import asyncio
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form

from app.services.pipeline import PipelineConfig, run as run_pipeline, update_progress, get_progress, clear_progress
from app.services.upload_to_supabase import run as run_upload
from app.schemas.pipeline import JobStatus, JobProgress

router = APIRouter()

DATA_DIR = Path("./data")


# Internal job status store (status only, progress is separate)
jobs: dict[str, dict] = {}


async def _run_job(job_id: str, scan_path: str, site_id: str, voxel_size: float):
    jobs[job_id]["status"] = "running"
    try:
        output_dir = str(DATA_DIR / "output" / job_id)
        cfg = PipelineConfig(voxel_size=voxel_size, site_id=site_id)

        # 전처리 (blocking → thread pool) - pass job_id for progress tracking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_pipeline, scan_path, output_dir, cfg, job_id)

        # Step 8: Supabase 적재
        update_progress(job_id, 7)
        await loop.run_in_executor(None, run_upload, output_dir, site_id)

        jobs[job_id]["status"] = "done"
        jobs[job_id]["summary"] = result["summary"]
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["message"] = str(e)
    finally:
        # Clean up progress entry after job completes
        clear_progress(job_id)


@router.post("/run")
async def start_pipeline(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    site_id: str = Form("SITE_001"),
    voxel_size: float = Form(0.05),
):
    """스캔 파일 업로드 → 백그라운드 전처리 + DB 적재 시작."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    scan_path = DATA_DIR / file.filename
    with open(scan_path, "wb") as f:
        f.write(await file.read())

    job_id = f"{site_id}_{scan_path.stem}"
    jobs[job_id] = {"status": "queued", "summary": None, "message": None}

    background_tasks.add_task(_run_job, job_id, str(scan_path), site_id, voxel_size)
    return {"job_id": job_id, "status": "queued"}


@router.get("/status/{job_id}", response_model=JobStatus)
def get_status(job_id: str):
    """
    파이프라인 실행 상태 폴링.

    Returns:
        JobStatus with progress information if job is running
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="job을 찾을 수 없습니다.")

    job = jobs[job_id]

    # Get progress if job is running
    progress = get_progress(job_id) if job["status"] == "running" else None

    return JobStatus(
        job_id=job_id,
        status=job["status"],
        progress=progress,
        summary=job.get("summary"),
        message=job.get("message")
    )

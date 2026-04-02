# Section 01: Backend Progress Tracking

**Section ID:** 01
**Status:** Pending
**Estimated Effort:** Low complexity, high visibility

---

## Background

The FACTOR Digital Twin system currently provides only a basic status field ("queued", "running", "done", "error") when users poll the pipeline status endpoint. Users have no visibility into which step of the 8-step LiDAR processing pipeline is currently executing, nor any percentage-based progress indication.

This section implements real-time pipeline progress tracking on the backend. Once complete, the `GET /pipeline/{job_id}` endpoint will return detailed progress information including the current step number, step name (in Korean), and overall percentage completion.

This is the foundational work that enables Section 02 (Frontend Progress Display) to show a visual progress bar and step checklist to users.

---

## Requirements

When this section is complete, the following must be true:

1. A `JobProgress` Pydantic schema exists with fields for `current_step`, `total_steps`, `step_name`, and `percentage`
2. An in-memory progress store (`_job_progress` dictionary) tracks progress for each job
3. A `PIPELINE_STEPS` list defines all 8 pipeline steps with Korean labels
4. Helper functions `update_progress()` and `get_progress()` exist in the pipeline service
5. The pipeline execution code calls `update_progress()` before each processing step
6. The status endpoint returns a `progress` object containing current step information
7. Progress percentage increases monotonically from 0 to 100 as steps complete

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| **Requires** | None | This section has no dependencies |
| **Blocks** | Section 02 | Frontend Progress Display depends on this endpoint returning progress data |

---

## Implementation Details

### Step 1: Create JobProgress Schema

Add the following schemas to handle progress data:

**File:** `backend/app/schemas/pipeline.py`

```python
from pydantic import BaseModel
from typing import Literal, Optional

class JobProgress(BaseModel):
    current_step: int
    total_steps: int
    step_name: str
    percentage: int

class JobStatus(BaseModel):
    job_id: str
    status: Literal["queued", "running", "done", "error"]
    progress: Optional[JobProgress] = None
    summary: Optional[dict] = None
    message: Optional[str] = None
```

### Step 2: Create In-Memory Progress Store

Add progress tracking infrastructure to the pipeline service:

**File:** `backend/app/services/pipeline.py`

```python
from typing import Dict, Optional
from app.schemas.pipeline import JobProgress

# In-memory progress store (keyed by job_id)
_job_progress: Dict[str, JobProgress] = {}

# Pipeline step definitions (Korean labels for UI)
PIPELINE_STEPS = [
    "파일 로드",           # Step 1: File load
    "복셀 다운샘플링",      # Step 2: Voxel downsampling
    "통계적 노이즈 제거",    # Step 3: Statistical noise removal
    "좌표 정규화",          # Step 4: Coordinate normalization
    "RANSAC 바닥 분리",     # Step 5: RANSAC floor separation
    "DBSCAN 설비 클러스터링", # Step 6: DBSCAN equipment clustering
    "메타데이터 태깅",       # Step 7: Metadata tagging
    "Supabase 적재",       # Step 8: Supabase upload
]

def update_progress(job_id: str, step_index: int) -> None:
    """
    Update progress for a job. Call this before each pipeline step.

    Args:
        job_id: The unique job identifier
        step_index: Zero-based index of the current step (0-7)
    """
    _job_progress[job_id] = JobProgress(
        current_step=step_index + 1,
        total_steps=len(PIPELINE_STEPS),
        step_name=PIPELINE_STEPS[step_index],
        percentage=int(((step_index + 1) / len(PIPELINE_STEPS)) * 100)
    )

def get_progress(job_id: str) -> Optional[JobProgress]:
    """
    Retrieve current progress for a job.

    Args:
        job_id: The unique job identifier

    Returns:
        JobProgress if job exists, None otherwise
    """
    return _job_progress.get(job_id)

def clear_progress(job_id: str) -> None:
    """
    Remove progress entry for a completed job (memory cleanup).

    Args:
        job_id: The unique job identifier
    """
    _job_progress.pop(job_id, None)
```

### Step 3: Update Pipeline Execution

Modify the pipeline processing function to call `update_progress()` before each step:

**File:** `backend/app/services/pipeline.py` (existing processing function)

```python
async def process_pipeline(job_id: str, file_path: str):
    try:
        # Step 0: File load
        update_progress(job_id, 0)
        point_cloud = load_ply_file(file_path)

        # Step 1: Voxel downsampling
        update_progress(job_id, 1)
        point_cloud = voxel_downsample(point_cloud)

        # Step 2: Statistical noise removal
        update_progress(job_id, 2)
        point_cloud = remove_noise(point_cloud)

        # Step 3: Coordinate normalization
        update_progress(job_id, 3)
        point_cloud = normalize_coordinates(point_cloud)

        # Step 4: RANSAC floor separation
        update_progress(job_id, 4)
        floor, equipment = ransac_floor_separation(point_cloud)

        # Step 5: DBSCAN equipment clustering
        update_progress(job_id, 5)
        clusters = dbscan_clustering(equipment)

        # Step 6: Metadata tagging
        update_progress(job_id, 6)
        tagged_equipment = tag_metadata(clusters)

        # Step 7: Supabase upload
        update_progress(job_id, 7)
        result = upload_to_supabase(tagged_equipment)

        # Mark job as done
        set_job_status(job_id, "done", summary=result)

    except Exception as e:
        set_job_status(job_id, "error", message=str(e))
    finally:
        # Clean up progress entry after job completes
        clear_progress(job_id)
```

### Step 4: Update Status Endpoint

Modify the status endpoint to include progress information:

**File:** `backend/app/api/endpoints/pipeline.py`

```python
from app.services.pipeline import get_progress, get_job_status_from_store
from app.schemas.pipeline import JobStatus

@router.get("/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """
    Get the current status and progress of a pipeline job.

    Returns:
        JobStatus with progress information if job is running
    """
    # Get basic status from store
    status_info = get_job_status_from_store(job_id)

    if status_info is None:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get progress if job is running
    progress = get_progress(job_id) if status_info["status"] == "running" else None

    return JobStatus(
        job_id=job_id,
        status=status_info["status"],
        progress=progress,
        summary=status_info.get("summary"),
        message=status_info.get("message")
    )
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/app/schemas/pipeline.py` | Create/Modify | Add `JobProgress` and `JobStatus` schemas |
| `backend/app/services/pipeline.py` | Modify | Add progress store, `PIPELINE_STEPS`, `update_progress()`, `get_progress()`, `clear_progress()` |
| `backend/app/api/endpoints/pipeline.py` | Modify | Update status endpoint to include progress in response |

---

## API Contract

### GET /pipeline/{job_id}

**Response (during processing):**

```json
{
  "job_id": "abc123",
  "status": "running",
  "progress": {
    "current_step": 3,
    "total_steps": 8,
    "step_name": "통계적 노이즈 제거",
    "percentage": 37
  },
  "summary": null,
  "message": null
}
```

**Response (completed):**

```json
{
  "job_id": "abc123",
  "status": "done",
  "progress": null,
  "summary": {
    "equipment_count": 42,
    "processing_time_ms": 15230
  },
  "message": null
}
```

**Response (error):**

```json
{
  "job_id": "abc123",
  "status": "error",
  "progress": null,
  "summary": null,
  "message": "Failed to parse PLY file: invalid header"
}
```

---

## Acceptance Criteria

- [ ] `GET /pipeline/{job_id}` returns a `progress` object when status is "running"
- [ ] `progress.current_step` correctly reflects the current pipeline step (1-8)
- [ ] `progress.total_steps` is always 8
- [ ] `progress.step_name` matches the Korean label for the current step
- [ ] `progress.percentage` increases monotonically from 12% to 100% as steps complete
- [ ] `progress` is `null` when job status is "queued", "done", or "error"
- [ ] Progress entries are cleaned up after job completion (no memory leak)

---

## Testing

### Manual Testing

1. Upload a LiDAR file to start a pipeline job
2. Poll `GET /pipeline/{job_id}` every 500ms
3. Verify progress values update as expected
4. Verify progress is null after completion

### Unit Tests

```python
# test_pipeline_progress.py

def test_update_progress_sets_correct_values():
    job_id = "test-123"
    update_progress(job_id, 0)
    progress = get_progress(job_id)

    assert progress.current_step == 1
    assert progress.total_steps == 8
    assert progress.step_name == "파일 로드"
    assert progress.percentage == 12

def test_progress_percentage_increases():
    job_id = "test-456"
    percentages = []

    for i in range(8):
        update_progress(job_id, i)
        percentages.append(get_progress(job_id).percentage)

    assert percentages == [12, 25, 37, 50, 62, 75, 87, 100]
    assert all(percentages[i] <= percentages[i+1] for i in range(len(percentages)-1))

def test_clear_progress_removes_entry():
    job_id = "test-789"
    update_progress(job_id, 3)
    assert get_progress(job_id) is not None

    clear_progress(job_id)
    assert get_progress(job_id) is None
```

---

## Notes

- The in-memory progress store is sufficient for a local development environment with FastAPI BackgroundTasks
- For production deployment with multiple workers, consider using Redis for shared progress state
- Memory cleanup via `clear_progress()` is important to prevent unbounded memory growth
- The 8-step structure matches the existing pipeline implementation

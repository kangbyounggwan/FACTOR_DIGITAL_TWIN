"""
FACTOR 디지털트윈 - LiDAR 전처리 파이프라인
흐름: E57/LAS 로드 → 다운샘플링 → 노이즈 제거 → 좌표 정규화 → 세그멘테이션 → 메타태깅 → DB 적재용 JSON 출력
"""

import json
import logging
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict

import numpy as np
import open3d as o3d

from app.services.loaders import load_pointcloud
from app.services.filters import voxel_downsample, remove_outliers
from app.services.normalize import normalize_coordinates
from app.services.segment import segment_floor, segment_equipment
from app.services.tagger import tag_metadata
from app.services.exporter import export_for_db
from app.schemas.pipeline import JobProgress

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


# ============ Progress Tracking ============

# In-memory progress store (keyed by job_id)
_job_progress: Dict[str, JobProgress] = {}

# Pipeline step definitions (Korean labels for UI)
PIPELINE_STEPS = [
    "파일 로드",              # Step 1: File load
    "복셀 다운샘플링",         # Step 2: Voxel downsampling
    "통계적 노이즈 제거",      # Step 3: Statistical noise removal
    "좌표 정규화",            # Step 4: Coordinate normalization
    "RANSAC 바닥 분리",       # Step 5: RANSAC floor separation
    "DBSCAN 설비 클러스터링",  # Step 6: DBSCAN equipment clustering
    "메타데이터 태깅",         # Step 7: Metadata tagging
    "Supabase 적재",         # Step 8: Supabase upload
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
    log.info(f"[Progress] Job {job_id}: Step {step_index + 1}/{len(PIPELINE_STEPS)} - {PIPELINE_STEPS[step_index]}")


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


# ============ Pipeline Config ============


@dataclass
class PipelineConfig:
    # 다운샘플링
    voxel_size: float = 0.05          # 5cm 격자 — 제조현장 기준 적합
    # 노이즈 제거
    nb_neighbors: int = 20
    std_ratio: float = 2.0
    # 바닥면 RANSAC
    floor_distance_threshold: float = 0.02
    floor_ransac_n: int = 3
    floor_num_iterations: int = 1000
    # 설비 클러스터링
    cluster_eps: float = 0.3          # 30cm 이내 포인트 = 같은 설비
    cluster_min_points: int = 50
    # 현장 메타
    site_id: str = "SITE_001"
    scan_date: str = ""               # ISO 8601, 비워두면 오늘 날짜
    operator: str = ""
    extra: dict = field(default_factory=dict)


def run(input_path: str, output_dir: str, config: Optional[PipelineConfig] = None, job_id: Optional[str] = None) -> dict:
    """
    Run the LiDAR processing pipeline.

    Args:
        input_path: Path to input scan file
        output_dir: Output directory for processed data
        config: Pipeline configuration
        job_id: Optional job ID for progress tracking
    """
    cfg = config or PipelineConfig()
    src = Path(input_path)
    dst = Path(output_dir)
    dst.mkdir(parents=True, exist_ok=True)

    # Step 1: 파일 로드
    if job_id:
        update_progress(job_id, 0)
    log.info(f"[1/7] 로드: {src.name}")
    pcd = load_pointcloud(str(src))
    log.info(f"      포인트 수: {len(pcd.points):,}")

    # Step 2: 복셀 다운샘플링
    if job_id:
        update_progress(job_id, 1)
    log.info("[2/7] 다운샘플링")
    pcd = voxel_downsample(pcd, cfg.voxel_size)
    log.info(f"      → {len(pcd.points):,} 포인트")

    # Step 3: 통계적 노이즈 제거
    if job_id:
        update_progress(job_id, 2)
    log.info("[3/7] 노이즈 제거")
    pcd = remove_outliers(pcd, cfg.nb_neighbors, cfg.std_ratio)
    log.info(f"      → {len(pcd.points):,} 포인트")

    # Step 4: 좌표 정규화
    if job_id:
        update_progress(job_id, 3)
    log.info("[4/7] 좌표 정규화")
    pcd, origin = normalize_coordinates(pcd)

    # Step 5: RANSAC 바닥 분리
    if job_id:
        update_progress(job_id, 4)
    log.info("[5/7] RANSAC 바닥 분리")
    floor_pcd, non_floor_pcd = segment_floor(
        pcd,
        cfg.floor_distance_threshold,
        cfg.floor_ransac_n,
        cfg.floor_num_iterations,
    )

    # Step 6: DBSCAN 설비 클러스터링
    if job_id:
        update_progress(job_id, 5)
    log.info("[6/7] DBSCAN 설비 클러스터링")
    equipment_clusters = segment_equipment(
        non_floor_pcd,
        cfg.cluster_eps,
        cfg.cluster_min_points,
    )
    log.info(f"      바닥 포인트: {len(floor_pcd.points):,} | 설비 클러스터: {len(equipment_clusters)}개")

    # Step 7: 메타데이터 태깅 및 내보내기
    if job_id:
        update_progress(job_id, 6)
    log.info("[7/7] 메타데이터 태깅 및 내보내기")
    tagged = tag_metadata(equipment_clusters, cfg.site_id, cfg.scan_date, cfg.operator)
    result = export_for_db(
        floor_pcd=floor_pcd,
        equipment_clusters=tagged,
        origin=origin,
        site_id=cfg.site_id,
        output_dir=str(dst),
    )

    summary_path = dst / "pipeline_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(result["summary"], f, ensure_ascii=False, indent=2)

    log.info(f"완료 → {dst}")
    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="FACTOR LiDAR 전처리 파이프라인")
    parser.add_argument("input", help="E57 / LAS / PLY 파일 경로")
    parser.add_argument("output", help="결과 저장 디렉토리")
    parser.add_argument("--voxel-size", type=float, default=0.05)
    parser.add_argument("--site-id", default="SITE_001")
    parser.add_argument("--scan-date", default="")
    parser.add_argument("--operator", default="")
    args = parser.parse_args()

    cfg = PipelineConfig(
        voxel_size=args.voxel_size,
        site_id=args.site_id,
        scan_date=args.scan_date,
        operator=args.operator,
    )
    run(args.input, args.output, cfg)

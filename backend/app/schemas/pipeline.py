from pydantic import BaseModel
from typing import Literal, Optional


class JobProgress(BaseModel):
    """파이프라인 진행 상태"""
    current_step: int       # 현재 단계 (1-8)
    total_steps: int        # 전체 단계 수 (8)
    step_name: str          # 현재 단계 이름 (한글)
    percentage: int         # 진행률 (0-100)


class JobStatus(BaseModel):
    """파이프라인 작업 상태"""
    job_id: str
    status: Literal["queued", "running", "done", "error"]
    progress: Optional[JobProgress] = None
    summary: Optional[dict] = None
    message: Optional[str] = None

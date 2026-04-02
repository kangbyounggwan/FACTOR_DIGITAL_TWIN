from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class EquipmentGroupCreate(BaseModel):
    """설비 그룹 생성 요청."""
    line_id: str
    name: str
    group_type: str = "BRIDGE"
    description: Optional[str] = None
    equipment_ids: List[str] = []  # 초기 멤버 설비 ID 목록


class EquipmentGroupUpdate(BaseModel):
    """설비 그룹 수정 요청."""
    name: Optional[str] = None
    group_type: Optional[str] = None
    description: Optional[str] = None


class EquipmentGroupMemberUpdate(BaseModel):
    """그룹 멤버 추가/제거 요청."""
    equipment_ids: List[str]


class EquipmentGroupOut(BaseModel):
    """설비 그룹 응답."""
    id: str
    line_id: str
    name: str
    group_type: str
    description: Optional[str]
    centroid_x: Optional[float]
    centroid_y: Optional[float]
    centroid_z: Optional[float]
    size_w: Optional[float]
    size_h: Optional[float]
    size_d: Optional[float]
    member_count: int = 0
    member_ids: List[str] = []
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}

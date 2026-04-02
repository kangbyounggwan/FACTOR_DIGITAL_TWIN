from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
import math


class EquipmentCreate(BaseModel):
    """설비 생성 요청 모델."""
    line_id: str
    scan_code: str
    name: Optional[str] = ""
    equipment_type: Optional[str] = "UNKNOWN"
    zone: Optional[str] = ""
    centroid_x: float = 0.0
    centroid_y: float = 0.0
    centroid_z: float = 0.0
    size_w: float = 1.0
    size_h: float = 1.0
    size_d: float = 1.0
    note: Optional[str] = ""


class EquipmentUpdate(BaseModel):
    name:           Optional[str] = None
    equipment_type: Optional[str] = None
    zone:           Optional[str] = None
    verified:       Optional[bool] = None
    note:           Optional[str] = None
    # Position and size fields
    centroid_x:     Optional[float] = None
    centroid_y:     Optional[float] = None
    centroid_z:     Optional[float] = None
    size_w:         Optional[float] = None
    size_d:         Optional[float] = None
    size_h:         Optional[float] = None


class SplitRequest(BaseModel):
    plane_point: List[float]
    plane_normal: List[float]

    @field_validator('plane_point')
    @classmethod
    def validate_plane_point(cls, v: List[float]) -> List[float]:
        if len(v) != 3:
            raise ValueError('plane_point must have exactly 3 coordinates')
        return v

    @field_validator('plane_normal')
    @classmethod
    def validate_plane_normal(cls, v: List[float]) -> List[float]:
        if len(v) != 3:
            raise ValueError('plane_normal must have exactly 3 coordinates')
        magnitude = math.sqrt(sum(x**2 for x in v))
        if magnitude < 1e-10:
            raise ValueError('plane_normal cannot be a zero vector')
        return v


class EquipmentOut(BaseModel):
    """Equipment response model for split operation."""
    equipment_id: str
    site_id: str
    equipment_type: str
    zone: str
    centroid_x: float
    centroid_y: float
    centroid_z: float
    size_w: float
    size_h: float
    size_d: float
    point_count: int
    verified: bool

    model_config = {"from_attributes": True}


class SplitResponse(BaseModel):
    equipment_a: EquipmentOut
    equipment_b: EquipmentOut
    original_id: str


class PointsUpdateRequest(BaseModel):
    """Request body for updating equipment points."""
    exclude_indices: Optional[List[int]] = None  # Points to remove
    include_indices: Optional[List[int]] = None  # Points to add (from another equipment)
    source_equipment_id: Optional[str] = None    # Required if include_indices is provided


class PointsUpdateResponse(BaseModel):
    """Response after updating equipment points."""
    equipment_id: str
    point_count: int
    centroid_x: float
    centroid_y: float
    centroid_z: float
    size_w: float
    size_h: float
    size_d: float

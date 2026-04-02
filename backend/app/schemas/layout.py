"""
Layout schemas for FACTOR Digital Twin - Layout Versioning API
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class LayoutEquipmentBase(BaseModel):
    """Equipment position snapshot within a layout."""
    equipment_id: str  # scan_code (e.g., "EQ_001")
    centroid_x: float
    centroid_y: float
    centroid_z: float
    size_w: float
    size_h: float
    size_d: float
    rotation_x: float = 0.0
    rotation_y: float = 0.0
    rotation_z: float = 0.0


class LayoutEquipmentCreate(LayoutEquipmentBase):
    """Request body for adding equipment to a layout."""
    pass


class LayoutEquipmentOut(LayoutEquipmentBase):
    """Equipment position response."""
    id: UUID

    model_config = {"from_attributes": True}


class LayoutBase(BaseModel):
    """Layout metadata base."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    # 공장 바닥 설정
    floor_x: Optional[float] = None
    floor_y: Optional[float] = None
    floor_width: Optional[float] = None
    floor_height: Optional[float] = None
    # 배경 이미지 설정
    background_image: Optional[str] = None
    background_opacity: Optional[float] = 0.5


class LayoutCreate(LayoutBase):
    """Request body for creating a new layout."""
    factory_id: UUID
    equipment: Optional[List[LayoutEquipmentCreate]] = None
    is_active: bool = False


class LayoutUpdate(BaseModel):
    """Request body for updating layout metadata."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    # 공장 바닥 설정
    floor_x: Optional[float] = None
    floor_y: Optional[float] = None
    floor_width: Optional[float] = None
    floor_height: Optional[float] = None
    # 배경 이미지 설정
    background_image: Optional[str] = None
    background_opacity: Optional[float] = None


class LayoutOut(LayoutBase):
    """Layout response (list view)."""
    id: UUID
    factory_id: UUID
    is_active: bool
    equipment_count: int = 0
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LayoutDetailOut(LayoutOut):
    """Layout response with equipment positions (detail view)."""
    equipment: List[LayoutEquipmentOut] = []


class LayoutActivateResponse(BaseModel):
    """Response after activating a layout."""
    activated_id: UUID
    deactivated_ids: List[UUID] = []


class LayoutCloneRequest(BaseModel):
    """Request body for cloning a layout."""
    new_name: str = Field(..., min_length=1, max_length=100)
    new_description: Optional[str] = None


class LayoutCompareResponse(BaseModel):
    """Response for comparing two layouts."""
    added: List[str] = []      # Equipment IDs (scan_code) only in layout B
    removed: List[str] = []    # Equipment IDs (scan_code) only in layout A
    moved: List[str] = []      # Equipment IDs (scan_code) with different positions


class SaveLayoutFromViewerRequest(BaseModel):
    """Request body for saving current viewer state as layout."""
    factory_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    equipment: List[LayoutEquipmentCreate]
    set_active: bool = False
    # 공장 바닥 설정
    floor_x: Optional[float] = None
    floor_y: Optional[float] = None
    floor_width: Optional[float] = None
    floor_height: Optional[float] = None
    # 배경 이미지 설정
    background_image: Optional[str] = None
    background_opacity: Optional[float] = 0.5

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FlowConnectionCreate(BaseModel):
    factory_id: str
    name: str
    description: Optional[str] = None
    source_equipment_id: str
    target_equipment_id: str
    color: str = "#ff8800"
    line_style: str = "solid"


class FlowConnectionOut(BaseModel):
    id: str
    factory_id: str
    name: str
    description: Optional[str] = None
    source_equipment_id: str
    target_equipment_id: str
    color: str
    line_style: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

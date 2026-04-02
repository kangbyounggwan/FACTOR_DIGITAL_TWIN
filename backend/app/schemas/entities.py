"""
Pydantic schemas for Company, Factory, and Line CRUD operations.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID
import re


# =============================================================================
# COMPANY SCHEMAS
# =============================================================================

class CompanyCreate(BaseModel):
    """Schema for creating a new company."""
    code: str = Field(..., min_length=1, max_length=50, description="Unique company code")
    name: str = Field(..., min_length=1, max_length=200, description="Company display name")
    description: Optional[str] = Field(None, max_length=1000, description="Company description")
    logo_url: Optional[str] = Field(None, max_length=500, description="URL to company logo")

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate code format: alphanumeric, hyphens, underscores only."""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Code must contain only alphanumeric characters, hyphens, and underscores')
        return v.upper()  # Normalize to uppercase


class CompanyUpdate(BaseModel):
    """Schema for updating an existing company."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    logo_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class CompanyOut(BaseModel):
    """Schema for company response."""
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class CompanyDeleteInfo(BaseModel):
    """Schema for delete impact information."""
    company_id: UUID
    company_name: str
    factory_count: int
    line_count: int
    equipment_count: int


# =============================================================================
# FACTORY SCHEMAS
# =============================================================================

class FactoryCreate(BaseModel):
    """Schema for creating a new factory."""
    company_id: UUID = Field(..., description="Parent company UUID")
    code: str = Field(..., min_length=1, max_length=50, description="Unique factory code")
    name: str = Field(..., min_length=1, max_length=200, description="Factory display name")
    address: Optional[str] = Field(None, max_length=500, description="Factory address")

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate code format: alphanumeric, hyphens, underscores only."""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Code must contain only alphanumeric characters, hyphens, and underscores')
        return v.upper()


class FactoryUpdate(BaseModel):
    """Schema for updating an existing factory."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class FactoryOut(BaseModel):
    """Schema for factory response."""
    id: UUID
    company_id: UUID
    code: str
    name: str
    address: Optional[str] = None
    is_active: bool = True
    company_name: Optional[str] = None  # Joined from companies table

    model_config = {"from_attributes": True}


class FactoryDeleteInfo(BaseModel):
    """Schema for delete impact information."""
    factory_id: UUID
    factory_name: str
    line_count: int
    equipment_count: int
    layout_count: int


# =============================================================================
# LINE SCHEMAS
# =============================================================================

class LineCreate(BaseModel):
    """Schema for creating a new production line."""
    factory_id: UUID = Field(..., description="Parent factory UUID")
    code: str = Field(..., min_length=1, max_length=50, description="Unique line code")
    name: str = Field(..., min_length=1, max_length=200, description="Line display name")
    description: Optional[str] = Field(None, max_length=1000, description="Line description")
    building: Optional[str] = Field(None, max_length=100, description="Building name/number")
    floor: Optional[str] = Field(None, max_length=50, description="Floor number")
    area: Optional[str] = Field(None, max_length=100, description="Area within floor")
    sort_order: Optional[int] = Field(0, ge=0, description="Display sort order")

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate code format: alphanumeric, hyphens, underscores only."""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Code must contain only alphanumeric characters, hyphens, and underscores')
        return v.upper()


class LineUpdate(BaseModel):
    """Schema for updating an existing production line."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    building: Optional[str] = Field(None, max_length=100)
    floor: Optional[str] = Field(None, max_length=50)
    area: Optional[str] = Field(None, max_length=100)
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class LineOut(BaseModel):
    """Schema for line response."""
    id: UUID
    factory_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    area: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    factory_name: Optional[str] = None  # Joined from factories table
    factory_code: Optional[str] = None  # Joined from factories table

    model_config = {"from_attributes": True}


class LineDeleteInfo(BaseModel):
    """Schema for delete impact information."""
    line_id: UUID
    line_name: str
    equipment_count: int

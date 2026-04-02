# Section 06: Company/Factory/Line CRUD API

**Status:** Pending
**Estimated Effort:** 4-5 hours
**Track:** B (CRUD)

---

## Background

The FACTOR Digital Twin system currently has read-only APIs for companies, factories, and production lines. The existing endpoints support only listing and retrieval operations:

- `GET /api/companies/` - List active companies
- `GET /api/companies/{company_code}/factories` - List factories for a company
- `GET /api/factories/` - List all factories
- `GET /api/factories/{factory_code}` - Get single factory
- `GET /api/factories/{factory_code}/lines` - List production lines

To support full admin functionality, we need complete CRUD (Create, Read, Update, Delete) operations for all three entity types. The delete operations must be safe and cascade properly to child entities (handled by Section 05: CASCADE FK).

**Why This Matters:**
- Administrators need to manage the organizational hierarchy (Company > Factory > Line)
- Before deleting an entity, users need to see what child data will be affected
- The system must prevent orphaned records and maintain referential integrity

---

## Dependencies

### Requires (must be completed first)

| Section | Reason |
|---------|--------|
| **Section 05: CASCADE FK** | DELETE operations rely on CASCADE constraints to automatically remove child records. Without this, deletes will fail with FK constraint violations. |

### Blocks (cannot start until this section is complete)

| Section | Reason |
|---------|--------|
| **Section 07: CRUD Hooks** | Frontend hooks need these API endpoints to call |
| **Section 08: Admin Page** | The admin UI depends on working CRUD APIs |

### Parallelizable With

| Section | Reason |
|---------|--------|
| **Section 02: Layout API** | Different API domain, no conflicts |

---

## Requirements

When this section is complete, the following must be true:

1. **Company CRUD:**
   - POST `/api/companies/` creates a new company
   - PUT `/api/companies/{id}` updates an existing company
   - DELETE `/api/companies/{id}` deletes a company and all children
   - GET `/api/companies/{id}/delete-info` returns count of affected child records

2. **Factory CRUD:**
   - POST `/api/factories/` creates a new factory
   - PUT `/api/factories/{id}` updates an existing factory
   - DELETE `/api/factories/{id}` deletes a factory and all children
   - GET `/api/factories/{id}/delete-info` returns count of affected child records

3. **Line CRUD:**
   - GET `/api/lines/` lists all production lines
   - GET `/api/lines/{id}` gets a single line by ID
   - POST `/api/lines/` creates a new production line
   - PUT `/api/lines/{id}` updates an existing production line
   - DELETE `/api/lines/{id}` deletes a line and all children
   - GET `/api/lines/{id}/delete-info` returns count of affected equipment

4. **Data Validation:**
   - All required fields are validated
   - Code uniqueness is enforced
   - Parent entity existence is verified before create

5. **Error Handling:**
   - 404 returned for non-existent entities
   - 400 returned for validation errors
   - 409 returned for duplicate codes

---

## Implementation Details

### Database Schema Reference

The relevant tables (already exist in Supabase):

```sql
-- companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- factories table
CREATE TABLE factories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- production_lines table
CREATE TABLE production_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    building VARCHAR(100),
    floor VARCHAR(50),
    area VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### File 1: entities.py (CREATE)

**Path:** `backend/app/schemas/entities.py`

This file defines all Pydantic models for CRUD operations on companies, factories, and lines.

```python
# backend/app/schemas/entities.py
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
    is_active: bool

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
    is_active: bool
    company_name: Optional[str] = None  # Joined from companies table

    model_config = {"from_attributes": True}


class FactoryDeleteInfo(BaseModel):
    """Schema for delete impact information."""
    factory_id: UUID
    factory_name: str
    line_count: int
    equipment_count: int


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
    sort_order: int
    is_active: bool
    factory_name: Optional[str] = None  # Joined from factories table
    factory_code: Optional[str] = None  # Joined from factories table

    model_config = {"from_attributes": True}


class LineDeleteInfo(BaseModel):
    """Schema for delete impact information."""
    line_id: UUID
    line_name: str
    equipment_count: int
```

---

### File 2: companies.py (MODIFY)

**Path:** `backend/app/api/companies.py`

Add CREATE, UPDATE, DELETE endpoints and delete-info endpoint to the existing companies router.

```python
# backend/app/api/companies.py
"""
Company API endpoints - CRUD operations for company management.
"""
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from uuid import UUID

from app.core.supabase import get_supabase
from app.schemas.entities import (
    CompanyCreate,
    CompanyUpdate,
    CompanyOut,
    CompanyDeleteInfo,
)

router = APIRouter()


# =============================================================================
# EXISTING ENDPOINTS (keep these)
# =============================================================================

@router.get("/")
def list_companies(db: Client = Depends(get_supabase)):
    """List all active companies."""
    resp = (
        db.table("companies")
        .select("id, code, name, description, logo_url")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    return [
        {
            "id": c["id"],
            "code": c["code"],
            "name": c["name"],
            "description": c.get("description"),
            "logo_url": c.get("logo_url"),
        }
        for c in resp.data
    ]


@router.get("/{company_code}/factories")
def list_company_factories(company_code: str, db: Client = Depends(get_supabase)):
    """List factories for a specific company by code."""
    # Get company ID
    company_resp = (
        db.table("companies")
        .select("id")
        .eq("code", company_code)
        .single()
        .execute()
    )

    if not company_resp.data:
        raise HTTPException(status_code=404, detail="Company not found")

    company_id = company_resp.data["id"]

    # Get factories
    resp = (
        db.table("factories")
        .select("id, code, name, address")
        .eq("company_id", company_id)
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    return [
        {
            "id": f["id"],
            "code": f["code"],
            "name": f["name"],
            "address": f.get("address"),
        }
        for f in resp.data
    ]


# =============================================================================
# NEW CRUD ENDPOINTS
# =============================================================================

@router.post("/", response_model=CompanyOut, status_code=201)
def create_company(body: CompanyCreate, db: Client = Depends(get_supabase)):
    """
    Create a new company.

    - **code**: Unique company identifier (will be uppercased)
    - **name**: Company display name
    - **description**: Optional description
    - **logo_url**: Optional URL to company logo
    """
    # Check for duplicate code
    existing = (
        db.table("companies")
        .select("id")
        .eq("code", body.code)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=f"Company with code '{body.code}' already exists"
        )

    # Insert new company
    result = db.table("companies").insert({
        "code": body.code,
        "name": body.name,
        "description": body.description,
        "logo_url": body.logo_url,
        "is_active": True,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create company")

    company = result.data[0]
    return CompanyOut(
        id=company["id"],
        code=company["code"],
        name=company["name"],
        description=company.get("description"),
        logo_url=company.get("logo_url"),
        is_active=company["is_active"],
    )


@router.get("/{company_id}/detail", response_model=CompanyOut)
def get_company_by_id(company_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get a single company by UUID.
    """
    resp = (
        db.table("companies")
        .select("id, code, name, description, logo_url, is_active")
        .eq("id", str(company_id))
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Company not found")

    c = resp.data
    return CompanyOut(
        id=c["id"],
        code=c["code"],
        name=c["name"],
        description=c.get("description"),
        logo_url=c.get("logo_url"),
        is_active=c["is_active"],
    )


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: UUID,
    body: CompanyUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update an existing company.

    Only provided fields will be updated. Code cannot be changed.
    """
    # Build update dict with only non-None values
    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.description is not None:
        update_data["description"] = body.description
    if body.logo_url is not None:
        update_data["logo_url"] = body.logo_url
    if body.is_active is not None:
        update_data["is_active"] = body.is_active

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Perform update
    result = (
        db.table("companies")
        .update(update_data)
        .eq("id", str(company_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Company not found")

    company = result.data[0]
    return CompanyOut(
        id=company["id"],
        code=company["code"],
        name=company["name"],
        description=company.get("description"),
        logo_url=company.get("logo_url"),
        is_active=company["is_active"],
    )


@router.get("/{company_id}/delete-info", response_model=CompanyDeleteInfo)
def get_company_delete_info(company_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get information about what will be deleted if this company is deleted.

    Returns counts of factories, lines, and equipment that will be cascade deleted.
    """
    # Get company
    company_resp = (
        db.table("companies")
        .select("id, name")
        .eq("id", str(company_id))
        .single()
        .execute()
    )

    if not company_resp.data:
        raise HTTPException(status_code=404, detail="Company not found")

    company = company_resp.data

    # Count factories
    factories_resp = (
        db.table("factories")
        .select("id", count="exact")
        .eq("company_id", str(company_id))
        .execute()
    )
    factory_count = factories_resp.count or 0

    # Get factory IDs for counting lines
    factory_ids = [f["id"] for f in factories_resp.data] if factories_resp.data else []

    # Count lines
    line_count = 0
    equipment_count = 0

    if factory_ids:
        lines_resp = (
            db.table("production_lines")
            .select("id", count="exact")
            .in_("factory_id", factory_ids)
            .execute()
        )
        line_count = lines_resp.count or 0

        # Get line IDs for counting equipment
        line_ids = [ln["id"] for ln in lines_resp.data] if lines_resp.data else []

        if line_ids:
            equipment_resp = (
                db.table("equipment_scans")
                .select("id", count="exact")
                .in_("line_id", line_ids)
                .execute()
            )
            equipment_count = equipment_resp.count or 0

    return CompanyDeleteInfo(
        company_id=company["id"],
        company_name=company["name"],
        factory_count=factory_count,
        line_count=line_count,
        equipment_count=equipment_count,
    )


@router.delete("/{company_id}")
def delete_company(company_id: UUID, db: Client = Depends(get_supabase)):
    """
    Delete a company and all its children (factories, lines, equipment).

    This is a cascading delete - all related data will be permanently removed.
    Use GET /companies/{id}/delete-info first to see what will be deleted.
    """
    # Verify company exists
    check_resp = (
        db.table("companies")
        .select("id")
        .eq("id", str(company_id))
        .single()
        .execute()
    )

    if not check_resp.data:
        raise HTTPException(status_code=404, detail="Company not found")

    # Delete (CASCADE will handle children)
    result = (
        db.table("companies")
        .delete()
        .eq("id", str(company_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to delete company")

    return {"message": "Company and all children deleted successfully"}
```

---

### File 3: factories.py (MODIFY)

**Path:** `backend/app/api/factories.py`

Add CREATE, UPDATE, DELETE endpoints and delete-info endpoint to the existing factories router.

```python
# backend/app/api/factories.py
"""
Factory API endpoints - CRUD operations for factory management.
"""
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from uuid import UUID

from app.core.supabase import get_supabase
from app.schemas.entities import (
    FactoryCreate,
    FactoryUpdate,
    FactoryOut,
    FactoryDeleteInfo,
)

router = APIRouter()


# =============================================================================
# EXISTING ENDPOINTS (keep these)
# =============================================================================

@router.get("/")
def list_factories(db: Client = Depends(get_supabase)):
    """List all active factories."""
    resp = (
        db.table("factories")
        .select("id, code, name, address, companies(name)")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    result = []
    for f in resp.data:
        result.append({
            "id": f["id"],
            "code": f["code"],
            "name": f["name"],
            "address": f.get("address"),
            "company_name": f.get("companies", {}).get("name") if f.get("companies") else None,
        })
    return result


@router.get("/{factory_code}")
def get_factory(factory_code: str, db: Client = Depends(get_supabase)):
    """Get a single factory by code."""
    resp = (
        db.table("factories")
        .select("id, code, name, address, companies(name)")
        .eq("code", factory_code)
        .eq("is_active", True)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    f = resp.data
    return {
        "id": f["id"],
        "code": f["code"],
        "name": f["name"],
        "address": f.get("address"),
        "company_name": f.get("companies", {}).get("name") if f.get("companies") else None,
    }


@router.get("/{factory_code}/lines")
def list_production_lines(factory_code: str, db: Client = Depends(get_supabase)):
    """List production lines for a specific factory."""
    # Get factory ID
    factory_resp = (
        db.table("factories")
        .select("id")
        .eq("code", factory_code)
        .single()
        .execute()
    )

    if not factory_resp.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    factory_id = factory_resp.data["id"]

    # Get lines
    resp = (
        db.table("production_lines")
        .select("id, code, name, description, building, floor, area")
        .eq("factory_id", factory_id)
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )

    # Get equipment count per line
    result = []
    for line in resp.data:
        # Count equipment scans
        count_resp = (
            db.table("equipment_scans")
            .select("id", count="exact")
            .eq("line_id", line["id"])
            .execute()
        )

        result.append({
            "id": line["id"],
            "code": line["code"],
            "name": line["name"],
            "description": line.get("description"),
            "location": f"{line.get('building', '')} {line.get('floor', '')} {line.get('area', '')}".strip(),
            "equipment_count": count_resp.count or 0,
        })

    return result


@router.get("/lines/{line_code}")
def get_production_line(line_code: str, db: Client = Depends(get_supabase)):
    """Get a single production line by code."""
    resp = (
        db.table("production_lines")
        .select("*, factories(code, name)")
        .eq("code", line_code)
        .eq("is_active", True)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Line not found")

    line = resp.data
    return {
        "id": line["id"],
        "code": line["code"],
        "name": line["name"],
        "description": line.get("description"),
        "factory_code": line.get("factories", {}).get("code") if line.get("factories") else None,
        "factory_name": line.get("factories", {}).get("name") if line.get("factories") else None,
    }


# =============================================================================
# NEW CRUD ENDPOINTS
# =============================================================================

@router.post("/", response_model=FactoryOut, status_code=201)
def create_factory(body: FactoryCreate, db: Client = Depends(get_supabase)):
    """
    Create a new factory.

    - **company_id**: UUID of parent company (must exist)
    - **code**: Unique factory identifier (will be uppercased)
    - **name**: Factory display name
    - **address**: Optional factory address
    """
    # Verify parent company exists
    company_resp = (
        db.table("companies")
        .select("id, name")
        .eq("id", str(body.company_id))
        .single()
        .execute()
    )

    if not company_resp.data:
        raise HTTPException(
            status_code=400,
            detail=f"Parent company with ID '{body.company_id}' not found"
        )

    # Check for duplicate code
    existing = (
        db.table("factories")
        .select("id")
        .eq("code", body.code)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=f"Factory with code '{body.code}' already exists"
        )

    # Insert new factory
    result = db.table("factories").insert({
        "company_id": str(body.company_id),
        "code": body.code,
        "name": body.name,
        "address": body.address,
        "is_active": True,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create factory")

    factory = result.data[0]
    return FactoryOut(
        id=factory["id"],
        company_id=factory["company_id"],
        code=factory["code"],
        name=factory["name"],
        address=factory.get("address"),
        is_active=factory["is_active"],
        company_name=company_resp.data["name"],
    )


@router.get("/by-id/{factory_id}", response_model=FactoryOut)
def get_factory_by_id(factory_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get a single factory by UUID.
    """
    resp = (
        db.table("factories")
        .select("id, company_id, code, name, address, is_active, companies(name)")
        .eq("id", str(factory_id))
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    f = resp.data
    return FactoryOut(
        id=f["id"],
        company_id=f["company_id"],
        code=f["code"],
        name=f["name"],
        address=f.get("address"),
        is_active=f["is_active"],
        company_name=f.get("companies", {}).get("name") if f.get("companies") else None,
    )


@router.put("/{factory_id}", response_model=FactoryOut)
def update_factory(
    factory_id: UUID,
    body: FactoryUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update an existing factory.

    Only provided fields will be updated. Code and company_id cannot be changed.
    """
    # Build update dict with only non-None values
    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.address is not None:
        update_data["address"] = body.address
    if body.is_active is not None:
        update_data["is_active"] = body.is_active

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Perform update
    result = (
        db.table("factories")
        .update(update_data)
        .eq("id", str(factory_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    # Fetch complete data with company name
    factory = result.data[0]
    company_resp = (
        db.table("companies")
        .select("name")
        .eq("id", factory["company_id"])
        .single()
        .execute()
    )

    return FactoryOut(
        id=factory["id"],
        company_id=factory["company_id"],
        code=factory["code"],
        name=factory["name"],
        address=factory.get("address"),
        is_active=factory["is_active"],
        company_name=company_resp.data["name"] if company_resp.data else None,
    )


@router.get("/{factory_id}/delete-info", response_model=FactoryDeleteInfo)
def get_factory_delete_info(factory_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get information about what will be deleted if this factory is deleted.

    Returns counts of lines and equipment that will be cascade deleted.
    """
    # Get factory
    factory_resp = (
        db.table("factories")
        .select("id, name")
        .eq("id", str(factory_id))
        .single()
        .execute()
    )

    if not factory_resp.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    factory = factory_resp.data

    # Count lines
    lines_resp = (
        db.table("production_lines")
        .select("id", count="exact")
        .eq("factory_id", str(factory_id))
        .execute()
    )
    line_count = lines_resp.count or 0

    # Get line IDs for counting equipment
    line_ids = [ln["id"] for ln in lines_resp.data] if lines_resp.data else []

    equipment_count = 0
    if line_ids:
        equipment_resp = (
            db.table("equipment_scans")
            .select("id", count="exact")
            .in_("line_id", line_ids)
            .execute()
        )
        equipment_count = equipment_resp.count or 0

    return FactoryDeleteInfo(
        factory_id=factory["id"],
        factory_name=factory["name"],
        line_count=line_count,
        equipment_count=equipment_count,
    )


@router.delete("/{factory_id}")
def delete_factory(factory_id: UUID, db: Client = Depends(get_supabase)):
    """
    Delete a factory and all its children (lines, equipment).

    This is a cascading delete - all related data will be permanently removed.
    Use GET /factories/{id}/delete-info first to see what will be deleted.
    """
    # Verify factory exists
    check_resp = (
        db.table("factories")
        .select("id")
        .eq("id", str(factory_id))
        .single()
        .execute()
    )

    if not check_resp.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    # Delete (CASCADE will handle children)
    result = (
        db.table("factories")
        .delete()
        .eq("id", str(factory_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to delete factory")

    return {"message": "Factory and all children deleted successfully"}
```

---

### File 4: lines.py (CREATE)

**Path:** `backend/app/api/lines.py`

Create a new dedicated router for production lines with full CRUD operations.

```python
# backend/app/api/lines.py
"""
Production Line API endpoints - CRUD operations for line management.
"""
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from uuid import UUID
from typing import List

from app.core.supabase import get_supabase
from app.schemas.entities import (
    LineCreate,
    LineUpdate,
    LineOut,
    LineDeleteInfo,
)

router = APIRouter()


@router.get("/", response_model=List[LineOut])
def list_lines(
    factory_id: UUID = None,
    include_inactive: bool = False,
    db: Client = Depends(get_supabase)
):
    """
    List all production lines.

    - **factory_id**: Optional filter by factory UUID
    - **include_inactive**: If true, include inactive lines
    """
    query = (
        db.table("production_lines")
        .select("id, factory_id, code, name, description, building, floor, area, sort_order, is_active, factories(code, name)")
    )

    if factory_id:
        query = query.eq("factory_id", str(factory_id))

    if not include_inactive:
        query = query.eq("is_active", True)

    resp = query.order("sort_order").execute()

    return [
        LineOut(
            id=ln["id"],
            factory_id=ln["factory_id"],
            code=ln["code"],
            name=ln["name"],
            description=ln.get("description"),
            building=ln.get("building"),
            floor=ln.get("floor"),
            area=ln.get("area"),
            sort_order=ln.get("sort_order", 0),
            is_active=ln["is_active"],
            factory_name=ln.get("factories", {}).get("name") if ln.get("factories") else None,
            factory_code=ln.get("factories", {}).get("code") if ln.get("factories") else None,
        )
        for ln in resp.data
    ]


@router.get("/{line_id}", response_model=LineOut)
def get_line(line_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get a single production line by UUID.
    """
    resp = (
        db.table("production_lines")
        .select("id, factory_id, code, name, description, building, floor, area, sort_order, is_active, factories(code, name)")
        .eq("id", str(line_id))
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Line not found")

    ln = resp.data
    return LineOut(
        id=ln["id"],
        factory_id=ln["factory_id"],
        code=ln["code"],
        name=ln["name"],
        description=ln.get("description"),
        building=ln.get("building"),
        floor=ln.get("floor"),
        area=ln.get("area"),
        sort_order=ln.get("sort_order", 0),
        is_active=ln["is_active"],
        factory_name=ln.get("factories", {}).get("name") if ln.get("factories") else None,
        factory_code=ln.get("factories", {}).get("code") if ln.get("factories") else None,
    )


@router.post("/", response_model=LineOut, status_code=201)
def create_line(body: LineCreate, db: Client = Depends(get_supabase)):
    """
    Create a new production line.

    - **factory_id**: UUID of parent factory (must exist)
    - **code**: Unique line identifier (will be uppercased)
    - **name**: Line display name
    - **description**: Optional description
    - **building**: Optional building name/number
    - **floor**: Optional floor number
    - **area**: Optional area within floor
    - **sort_order**: Display order (default 0)
    """
    # Verify parent factory exists
    factory_resp = (
        db.table("factories")
        .select("id, code, name")
        .eq("id", str(body.factory_id))
        .single()
        .execute()
    )

    if not factory_resp.data:
        raise HTTPException(
            status_code=400,
            detail=f"Parent factory with ID '{body.factory_id}' not found"
        )

    # Check for duplicate code
    existing = (
        db.table("production_lines")
        .select("id")
        .eq("code", body.code)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=f"Line with code '{body.code}' already exists"
        )

    # Insert new line
    result = db.table("production_lines").insert({
        "factory_id": str(body.factory_id),
        "code": body.code,
        "name": body.name,
        "description": body.description,
        "building": body.building,
        "floor": body.floor,
        "area": body.area,
        "sort_order": body.sort_order or 0,
        "is_active": True,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create line")

    ln = result.data[0]
    factory = factory_resp.data

    return LineOut(
        id=ln["id"],
        factory_id=ln["factory_id"],
        code=ln["code"],
        name=ln["name"],
        description=ln.get("description"),
        building=ln.get("building"),
        floor=ln.get("floor"),
        area=ln.get("area"),
        sort_order=ln.get("sort_order", 0),
        is_active=ln["is_active"],
        factory_name=factory["name"],
        factory_code=factory["code"],
    )


@router.put("/{line_id}", response_model=LineOut)
def update_line(
    line_id: UUID,
    body: LineUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update an existing production line.

    Only provided fields will be updated. Code and factory_id cannot be changed.
    """
    # Build update dict with only non-None values
    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.description is not None:
        update_data["description"] = body.description
    if body.building is not None:
        update_data["building"] = body.building
    if body.floor is not None:
        update_data["floor"] = body.floor
    if body.area is not None:
        update_data["area"] = body.area
    if body.sort_order is not None:
        update_data["sort_order"] = body.sort_order
    if body.is_active is not None:
        update_data["is_active"] = body.is_active

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Perform update
    result = (
        db.table("production_lines")
        .update(update_data)
        .eq("id", str(line_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Line not found")

    # Fetch complete data with factory info
    ln = result.data[0]
    factory_resp = (
        db.table("factories")
        .select("code, name")
        .eq("id", ln["factory_id"])
        .single()
        .execute()
    )

    return LineOut(
        id=ln["id"],
        factory_id=ln["factory_id"],
        code=ln["code"],
        name=ln["name"],
        description=ln.get("description"),
        building=ln.get("building"),
        floor=ln.get("floor"),
        area=ln.get("area"),
        sort_order=ln.get("sort_order", 0),
        is_active=ln["is_active"],
        factory_name=factory_resp.data["name"] if factory_resp.data else None,
        factory_code=factory_resp.data["code"] if factory_resp.data else None,
    )


@router.get("/{line_id}/delete-info", response_model=LineDeleteInfo)
def get_line_delete_info(line_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get information about what will be deleted if this line is deleted.

    Returns count of equipment that will be cascade deleted.
    """
    # Get line
    line_resp = (
        db.table("production_lines")
        .select("id, name")
        .eq("id", str(line_id))
        .single()
        .execute()
    )

    if not line_resp.data:
        raise HTTPException(status_code=404, detail="Line not found")

    line = line_resp.data

    # Count equipment
    equipment_resp = (
        db.table("equipment_scans")
        .select("id", count="exact")
        .eq("line_id", str(line_id))
        .execute()
    )
    equipment_count = equipment_resp.count or 0

    return LineDeleteInfo(
        line_id=line["id"],
        line_name=line["name"],
        equipment_count=equipment_count,
    )


@router.delete("/{line_id}")
def delete_line(line_id: UUID, db: Client = Depends(get_supabase)):
    """
    Delete a production line and all its equipment.

    This is a cascading delete - all related equipment will be permanently removed.
    Use GET /lines/{id}/delete-info first to see what will be deleted.
    """
    # Verify line exists
    check_resp = (
        db.table("production_lines")
        .select("id")
        .eq("id", str(line_id))
        .single()
        .execute()
    )

    if not check_resp.data:
        raise HTTPException(status_code=404, detail="Line not found")

    # Delete (CASCADE will handle equipment)
    result = (
        db.table("production_lines")
        .delete()
        .eq("id", str(line_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to delete line")

    return {"message": "Line and all equipment deleted successfully"}
```

---

### File 5: main.py (MODIFY)

**Path:** `backend/app/main.py`

Register the new lines router.

```python
# Add this import at the top with other imports:
from app.api import equipment, pipeline, sites, factories, companies, equipment_types, lines

# Add this router registration after the existing routers:
app.include_router(lines.router, prefix="/api/lines", tags=["lines"])
```

**Full modified main.py:**

```python
# backend/app/main.py
"""
FACTOR Digital Twin - FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import equipment, pipeline, sites, factories, companies, equipment_types, lines
from app.core.config import settings

app = FastAPI(
    title="FACTOR Digital Twin API",
    version="0.1.0",
    docs_url="/docs",
    redirect_slashes=False,
)

# GZip compression for large responses (point cloud data)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(factories.router, prefix="/api/factories", tags=["factories"])
app.include_router(lines.router, prefix="/api/lines", tags=["lines"])
app.include_router(equipment.router, prefix="/api/equipment", tags=["equipment"])
app.include_router(equipment_types.router, prefix="/api/equipment-types", tags=["equipment-types"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["pipeline"])
app.include_router(sites.router, prefix="/api/sites", tags=["sites"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "factor-digital-twin"}
```

---

## API Endpoint Summary

### Companies (`/api/companies`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all active companies |
| POST | `/` | Create a new company |
| GET | `/{company_code}/factories` | List factories for company (by code) |
| GET | `/{company_id}/detail` | Get company details (by UUID) |
| PUT | `/{company_id}` | Update company |
| GET | `/{company_id}/delete-info` | Get delete impact info |
| DELETE | `/{company_id}` | Delete company and children |

### Factories (`/api/factories`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all active factories |
| POST | `/` | Create a new factory |
| GET | `/{factory_code}` | Get factory (by code) |
| GET | `/{factory_code}/lines` | List lines for factory (by code) |
| GET | `/by-id/{factory_id}` | Get factory (by UUID) |
| PUT | `/{factory_id}` | Update factory |
| GET | `/{factory_id}/delete-info` | Get delete impact info |
| DELETE | `/{factory_id}` | Delete factory and children |

### Lines (`/api/lines`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all lines (optional factory_id filter) |
| POST | `/` | Create a new line |
| GET | `/{line_id}` | Get line by UUID |
| PUT | `/{line_id}` | Update line |
| GET | `/{line_id}/delete-info` | Get delete impact info |
| DELETE | `/{line_id}` | Delete line and equipment |

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/app/schemas/entities.py` | CREATE | Pydantic schemas for Company, Factory, Line CRUD |
| `backend/app/api/companies.py` | MODIFY | Add POST, PUT, DELETE, delete-info endpoints |
| `backend/app/api/factories.py` | MODIFY | Add POST, PUT, DELETE, delete-info endpoints |
| `backend/app/api/lines.py` | CREATE | New router with full CRUD for production lines |
| `backend/app/main.py` | MODIFY | Register lines router |

---

## Acceptance Criteria

### Company CRUD
- [ ] `POST /api/companies/` creates a new company with valid data
- [ ] `POST /api/companies/` returns 409 for duplicate code
- [ ] `POST /api/companies/` validates code format (alphanumeric, hyphens, underscores)
- [ ] `GET /api/companies/{id}/detail` returns company by UUID
- [ ] `GET /api/companies/{id}/detail` returns 404 for non-existent company
- [ ] `PUT /api/companies/{id}` updates company fields
- [ ] `PUT /api/companies/{id}` returns 400 when no fields provided
- [ ] `PUT /api/companies/{id}` returns 404 for non-existent company
- [ ] `GET /api/companies/{id}/delete-info` returns child counts
- [ ] `DELETE /api/companies/{id}` removes company and cascades to children
- [ ] `DELETE /api/companies/{id}` returns 404 for non-existent company

### Factory CRUD
- [ ] `POST /api/factories/` creates a new factory with valid data
- [ ] `POST /api/factories/` validates parent company exists
- [ ] `POST /api/factories/` returns 409 for duplicate code
- [ ] `GET /api/factories/by-id/{id}` returns factory by UUID
- [ ] `PUT /api/factories/{id}` updates factory fields
- [ ] `GET /api/factories/{id}/delete-info` returns child counts
- [ ] `DELETE /api/factories/{id}` removes factory and cascades to children

### Line CRUD
- [ ] `GET /api/lines/` lists all active lines
- [ ] `GET /api/lines/?factory_id={id}` filters by factory
- [ ] `GET /api/lines/{id}` returns line by UUID
- [ ] `POST /api/lines/` creates a new line with valid data
- [ ] `POST /api/lines/` validates parent factory exists
- [ ] `POST /api/lines/` returns 409 for duplicate code
- [ ] `PUT /api/lines/{id}` updates line fields
- [ ] `GET /api/lines/{id}/delete-info` returns equipment count
- [ ] `DELETE /api/lines/{id}` removes line and cascades to equipment

### General
- [ ] All endpoints return appropriate HTTP status codes
- [ ] All endpoints handle database errors gracefully
- [ ] Swagger documentation is automatically generated at `/docs`
- [ ] Lines router is registered in main.py

---

## Testing Checklist

### Manual Testing with Swagger UI

1. **Start the backend server:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. **Open Swagger UI:** Navigate to `http://localhost:8000/docs`

3. **Test Company CRUD:**
   - Create: POST `/api/companies/` with `{"code": "TEST-CO", "name": "Test Company"}`
   - Verify the response contains a UUID `id`
   - Read: GET `/api/companies/{id}/detail` with the returned UUID
   - Update: PUT `/api/companies/{id}` with `{"name": "Updated Name"}`
   - Delete Info: GET `/api/companies/{id}/delete-info`
   - Delete: DELETE `/api/companies/{id}`

4. **Test Factory CRUD:**
   - First create a company (or use existing)
   - Create: POST `/api/factories/` with `{"company_id": "<company-uuid>", "code": "TEST-FAC", "name": "Test Factory"}`
   - Follow same pattern as company testing

5. **Test Line CRUD:**
   - First create a factory (or use existing)
   - Create: POST `/api/lines/` with `{"factory_id": "<factory-uuid>", "code": "TEST-LINE", "name": "Test Line"}`
   - Follow same pattern as company testing

### cURL Examples

```bash
# Create company
curl -X POST "http://localhost:8000/api/companies/" \
  -H "Content-Type: application/json" \
  -d '{"code": "ACME", "name": "Acme Corporation"}'

# Create factory
curl -X POST "http://localhost:8000/api/factories/" \
  -H "Content-Type: application/json" \
  -d '{"company_id": "<company-uuid>", "code": "FAC-01", "name": "Factory 1"}'

# Create line
curl -X POST "http://localhost:8000/api/lines/" \
  -H "Content-Type: application/json" \
  -d '{"factory_id": "<factory-uuid>", "code": "LINE-A", "name": "Production Line A"}'

# Get delete info
curl "http://localhost:8000/api/companies/<company-uuid>/delete-info"

# Delete company (cascades to factory and line)
curl -X DELETE "http://localhost:8000/api/companies/<company-uuid>"
```

---

## Notes for Implementer

1. **Section 05 Dependency:** Ensure the CASCADE FK migration (Section 05) has been applied before testing delete operations. Without it, deletes will fail with foreign key constraint violations.

2. **UUID Handling:** Supabase returns UUIDs as strings. The code converts them using `str(uuid)` when building queries. Pydantic handles the conversion in responses.

3. **Code Normalization:** All entity codes are automatically uppercased by the validators. This ensures consistency and prevents case-sensitivity issues.

4. **Existing Endpoints:** The existing GET endpoints in companies.py and factories.py use `company_code` and `factory_code` as path parameters. The new CRUD endpoints use UUIDs (`company_id`, `factory_id`, `line_id`) for consistency with database operations. Both patterns are maintained for backward compatibility.

5. **Delete Safety:** Always call the `/delete-info` endpoint before performing a delete to show users what will be affected. The frontend (Section 08) will implement a confirmation dialog using this data.

6. **Error Messages:** Error messages are in English for API consumers. The frontend can translate these for display if needed.

7. **Supabase Client:** The `get_supabase()` dependency is cached using `@lru_cache`. This is the existing pattern in the codebase.

8. **Equipment Table:** The code references `equipment_scans` table for counting equipment. Verify this is the correct table name in your database schema. Adjust if your equipment table has a different name.

---

## Troubleshooting

**Issue:** `POST` returns 500 Internal Server Error
- Check if the database is accessible
- Verify the table names match your schema
- Check the Supabase service key is configured

**Issue:** `DELETE` fails with foreign key error
- Section 05 (CASCADE FK) must be completed first
- Run the migration to add CASCADE constraints

**Issue:** Swagger UI not showing new endpoints
- Restart the uvicorn server
- Verify the router is imported in main.py
- Check for syntax errors in the new files

**Issue:** Code validation failing unexpectedly
- Codes must be alphanumeric with hyphens and underscores only
- Codes are auto-uppercased, so `test-co` becomes `TEST-CO`
- Empty codes are rejected

**Issue:** `get_supabase()` import error
- Verify the import path: `from app.core.supabase import get_supabase`
- Check that the supabase.py file exists in `backend/app/core/`

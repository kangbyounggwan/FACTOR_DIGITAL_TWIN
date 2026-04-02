"""
Company API endpoints - CRUD operations for company management.
"""
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from typing import List
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
# LIST / READ ENDPOINTS
# =============================================================================

@router.get("/", response_model=List[CompanyOut])
def list_companies(db: Client = Depends(get_supabase)):
    """List all active companies."""
    resp = (
        db.table("companies")
        .select("id, code, name, description, logo_url, is_active")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    return resp.data


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
# CRUD ENDPOINTS
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

    return result.data[0]


@router.get("/{company_id}/detail", response_model=CompanyOut)
def get_company_by_id(company_id: UUID, db: Client = Depends(get_supabase)):
    """Get a single company by UUID."""
    resp = (
        db.table("companies")
        .select("id, code, name, description, logo_url, is_active")
        .eq("id", str(company_id))
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Company not found")

    return resp.data


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

    result = (
        db.table("companies")
        .update(update_data)
        .eq("id", str(company_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Company not found")

    return result.data[0]


@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: UUID, db: Client = Depends(get_supabase)):
    """
    Delete a company and all its child records (factories, lines, equipment).
    CASCADE delete is handled by the database.
    """
    # Check if company exists
    check = (
        db.table("companies")
        .select("id")
        .eq("id", str(company_id))
        .single()
        .execute()
    )

    if not check.data:
        raise HTTPException(status_code=404, detail="Company not found")

    # Delete company (CASCADE handles children)
    db.table("companies").delete().eq("id", str(company_id)).execute()

    return None


@router.get("/{company_id}/delete-info", response_model=CompanyDeleteInfo)
def get_company_delete_info(company_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get information about what will be deleted when this company is deleted.
    Returns counts of all child records that will be affected.
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
        line_ids = [l["id"] for l in lines_resp.data] if lines_resp.data else []

        if line_ids:
            equipment_resp = (
                db.table("equipment_scans")
                .select("id", count="exact")
                .in_("line_id", line_ids)
                .execute()
            )
            equipment_count = equipment_resp.count or 0

    return CompanyDeleteInfo(
        company_id=company_id,
        company_name=company["name"],
        factory_count=factory_count,
        line_count=line_count,
        equipment_count=equipment_count,
    )

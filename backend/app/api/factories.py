"""
Factory API endpoints - CRUD operations for factory management.
"""
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from typing import List
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
# LIST / READ ENDPOINTS
# =============================================================================

@router.get("/", response_model=List[FactoryOut])
def list_factories(db: Client = Depends(get_supabase)):
    """List all active factories."""
    resp = (
        db.table("factories")
        .select("id, company_id, code, name, address, is_active, companies(name)")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    result = []
    for f in resp.data:
        result.append({
            "id": f["id"],
            "company_id": f["company_id"],
            "code": f["code"],
            "name": f["name"],
            "address": f.get("address"),
            "is_active": f.get("is_active", True),
            "company_name": f.get("companies", {}).get("name") if f.get("companies") else None,
        })
    return result


@router.get("/{factory_code}")
def get_factory(factory_code: str, db: Client = Depends(get_supabase)):
    """Get a single factory by code."""
    resp = (
        db.table("factories")
        .select("id, company_id, code, name, address, is_active, companies(name)")
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
        "company_id": f["company_id"],
        "code": f["code"],
        "name": f["name"],
        "address": f.get("address"),
        "is_active": f.get("is_active", True),
        "company_name": f.get("companies", {}).get("name") if f.get("companies") else None,
    }


@router.get("/{factory_code}/lines")
def list_production_lines(factory_code: str, db: Client = Depends(get_supabase)):
    """List production lines for a factory."""
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


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.post("/", response_model=FactoryOut, status_code=201)
def create_factory(body: FactoryCreate, db: Client = Depends(get_supabase)):
    """
    Create a new factory.

    - **company_id**: Parent company UUID
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
        raise HTTPException(status_code=404, detail="Parent company not found")

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
    return {
        **factory,
        "company_name": company_resp.data["name"],
    }


@router.get("/{factory_id}/detail", response_model=FactoryOut)
def get_factory_by_id(factory_id: UUID, db: Client = Depends(get_supabase)):
    """Get a single factory by UUID."""
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
    return {
        "id": f["id"],
        "company_id": f["company_id"],
        "code": f["code"],
        "name": f["name"],
        "address": f.get("address"),
        "is_active": f.get("is_active", True),
        "company_name": f.get("companies", {}).get("name") if f.get("companies") else None,
    }


@router.put("/{factory_id}", response_model=FactoryOut)
def update_factory(
    factory_id: UUID,
    body: FactoryUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update an existing factory.

    Only provided fields will be updated. Code cannot be changed.
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

    result = (
        db.table("factories")
        .update(update_data)
        .eq("id", str(factory_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    # Get updated factory with company name
    factory = result.data[0]
    company_resp = (
        db.table("companies")
        .select("name")
        .eq("id", factory["company_id"])
        .single()
        .execute()
    )

    return {
        **factory,
        "company_name": company_resp.data["name"] if company_resp.data else None,
    }


@router.delete("/{factory_id}", status_code=204)
def delete_factory(factory_id: UUID, db: Client = Depends(get_supabase)):
    """
    Delete a factory and all its child records (lines, equipment, layouts).
    CASCADE delete is handled by the database.
    """
    # Check if factory exists
    check = (
        db.table("factories")
        .select("id")
        .eq("id", str(factory_id))
        .single()
        .execute()
    )

    if not check.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    # Delete factory (CASCADE handles children)
    db.table("factories").delete().eq("id", str(factory_id)).execute()

    return None


@router.get("/{factory_id}/delete-info", response_model=FactoryDeleteInfo)
def get_factory_delete_info(factory_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get information about what will be deleted when this factory is deleted.
    Returns counts of all child records that will be affected.
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
    line_ids = [l["id"] for l in lines_resp.data] if lines_resp.data else []

    # Count equipment
    equipment_count = 0
    if line_ids:
        equipment_resp = (
            db.table("equipment_scans")
            .select("id", count="exact")
            .in_("line_id", line_ids)
            .execute()
        )
        equipment_count = equipment_resp.count or 0

    # Count layouts
    layouts_resp = (
        db.table("layouts")
        .select("id", count="exact")
        .eq("factory_id", str(factory_id))
        .execute()
    )
    layout_count = layouts_resp.count or 0

    return FactoryDeleteInfo(
        factory_id=factory_id,
        factory_name=factory["name"],
        line_count=line_count,
        equipment_count=equipment_count,
        layout_count=layout_count,
    )

"""
Production Line API endpoints - CRUD operations for line management.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from typing import List, Optional
from uuid import UUID

from app.core.supabase import get_supabase
from app.schemas.entities import (
    LineCreate,
    LineUpdate,
    LineOut,
    LineDeleteInfo,
)

router = APIRouter()


# =============================================================================
# LIST / READ ENDPOINTS
# =============================================================================

@router.get("/", response_model=List[LineOut])
def list_lines(
    factory_id: Optional[UUID] = Query(None, description="Filter by factory ID"),
    db: Client = Depends(get_supabase),
):
    """List all active production lines, optionally filtered by factory."""
    query = (
        db.table("production_lines")
        .select("*, factories(code, name)")
        .eq("is_active", True)
    )

    if factory_id:
        query = query.eq("factory_id", str(factory_id))

    query = query.order("sort_order")
    resp = query.execute()

    result = []
    for line in resp.data:
        result.append({
            "id": line["id"],
            "factory_id": line["factory_id"],
            "code": line["code"],
            "name": line["name"],
            "description": line.get("description"),
            "building": line.get("building"),
            "floor": line.get("floor"),
            "area": line.get("area"),
            "sort_order": line.get("sort_order", 0),
            "is_active": line.get("is_active", True),
            "factory_name": line.get("factories", {}).get("name") if line.get("factories") else None,
            "factory_code": line.get("factories", {}).get("code") if line.get("factories") else None,
        })

    return result


@router.get("/{line_id}", response_model=LineOut)
def get_line(line_id: UUID, db: Client = Depends(get_supabase)):
    """Get a single production line by UUID."""
    resp = (
        db.table("production_lines")
        .select("*, factories(code, name)")
        .eq("id", str(line_id))
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Production line not found")

    line = resp.data
    return {
        "id": line["id"],
        "factory_id": line["factory_id"],
        "code": line["code"],
        "name": line["name"],
        "description": line.get("description"),
        "building": line.get("building"),
        "floor": line.get("floor"),
        "area": line.get("area"),
        "sort_order": line.get("sort_order", 0),
        "is_active": line.get("is_active", True),
        "factory_name": line.get("factories", {}).get("name") if line.get("factories") else None,
        "factory_code": line.get("factories", {}).get("code") if line.get("factories") else None,
    }


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.post("/", response_model=LineOut, status_code=201)
def create_line(body: LineCreate, db: Client = Depends(get_supabase)):
    """
    Create a new production line.

    - **factory_id**: Parent factory UUID
    - **code**: Unique line identifier (will be uppercased)
    - **name**: Line display name
    - **description**: Optional description
    - **building**: Optional building name/number
    - **floor**: Optional floor
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
        raise HTTPException(status_code=404, detail="Parent factory not found")

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
            detail=f"Production line with code '{body.code}' already exists"
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
        raise HTTPException(status_code=500, detail="Failed to create production line")

    line = result.data[0]
    return {
        **line,
        "factory_name": factory_resp.data["name"],
        "factory_code": factory_resp.data["code"],
    }


@router.put("/{line_id}", response_model=LineOut)
def update_line(
    line_id: UUID,
    body: LineUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update an existing production line.

    Only provided fields will be updated. Code cannot be changed.
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

    result = (
        db.table("production_lines")
        .update(update_data)
        .eq("id", str(line_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Production line not found")

    # Get updated line with factory info
    line = result.data[0]
    factory_resp = (
        db.table("factories")
        .select("code, name")
        .eq("id", line["factory_id"])
        .single()
        .execute()
    )

    return {
        **line,
        "factory_name": factory_resp.data["name"] if factory_resp.data else None,
        "factory_code": factory_resp.data["code"] if factory_resp.data else None,
    }


@router.delete("/{line_id}", status_code=204)
def delete_line(line_id: UUID, db: Client = Depends(get_supabase)):
    """
    Delete a production line and all its equipment.
    CASCADE delete is handled by the database.
    """
    # Check if line exists
    check = (
        db.table("production_lines")
        .select("id")
        .eq("id", str(line_id))
        .single()
        .execute()
    )

    if not check.data:
        raise HTTPException(status_code=404, detail="Production line not found")

    # Delete line (CASCADE handles equipment)
    db.table("production_lines").delete().eq("id", str(line_id)).execute()

    return None


@router.get("/{line_id}/delete-info", response_model=LineDeleteInfo)
def get_line_delete_info(line_id: UUID, db: Client = Depends(get_supabase)):
    """
    Get information about what will be deleted when this line is deleted.
    Returns count of equipment that will be affected.
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
        raise HTTPException(status_code=404, detail="Production line not found")

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
        line_id=line_id,
        line_name=line["name"],
        equipment_count=equipment_count,
    )

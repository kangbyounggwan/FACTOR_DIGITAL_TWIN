"""
Production Line API endpoints - CRUD operations for line management.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from typing import List, Optional
from uuid import UUID

from app.core.supabase import get_supabase, fetch_one
from app.schemas.entities import (
    LineCreate,
    LineUpdate,
    LineOut,
    LineDeleteInfo,
)

router = APIRouter()


def _line_with_factory(line: dict, factory: dict | None = None) -> dict:
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
        "factory_name": (factory or line.get("factories", {})).get("name") if (factory or line.get("factories")) else None,
        "factory_code": (factory or line.get("factories", {})).get("code") if (factory or line.get("factories")) else None,
    }


# =============================================================================
# LIST / READ ENDPOINTS
# =============================================================================

@router.get("/", response_model=List[LineOut])
def list_lines(
    factory_id: Optional[UUID] = Query(None, description="Filter by factory ID"),
    db: Client = Depends(get_supabase),
):
    """List all active production lines, optionally filtered by factory."""
    query = db.table("production_lines").select("*, factories(code, name)").eq("is_active", True)
    if factory_id:
        query = query.eq("factory_id", str(factory_id))
    resp = query.order("sort_order").execute()
    return [_line_with_factory(line) for line in resp.data]


@router.get("/{line_id}", response_model=LineOut)
def get_line(line_id: UUID, db: Client = Depends(get_supabase)):
    """Get a single production line by UUID."""
    resp = db.table("production_lines").select("*, factories(code, name)").eq("id", str(line_id)).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Production line not found")
    return _line_with_factory(resp.data[0])


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.post("/", response_model=LineOut, status_code=201)
def create_line(body: LineCreate, db: Client = Depends(get_supabase)):
    """Create a new production line."""
    factory = fetch_one(db, "factories", "id", str(body.factory_id), select="id, code, name", label="공장")

    existing = db.table("production_lines").select("id").eq("code", body.code).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"Production line with code '{body.code}' already exists")

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
    return {**result.data[0], "factory_name": factory["name"], "factory_code": factory["code"]}


@router.put("/{line_id}", response_model=LineOut)
def update_line(line_id: UUID, body: LineUpdate, db: Client = Depends(get_supabase)):
    """Update an existing production line."""
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

    result = db.table("production_lines").update(update_data).eq("id", str(line_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Production line not found")

    line = result.data[0]
    factory_resp = db.table("factories").select("code, name").eq("id", line["factory_id"]).execute()
    factory = factory_resp.data[0] if factory_resp.data else None
    return _line_with_factory(line, factory)


@router.delete("/{line_id}", status_code=204)
def delete_line(line_id: UUID, db: Client = Depends(get_supabase)):
    """Delete a production line and all its equipment."""
    fetch_one(db, "production_lines", "id", str(line_id), select="id", label="라인")
    db.table("production_lines").delete().eq("id", str(line_id)).execute()
    return None


@router.get("/{line_id}/delete-info", response_model=LineDeleteInfo)
def get_line_delete_info(line_id: UUID, db: Client = Depends(get_supabase)):
    """Get cascade delete impact preview."""
    line = fetch_one(db, "production_lines", "id", str(line_id), select="id, name", label="라인")
    equipment_resp = db.table("equipment_scans").select("id", count="exact").eq("line_id", str(line_id)).execute()
    return LineDeleteInfo(
        line_id=line_id,
        line_name=line["name"],
        equipment_count=equipment_resp.count or 0,
    )

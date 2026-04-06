"""
Factory API endpoints - CRUD operations for factory management.
"""
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from typing import List
from uuid import UUID

from app.core.supabase import get_supabase, fetch_one
from app.schemas.entities import (
    FactoryCreate,
    FactoryUpdate,
    FactoryOut,
    FactoryDeleteInfo,
)

router = APIRouter()


def _factory_out(f: dict) -> dict:
    return {
        "id": f["id"],
        "company_id": f["company_id"],
        "code": f["code"],
        "name": f["name"],
        "address": f.get("address"),
        "is_active": f.get("is_active", True),
        "company_name": f.get("companies", {}).get("name") if f.get("companies") else None,
    }


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
    return [_factory_out(f) for f in resp.data]


@router.get("/{factory_code}")
def get_factory(factory_code: str, db: Client = Depends(get_supabase)):
    """Get a single factory by code."""
    resp = (
        db.table("factories")
        .select("id, company_id, code, name, address, is_active, companies(name)")
        .eq("code", factory_code)
        .eq("is_active", True)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Factory not found")
    return _factory_out(resp.data[0])


@router.get("/{factory_code}/lines")
def list_production_lines(factory_code: str, db: Client = Depends(get_supabase)):
    """List production lines for a factory (N+1 쿼리 제거)."""
    factory = fetch_one(db, "factories", "code", factory_code, select="id", label="공장")
    factory_id = factory["id"]

    resp = (
        db.table("production_lines")
        .select("id, code, name, description, building, floor, area")
        .eq("factory_id", factory_id)
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )

    if not resp.data:
        return []

    # 한 번의 쿼리로 모든 라인의 설비 수 조회 (N+1 제거)
    line_ids = [line["id"] for line in resp.data]
    count_resp = (
        db.table("equipment_scans")
        .select("line_id")
        .in_("line_id", line_ids)
        .execute()
    )

    # line_id별 카운트 계산
    line_counts: dict[str, int] = {}
    if count_resp.data:
        for row in count_resp.data:
            lid = row["line_id"]
            line_counts[lid] = line_counts.get(lid, 0) + 1

    return [
        {
            "id": line["id"],
            "code": line["code"],
            "name": line["name"],
            "description": line.get("description"),
            "location": f"{line.get('building', '')} {line.get('floor', '')} {line.get('area', '')}".strip(),
            "equipment_count": line_counts.get(line["id"], 0),
        }
        for line in resp.data
    ]


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.post("/", response_model=FactoryOut, status_code=201)
def create_factory(body: FactoryCreate, db: Client = Depends(get_supabase)):
    """Create a new factory."""
    company = fetch_one(db, "companies", "id", str(body.company_id), select="id, name", label="회사")

    existing = db.table("factories").select("id").eq("code", body.code).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"Factory with code '{body.code}' already exists")

    result = db.table("factories").insert({
        "company_id": str(body.company_id),
        "code": body.code,
        "name": body.name,
        "address": body.address,
        "is_active": True,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create factory")
    return {**result.data[0], "company_name": company["name"]}


@router.get("/{factory_id}/detail", response_model=FactoryOut)
def get_factory_by_id(factory_id: UUID, db: Client = Depends(get_supabase)):
    """Get a single factory by UUID."""
    resp = (
        db.table("factories")
        .select("id, company_id, code, name, address, is_active, companies(name)")
        .eq("id", str(factory_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Factory not found")
    return _factory_out(resp.data[0])


@router.put("/{factory_id}", response_model=FactoryOut)
def update_factory(factory_id: UUID, body: FactoryUpdate, db: Client = Depends(get_supabase)):
    """Update an existing factory."""
    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.address is not None:
        update_data["address"] = body.address
    if body.is_active is not None:
        update_data["is_active"] = body.is_active

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.table("factories").update(update_data).eq("id", str(factory_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Factory not found")

    factory = result.data[0]
    company_resp = db.table("companies").select("name").eq("id", factory["company_id"]).execute()
    return {**factory, "company_name": company_resp.data[0]["name"] if company_resp.data else None}


@router.delete("/{factory_id}", status_code=204)
def delete_factory(factory_id: UUID, db: Client = Depends(get_supabase)):
    """Delete a factory and all its child records."""
    fetch_one(db, "factories", "id", str(factory_id), select="id", label="공장")
    db.table("factories").delete().eq("id", str(factory_id)).execute()
    return None


@router.get("/{factory_id}/delete-info", response_model=FactoryDeleteInfo)
def get_factory_delete_info(factory_id: UUID, db: Client = Depends(get_supabase)):
    """Get cascade delete impact preview."""
    factory = fetch_one(db, "factories", "id", str(factory_id), select="id, name", label="공장")

    lines_resp = db.table("production_lines").select("id", count="exact").eq("factory_id", str(factory_id)).execute()
    line_count = lines_resp.count or 0
    line_ids = [l["id"] for l in lines_resp.data] if lines_resp.data else []

    equipment_count = 0
    if line_ids:
        equipment_resp = db.table("equipment_scans").select("id", count="exact").in_("line_id", line_ids).execute()
        equipment_count = equipment_resp.count or 0

    layouts_resp = db.table("layouts").select("id", count="exact").eq("factory_id", str(factory_id)).execute()

    return FactoryDeleteInfo(
        factory_id=factory_id,
        factory_name=factory["name"],
        line_count=line_count,
        equipment_count=equipment_count,
        layout_count=layouts_resp.count or 0,
    )

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from supabase import Client
from app.core.supabase import get_supabase

router = APIRouter()


class ZoneCreate(BaseModel):
    code: str
    name: str
    line_id: str
    color_hex: Optional[str] = None
    sort_order: Optional[int] = 0


class ZoneUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    color_hex: Optional[str] = None
    sort_order: Optional[int] = None


class ZoneOut(BaseModel):
    id: str
    code: str
    name: str
    line_id: str
    color_hex: Optional[str] = None
    sort_order: int = 0


@router.get("/line/{line_id}")
def list_zones_by_line(line_id: str, db: Client = Depends(get_supabase)):
    """라인별 구역 목록 조회."""
    resp = (
        db.table("zones")
        .select("*")
        .eq("line_id", line_id)
        .order("sort_order")
        .execute()
    )
    return resp.data


@router.post("/")
def create_zone(body: ZoneCreate, db: Client = Depends(get_supabase)):
    """새 구역 생성."""
    # Check if code already exists for this line
    existing = (
        db.table("zones")
        .select("id")
        .eq("code", body.code)
        .eq("line_id", body.line_id)
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=400, detail="이미 존재하는 구역 코드입니다.")

    insert_data = {
        "code": body.code,
        "name": body.name,
        "line_id": body.line_id,
        "color_hex": body.color_hex,
        "sort_order": body.sort_order or 0,
    }

    resp = db.table("zones").insert(insert_data).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="구역 생성 실패")

    return resp.data[0]


@router.get("/ensure/{line_id}/{code}")
def ensure_zone(line_id: str, code: str, db: Client = Depends(get_supabase)):
    """구역 코드가 존재하면 반환, 없으면 생성하여 반환."""
    existing = (
        db.table("zones")
        .select("*")
        .eq("code", code)
        .eq("line_id", line_id)
        .execute()
    )

    if existing.data:
        return existing.data[0]

    # Create with code as name
    insert_data = {
        "code": code,
        "name": code.replace("_", " "),
        "line_id": line_id,
    }

    resp = db.table("zones").insert(insert_data).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="구역 생성 실패")

    return resp.data[0]


@router.patch("/{zone_id}")
def update_zone(zone_id: str, body: ZoneUpdate, db: Client = Depends(get_supabase)):
    """구역 업데이트."""
    update_data = {}

    if body.code is not None:
        update_data["code"] = body.code
    if body.name is not None:
        update_data["name"] = body.name
    if body.color_hex is not None:
        update_data["color_hex"] = body.color_hex
    if body.sort_order is not None:
        update_data["sort_order"] = body.sort_order

    if not update_data:
        raise HTTPException(status_code=400, detail="변경할 항목이 없습니다.")

    resp = (
        db.table("zones")
        .update(update_data)
        .eq("id", zone_id)
        .execute()
    )

    if resp.data:
        return resp.data[0]
    raise HTTPException(status_code=404, detail="구역을 찾을 수 없습니다.")


@router.delete("/{zone_id}")
def delete_zone(zone_id: str, db: Client = Depends(get_supabase)):
    """구역 삭제."""
    resp = db.table("zones").delete().eq("id", zone_id).execute()
    return {"deleted": zone_id}

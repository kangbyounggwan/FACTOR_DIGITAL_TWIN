from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import Client
from app.core.supabase import get_supabase

router = APIRouter()


class EquipmentTypeCreate(BaseModel):
    code: str
    name: str
    color_hex: str | None = "#5F5E5A"


class EquipmentTypeOut(BaseModel):
    id: str
    code: str
    name: str
    color_hex: str | None = None


@router.get("/")
def list_equipment_types(db: Client = Depends(get_supabase)):
    """설비 타입 목록 조회."""
    resp = (
        db.table("equipment_types")
        .select("*")
        .order("code")
        .execute()
    )
    # Normalize response to expected format
    result = []
    for row in resp.data:
        result.append({
            "id": row.get("id"),
            "code": row.get("code"),
            "name": row.get("name") or row.get("code", ""),
            "color_hex": row.get("color_hex"),
        })
    return result


@router.post("/")
def create_equipment_type(body: EquipmentTypeCreate, db: Client = Depends(get_supabase)):
    """새 설비 타입 생성."""
    # Check if code already exists
    existing = (
        db.table("equipment_types")
        .select("id")
        .eq("code", body.code)
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=400, detail="이미 존재하는 설비 타입 코드입니다.")

    # Create new type
    insert_data = {"code": body.code, "name": body.name}

    resp = (
        db.table("equipment_types")
        .insert(insert_data)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=500, detail="설비 타입 생성 실패")

    row = resp.data[0]
    return {
        "id": row.get("id"),
        "code": row.get("code"),
        "name": row.get("name", row.get("code", "")),
        "color_hex": row.get("color_hex"),
    }


@router.get("/ensure/{code}")
def ensure_equipment_type(code: str, db: Client = Depends(get_supabase)):
    """설비 타입 코드가 존재하면 반환, 없으면 생성하여 반환."""
    # Check if exists
    existing = (
        db.table("equipment_types")
        .select("*")
        .eq("code", code)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        return {
            "id": row.get("id"),
            "code": row.get("code"),
            "name": row.get("name") or row.get("code", ""),
            "color_hex": row.get("color_hex"),
        }

    # Create with code as name (replace underscores with spaces for display)
    insert_data = {"code": code, "name": code.replace("_", " ")}

    resp = (
        db.table("equipment_types")
        .insert(insert_data)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=500, detail="설비 타입 생성 실패")

    row = resp.data[0]
    return {
        "id": row.get("id"),
        "code": row.get("code"),
        "name": row.get("name", row.get("code", "")),
        "color_hex": row.get("color_hex"),
    }

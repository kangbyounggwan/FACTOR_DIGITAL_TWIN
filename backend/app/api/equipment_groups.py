from typing import List
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase, fetch_one

from app.schemas.equipment_group import (
    EquipmentGroupCreate,
    EquipmentGroupUpdate,
    EquipmentGroupMemberUpdate,
    EquipmentGroupOut,
)

router = APIRouter()


def transform_group(group: dict, members: List[dict] = None) -> dict:
    """Transform DB row to API response format."""
    member_ids = [m["scan_code"] for m in members] if members else []
    return {
        "id": str(group["id"]),
        "line_id": str(group["line_id"]),
        "name": group["name"],
        "group_type": group.get("group_type", "BRIDGE"),
        "description": group.get("description"),
        "centroid_x": group.get("centroid_x"),
        "centroid_y": group.get("centroid_y"),
        "centroid_z": group.get("centroid_z"),
        "size_w": group.get("size_w"),
        "size_h": group.get("size_h"),
        "size_d": group.get("size_d"),
        "member_count": len(member_ids),
        "member_ids": member_ids,
        "created_at": group.get("created_at"),
        "updated_at": group.get("updated_at"),
    }


@router.get("/factory/{factory_code}", response_model=List[EquipmentGroupOut])
def list_groups_by_factory(factory_code: str, db: Client = Depends(get_supabase)):
    """공장의 모든 설비 그룹 조회."""
    factory = fetch_one(db, "factories", "code", factory_code, select="id", label="공장")
    factory_id = factory["id"]

    # Get all lines in factory
    lines_resp = (
        db.table("production_lines")
        .select("id")
        .eq("factory_id", factory_id)
        .execute()
    )

    if not lines_resp.data:
        return []

    line_ids = [line["id"] for line in lines_resp.data]

    # Get all groups in these lines
    groups_resp = (
        db.table("equipment_groups")
        .select("*")
        .in_("line_id", line_ids)
        .order("name")
        .execute()
    )

    result = []
    for group in groups_resp.data:
        members_resp = (
            db.table("equipment_scans")
            .select("scan_code")
            .eq("group_id", group["id"])
            .execute()
        )
        result.append(transform_group(group, members_resp.data))

    return result


@router.get("/line/{line_code}", response_model=List[EquipmentGroupOut])
def list_groups_by_line(line_code: str, db: Client = Depends(get_supabase)):
    """라인의 모든 설비 그룹 조회."""
    line = fetch_one(db, "production_lines", "code", line_code, select="id", label="라인")
    line_id = line["id"]

    # Get groups
    groups_resp = (
        db.table("equipment_groups")
        .select("*")
        .eq("line_id", line_id)
        .order("name")
        .execute()
    )

    result = []
    for group in groups_resp.data:
        members_resp = (
            db.table("equipment_scans")
            .select("scan_code")
            .eq("group_id", group["id"])
            .execute()
        )
        result.append(transform_group(group, members_resp.data))

    return result


@router.get("/{group_id}", response_model=EquipmentGroupOut)
def get_group(group_id: str, db: Client = Depends(get_supabase)):
    """설비 그룹 상세 조회."""
    group = fetch_one(db, "equipment_groups", "id", group_id, label="그룹")

    members_resp = (
        db.table("equipment_scans")
        .select("scan_code")
        .eq("group_id", group_id)
        .execute()
    )

    return transform_group(group, members_resp.data)


@router.post("/", response_model=EquipmentGroupOut)
def create_group(body: EquipmentGroupCreate, db: Client = Depends(get_supabase)):
    """설비 그룹 생성."""
    # Get line_id from line_code
    line_resp = (
        db.table("production_lines")
        .select("id")
        .eq("code", body.line_id)
        .execute()
    )

    # line_id가 UUID면 직접 사용, 아니면 code로 조회
    if line_resp.data:
        line_id = line_resp.data[0]["id"]
    else:
        # Try as UUID directly
        line_id = body.line_id

    # Create group
    insert_data = {
        "line_id": line_id,
        "name": body.name,
        "group_type": body.group_type,
        "description": body.description,
    }

    try:
        group_resp = db.table("equipment_groups").insert(insert_data).execute()
        if not group_resp.data:
            raise HTTPException(status_code=500, detail="그룹 생성 실패")

        group = group_resp.data[0]

        # Add initial members
        if body.equipment_ids:
            for eq_id in body.equipment_ids:
                db.table("equipment_scans").update(
                    {"group_id": group["id"]}
                ).eq("scan_code", eq_id).execute()

        # Fetch updated group with members
        return get_group(group["id"], db)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"그룹 생성 실패: {str(e)}")


@router.patch("/{group_id}", response_model=EquipmentGroupOut)
def update_group(
    group_id: str,
    body: EquipmentGroupUpdate,
    db: Client = Depends(get_supabase),
):
    """설비 그룹 정보 수정."""
    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.group_type is not None:
        update_data["group_type"] = body.group_type
    if body.description is not None:
        update_data["description"] = body.description

    if not update_data:
        raise HTTPException(status_code=400, detail="변경할 항목이 없습니다.")

    resp = (
        db.table("equipment_groups")
        .update(update_data)
        .eq("id", group_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")

    return get_group(group_id, db)


@router.post("/{group_id}/members", response_model=EquipmentGroupOut)
def add_members(
    group_id: str,
    body: EquipmentGroupMemberUpdate,
    db: Client = Depends(get_supabase),
):
    """그룹에 설비 추가."""
    fetch_one(db, "equipment_groups", "id", group_id, select="id", label="그룹")

    # Add members
    for eq_id in body.equipment_ids:
        db.table("equipment_scans").update(
            {"group_id": group_id}
        ).eq("scan_code", eq_id).execute()

    return get_group(group_id, db)


@router.delete("/{group_id}/members", response_model=EquipmentGroupOut)
def remove_members(
    group_id: str,
    body: EquipmentGroupMemberUpdate,
    db: Client = Depends(get_supabase),
):
    """그룹에서 설비 제거."""
    fetch_one(db, "equipment_groups", "id", group_id, select="id", label="그룹")

    # Remove members (set group_id to null)
    for eq_id in body.equipment_ids:
        db.table("equipment_scans").update(
            {"group_id": None}
        ).eq("scan_code", eq_id).eq("group_id", group_id).execute()

    return get_group(group_id, db)


@router.delete("/{group_id}")
def delete_group(group_id: str, db: Client = Depends(get_supabase)):
    """설비 그룹 삭제 (멤버의 group_id는 자동으로 null 처리)."""
    group = fetch_one(db, "equipment_groups", "id", group_id, select="id, name", label="그룹")

    try:
        db.table("equipment_groups").delete().eq("id", group_id).execute()
        return {"deleted": group_id, "name": group["name"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"그룹 삭제 실패: {str(e)}")

from typing import Literal
import random
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.supabase import get_supabase
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentUpdate,
    SplitRequest,
    SplitResponse,
    EquipmentOut,
    PointsUpdateRequest,
    PointsUpdateResponse,
)
from app.services.pointcloud import load_points_from_ply, get_lod_max_points

router = APIRouter()


def generate_mock_points(equipment_data: dict, lod: Literal["high", "medium", "low"]) -> dict:
    """Generate mock point cloud from equipment centroid and size."""
    cx = equipment_data.get("centroid_x", 0)
    cy = equipment_data.get("centroid_y", 0)
    cz = equipment_data.get("centroid_z", 0)
    w = equipment_data.get("size_w", 1)
    h = equipment_data.get("size_h", 1)
    d = equipment_data.get("size_d", 1)

    # Determine point count based on LOD
    lod_counts = {"high": 50000, "medium": 10000, "low": 2000}
    count = lod_counts.get(lod, 10000)

    # Generate random points within bounding box
    positions = []
    colors = []
    for _ in range(count):
        x = cx + (random.random() - 0.5) * w
        y = cy + (random.random() - 0.5) * h
        z = cz + (random.random() - 0.5) * d
        positions.append([x, y, z])
        # Gray-ish color with slight variation
        gray = 100 + random.randint(0, 55)
        colors.append([gray, gray, gray])

    return {
        "positions": positions,
        "colors": colors,
        "point_count": count,
    }


def transform_scan_to_equipment(scan: dict) -> dict:
    """Transform equipment_scans row to frontend Equipment format."""
    return {
        "equipment_id": scan["scan_code"],
        "name": scan.get("name", ""),
        "site_id": scan["line_id"],
        "equipment_type": scan.get("equipment_type_code", "UNKNOWN"),
        "zone": scan.get("zone", ""),
        "centroid_x": scan["centroid_x"],
        "centroid_y": scan["centroid_y"],
        "centroid_z": scan["centroid_z"],
        "size_w": scan["size_w"],
        "size_h": scan["size_h"],
        "size_d": scan["size_d"],
        "point_count": scan.get("point_count", 0),
        "verified": scan.get("verified", False),
        "note": scan.get("note", ""),
        "scan_date": scan.get("scan_date"),
    }


@router.get("/factories/{factory_code}")
def list_equipment_by_factory(factory_code: str, db: Client = Depends(get_supabase)):
    """공장 코드로 전체 설비 목록 조회 (모든 라인 포함)."""
    try:
        # First get factory_id
        factory_resp = (
            db.table("factories")
            .select("id")
            .eq("code", factory_code)
            .single()
            .execute()
        )

        if not factory_resp.data:
            raise HTTPException(status_code=404, detail="공장을 찾을 수 없습니다.")

        factory_id = factory_resp.data["id"]

        # Get all lines in this factory
        lines_resp = (
            db.table("production_lines")
            .select("id, code")
            .eq("factory_id", factory_id)
            .execute()
        )

        if not lines_resp.data:
            return []

        line_ids = [str(line["id"]) for line in lines_resp.data]
        line_code_map = {str(line["id"]): line["code"] for line in lines_resp.data}

        # Get all equipment scans for these lines
        resp = (
            db.table("equipment_scans")
            .select("*, equipment_types(code)")
            .in_("line_id", line_ids)
            .order("scan_code")
            .execute()
        )

        # Transform to frontend format with line_code
        result = []
        for scan in resp.data:
            eq = transform_scan_to_equipment(scan)
            if scan.get("equipment_types"):
                eq["equipment_type"] = scan["equipment_types"]["code"]
            eq["line_code"] = line_code_map.get(str(scan["line_id"]), "")
            result.append(eq)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설비 조회 실패: {str(e)}")


@router.get("/lines/{line_code}")
def list_equipment_by_line(line_code: str, db: Client = Depends(get_supabase)):
    """라인(사이트) 코드로 설비 목록 조회."""
    # First get line_id from production_lines
    line_resp = (
        db.table("production_lines")
        .select("id")
        .eq("code", line_code)
        .single()
        .execute()
    )

    if not line_resp.data:
        raise HTTPException(status_code=404, detail="라인을 찾을 수 없습니다.")

    line_id = line_resp.data["id"]

    # Get equipment scans with type info
    resp = (
        db.table("equipment_scans")
        .select("*, equipment_types(code)")
        .eq("line_id", line_id)
        .order("scan_code")
        .execute()
    )

    # Transform to frontend format
    result = []
    for scan in resp.data:
        eq = transform_scan_to_equipment(scan)
        if scan.get("equipment_types"):
            eq["equipment_type"] = scan["equipment_types"]["code"]
        result.append(eq)

    return result


# Points endpoint - MUST be before /{site_id}/{equipment_id} to avoid route conflict
@router.get("/{equipment_id}/points")
def get_equipment_points(
    equipment_id: str,
    lod: Literal["high", "medium", "low"] = "high",
    db: Client = Depends(get_supabase),
):
    """설비 포인트클라우드 데이터 조회."""
    resp = (
        db.table("equipment_scans")
        .select("ply_url, centroid_x, centroid_y, centroid_z, size_w, size_h, size_d, point_count")
        .eq("scan_code", equipment_id)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="설비를 찾을 수 없습니다.")

    ply_url = resp.data.get("ply_url")

    # If no PLY URL, generate mock point cloud from centroid/size
    if not ply_url:
        return generate_mock_points(resp.data, lod)

    # Load and return point cloud data
    max_points = get_lod_max_points(lod)
    try:
        points_data = load_points_from_ply(ply_url, max_points)
        return points_data
    except Exception as e:
        # Fallback to mock data if PLY loading fails
        return generate_mock_points(resp.data, lod)


# Stats endpoint - MUST be before /{site_id}/{equipment_id} to avoid route conflict
@router.get("/{site_id}/stats/summary")
def get_site_stats(site_id: str, db: Client = Depends(get_supabase)):
    """검수 현황 통계."""
    line_resp = (
        db.table("production_lines")
        .select("id")
        .eq("code", site_id)
        .single()
        .execute()
    )

    if not line_resp.data:
        return {"total": 0, "verified": 0, "pending": 0, "by_type": {}}

    line_id = line_resp.data["id"]

    rows = (
        db.table("equipment_scans")
        .select("verified, equipment_types(code)")
        .eq("line_id", line_id)
        .execute()
        .data
    )

    total = len(rows)
    verified = sum(1 for r in rows if r.get("verified"))
    by_type = {}
    for r in rows:
        eq_type = r.get("equipment_types", {}).get("code", "UNKNOWN") if r.get("equipment_types") else "UNKNOWN"
        by_type[eq_type] = by_type.get(eq_type, 0) + 1

    return {
        "total": total,
        "verified": verified,
        "pending": total - verified,
        "by_type": by_type,
    }


# Legacy route for backward compatibility
@router.get("/{site_id}")
def list_equipment(site_id: str, db: Client = Depends(get_supabase)):
    """사이트(라인 코드)의 전체 설비 목록 반환."""
    return list_equipment_by_line(site_id, db)


@router.get("/{site_id}/{equipment_id}")
def get_equipment(site_id: str, equipment_id: str, db: Client = Depends(get_supabase)):
    """단일 설비 조회."""
    resp = (
        db.table("equipment_scans")
        .select("*, equipment_types(code)")
        .eq("scan_code", equipment_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="설비를 찾을 수 없습니다.")

    eq = transform_scan_to_equipment(resp.data)
    if resp.data.get("equipment_types"):
        eq["equipment_type"] = resp.data["equipment_types"]["code"]
    return eq


@router.patch("/{equipment_id}")
def update_equipment(
    equipment_id: str,
    body: EquipmentUpdate,
    db: Client = Depends(get_supabase),
):
    """설비 이름, 타입, 구역, 검수 상태, 메모, 위치, 크기 업데이트."""
    update_data = {}

    if body.name is not None:
        update_data["name"] = body.name
    if body.zone is not None:
        update_data["zone"] = body.zone
    if body.verified is not None:
        update_data["verified"] = body.verified
    if body.note is not None:
        update_data["note"] = body.note
    if body.equipment_type is not None:
        # Look up equipment_type_id from code
        type_resp = (
            db.table("equipment_types")
            .select("id")
            .eq("code", body.equipment_type)
            .execute()
        )
        if type_resp.data and len(type_resp.data) > 0:
            update_data["equipment_type_id"] = type_resp.data[0]["id"]

    # Position fields
    if body.centroid_x is not None:
        update_data["centroid_x"] = body.centroid_x
    if body.centroid_y is not None:
        update_data["centroid_y"] = body.centroid_y
    if body.centroid_z is not None:
        update_data["centroid_z"] = body.centroid_z

    # Size fields
    if body.size_w is not None:
        update_data["size_w"] = body.size_w
    if body.size_d is not None:
        update_data["size_d"] = body.size_d
    if body.size_h is not None:
        update_data["size_h"] = body.size_h

    if not update_data:
        raise HTTPException(status_code=400, detail="변경할 항목이 없습니다.")

    resp = (
        db.table("equipment_scans")
        .update(update_data)
        .eq("scan_code", equipment_id)
        .execute()
    )

    # Return updated record
    if resp.data:
        return transform_scan_to_equipment(resp.data[0])
    return {}


@router.post("/")
def create_equipment(
    body: EquipmentCreate,
    db: Client = Depends(get_supabase),
):
    """새 설비 생성."""
    # Check if scan_code already exists
    existing = (
        db.table("equipment_scans")
        .select("id")
        .eq("scan_code", body.scan_code)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="이미 존재하는 설비 코드입니다.")

    # Get equipment_type_id if code provided
    equipment_type_id = None
    if body.equipment_type:
        type_resp = (
            db.table("equipment_types")
            .select("id")
            .eq("code", body.equipment_type)
            .execute()
        )
        if type_resp.data and len(type_resp.data) > 0:
            equipment_type_id = type_resp.data[0]["id"]

    insert_data = {
        "line_id": body.line_id,
        "scan_code": body.scan_code,
        "name": body.name or "",
        "equipment_type_id": equipment_type_id,
        "zone": body.zone or "",
        "centroid_x": body.centroid_x,
        "centroid_y": body.centroid_y,
        "centroid_z": body.centroid_z,
        "size_w": body.size_w,
        "size_h": body.size_h,
        "size_d": body.size_d,
        "point_count": 0,
        "verified": False,
        "note": body.note or "",
    }

    try:
        resp = db.table("equipment_scans").insert(insert_data).execute()
        if resp.data:
            return transform_scan_to_equipment(resp.data[0])
        raise HTTPException(status_code=500, detail="설비 생성 실패")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설비 생성 실패: {str(e)}")


@router.delete("/{equipment_id}")
def delete_equipment(
    equipment_id: str,
    db: Client = Depends(get_supabase),
):
    """설비 삭제."""
    # Check if equipment exists
    existing = (
        db.table("equipment_scans")
        .select("id")
        .eq("scan_code", equipment_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="설비를 찾을 수 없습니다.")

    try:
        db.table("equipment_scans").delete().eq("scan_code", equipment_id).execute()
        return {"deleted": equipment_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설비 삭제 실패: {str(e)}")


@router.post("/{equipment_id}/split", response_model=SplitResponse)
def split_equipment(
    equipment_id: str,
    body: SplitRequest,
    db: Client = Depends(get_supabase),
):
    """설비를 평면을 기준으로 두 개로 분할."""
    resp = (
        db.table("equipment_scans")
        .select("*")
        .eq("scan_code", equipment_id)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="설비를 찾을 수 없습니다.")

    original = resp.data
    plane_normal = body.plane_normal
    offset = 0.5

    # Create equipment A (positive side)
    eq_a_data = {
        "scan_code": f"{equipment_id}_A",
        "line_id": original["line_id"],
        "equipment_type_id": original.get("equipment_type_id"),
        "zone": original.get("zone"),
        "scan_date": original.get("scan_date"),
        "centroid_x": original["centroid_x"] + plane_normal[0] * offset,
        "centroid_y": original["centroid_y"] + plane_normal[1] * offset,
        "centroid_z": original["centroid_z"] + plane_normal[2] * offset,
        "size_w": original["size_w"] * 0.5,
        "size_h": original["size_h"],
        "size_d": original["size_d"] * 0.5,
        "point_count": original.get("point_count", 0) // 2,
        "verified": False,
        "note": f"분할됨: {equipment_id}",
    }

    # Create equipment B (negative side)
    eq_b_data = {
        "scan_code": f"{equipment_id}_B",
        "line_id": original["line_id"],
        "equipment_type_id": original.get("equipment_type_id"),
        "zone": original.get("zone"),
        "scan_date": original.get("scan_date"),
        "centroid_x": original["centroid_x"] - plane_normal[0] * offset,
        "centroid_y": original["centroid_y"] - plane_normal[1] * offset,
        "centroid_z": original["centroid_z"] - plane_normal[2] * offset,
        "size_w": original["size_w"] * 0.5,
        "size_h": original["size_h"],
        "size_d": original["size_d"] * 0.5,
        "point_count": original.get("point_count", 0) - original.get("point_count", 0) // 2,
        "verified": False,
        "note": f"분할됨: {equipment_id}",
    }

    try:
        db.table("equipment_scans").insert(eq_a_data).execute()
        db.table("equipment_scans").insert(eq_b_data).execute()
        db.table("equipment_scans").delete().eq("scan_code", equipment_id).execute()

        return SplitResponse(
            equipment_a=EquipmentOut(
                equipment_id=eq_a_data["scan_code"],
                site_id=str(eq_a_data["line_id"]),
                equipment_type="UNKNOWN",
                zone=eq_a_data.get("zone", ""),
                centroid_x=eq_a_data["centroid_x"],
                centroid_y=eq_a_data["centroid_y"],
                centroid_z=eq_a_data["centroid_z"],
                size_w=eq_a_data["size_w"],
                size_h=eq_a_data["size_h"],
                size_d=eq_a_data["size_d"],
                point_count=eq_a_data["point_count"],
                verified=False,
            ),
            equipment_b=EquipmentOut(
                equipment_id=eq_b_data["scan_code"],
                site_id=str(eq_b_data["line_id"]),
                equipment_type="UNKNOWN",
                zone=eq_b_data.get("zone", ""),
                centroid_x=eq_b_data["centroid_x"],
                centroid_y=eq_b_data["centroid_y"],
                centroid_z=eq_b_data["centroid_z"],
                size_w=eq_b_data["size_w"],
                size_h=eq_b_data["size_h"],
                size_d=eq_b_data["size_d"],
                point_count=eq_b_data["point_count"],
                verified=False,
            ),
            original_id=equipment_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분할 작업 실패: {str(e)}")


@router.patch("/{equipment_id}/points", response_model=PointsUpdateResponse)
def update_equipment_points_endpoint(
    equipment_id: str,
    body: PointsUpdateRequest,
    db: Client = Depends(get_supabase),
):
    """설비 포인트클라우드 업데이트."""
    if body.include_indices and not body.source_equipment_id:
        raise HTTPException(status_code=400, detail="include_indices 사용 시 source_equipment_id 필요")

    if not body.exclude_indices and not body.include_indices:
        raise HTTPException(status_code=400, detail="exclude_indices 또는 include_indices 중 하나는 필수")

    resp = (
        db.table("equipment_scans")
        .select("*")
        .eq("scan_code", equipment_id)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="설비를 찾을 수 없습니다.")

    original = resp.data
    current_points = original.get("point_count", 0)

    excluded_count = len(body.exclude_indices) if body.exclude_indices else 0
    included_count = len(body.include_indices) if body.include_indices else 0
    new_point_count = max(1, current_points - excluded_count + included_count)

    try:
        db.table("equipment_scans").update({
            "point_count": new_point_count,
            "note": f"포인트 수정됨: -{excluded_count}, +{included_count}"
        }).eq("scan_code", equipment_id).execute()

        return PointsUpdateResponse(
            equipment_id=equipment_id,
            point_count=new_point_count,
            centroid_x=original["centroid_x"],
            centroid_y=original["centroid_y"],
            centroid_z=original["centroid_z"],
            size_w=original["size_w"],
            size_h=original["size_h"],
            size_d=original["size_d"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"포인트 업데이트 실패: {str(e)}")

"""
tagger.py — 설비 클러스터 메타데이터 태깅
크기·위치 기반으로 설비 타입을 1차 추정하고,
수동 보정 또는 CAD 매핑으로 정교화할 수 있는 구조.
"""

from datetime import date
from typing import Optional


# 설비 타입 추정 기준 (높이 × 바닥면적 → 타입)
# 현장별로 조정 필요 — 여기선 일반 제조현장 기준
EQUIPMENT_TYPE_RULES = [
    {"label": "CNC_MCT",      "h_min": 1.0, "h_max": 3.0, "area_min": 2.0,  "area_max": 20.0},
    {"label": "CONVEYOR",     "h_min": 0.5, "h_max": 1.5, "area_min": 5.0,  "area_max": 50.0},
    {"label": "RACK",         "h_min": 1.5, "h_max": 6.0, "area_min": 0.5,  "area_max": 5.0},
    {"label": "CONTROL_PANEL","h_min": 0.8, "h_max": 2.5, "area_min": 0.1,  "area_max": 1.0},
    {"label": "COLUMN",       "h_min": 2.5, "h_max": 8.0, "area_min": 0.05, "area_max": 0.5},
]


def _estimate_type(size: list) -> str:
    """바운딩 박스 크기(x,y,z)로 설비 타입 1차 추정."""
    w, d, h = size
    area = w * d
    for rule in EQUIPMENT_TYPE_RULES:
        if rule["h_min"] <= h <= rule["h_max"] and rule["area_min"] <= area <= rule["area_max"]:
            return rule["label"]
    return "UNKNOWN"


def tag_metadata(
    clusters: list[dict],
    site_id: str,
    scan_date: Optional[str] = None,
    operator: Optional[str] = None,
) -> list[dict]:
    """
    각 클러스터에 메타데이터를 추가하여 반환.

    equipment_id: {site_id}_EQ_{순번:04d}  →  예) SITE_001_EQ_0001
    타입은 크기 기반 자동 추정 + 수동 보정 가능 (equipment_type 필드를 직접 수정)
    """
    today = scan_date or date.today().isoformat()
    tagged = []

    for i, cluster in enumerate(clusters):
        eq_id = f"{site_id}_EQ_{i+1:04d}"
        eq_type = _estimate_type(cluster["bbox"]["size"])

        tagged.append({
            **cluster,
            "equipment_id": eq_id,
            "equipment_type": eq_type,
            "site_id": site_id,
            "scan_date": today,
            "operator": operator or "",
            "verified": False,        # 수동 검수 전까지 False
            "note": "",
        })

    return tagged

"""
exporter.py — DB 적재용 출력
Supabase 테이블 구조에 맞는 JSON 생성 + 설비별 PLY 파일 저장
"""

import json
from pathlib import Path

import numpy as np
import open3d as o3d


def export_for_db(
    floor_pcd: o3d.geometry.PointCloud,
    equipment_clusters: list[dict],
    origin: np.ndarray,
    site_id: str,
    output_dir: str,
) -> dict:
    """
    출력물:
      {output_dir}/
        floor.ply                      ← 바닥 포인트클라우드 (Supabase Storage에 업로드)
        equipment/{eq_id}.ply          ← 설비별 포인트클라우드
        equipment_metadata.json        ← Supabase equipment_scans 테이블 적재용
        scan_origin.json               ← 역변환용 기준점 저장
        pipeline_summary.json          ← 파이프라인 실행 요약
    """
    dst = Path(output_dir)
    eq_dir = dst / "equipment"
    eq_dir.mkdir(parents=True, exist_ok=True)

    # ── 바닥 PLY
    floor_path = dst / "floor.ply"
    o3d.io.write_point_cloud(str(floor_path), floor_pcd)

    # ── 설비별 PLY + 메타 레코드
    records = []
    for cluster in equipment_clusters:
        eq_id = cluster["equipment_id"]
        ply_path = eq_dir / f"{eq_id}.ply"
        o3d.io.write_point_cloud(str(ply_path), cluster["pcd"])

        # Supabase equipment_scans 테이블 행
        record = {
            "equipment_id":   eq_id,
            "site_id":        cluster["site_id"],
            "equipment_type": cluster["equipment_type"],
            "scan_date":      cluster["scan_date"],
            "operator":       cluster["operator"],
            "centroid_x":     round(cluster["centroid"][0], 4),
            "centroid_y":     round(cluster["centroid"][1], 4),
            "centroid_z":     round(cluster["centroid"][2], 4),
            "bbox_min":       [round(v, 4) for v in cluster["bbox"]["min"]],
            "bbox_max":       [round(v, 4) for v in cluster["bbox"]["max"]],
            "size_w":         round(cluster["bbox"]["size"][0], 4),
            "size_d":         round(cluster["bbox"]["size"][1], 4),
            "size_h":         round(cluster["bbox"]["size"][2], 4),
            "point_count":    cluster["point_count"],
            "ply_path":       str(ply_path.relative_to(dst)),
            "verified":       cluster["verified"],
            "note":           cluster["note"],
        }
        records.append(record)

    # ── equipment_metadata.json
    meta_path = dst / "equipment_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    # ── scan_origin.json (역변환용)
    origin_path = dst / "scan_origin.json"
    with open(origin_path, "w", encoding="utf-8") as f:
        json.dump({
            "site_id": site_id,
            "origin_x": float(origin[0]),
            "origin_y": float(origin[1]),
            "origin_z": float(origin[2]),
        }, f, indent=2)

    # ── pipeline_summary.json
    summary = {
        "site_id": site_id,
        "floor_point_count": len(floor_pcd.points),
        "equipment_count": len(equipment_clusters),
        "equipment_types": {},
        "output_dir": str(dst),
    }
    for r in records:
        t = r["equipment_type"]
        summary["equipment_types"][t] = summary["equipment_types"].get(t, 0) + 1

    return {
        "summary": summary,
        "records": records,
        "floor_path": str(floor_path),
    }

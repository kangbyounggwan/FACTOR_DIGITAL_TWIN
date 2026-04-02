"""
normalize.py — 좌표 정규화
현장 포인트클라우드의 절대 좌표를 로컬 기준점 기준으로 이동.
DB 저장 및 웹 렌더링 시 수치 안정성 확보.
"""

import numpy as np
import open3d as o3d


def normalize_coordinates(
    pcd: o3d.geometry.PointCloud,
    anchor: str = "min",          # "min" | "centroid" | "floor_center"
) -> tuple[o3d.geometry.PointCloud, np.ndarray]:
    """
    포인트클라우드를 로컬 좌표계로 이동.

    anchor 옵션:
      "min"          — 바운딩 박스 최솟값을 원점으로 (창고·공장 레이아웃에 직관적)
      "centroid"     — 질량 중심을 원점으로 (구형 객체, 단일 설비에 적합)
      "floor_center" — 바닥 중심을 원점으로 (건물 전체 스캔에 적합)

    반환:
      pcd    — 이동된 포인트클라우드
      origin — 원래 좌표계의 기준점 (Supabase에 저장해두면 역변환 가능)
    """
    pts = np.asarray(pcd.points)

    if anchor == "min":
        origin = pts.min(axis=0)
    elif anchor == "centroid":
        origin = pts.mean(axis=0)
    elif anchor == "floor_center":
        # z 최솟값(바닥)에서 x, y 중심을 기준점으로
        z_min = pts[:, 2].min()
        floor_mask = pts[:, 2] < (z_min + 0.1)
        floor_pts = pts[floor_mask]
        cx = (floor_pts[:, 0].max() + floor_pts[:, 0].min()) / 2
        cy = (floor_pts[:, 1].max() + floor_pts[:, 1].min()) / 2
        origin = np.array([cx, cy, z_min])
    else:
        raise ValueError(f"anchor 옵션 오류: {anchor}")

    shifted = pts - origin
    result = o3d.geometry.PointCloud()
    result.points = o3d.utility.Vector3dVector(shifted)
    if pcd.has_colors():
        result.colors = pcd.colors
    if pcd.has_normals():
        result.normals = pcd.normals

    return result, origin

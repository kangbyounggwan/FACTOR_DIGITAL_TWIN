"""
segment.py — 세그멘테이션
1. 바닥면 분리: RANSAC 평면 추정
2. 설비 클러스터링: DBSCAN
"""

import numpy as np
import open3d as o3d


def segment_floor(
    pcd: o3d.geometry.PointCloud,
    distance_threshold: float = 0.02,
    ransac_n: int = 3,
    num_iterations: int = 1000,
) -> tuple[o3d.geometry.PointCloud, o3d.geometry.PointCloud]:
    """
    RANSAC으로 가장 큰 평면(바닥) 분리.
    반환: (floor_pcd, non_floor_pcd)

    distance_threshold: 평면 모델에서 인라이어로 볼 최대 거리(m)
    일반 제조현장 콘크리트 바닥 → 0.02~0.03m 적합
    """
    plane_model, inliers = pcd.segment_plane(
        distance_threshold=distance_threshold,
        ransac_n=ransac_n,
        num_iterations=num_iterations,
    )
    floor_pcd = pcd.select_by_index(inliers)
    non_floor_pcd = pcd.select_by_index(inliers, invert=True)
    return floor_pcd, non_floor_pcd


def segment_equipment(
    pcd: o3d.geometry.PointCloud,
    eps: float = 0.3,
    min_points: int = 50,
) -> list[dict]:
    """
    DBSCAN 클러스터링으로 설비별 분리.
    각 클러스터를 설비 후보로 반환.

    eps:        같은 클러스터로 묶을 최대 거리(m). 설비 간격이 좁으면 줄여야 함.
    min_points: 최소 포인트 수 미만 클러스터는 노이즈로 제외.

    반환: [{"id": int, "pcd": PointCloud, "bbox": BoundingBox, "centroid": [x,y,z]}, ...]
    """
    labels = np.array(
        pcd.cluster_dbscan(eps=eps, min_points=min_points, print_progress=False)
    )

    clusters = []
    unique_labels = set(labels)
    unique_labels.discard(-1)  # -1 = 노이즈

    for label in sorted(unique_labels):
        indices = np.where(labels == label)[0]
        cluster_pcd = pcd.select_by_index(indices.tolist())

        bbox = cluster_pcd.get_axis_aligned_bounding_box()
        centroid = np.asarray(cluster_pcd.points).mean(axis=0)

        clusters.append({
            "id": int(label),
            "pcd": cluster_pcd,
            "bbox": {
                "min": bbox.min_bound.tolist(),
                "max": bbox.max_bound.tolist(),
                "size": (bbox.max_bound - bbox.min_bound).tolist(),
            },
            "centroid": centroid.tolist(),
            "point_count": len(cluster_pcd.points),
        })

    return clusters

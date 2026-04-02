"""
filters.py — 다운샘플링 & 노이즈 제거
"""

import open3d as o3d


def voxel_downsample(pcd: o3d.geometry.PointCloud, voxel_size: float) -> o3d.geometry.PointCloud:
    """
    Voxel Grid 다운샘플링.
    voxel_size=0.05 → 5cm 격자 (제조현장 기준. 창고/물류는 0.1, 정밀부품은 0.02 권장)
    """
    return pcd.voxel_down_sample(voxel_size=voxel_size)


def remove_outliers(
    pcd: o3d.geometry.PointCloud,
    nb_neighbors: int = 20,
    std_ratio: float = 2.0,
) -> o3d.geometry.PointCloud:
    """
    Statistical Outlier Removal.
    - nb_neighbors: 이웃 포인트 수 (많을수록 엄격)
    - std_ratio: 평균 거리의 몇 배 초과 시 제거 (작을수록 엄격)
    현장 먼지·사람·이동 물체로 생긴 노이즈 제거에 효과적.
    """
    cleaned, _ = pcd.remove_statistical_outlier(
        nb_neighbors=nb_neighbors,
        std_ratio=std_ratio,
    )
    return cleaned

"""
loaders.py — E57 / LAS / PLY 포맷 통합 로더
E57: pye57 사용 (산업용 스캐너 표준 포맷)
LAS/LAZ: laspy 사용
PLY: open3d 기본
"""

from pathlib import Path
import numpy as np
import open3d as o3d


def load_pointcloud(path: str) -> o3d.geometry.PointCloud:
    """파일 확장자에 따라 자동으로 적합한 로더를 선택."""
    ext = Path(path).suffix.lower()
    if ext == ".e57":
        return _load_e57(path)
    elif ext in (".las", ".laz"):
        return _load_las(path)
    elif ext == ".ply":
        return o3d.io.read_point_cloud(path)
    else:
        raise ValueError(f"지원하지 않는 포맷: {ext}  (E57 / LAS / LAZ / PLY 만 지원)")


def _load_e57(path: str) -> o3d.geometry.PointCloud:
    """
    E57 → Open3D PointCloud 변환
    pye57 라이브러리 필요: pip install pye57
    복수 스캔 포함 E57의 경우 전체를 합쳐서 반환.
    """
    try:
        import pye57
    except ImportError:
        raise ImportError("E57 로더 필요: pip install pye57")

    e57 = pye57.E57(path)
    all_xyz = []
    all_rgb = []

    for i in range(e57.scan_count):
        data = e57.read_scan(i, ignore_missing_fields=True)

        x = data.get("cartesianX", np.array([]))
        y = data.get("cartesianY", np.array([]))
        z = data.get("cartesianZ", np.array([]))

        if len(x) == 0:
            continue

        xyz = np.column_stack([x, y, z])
        # NaN / Inf 제거
        mask = np.isfinite(xyz).all(axis=1)
        all_xyz.append(xyz[mask])

        # 컬러 정보가 있으면 수집
        if all(k in data for k in ("colorRed", "colorGreen", "colorBlue")):
            rgb = np.column_stack([
                data["colorRed"][mask] / 255.0,
                data["colorGreen"][mask] / 255.0,
                data["colorBlue"][mask] / 255.0,
            ])
            all_rgb.append(rgb)

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(np.vstack(all_xyz))
    if all_rgb and len(all_rgb) == len(all_xyz):
        pcd.colors = o3d.utility.Vector3dVector(np.vstack(all_rgb))

    return pcd


def _load_las(path: str) -> o3d.geometry.PointCloud:
    """
    LAS / LAZ → Open3D PointCloud 변환
    laspy 라이브러리 필요: pip install laspy lazrs-python
    """
    try:
        import laspy
    except ImportError:
        raise ImportError("LAS 로더 필요: pip install laspy lazrs-python")

    las = laspy.read(path)
    xyz = np.column_stack([las.x, las.y, las.z])

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(xyz)

    # RGB가 있으면 0-1 스케일로 정규화
    if hasattr(las, "red") and hasattr(las, "green") and hasattr(las, "blue"):
        max_val = 65535.0 if las.red.max() > 255 else 255.0
        rgb = np.column_stack([las.red, las.green, las.blue]) / max_val
        pcd.colors = o3d.utility.Vector3dVector(rgb)

    return pcd

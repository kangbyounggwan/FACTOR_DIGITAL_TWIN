"""Point cloud loading and processing service."""

import os
import tempfile
from typing import Literal, Optional

import numpy as np
import httpx
import open3d as o3d


def get_lod_max_points(lod: Literal["high", "medium", "low"]) -> int:
    """Get maximum point count for given LOD level."""
    lod_limits = {
        "high": 500000,
        "medium": 100000,
        "low": 20000
    }
    return lod_limits.get(lod, 500000)


def load_points_from_ply(ply_url: str, max_points: int = 500000) -> dict:
    """
    Load point cloud from PLY file and return as JSON-serializable format.

    Args:
        ply_url: URL to PLY file in Supabase storage
        max_points: Maximum number of points to return (downsample if exceeded)

    Returns:
        Dictionary with positions, colors, and point_count
    """
    # Download PLY file from URL
    response = httpx.get(ply_url, timeout=60.0)
    response.raise_for_status()

    # Save to temporary file for parsing
    with tempfile.NamedTemporaryFile(suffix=".ply", delete=False) as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    try:
        # Parse PLY file using Open3D
        pcd = o3d.io.read_point_cloud(tmp_path)
        positions = np.asarray(pcd.points)

        # Handle colors - Open3D normalizes to 0-1
        if pcd.has_colors():
            colors = np.asarray(pcd.colors)
            # Convert to 0-255 range
            if colors.max() <= 1.0:
                colors = (colors * 255).astype(np.uint8)
            else:
                colors = colors.astype(np.uint8)
        else:
            # Default gray color if no colors
            colors = np.full((len(positions), 3), 128, dtype=np.uint8)

    finally:
        os.unlink(tmp_path)

    # Downsample if exceeding max_points
    if len(positions) > max_points:
        indices = np.random.choice(len(positions), max_points, replace=False)
        indices.sort()  # Maintain spatial coherence
        positions = positions[indices]
        colors = colors[indices]

    return {
        "positions": positions.tolist(),  # [[x, y, z], ...]
        "colors": colors.tolist(),         # [[r, g, b], ...]
        "point_count": len(positions)
    }


def load_points_from_local_ply(ply_path: str, max_points: int = 500000) -> dict:
    """
    Load point cloud from local PLY file.

    Args:
        ply_path: Path to local PLY file
        max_points: Maximum number of points to return

    Returns:
        Dictionary with positions, colors, and point_count
    """
    pcd = o3d.io.read_point_cloud(ply_path)
    positions = np.asarray(pcd.points)

    if pcd.has_colors():
        colors = np.asarray(pcd.colors)
        if colors.max() <= 1.0:
            colors = (colors * 255).astype(np.uint8)
        else:
            colors = colors.astype(np.uint8)
    else:
        colors = np.full((len(positions), 3), 128, dtype=np.uint8)

    # Downsample if exceeding max_points
    if len(positions) > max_points:
        indices = np.random.choice(len(positions), max_points, replace=False)
        indices.sort()
        positions = positions[indices]
        colors = colors[indices]

    return {
        "positions": positions.tolist(),
        "colors": colors.tolist(),
        "point_count": len(positions)
    }

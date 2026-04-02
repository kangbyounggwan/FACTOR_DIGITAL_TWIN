# Section 03: Point Cloud Data Endpoint

**Status:** Pending
**Dependencies:** Requires nothing | Blocks Section 04 (Frontend View Mode Toggle)

---

## Background

The FACTOR Digital Twin equipment registration system currently renders registered equipment as simple 3D bounding boxes. While functional, this provides limited visual fidelity - users cannot see the actual LiDAR scan data that represents the equipment geometry.

This section implements a backend endpoint that serves point cloud data (positions and colors) for each equipment item. The PLY files containing point cloud data are already stored in Supabase storage during the pipeline processing phase. This endpoint makes that data accessible to the frontend for high-fidelity 3D visualization.

This is a foundational feature that enables:
- Visual verification of equipment boundaries
- More accurate equipment editing (split, selection) in later sections
- Better user confidence in AI-detected equipment regions

---

## Requirements

When this section is complete:

1. A new REST endpoint `GET /equipment/{equipment_id}/points` exists and is accessible
2. The endpoint loads PLY files from Supabase storage
3. The endpoint returns point positions and colors in JSON format
4. Large point clouds are automatically downsampled to prevent browser memory issues
5. Level-of-detail (LOD) parameter allows requesting different point densities
6. Response size stays manageable (< 50MB for maximum point count)

---

## Technical Context

### Current Architecture
- **Backend:** FastAPI application in `backend/app/`
- **Storage:** Supabase storage contains PLY files uploaded during pipeline processing
- **Equipment Data:** Each equipment record includes a `ply_url` field pointing to its point cloud file
- **Existing Endpoints:** Equipment CRUD operations exist in `backend/app/api/endpoints/equipment.py`

### PLY File Format
PLY (Polygon File Format) files contain:
- Vertex positions (x, y, z coordinates)
- Vertex colors (r, g, b values, typically 0-255)
- Optional: normals, faces, custom properties

The endpoint must parse PLY files and extract position/color data.

---

## Implementation Details

### Files to Create

#### 1. `backend/app/services/pointcloud.py`

Create a new service module for point cloud operations:

```python
# backend/app/services/pointcloud.py
import numpy as np
from typing import Optional, Literal
import tempfile
import httpx

def load_points_from_ply(ply_url: str, max_points: int = 500000) -> dict:
    """
    Load point cloud from PLY file and return as JSON-serializable format.

    Args:
        ply_url: URL to PLY file in Supabase storage
        max_points: Maximum number of points to return (downsample if exceeded)

    Returns:
        Dictionary with positions, colors, and point_count
    """
    # Download PLY file from Supabase storage
    response = httpx.get(ply_url)
    response.raise_for_status()

    # Save to temporary file for parsing
    with tempfile.NamedTemporaryFile(suffix=".ply", delete=False) as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    # Parse PLY file using Open3D or plyfile library
    try:
        import open3d as o3d
        pcd = o3d.io.read_point_cloud(tmp_path)
        positions = np.asarray(pcd.points)
        colors = np.asarray(pcd.colors)  # Already normalized 0-1 by Open3D

        # Convert colors to 0-255 range if needed
        if colors.max() <= 1.0:
            colors = (colors * 255).astype(np.uint8)
    finally:
        import os
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


def get_lod_max_points(lod: Literal["high", "medium", "low"]) -> int:
    """Get maximum point count for given LOD level."""
    lod_limits = {
        "high": 500000,
        "medium": 100000,
        "low": 20000
    }
    return lod_limits.get(lod, 500000)
```

### Files to Modify

#### 2. `backend/app/api/endpoints/equipment.py`

Add the new endpoint to the existing equipment router:

```python
# Add imports at top of file
from typing import Literal
from app.services.pointcloud import load_points_from_ply, get_lod_max_points

# Add new endpoint
@router.get("/{equipment_id}/points")
async def get_equipment_points(
    equipment_id: str,
    lod: Literal["high", "medium", "low"] = "high"
):
    """
    Get point cloud data for equipment visualization.

    Args:
        equipment_id: UUID of the equipment
        lod: Level of detail - high (500K), medium (100K), low (20K) points

    Returns:
        JSON with positions, colors arrays and point_count
    """
    # Fetch equipment record to get PLY URL
    equipment = await get_equipment_by_id(equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    if not equipment.ply_url:
        raise HTTPException(status_code=404, detail="No point cloud data available")

    # Load and return point cloud data
    max_points = get_lod_max_points(lod)
    try:
        points_data = load_points_from_ply(equipment.ply_url, max_points)
        return points_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load point cloud: {str(e)}")
```

### API Response Schema

The endpoint returns:

```json
{
  "positions": [[x1, y1, z1], [x2, y2, z2], ...],
  "colors": [[r1, g1, b1], [r2, g2, b2], ...],
  "point_count": 250000
}
```

- `positions`: Array of [x, y, z] coordinate triplets (floats)
- `colors`: Array of [r, g, b] color triplets (integers 0-255)
- `point_count`: Total number of points in response

### Dependencies to Install

Ensure the backend has required packages:

```
# Add to backend/requirements.txt if not present
open3d>=0.17.0
httpx>=0.24.0
```

Alternative: If Open3D is too heavy, use `plyfile` package instead:

```python
# Alternative implementation using plyfile
from plyfile import PlyData

def load_points_from_ply(ply_url: str, max_points: int = 500000) -> dict:
    response = httpx.get(ply_url)
    response.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix=".ply", delete=False) as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    try:
        plydata = PlyData.read(tmp_path)
        vertex = plydata['vertex']

        positions = np.column_stack([
            vertex['x'], vertex['y'], vertex['z']
        ])

        # Colors may be 'red','green','blue' or 'r','g','b'
        try:
            colors = np.column_stack([
                vertex['red'], vertex['green'], vertex['blue']
            ])
        except ValueError:
            colors = np.column_stack([
                vertex['r'], vertex['g'], vertex['b']
            ])
    finally:
        os.unlink(tmp_path)

    # Downsample if needed
    if len(positions) > max_points:
        indices = np.random.choice(len(positions), max_points, replace=False)
        indices.sort()
        positions = positions[indices]
        colors = colors[indices]

    return {
        "positions": positions.tolist(),
        "colors": colors.astype(int).tolist(),
        "point_count": len(positions)
    }
```

---

## Performance Considerations

### Response Size
- 500K points with float32 positions = ~6MB raw data
- JSON encoding adds overhead (~3-4x for numbers)
- Expected response size: 20-30MB for high LOD
- Enable gzip compression on FastAPI to reduce transfer size

### Enabling Compression

Add middleware to FastAPI app:

```python
# backend/app/main.py
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### Future Optimizations (Not Required for This Section)
- Binary ArrayBuffer format instead of JSON
- Progressive loading (first 100K, then rest on demand)
- Server-side caching of processed point clouds
- Pre-computed LOD files stored alongside original PLY

---

## Acceptance Criteria

- [ ] `GET /equipment/{id}/points` endpoint exists and returns 200 OK
- [ ] Response contains `positions` array with [x, y, z] triplets
- [ ] Response contains `colors` array with [r, g, b] triplets
- [ ] Response contains `point_count` integer
- [ ] `lod` query parameter accepts "high", "medium", "low" values
- [ ] High LOD returns up to 500,000 points
- [ ] Medium LOD returns up to 100,000 points
- [ ] Low LOD returns up to 20,000 points
- [ ] Downsampling works correctly when PLY exceeds max points
- [ ] Response size is manageable (< 50MB for 500K points)
- [ ] 404 returned when equipment not found
- [ ] 404 returned when equipment has no ply_url
- [ ] 500 returned with error message on PLY parsing failure

---

## Testing

### Manual Testing

```bash
# Test high LOD (default)
curl http://localhost:8000/equipment/{equipment_id}/points

# Test medium LOD
curl http://localhost:8000/equipment/{equipment_id}/points?lod=medium

# Test low LOD
curl http://localhost:8000/equipment/{equipment_id}/points?lod=low

# Test non-existent equipment
curl http://localhost:8000/equipment/00000000-0000-0000-0000-000000000000/points
# Expected: 404
```

### Unit Test

```python
# backend/tests/test_pointcloud.py
import pytest
from app.services.pointcloud import load_points_from_ply, get_lod_max_points

def test_get_lod_max_points():
    assert get_lod_max_points("high") == 500000
    assert get_lod_max_points("medium") == 100000
    assert get_lod_max_points("low") == 20000
    assert get_lod_max_points("invalid") == 500000  # Default

def test_load_points_downsampling(mock_ply_url):
    # Create a mock PLY with 1M points
    result = load_points_from_ply(mock_ply_url, max_points=100)
    assert result["point_count"] == 100
    assert len(result["positions"]) == 100
    assert len(result["colors"]) == 100

def test_load_points_structure(mock_ply_url):
    result = load_points_from_ply(mock_ply_url, max_points=10)
    # Check position structure
    assert all(len(p) == 3 for p in result["positions"])
    # Check color structure
    assert all(len(c) == 3 for c in result["colors"])
    # Check color range
    assert all(0 <= v <= 255 for c in result["colors"] for v in c)
```

---

## Files Summary

| Action | File Path |
|--------|-----------|
| CREATE | `backend/app/services/pointcloud.py` |
| MODIFY | `backend/app/api/endpoints/equipment.py` |
| MODIFY | `backend/requirements.txt` (add open3d or plyfile) |
| MODIFY | `backend/app/main.py` (add GZip middleware - optional) |
| CREATE | `backend/tests/test_pointcloud.py` (optional) |

---

## Completion Checklist

When implementing this section:

1. [ ] Create `pointcloud.py` service with `load_points_from_ply` function
2. [ ] Add PLY parsing library to requirements.txt
3. [ ] Add `/points` endpoint to equipment router
4. [ ] Test endpoint with real equipment ID
5. [ ] Verify LOD parameter affects point count
6. [ ] Verify response structure matches schema
7. [ ] Test error cases (404, 500)
8. [ ] Enable gzip compression if response size is large
9. [ ] Update API documentation if using OpenAPI/Swagger

---

## Next Section

After completing this section, proceed to **Section 04: Frontend View Mode Toggle** which will consume this endpoint to render point clouds in the browser.

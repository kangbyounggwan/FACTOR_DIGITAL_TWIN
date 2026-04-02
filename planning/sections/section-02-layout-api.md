# Section 02: Layout API Endpoints

**Track:** A (Layout Versioning)
**Status:** Not Started
**Estimated Effort:** 2-3 hours

---

## Background

The FACTOR Digital Twin system currently stores equipment positions in the `equipment_scans` table as original scan data. However, users need the ability to:

1. Save different layout configurations (snapshots of equipment positions)
2. Switch between layouts to compare arrangements
3. Activate a specific layout for the 3D/2D viewers
4. Clone existing layouts as a starting point for new arrangements

This section implements the FastAPI backend endpoints for layout CRUD operations, building on the database schema created in Section 01.

---

## Dependencies

### Requires (must be completed first)
- **Section 01: Layout DB Schema** - The `layouts` and `layout_equipment` tables must exist in the database

### Blocks (cannot start until this is complete)
- **Section 03: Layout Hooks** - Frontend hooks depend on these API endpoints

### Can Run In Parallel With
- **Section 06: CRUD APIs** (Track B)

---

## Requirements

When this section is complete, the following must be true:

1. All 8 layout API endpoints are implemented and functional
2. Pydantic schemas validate all request/response data
3. The router is registered in `main.py`
4. All endpoints handle errors gracefully with appropriate HTTP status codes
5. The single-active-layout constraint is enforced via database trigger (from Section 01)

---

## Implementation Details

### File Structure

```
backend/app/
├── schemas/
│   └── layout.py          # NEW - Pydantic models for layouts
├── api/
│   ├── layouts.py         # NEW - Layout API endpoints
│   └── __init__.py        # EXISTS (currently empty)
└── main.py                # MODIFY - Add layouts router
```

---

### File 1: `backend/app/schemas/layout.py` (NEW)

Create this file with all Pydantic models for layout operations:

```python
"""
Pydantic schemas for layout versioning system.

Layouts store snapshots of equipment positions for a factory.
Each factory can have multiple layouts, but only one can be active at a time.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class LayoutEquipmentPosition(BaseModel):
    """Position and size data for a single equipment in a layout."""
    equipment_id: str = Field(..., description="UUID of the equipment")
    centroid_x: float = Field(..., description="X coordinate of equipment center")
    centroid_y: float = Field(..., description="Y coordinate of equipment center")
    centroid_z: float = Field(..., description="Z coordinate of equipment center")
    size_w: float = Field(..., description="Width (X dimension)")
    size_h: float = Field(..., description="Height (Z dimension)")
    size_d: float = Field(..., description="Depth (Y dimension)")


class LayoutCreate(BaseModel):
    """Request body for creating a new layout."""
    name: str = Field(..., min_length=1, max_length=100, description="Layout name")
    description: Optional[str] = Field(None, max_length=500, description="Optional description")
    equipment_positions: List[LayoutEquipmentPosition] = Field(
        ...,
        description="List of all equipment positions to save in this layout"
    )


class LayoutUpdate(BaseModel):
    """Request body for updating layout metadata (name/description only)."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class LayoutResponse(BaseModel):
    """Response model for layout list and basic operations."""
    id: str
    factory_id: str
    name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    equipment_count: int = Field(..., description="Number of equipment in this layout")


class LayoutDetailResponse(LayoutResponse):
    """Extended response with full equipment position data."""
    equipment_positions: List[LayoutEquipmentPosition]


class LayoutCompareResponse(BaseModel):
    """Response for comparing two layouts."""
    changed_equipment_count: int = Field(
        ...,
        description="Equipment present in both layouts (may have different positions)"
    )
    added_equipment_count: int = Field(
        ...,
        description="Equipment in target layout but not in active layout"
    )
    removed_equipment_count: int = Field(
        ...,
        description="Equipment in active layout but not in target layout"
    )
```

---

### File 2: `backend/app/api/layouts.py` (NEW)

Create this file with all layout API endpoints:

```python
"""
Layout API endpoints for the FACTOR Digital Twin system.

Provides CRUD operations for layout versioning:
- List layouts for a factory
- Create new layout (save current positions)
- Get layout details (with equipment positions)
- Update layout metadata
- Delete layout
- Activate layout
- Clone layout
- Compare layout with active layout
"""
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from typing import List

from app.core.supabase import get_supabase
from app.schemas.layout import (
    LayoutCreate,
    LayoutUpdate,
    LayoutResponse,
    LayoutDetailResponse,
    LayoutEquipmentPosition,
    LayoutCompareResponse,
)

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================

def _get_factory_id_by_code(db: Client, factory_code: str) -> str:
    """
    Resolve factory code to factory ID.
    Raises HTTPException 404 if factory not found.
    """
    result = db.table("factories").select("id").eq("code", factory_code).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Factory '{factory_code}' not found")
    return result.data["id"]


def _build_layout_response(layout_data: dict, equipment_count: int) -> LayoutResponse:
    """Build LayoutResponse from database row."""
    return LayoutResponse(
        id=layout_data["id"],
        factory_id=layout_data["factory_id"],
        name=layout_data["name"],
        description=layout_data.get("description"),
        is_active=layout_data["is_active"],
        created_at=layout_data["created_at"],
        updated_at=layout_data["updated_at"],
        equipment_count=equipment_count,
    )


# =============================================================================
# Layout List & Create (Factory-scoped)
# =============================================================================

@router.get("/factories/{factory_code}/layouts", response_model=List[LayoutResponse])
def list_factory_layouts(factory_code: str, db: Client = Depends(get_supabase)):
    """
    Get all layouts for a factory.

    Returns layouts sorted by creation date (newest first).
    Each layout includes the count of equipment positions stored.

    Args:
        factory_code: The factory's unique code (e.g., "FACTORY001")

    Returns:
        List of layouts with metadata and equipment counts
    """
    factory_id = _get_factory_id_by_code(db, factory_code)

    # Query layouts with equipment count using Supabase's count aggregation
    result = db.table("layouts") \
        .select("*, layout_equipment(count)") \
        .eq("factory_id", factory_id) \
        .order("created_at", desc=True) \
        .execute()

    layouts = []
    for row in result.data:
        # Extract count from nested aggregation result
        equipment_count = 0
        if row.get("layout_equipment"):
            # Supabase returns [{"count": N}] for count aggregation
            equipment_count = row["layout_equipment"][0].get("count", 0)

        layouts.append(_build_layout_response(row, equipment_count))

    return layouts


@router.post("/factories/{factory_code}/layouts", response_model=LayoutResponse, status_code=201)
def create_layout(
    factory_code: str,
    body: LayoutCreate,
    db: Client = Depends(get_supabase)
):
    """
    Create a new layout for a factory.

    Saves the current equipment positions as a new layout snapshot.
    The layout is created as inactive by default.

    Args:
        factory_code: The factory's unique code
        body: Layout name, description, and equipment positions

    Returns:
        The created layout with metadata
    """
    factory_id = _get_factory_id_by_code(db, factory_code)

    # 1. Create the layout record
    layout_result = db.table("layouts").insert({
        "factory_id": factory_id,
        "name": body.name,
        "description": body.description,
        "is_active": False,
    }).execute()

    if not layout_result.data:
        raise HTTPException(status_code=500, detail="Failed to create layout")

    layout = layout_result.data[0]

    # 2. Insert all equipment positions
    if body.equipment_positions:
        positions_to_insert = [
            {
                "layout_id": layout["id"],
                "equipment_id": pos.equipment_id,
                "centroid_x": pos.centroid_x,
                "centroid_y": pos.centroid_y,
                "centroid_z": pos.centroid_z,
                "size_w": pos.size_w,
                "size_h": pos.size_h,
                "size_d": pos.size_d,
            }
            for pos in body.equipment_positions
        ]

        positions_result = db.table("layout_equipment").insert(positions_to_insert).execute()

        if not positions_result.data:
            # Rollback: delete the layout if positions failed
            db.table("layouts").delete().eq("id", layout["id"]).execute()
            raise HTTPException(status_code=500, detail="Failed to save equipment positions")

    return _build_layout_response(layout, len(body.equipment_positions))


# =============================================================================
# Layout Detail Operations
# =============================================================================

@router.get("/layouts/{layout_id}", response_model=LayoutDetailResponse)
def get_layout_detail(layout_id: str, db: Client = Depends(get_supabase)):
    """
    Get detailed layout information including all equipment positions.

    Args:
        layout_id: UUID of the layout

    Returns:
        Layout metadata plus full list of equipment positions
    """
    # Get layout metadata
    layout_result = db.table("layouts").select("*").eq("id", layout_id).single().execute()

    if not layout_result.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    layout = layout_result.data

    # Get all equipment positions for this layout
    positions_result = db.table("layout_equipment") \
        .select("*") \
        .eq("layout_id", layout_id) \
        .execute()

    positions = [
        LayoutEquipmentPosition(
            equipment_id=p["equipment_id"],
            centroid_x=p["centroid_x"],
            centroid_y=p["centroid_y"],
            centroid_z=p["centroid_z"],
            size_w=p["size_w"],
            size_h=p["size_h"],
            size_d=p["size_d"],
        )
        for p in positions_result.data
    ]

    return LayoutDetailResponse(
        id=layout["id"],
        factory_id=layout["factory_id"],
        name=layout["name"],
        description=layout.get("description"),
        is_active=layout["is_active"],
        created_at=layout["created_at"],
        updated_at=layout["updated_at"],
        equipment_count=len(positions),
        equipment_positions=positions,
    )


@router.put("/layouts/{layout_id}", response_model=LayoutResponse)
def update_layout(
    layout_id: str,
    body: LayoutUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update layout metadata (name and/or description).

    Note: This does not update equipment positions. To update positions,
    create a new layout or use the clone feature.

    Args:
        layout_id: UUID of the layout
        body: Fields to update (name, description)

    Returns:
        Updated layout metadata
    """
    # Build update dict with only provided fields
    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.description is not None:
        update_data["description"] = body.description

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Supabase doesn't support SQL functions in updates, so we fetch and return
    result = db.table("layouts") \
        .update(update_data) \
        .eq("id", layout_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Get equipment count
    count_result = db.table("layout_equipment") \
        .select("id", count="exact") \
        .eq("layout_id", layout_id) \
        .execute()

    return _build_layout_response(result.data[0], count_result.count or 0)


@router.delete("/layouts/{layout_id}")
def delete_layout(layout_id: str, db: Client = Depends(get_supabase)):
    """
    Delete a layout and all its equipment positions.

    The layout_equipment records are automatically deleted via CASCADE.

    Args:
        layout_id: UUID of the layout to delete

    Returns:
        Success message
    """
    # Check if layout exists first
    check_result = db.table("layouts").select("id, is_active").eq("id", layout_id).single().execute()

    if not check_result.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    if check_result.data["is_active"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete active layout. Activate another layout first."
        )

    # Delete the layout (CASCADE will delete layout_equipment)
    db.table("layouts").delete().eq("id", layout_id).execute()

    return {"message": "Layout deleted successfully"}


# =============================================================================
# Layout Actions
# =============================================================================

@router.post("/layouts/{layout_id}/activate", response_model=LayoutResponse)
def activate_layout(layout_id: str, db: Client = Depends(get_supabase)):
    """
    Activate a layout for use in the 3D/2D viewers.

    Only one layout can be active per factory at a time.
    The database trigger automatically deactivates other layouts.

    Args:
        layout_id: UUID of the layout to activate

    Returns:
        The activated layout
    """
    # Update the layout to active
    # The database trigger (ensure_single_active_layout) handles deactivating others
    result = db.table("layouts") \
        .update({"is_active": True}) \
        .eq("id", layout_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Get equipment count
    count_result = db.table("layout_equipment") \
        .select("id", count="exact") \
        .eq("layout_id", layout_id) \
        .execute()

    return _build_layout_response(result.data[0], count_result.count or 0)


@router.post("/layouts/{layout_id}/clone", response_model=LayoutResponse, status_code=201)
def clone_layout(layout_id: str, db: Client = Depends(get_supabase)):
    """
    Create a copy of an existing layout.

    The cloned layout will have "(Copy)" appended to the name
    and will be created as inactive.

    Args:
        layout_id: UUID of the layout to clone

    Returns:
        The newly created layout
    """
    # 1. Get the original layout
    original_result = db.table("layouts").select("*").eq("id", layout_id).single().execute()

    if not original_result.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    original = original_result.data

    # 2. Create new layout with copied metadata
    new_layout_result = db.table("layouts").insert({
        "factory_id": original["factory_id"],
        "name": f"{original['name']} (Copy)",
        "description": original.get("description"),
        "is_active": False,
    }).execute()

    if not new_layout_result.data:
        raise HTTPException(status_code=500, detail="Failed to create layout copy")

    new_layout = new_layout_result.data[0]

    # 3. Copy all equipment positions
    positions_result = db.table("layout_equipment") \
        .select("*") \
        .eq("layout_id", layout_id) \
        .execute()

    if positions_result.data:
        new_positions = [
            {
                "layout_id": new_layout["id"],
                "equipment_id": p["equipment_id"],
                "centroid_x": p["centroid_x"],
                "centroid_y": p["centroid_y"],
                "centroid_z": p["centroid_z"],
                "size_w": p["size_w"],
                "size_h": p["size_h"],
                "size_d": p["size_d"],
            }
            for p in positions_result.data
        ]

        db.table("layout_equipment").insert(new_positions).execute()

    return _build_layout_response(new_layout, len(positions_result.data))


@router.get("/layouts/{layout_id}/compare", response_model=LayoutCompareResponse)
def compare_layout(layout_id: str, db: Client = Depends(get_supabase)):
    """
    Compare a layout with the currently active layout.

    Returns counts of:
    - Changed equipment: present in both layouts
    - Added equipment: in target layout but not active
    - Removed equipment: in active layout but not target

    If no layout is active, compares against an empty set.

    Args:
        layout_id: UUID of the layout to compare

    Returns:
        Comparison statistics
    """
    # Get the target layout's factory
    target_result = db.table("layouts") \
        .select("factory_id") \
        .eq("id", layout_id) \
        .single() \
        .execute()

    if not target_result.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    factory_id = target_result.data["factory_id"]

    # Find the active layout for this factory
    active_result = db.table("layouts") \
        .select("id") \
        .eq("factory_id", factory_id) \
        .eq("is_active", True) \
        .execute()

    # Get equipment IDs in target layout
    target_positions = db.table("layout_equipment") \
        .select("equipment_id") \
        .eq("layout_id", layout_id) \
        .execute()

    target_ids = {p["equipment_id"] for p in target_positions.data}

    # Get equipment IDs in active layout (if any)
    active_ids = set()
    if active_result.data:
        active_layout_id = active_result.data[0]["id"]

        # Don't compare with self
        if active_layout_id == layout_id:
            return LayoutCompareResponse(
                changed_equipment_count=len(target_ids),
                added_equipment_count=0,
                removed_equipment_count=0,
            )

        active_positions = db.table("layout_equipment") \
            .select("equipment_id") \
            .eq("layout_id", active_layout_id) \
            .execute()

        active_ids = {p["equipment_id"] for p in active_positions.data}

    # Calculate differences
    common = target_ids & active_ids
    added = target_ids - active_ids
    removed = active_ids - target_ids

    return LayoutCompareResponse(
        changed_equipment_count=len(common),
        added_equipment_count=len(added),
        removed_equipment_count=len(removed),
    )


# =============================================================================
# Get Active Layout for Factory (Convenience Endpoint)
# =============================================================================

@router.get("/factories/{factory_code}/layouts/active", response_model=LayoutDetailResponse)
def get_active_layout(factory_code: str, db: Client = Depends(get_supabase)):
    """
    Get the currently active layout for a factory.

    This is a convenience endpoint for the viewers to load
    the active layout's equipment positions.

    Args:
        factory_code: The factory's unique code

    Returns:
        The active layout with full equipment positions,
        or 404 if no layout is active
    """
    factory_id = _get_factory_id_by_code(db, factory_code)

    # Find active layout
    layout_result = db.table("layouts") \
        .select("*") \
        .eq("factory_id", factory_id) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not layout_result.data:
        raise HTTPException(status_code=404, detail="No active layout found for this factory")

    layout = layout_result.data

    # Get equipment positions
    positions_result = db.table("layout_equipment") \
        .select("*") \
        .eq("layout_id", layout["id"]) \
        .execute()

    positions = [
        LayoutEquipmentPosition(
            equipment_id=p["equipment_id"],
            centroid_x=p["centroid_x"],
            centroid_y=p["centroid_y"],
            centroid_z=p["centroid_z"],
            size_w=p["size_w"],
            size_h=p["size_h"],
            size_d=p["size_d"],
        )
        for p in positions_result.data
    ]

    return LayoutDetailResponse(
        id=layout["id"],
        factory_id=layout["factory_id"],
        name=layout["name"],
        description=layout.get("description"),
        is_active=layout["is_active"],
        created_at=layout["created_at"],
        updated_at=layout["updated_at"],
        equipment_count=len(positions),
        equipment_positions=positions,
    )
```

---

### File 3: `backend/app/main.py` (MODIFY)

Add the layouts router to the existing `main.py`:

**Current imports section (line 8):**
```python
from app.api import equipment, pipeline, sites, factories, companies, equipment_types
```

**Change to:**
```python
from app.api import equipment, pipeline, sites, factories, companies, equipment_types, layouts
```

**Current router includes (after line 34):**
```python
app.include_router(sites.router,     prefix="/api/sites",     tags=["sites"])
```

**Add after this line:**
```python
app.include_router(layouts.router,   prefix="/api",           tags=["layouts"])
```

**Note:** The layouts router uses `/api` as prefix because it has both `/factories/{code}/layouts` and `/layouts/{id}` endpoints built into the router itself.

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/factories/{factory_code}/layouts` | List all layouts for a factory |
| POST | `/api/factories/{factory_code}/layouts` | Create new layout |
| GET | `/api/factories/{factory_code}/layouts/active` | Get active layout with positions |
| GET | `/api/layouts/{layout_id}` | Get layout detail with positions |
| PUT | `/api/layouts/{layout_id}` | Update layout name/description |
| DELETE | `/api/layouts/{layout_id}` | Delete layout |
| POST | `/api/layouts/{layout_id}/activate` | Activate layout |
| POST | `/api/layouts/{layout_id}/clone` | Clone layout |
| GET | `/api/layouts/{layout_id}/compare` | Compare with active layout |

---

## Testing Commands

After implementation, test the endpoints using curl or the FastAPI Swagger UI at `http://localhost:8000/docs`.

### Test 1: List Layouts (should return empty array initially)
```bash
curl http://localhost:8000/api/factories/FACTORY001/layouts
```

### Test 2: Create Layout
```bash
curl -X POST http://localhost:8000/api/factories/FACTORY001/layouts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Initial Layout",
    "description": "First layout version",
    "equipment_positions": [
      {
        "equipment_id": "uuid-here",
        "centroid_x": 10.0,
        "centroid_y": 5.0,
        "centroid_z": 0.0,
        "size_w": 2.0,
        "size_h": 1.5,
        "size_d": 3.0
      }
    ]
  }'
```

### Test 3: Get Layout Detail
```bash
curl http://localhost:8000/api/layouts/{layout_id}
```

### Test 4: Activate Layout
```bash
curl -X POST http://localhost:8000/api/layouts/{layout_id}/activate
```

### Test 5: Clone Layout
```bash
curl -X POST http://localhost:8000/api/layouts/{layout_id}/clone
```

### Test 6: Compare Layout
```bash
curl http://localhost:8000/api/layouts/{layout_id}/compare
```

### Test 7: Delete Layout
```bash
curl -X DELETE http://localhost:8000/api/layouts/{layout_id}
```

---

## Acceptance Criteria

- [ ] `backend/app/schemas/layout.py` created with all Pydantic models
- [ ] `backend/app/api/layouts.py` created with all endpoint implementations
- [ ] `backend/app/main.py` modified to include layouts router
- [ ] **GET** `/api/factories/{factory_code}/layouts` - Returns list of layouts
- [ ] **POST** `/api/factories/{factory_code}/layouts` - Creates new layout with positions
- [ ] **GET** `/api/factories/{factory_code}/layouts/active` - Returns active layout
- [ ] **GET** `/api/layouts/{layout_id}` - Returns layout detail with positions
- [ ] **PUT** `/api/layouts/{layout_id}` - Updates name/description
- [ ] **DELETE** `/api/layouts/{layout_id}` - Deletes layout (fails if active)
- [ ] **POST** `/api/layouts/{layout_id}/activate` - Activates layout
- [ ] **POST** `/api/layouts/{layout_id}/clone` - Creates copy of layout
- [ ] **GET** `/api/layouts/{layout_id}/compare` - Compares with active layout
- [ ] All endpoints return appropriate HTTP status codes (200, 201, 400, 404, 500)
- [ ] FastAPI Swagger docs display all endpoints at `/docs`
- [ ] Backend server starts without import errors

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/app/schemas/layout.py` | CREATE | Pydantic models for layout API |
| `backend/app/api/layouts.py` | CREATE | Layout API endpoint implementations |
| `backend/app/main.py` | MODIFY | Add layouts router import and registration |

---

## Error Handling Reference

| Status Code | When Used |
|-------------|-----------|
| 200 | Successful GET, PUT, DELETE operations |
| 201 | Successful POST (create/clone) operations |
| 400 | Invalid request (no fields to update, trying to delete active layout) |
| 404 | Layout or factory not found |
| 500 | Database operation failed |

---

## Notes for Implementer

1. **Factory Code vs ID**: The API uses factory codes (e.g., "FACTORY001") in URLs for user-friendliness, but internally converts to UUIDs using `_get_factory_id_by_code()`.

2. **Single Active Layout**: The database trigger from Section 01 ensures only one layout is active per factory. You don't need to implement this logic in the API.

3. **Cascade Delete**: When a layout is deleted, all its `layout_equipment` records are automatically deleted via the CASCADE constraint from Section 01.

4. **Equipment Position Storage**: The layout stores position snapshots independent of the original `equipment_scans` table. This allows comparing different arrangements without modifying the original data.

5. **No Authentication**: Current implementation has no auth. This will be added in a future section if needed.

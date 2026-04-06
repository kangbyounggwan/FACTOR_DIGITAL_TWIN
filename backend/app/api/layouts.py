"""
FACTOR Digital Twin - Layout Versioning API
Endpoints for layout CRUD, activation, cloning, and comparison.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from typing import Optional, List
from uuid import UUID

from app.core.supabase import get_supabase, fetch_one
from app.schemas.layout import (
    LayoutCreate,
    LayoutUpdate,
    LayoutOut,
    LayoutDetailOut,
    LayoutEquipmentCreate,
    LayoutEquipmentOut,
    LayoutActivateResponse,
    LayoutCloneRequest,
    LayoutCompareResponse,
    SaveLayoutFromViewerRequest,
)

router = APIRouter()


# ============================================
# Static paths FIRST (before /{layout_id} routes)
# ============================================

@router.get("/", response_model=List[LayoutOut])
def list_layouts(
    factory_id: Optional[UUID] = Query(None, description="Filter by factory ID"),
    db: Client = Depends(get_supabase),
):
    """Get all layouts, optionally filtered by factory."""
    query = db.table("layouts").select("*")

    if factory_id:
        query = query.eq("factory_id", str(factory_id))

    query = query.order("created_at", desc=True)
    resp = query.execute()

    return resp.data


@router.post("/", response_model=LayoutDetailOut, status_code=201)
def create_layout(
    layout: LayoutCreate,
    db: Client = Depends(get_supabase),
):
    """Create a new layout with optional equipment positions."""
    # Verify factory exists
    fetch_one(db, "factories", "id", str(layout.factory_id), select="id", label="Factory")

    # Create layout
    layout_data = {
        "factory_id": str(layout.factory_id),
        "name": layout.name,
        "description": layout.description,
        "is_active": layout.is_active,
        "equipment_count": len(layout.equipment) if layout.equipment else 0,
        "floor_x": layout.floor_x,
        "floor_y": layout.floor_y,
        "floor_width": layout.floor_width,
        "floor_height": layout.floor_height,
        "background_image": layout.background_image,
        "background_opacity": layout.background_opacity,
    }

    layout_resp = db.table("layouts").insert(layout_data).execute()
    created_layout = layout_resp.data[0]

    # Insert equipment positions if provided
    equipment_out = []
    if layout.equipment:
        # Look up actual UUIDs from scan_codes
        scan_codes = [eq.equipment_id for eq in layout.equipment]
        eq_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("scan_code", scan_codes)
            .execute()
        )
        scan_to_uuid = {e["scan_code"]: e["id"] for e in eq_lookup_resp.data}

        equipment_records = []
        for eq in layout.equipment:
            equipment_uuid = scan_to_uuid.get(eq.equipment_id)
            if not equipment_uuid:
                continue
            equipment_records.append({
                "layout_id": created_layout["id"],
                "equipment_id": equipment_uuid,
                "centroid_x": eq.centroid_x,
                "centroid_y": eq.centroid_y,
                "centroid_z": eq.centroid_z,
                "size_w": eq.size_w,
                "size_h": eq.size_h,
                "size_d": eq.size_d,
                "rotation_x": eq.rotation_x,
                "rotation_y": eq.rotation_y,
                "rotation_z": eq.rotation_z,
            })

        if equipment_records:
            eq_resp = db.table("layout_equipment").insert(equipment_records).execute()
            equipment_out = eq_resp.data

    return {
        **created_layout,
        "equipment": equipment_out,
    }


@router.get("/factory/{factory_id}/active", response_model=Optional[LayoutDetailOut])
def get_active_layout(
    factory_id: UUID,
    db: Client = Depends(get_supabase),
):
    """Get the currently active layout for a factory."""
    layout_resp = (
        db.table("layouts")
        .select("*")
        .eq("factory_id", str(factory_id))
        .eq("is_active", True)
        .execute()
    )

    if not layout_resp.data:
        return None

    layout = layout_resp.data[0]

    # Get equipment positions
    eq_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", layout["id"])
        .execute()
    )

    # Convert UUIDs back to scan_codes for frontend
    equipment_out = []
    if eq_resp.data:
        eq_uuids = [eq["equipment_id"] for eq in eq_resp.data]
        scan_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("id", eq_uuids)
            .execute()
        )
        uuid_to_scan = {e["id"]: e["scan_code"] for e in scan_lookup_resp.data}

        for eq in eq_resp.data:
            scan_code = uuid_to_scan.get(eq["equipment_id"])
            if scan_code:
                equipment_out.append({
                    **eq,
                    "equipment_id": scan_code,
                })

    return {
        **layout,
        "equipment": equipment_out,
    }


@router.get("/compare/{layout_a_id}/{layout_b_id}", response_model=LayoutCompareResponse)
def compare_layouts(
    layout_a_id: UUID,
    layout_b_id: UUID,
    db: Client = Depends(get_supabase),
):
    """
    Compare two layouts and return differences.
    - added: equipment only in layout B
    - removed: equipment only in layout A
    - moved: equipment in both but with different positions
    """
    # Get equipment from both layouts
    eq_a_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", str(layout_a_id))
        .execute()
    )

    eq_b_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", str(layout_b_id))
        .execute()
    )

    # Build lookup maps
    eq_a_map = {eq["equipment_id"]: eq for eq in eq_a_resp.data}
    eq_b_map = {eq["equipment_id"]: eq for eq in eq_b_resp.data}

    ids_a = set(eq_a_map.keys())
    ids_b = set(eq_b_map.keys())

    # Find differences
    added = list(ids_b - ids_a)
    removed = list(ids_a - ids_b)

    # Find moved (in both but different position)
    moved = []
    for eq_id in (ids_a & ids_b):
        a = eq_a_map[eq_id]
        b = eq_b_map[eq_id]

        # Check if position or rotation changed
        position_changed = (
            a["centroid_x"] != b["centroid_x"] or
            a["centroid_y"] != b["centroid_y"] or
            a["centroid_z"] != b["centroid_z"]
        )
        rotation_changed = (
            a.get("rotation_x", 0) != b.get("rotation_x", 0) or
            a.get("rotation_y", 0) != b.get("rotation_y", 0) or
            a.get("rotation_z", 0) != b.get("rotation_z", 0)
        )

        if position_changed or rotation_changed:
            moved.append(eq_id)

    return LayoutCompareResponse(
        added=added,
        removed=removed,
        moved=moved,
    )


@router.post("/save-from-viewer", response_model=LayoutDetailOut, status_code=201)
def save_layout_from_viewer(
    request: SaveLayoutFromViewerRequest,
    db: Client = Depends(get_supabase),
):
    """
    Save current 3D viewer state as a new layout.
    Called by the editor UI when user clicks "Save Layout".
    """
    # Verify factory exists
    fetch_one(db, "factories", "id", str(request.factory_id), select="id", label="Factory")

    # Create layout
    layout_data = {
        "factory_id": str(request.factory_id),
        "name": request.name,
        "description": request.description,
        "is_active": request.set_active,
        "equipment_count": len(request.equipment),
        "floor_x": request.floor_x,
        "floor_y": request.floor_y,
        "floor_width": request.floor_width,
        "floor_height": request.floor_height,
        "background_image": request.background_image,
        "background_opacity": request.background_opacity,
    }

    layout_resp = db.table("layouts").insert(layout_data).execute()
    created_layout = layout_resp.data[0]

    # Insert equipment positions
    equipment_out = []
    if request.equipment:
        # Look up actual UUIDs from scan_codes
        scan_codes = [eq.equipment_id for eq in request.equipment]

        eq_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("scan_code", scan_codes)
            .execute()
        )

        scan_to_uuid = {e["scan_code"]: e["id"] for e in eq_lookup_resp.data}

        equipment_records = []
        for eq in request.equipment:
            equipment_uuid = scan_to_uuid.get(eq.equipment_id)
            if not equipment_uuid:
                continue
            equipment_records.append({
                "layout_id": created_layout["id"],
                "equipment_id": equipment_uuid,
                "centroid_x": eq.centroid_x,
                "centroid_y": eq.centroid_y,
                "centroid_z": eq.centroid_z,
                "size_w": eq.size_w,
                "size_h": eq.size_h,
                "size_d": eq.size_d,
                "rotation_x": eq.rotation_x,
                "rotation_y": eq.rotation_y,
                "rotation_z": eq.rotation_z,
            })

        if equipment_records:
            eq_resp = db.table("layout_equipment").insert(equipment_records).execute()
            equipment_out = eq_resp.data

    return {
        **created_layout,
        "equipment": equipment_out,
    }


# ============================================
# Layout CRUD - Dynamic routes (/{layout_id})
# ============================================

@router.get("/{layout_id}", response_model=LayoutDetailOut)
def get_layout(
    layout_id: UUID,
    db: Client = Depends(get_supabase),
):
    """Get layout details with all equipment positions."""
    layout = fetch_one(db, "layouts", "id", str(layout_id), label="Layout")

    # Get equipment positions
    eq_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", str(layout_id))
        .execute()
    )

    # Convert UUIDs back to scan_codes for frontend
    equipment_out = []
    if eq_resp.data:
        eq_uuids = [eq["equipment_id"] for eq in eq_resp.data]

        scan_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("id", eq_uuids)
            .execute()
        )
        uuid_to_scan = {e["id"]: e["scan_code"] for e in scan_lookup_resp.data}

        for eq in eq_resp.data:
            scan_code = uuid_to_scan.get(eq["equipment_id"])
            if scan_code:
                equipment_out.append({
                    **eq,
                    "equipment_id": scan_code,
                })

    return {
        **layout,
        "equipment": equipment_out,
    }


@router.patch("/{layout_id}", response_model=LayoutOut)
def update_layout(
    layout_id: UUID,
    layout: LayoutUpdate,
    db: Client = Depends(get_supabase),
):
    """Update layout metadata (name, description, floor bounds)."""
    # Build update data
    update_data = {}
    if layout.name is not None:
        update_data["name"] = layout.name
    if layout.description is not None:
        update_data["description"] = layout.description
    if layout.floor_x is not None:
        update_data["floor_x"] = layout.floor_x
    if layout.floor_y is not None:
        update_data["floor_y"] = layout.floor_y
    if layout.floor_width is not None:
        update_data["floor_width"] = layout.floor_width
    if layout.floor_height is not None:
        update_data["floor_height"] = layout.floor_height
    if layout.background_image is not None:
        update_data["background_image"] = layout.background_image
    if layout.background_opacity is not None:
        update_data["background_opacity"] = layout.background_opacity

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    resp = (
        db.table("layouts")
        .update(update_data)
        .eq("id", str(layout_id))
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    return resp.data[0]


@router.delete("/{layout_id}", status_code=204)
def delete_layout(
    layout_id: UUID,
    db: Client = Depends(get_supabase),
):
    """Delete a layout and all its equipment positions (CASCADE)."""
    fetch_one(db, "layouts", "id", str(layout_id), select="id", label="Layout")

    # Delete layout (layout_equipment will cascade)
    db.table("layouts").delete().eq("id", str(layout_id)).execute()

    return None


# ============================================
# Layout Activation
# ============================================

@router.post("/{layout_id}/activate", response_model=LayoutActivateResponse)
def activate_layout(
    layout_id: UUID,
    db: Client = Depends(get_supabase),
):
    """
    Set a layout as active for its factory.
    The database trigger automatically deactivates other layouts.
    """
    layout = fetch_one(db, "layouts", "id", str(layout_id), select="id, factory_id, is_active", label="Layout")
    factory_id = layout["factory_id"]

    # Find currently active layouts (before update)
    active_resp = (
        db.table("layouts")
        .select("id")
        .eq("factory_id", factory_id)
        .eq("is_active", True)
        .neq("id", str(layout_id))
        .execute()
    )

    deactivated_ids = [UUID(l["id"]) for l in active_resp.data]

    # Activate this layout (trigger will deactivate others)
    db.table("layouts").update({"is_active": True}).eq("id", str(layout_id)).execute()

    return LayoutActivateResponse(
        activated_id=layout_id,
        deactivated_ids=deactivated_ids,
    )


# ============================================
# Layout Clone
# ============================================

@router.post("/{layout_id}/clone", response_model=LayoutDetailOut, status_code=201)
def clone_layout(
    layout_id: UUID,
    clone_req: LayoutCloneRequest,
    db: Client = Depends(get_supabase),
):
    """Clone an existing layout with a new name."""
    source = fetch_one(db, "layouts", "id", str(layout_id), label="Source layout")

    # Get source equipment positions
    eq_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", str(layout_id))
        .execute()
    )

    # Create new layout
    new_layout_data = {
        "factory_id": source["factory_id"],
        "name": clone_req.new_name,
        "description": clone_req.new_description or source.get("description"),
        "is_active": False,  # Clones are never active by default
        "equipment_count": len(eq_resp.data),
        "floor_x": source.get("floor_x"),
        "floor_y": source.get("floor_y"),
        "floor_width": source.get("floor_width"),
        "floor_height": source.get("floor_height"),
        "background_image": source.get("background_image"),
        "background_opacity": source.get("background_opacity"),
    }

    new_layout_resp = db.table("layouts").insert(new_layout_data).execute()
    new_layout = new_layout_resp.data[0]

    # Copy equipment positions
    equipment_out = []
    if eq_resp.data:
        equipment_records = []
        for eq in eq_resp.data:
            equipment_records.append({
                "layout_id": new_layout["id"],
                "equipment_id": eq["equipment_id"],
                "centroid_x": eq["centroid_x"],
                "centroid_y": eq["centroid_y"],
                "centroid_z": eq["centroid_z"],
                "size_w": eq["size_w"],
                "size_h": eq["size_h"],
                "size_d": eq["size_d"],
                "rotation_x": eq.get("rotation_x", 0),
                "rotation_y": eq.get("rotation_y", 0),
                "rotation_z": eq.get("rotation_z", 0),
            })

        new_eq_resp = db.table("layout_equipment").insert(equipment_records).execute()
        equipment_out = new_eq_resp.data

    return {
        **new_layout,
        "equipment": equipment_out,
    }


# ============================================
# Update Equipment Positions in Layout
# ============================================

@router.put("/{layout_id}/equipment", response_model=LayoutDetailOut)
def update_layout_equipment(
    layout_id: UUID,
    equipment: List[LayoutEquipmentCreate],
    db: Client = Depends(get_supabase),
):
    """
    Replace all equipment positions in a layout.
    Used when saving changes from the editor.
    """
    layout = fetch_one(db, "layouts", "id", str(layout_id), label="Layout")

    # Delete existing equipment positions
    db.table("layout_equipment").delete().eq("layout_id", str(layout_id)).execute()

    # Insert new positions
    equipment_out = []
    if equipment:
        # Look up actual UUIDs from scan_codes
        scan_codes = [eq.equipment_id for eq in equipment]

        eq_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("scan_code", scan_codes)
            .execute()
        )

        scan_to_uuid = {e["scan_code"]: e["id"] for e in eq_lookup_resp.data}

        equipment_records = []
        for eq in equipment:
            equipment_uuid = scan_to_uuid.get(eq.equipment_id)
            if not equipment_uuid:
                continue
            equipment_records.append({
                "layout_id": str(layout_id),
                "equipment_id": equipment_uuid,
                "centroid_x": eq.centroid_x,
                "centroid_y": eq.centroid_y,
                "centroid_z": eq.centroid_z,
                "size_w": eq.size_w,
                "size_h": eq.size_h,
                "size_d": eq.size_d,
                "rotation_x": eq.rotation_x,
                "rotation_y": eq.rotation_y,
                "rotation_z": eq.rotation_z,
            })

        if equipment_records:
            eq_resp = db.table("layout_equipment").insert(equipment_records).execute()
            equipment_out = eq_resp.data

    # Update equipment count
    db.table("layouts").update({"equipment_count": len(equipment)}).eq("id", str(layout_id)).execute()

    # Return updated layout
    updated_resp = db.table("layouts").select("*").eq("id", str(layout_id)).execute()
    if not updated_resp.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    return {
        **updated_resp.data[0],
        "equipment": equipment_out,
    }

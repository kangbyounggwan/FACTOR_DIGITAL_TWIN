# Section 09: Equipment CRUD and Clone

**Status:** Pending
**Estimated Effort:** 5-6 hours

---

## Background

The FACTOR Digital Twin system currently supports viewing and repositioning equipment in the 2D layout editor, but lacks the ability to:
1. **Create new equipment** - Users cannot add new equipment to production lines
2. **Delete equipment** - Users cannot remove equipment from the system
3. **Update equipment positions** - Position changes are stored locally but not persisted to the database
4. **Clone equipment** - Users cannot duplicate equipment to quickly create similar items

This section implements full equipment CRUD (Create, Read, Update, Delete) operations plus a clone feature. Equipment management is a critical capability for maintaining accurate digital representations of physical manufacturing facilities.

**Key Design Decisions:**
- **Manual Equipment Creation**: Equipment created through the UI gets a `MANUAL_` prefix in scan_code to distinguish from scanned equipment
- **Clone Offset**: Cloned equipment appears at X+1 meter offset from the original to prevent overlap
- **Position Update API**: Uses PATCH semantics to allow partial updates (only changed fields)
- **Canvas Add Mode**: The 2D canvas supports an "add mode" where clicking creates new equipment at the click position
- **Integration with Layouts**: When a layout is active, position updates affect the layout_equipment table; otherwise, they update equipment_scans directly

**User Workflow:**
1. User navigates to Layout Editor page
2. User clicks "Add Equipment" button to enter add mode
3. User clicks on the 2D canvas to place new equipment at that position
4. Alternatively, user fills out a form with equipment details
5. User can select existing equipment and click "Clone" to duplicate it
6. User can select equipment and click "Delete" to remove it
7. Position/size changes can be saved to the current layout or to the base equipment_scans table

---

## Dependencies

### Requires (must be completed first)
- **Section 04: Layout UI** - SaveLayoutDialog and LayoutSelector components
- **Section 08: Admin Page** - EntityDialog and DeleteConfirmDialog patterns

### Blocks (cannot start until this section is complete)
- **Section 10: Viewer Integration** - 3D viewer needs equipment CRUD capabilities

### Parallelizable With
- None (this is a convergence point for both tracks)

---

## Requirements

When this section is complete, the following must be true:

1. **Backend APIs:**
   - POST /api/equipment - Create new equipment with position and size
   - DELETE /api/equipment/{id} - Delete equipment by ID
   - PATCH /api/equipment/{id}/position - Update equipment position/size
   - POST /api/equipment/{id}/clone - Clone equipment with X+1m offset

2. **Frontend Hooks:**
   - useEquipmentCrud hook provides create, update, remove, and clone functions
   - All operations show appropriate toast notifications
   - Operations trigger data refresh

3. **UI Components:**
   - "Add Equipment" mode toggle button in toolbar
   - Canvas click creates equipment in add mode
   - Equipment form dialog for detailed creation
   - Clone button on selected equipment
   - Delete button with confirmation on selected equipment
   - Visual feedback when in add mode (cursor change, tooltip)

4. **Integration:**
   - New equipment appears immediately in the canvas
   - Deleted equipment is removed from the canvas
   - Cloned equipment appears offset from original
   - All changes are persisted to the database

---

## Implementation Details

### File 1: Equipment Schema (MODIFY)

**Path:** `backend/app/schemas/equipment.py`

Create or modify the equipment schema file to include CRUD models.

```python
# backend/app/schemas/equipment.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class EquipmentBase(BaseModel):
    """Base equipment fields"""
    centroid_x: float = Field(..., description="X coordinate in meters")
    centroid_y: float = Field(..., description="Y coordinate in meters")
    centroid_z: float = Field(default=0.0, description="Z coordinate in meters")
    size_w: float = Field(default=1.0, ge=0.1, description="Width in meters")
    size_h: float = Field(default=1.0, ge=0.1, description="Height in meters")
    size_d: float = Field(default=1.0, ge=0.1, description="Depth in meters")

class EquipmentCreate(EquipmentBase):
    """Schema for creating new equipment"""
    line_id: str = Field(..., description="Production line UUID")
    equipment_type_id: Optional[str] = Field(None, description="Equipment type UUID")
    zone: Optional[str] = Field(None, max_length=50, description="Zone identifier")
    note: Optional[str] = Field(None, max_length=500, description="Equipment notes")

class EquipmentPositionUpdate(BaseModel):
    """Schema for updating equipment position and size (PATCH semantics)"""
    centroid_x: Optional[float] = Field(None, description="X coordinate in meters")
    centroid_y: Optional[float] = Field(None, description="Y coordinate in meters")
    centroid_z: Optional[float] = Field(None, description="Z coordinate in meters")
    size_w: Optional[float] = Field(None, ge=0.1, description="Width in meters")
    size_h: Optional[float] = Field(None, ge=0.1, description="Height in meters")
    size_d: Optional[float] = Field(None, ge=0.1, description="Depth in meters")

class EquipmentDetailUpdate(BaseModel):
    """Schema for updating equipment details"""
    zone: Optional[str] = Field(None, max_length=50, description="Zone identifier")
    note: Optional[str] = Field(None, max_length=500, description="Equipment notes")
    equipment_type_id: Optional[str] = Field(None, description="Equipment type UUID")
    verified: Optional[bool] = Field(None, description="Verification status")

class EquipmentResponse(EquipmentBase):
    """Schema for equipment response"""
    id: str
    line_id: str
    scan_code: str
    equipment_type_id: Optional[str] = None
    zone: Optional[str] = None
    note: Optional[str] = None
    verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class EquipmentCloneResponse(EquipmentResponse):
    """Schema for clone response, includes original_id"""
    original_id: str = Field(..., description="ID of the cloned equipment")
```

---

### File 2: Equipment API Endpoints (MODIFY)

**Path:** `backend/app/api/endpoints/equipment.py`

Add CRUD endpoints to the existing equipment router.

```python
# backend/app/api/endpoints/equipment.py
from fastapi import APIRouter, HTTPException, Depends, Query
from app.core.supabase import get_supabase
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentPositionUpdate,
    EquipmentDetailUpdate,
    EquipmentResponse,
    EquipmentCloneResponse,
)
from supabase import Client
from typing import List, Optional
import uuid

router = APIRouter(prefix="/api/equipment", tags=["equipment"])

# ============================================================================
# EXISTING ENDPOINTS (keep as-is)
# ============================================================================

@router.get("/", response_model=List[dict])
async def get_all_equipment(
    line_id: Optional[str] = Query(None, description="Filter by line ID"),
    db: Client = Depends(get_supabase)
):
    """Get all equipment, optionally filtered by line"""
    query = db.table("equipment_scans").select("*")
    if line_id:
        query = query.eq("line_id", line_id)
    result = query.execute()
    return result.data

@router.get("/{equipment_id}", response_model=dict)
async def get_equipment_by_id(equipment_id: str, db: Client = Depends(get_supabase)):
    """Get single equipment by ID"""
    result = db.table("equipment_scans").select("*").eq("id", equipment_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return result.data

# ============================================================================
# NEW CRUD ENDPOINTS
# ============================================================================

@router.post("/", response_model=EquipmentResponse, status_code=201)
async def create_equipment(
    body: EquipmentCreate,
    db: Client = Depends(get_supabase)
):
    """
    Create new equipment in a production line.

    Equipment created via API gets a MANUAL_ prefix in scan_code to distinguish
    from equipment created by scanning processes.

    Args:
        body: Equipment creation data including position, size, and line reference

    Returns:
        The created equipment record

    Raises:
        400: If line_id is invalid
        500: If database insert fails
    """
    # Generate unique scan_code for manually created equipment
    scan_code = f"MANUAL_{uuid.uuid4().hex[:8].upper()}"

    # Verify line exists
    line_check = db.table("production_lines").select("id").eq("id", body.line_id).single().execute()
    if not line_check.data:
        raise HTTPException(status_code=400, detail=f"Production line {body.line_id} not found")

    # Build insert data
    insert_data = {
        "line_id": body.line_id,
        "scan_code": scan_code,
        "centroid_x": body.centroid_x,
        "centroid_y": body.centroid_y,
        "centroid_z": body.centroid_z,
        "size_w": body.size_w,
        "size_h": body.size_h,
        "size_d": body.size_d,
        "verified": True,  # Manual creation implies verified
    }

    # Add optional fields if provided
    if body.equipment_type_id:
        insert_data["equipment_type_id"] = body.equipment_type_id
    if body.zone:
        insert_data["zone"] = body.zone
    if body.note:
        insert_data["note"] = body.note

    try:
        result = db.table("equipment_scans").insert(insert_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create equipment")
        return EquipmentResponse(**result.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/{equipment_id}", status_code=200)
async def delete_equipment(
    equipment_id: str,
    db: Client = Depends(get_supabase)
):
    """
    Delete equipment by ID.

    This will also delete any associated layout_equipment records due to
    CASCADE delete constraints.

    Args:
        equipment_id: UUID of the equipment to delete

    Returns:
        Success message

    Raises:
        404: If equipment not found
    """
    # Verify equipment exists
    check = db.table("equipment_scans").select("id").eq("id", equipment_id).single().execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # Delete equipment (cascade will handle layout_equipment)
    result = db.table("equipment_scans").delete().eq("id", equipment_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Equipment not found")

    return {"message": "Equipment deleted successfully", "id": equipment_id}


@router.patch("/{equipment_id}/position", response_model=EquipmentResponse)
async def update_equipment_position(
    equipment_id: str,
    body: EquipmentPositionUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update equipment position and/or size.

    Uses PATCH semantics - only provided fields are updated.
    This updates the base equipment_scans table. For layout-specific
    positions, use the layout endpoints.

    Args:
        equipment_id: UUID of the equipment to update
        body: Position/size fields to update (only non-null fields are applied)

    Returns:
        The updated equipment record

    Raises:
        404: If equipment not found
        400: If no fields provided for update
    """
    # Build update dict from non-None fields
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    # Perform update
    result = db.table("equipment_scans")\
        .update(update_data)\
        .eq("id", equipment_id)\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Equipment not found")

    return EquipmentResponse(**result.data[0])


@router.patch("/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment_details(
    equipment_id: str,
    body: EquipmentDetailUpdate,
    db: Client = Depends(get_supabase)
):
    """
    Update equipment details (zone, note, type, verified status).

    Uses PATCH semantics - only provided fields are updated.

    Args:
        equipment_id: UUID of the equipment to update
        body: Detail fields to update (only non-null fields are applied)

    Returns:
        The updated equipment record

    Raises:
        404: If equipment not found
        400: If no fields provided for update
    """
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    result = db.table("equipment_scans")\
        .update(update_data)\
        .eq("id", equipment_id)\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Equipment not found")

    return EquipmentResponse(**result.data[0])


@router.post("/{equipment_id}/clone", response_model=EquipmentCloneResponse, status_code=201)
async def clone_equipment(
    equipment_id: str,
    offset_x: float = Query(default=1.0, description="X offset for cloned equipment in meters"),
    offset_y: float = Query(default=0.0, description="Y offset for cloned equipment in meters"),
    db: Client = Depends(get_supabase)
):
    """
    Clone equipment with position offset.

    Creates a copy of the equipment with:
    - New UUID
    - CLONE_ prefix in scan_code
    - Position offset (default: X + 1m) to prevent overlap
    - All other attributes copied from original

    Args:
        equipment_id: UUID of the equipment to clone
        offset_x: X position offset in meters (default: 1.0)
        offset_y: Y position offset in meters (default: 0.0)

    Returns:
        The newly created equipment record with original_id reference

    Raises:
        404: If original equipment not found
        500: If clone operation fails
    """
    # Fetch original equipment
    original = db.table("equipment_scans")\
        .select("*")\
        .eq("id", equipment_id)\
        .single()\
        .execute()

    if not original.data:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # Generate new scan_code
    new_scan_code = f"CLONE_{uuid.uuid4().hex[:8].upper()}"

    # Build clone data
    clone_data = {
        "line_id": original.data["line_id"],
        "scan_code": new_scan_code,
        "equipment_type_id": original.data.get("equipment_type_id"),
        "centroid_x": original.data["centroid_x"] + offset_x,
        "centroid_y": original.data["centroid_y"] + offset_y,
        "centroid_z": original.data["centroid_z"],
        "size_w": original.data["size_w"],
        "size_h": original.data["size_h"],
        "size_d": original.data["size_d"],
        "zone": original.data.get("zone"),
        "note": original.data.get("note"),
        "verified": True,  # Cloned equipment is considered verified
    }

    # Remove None values
    clone_data = {k: v for k, v in clone_data.items() if v is not None}

    try:
        result = db.table("equipment_scans").insert(clone_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to clone equipment")

        # Return with original_id
        response_data = result.data[0]
        response_data["original_id"] = equipment_id
        return EquipmentCloneResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clone failed: {str(e)}")


@router.get("/line/{line_id}", response_model=List[EquipmentResponse])
async def get_equipment_by_line(
    line_id: str,
    db: Client = Depends(get_supabase)
):
    """
    Get all equipment for a specific production line.

    Args:
        line_id: UUID of the production line

    Returns:
        List of equipment records
    """
    result = db.table("equipment_scans")\
        .select("*")\
        .eq("line_id", line_id)\
        .order("created_at", desc=False)\
        .execute()

    return [EquipmentResponse(**eq) for eq in result.data]
```

---

### File 3: API Router Registration (MODIFY)

**Path:** `backend/app/api/__init__.py`

Ensure the equipment router is registered (if not already).

```python
# backend/app/api/__init__.py
from fastapi import APIRouter
from app.api.endpoints import companies, factories, lines, equipment, layouts

api_router = APIRouter()

# Existing routers
api_router.include_router(companies.router)
api_router.include_router(factories.router)
api_router.include_router(lines.router)
api_router.include_router(layouts.router)

# Equipment router (ensure CRUD endpoints are included)
api_router.include_router(equipment.router)
```

---

### File 4: Frontend API Functions (MODIFY)

**Path:** `frontend/src/lib/api.ts`

Add equipment CRUD API functions.

```typescript
// frontend/src/lib/api.ts
// Add these types and functions to the existing api.ts file

// ============================================================================
// EQUIPMENT TYPES
// ============================================================================

export interface EquipmentCreateInput {
  line_id: string
  centroid_x: number
  centroid_y: number
  centroid_z?: number
  size_w?: number
  size_h?: number
  size_d?: number
  equipment_type_id?: string
  zone?: string
  note?: string
}

export interface EquipmentPositionUpdate {
  centroid_x?: number
  centroid_y?: number
  centroid_z?: number
  size_w?: number
  size_h?: number
  size_d?: number
}

export interface EquipmentDetailUpdate {
  zone?: string
  note?: string
  equipment_type_id?: string
  verified?: boolean
}

export interface Equipment {
  id: string
  line_id: string
  scan_code: string
  equipment_type_id: string | null
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
  zone: string | null
  note: string | null
  verified: boolean
  created_at: string
}

export interface EquipmentCloneResponse extends Equipment {
  original_id: string
}

// ============================================================================
// EQUIPMENT API FUNCTIONS
// ============================================================================

/**
 * Create new equipment in a production line
 */
export async function createEquipment(data: EquipmentCreateInput): Promise<Equipment> {
  const res = await fetch(`${API_BASE}/equipment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      line_id: data.line_id,
      centroid_x: data.centroid_x,
      centroid_y: data.centroid_y,
      centroid_z: data.centroid_z ?? 0,
      size_w: data.size_w ?? 1.0,
      size_h: data.size_h ?? 1.0,
      size_d: data.size_d ?? 1.0,
      equipment_type_id: data.equipment_type_id,
      zone: data.zone,
      note: data.note,
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to create equipment' }))
    throw new Error(error.detail || 'Failed to create equipment')
  }

  return res.json()
}

/**
 * Delete equipment by ID
 */
export async function deleteEquipment(equipmentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/equipment/${equipmentId}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to delete equipment' }))
    throw new Error(error.detail || 'Failed to delete equipment')
  }
}

/**
 * Update equipment position and/or size
 */
export async function updateEquipmentPosition(
  equipmentId: string,
  data: EquipmentPositionUpdate
): Promise<Equipment> {
  // Filter out undefined values
  const updateData: Record<string, number> = {}
  if (data.centroid_x !== undefined) updateData.centroid_x = data.centroid_x
  if (data.centroid_y !== undefined) updateData.centroid_y = data.centroid_y
  if (data.centroid_z !== undefined) updateData.centroid_z = data.centroid_z
  if (data.size_w !== undefined) updateData.size_w = data.size_w
  if (data.size_h !== undefined) updateData.size_h = data.size_h
  if (data.size_d !== undefined) updateData.size_d = data.size_d

  const res = await fetch(`${API_BASE}/equipment/${equipmentId}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to update equipment position' }))
    throw new Error(error.detail || 'Failed to update equipment position')
  }

  return res.json()
}

/**
 * Update equipment details (zone, note, type)
 */
export async function updateEquipmentDetails(
  equipmentId: string,
  data: EquipmentDetailUpdate
): Promise<Equipment> {
  const res = await fetch(`${API_BASE}/equipment/${equipmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to update equipment' }))
    throw new Error(error.detail || 'Failed to update equipment')
  }

  return res.json()
}

/**
 * Clone equipment with position offset
 */
export async function cloneEquipment(
  equipmentId: string,
  offsetX: number = 1.0,
  offsetY: number = 0.0
): Promise<EquipmentCloneResponse> {
  const params = new URLSearchParams({
    offset_x: offsetX.toString(),
    offset_y: offsetY.toString(),
  })

  const res = await fetch(`${API_BASE}/equipment/${equipmentId}/clone?${params}`, {
    method: 'POST',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to clone equipment' }))
    throw new Error(error.detail || 'Failed to clone equipment')
  }

  return res.json()
}

/**
 * Get all equipment for a production line
 */
export async function getEquipmentByLine(lineId: string): Promise<Equipment[]> {
  const res = await fetch(`${API_BASE}/equipment/line/${lineId}`)

  if (!res.ok) {
    throw new Error('Failed to fetch equipment')
  }

  return res.json()
}
```

---

### File 5: Equipment CRUD Hook (NEW)

**Path:** `frontend/src/hooks/useEquipmentCrud.ts`

```typescript
// frontend/src/hooks/useEquipmentCrud.ts
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Equipment,
  EquipmentCreateInput,
  EquipmentPositionUpdate,
  EquipmentDetailUpdate,
  EquipmentCloneResponse,
  createEquipment,
  deleteEquipment,
  updateEquipmentPosition,
  updateEquipmentDetails,
  cloneEquipment,
} from '@/lib/api'

interface UseEquipmentCrudOptions {
  /** Callback fired after any successful operation */
  onSuccess?: () => void
  /** Callback fired after successful create */
  onCreateSuccess?: (equipment: Equipment) => void
  /** Callback fired after successful delete */
  onDeleteSuccess?: (equipmentId: string) => void
  /** Callback fired after successful clone */
  onCloneSuccess?: (equipment: EquipmentCloneResponse) => void
  /** Callback fired after successful position update */
  onPositionUpdateSuccess?: (equipment: Equipment) => void
}

interface UseEquipmentCrudReturn {
  /** Loading state for any operation */
  loading: boolean
  /** Create new equipment */
  create: (data: EquipmentCreateInput) => Promise<Equipment | null>
  /** Delete equipment by ID */
  remove: (equipmentId: string) => Promise<boolean>
  /** Update equipment position/size */
  updatePosition: (equipmentId: string, data: EquipmentPositionUpdate) => Promise<Equipment | null>
  /** Update equipment details */
  updateDetails: (equipmentId: string, data: EquipmentDetailUpdate) => Promise<Equipment | null>
  /** Clone equipment with offset */
  clone: (equipmentId: string, offsetX?: number, offsetY?: number) => Promise<EquipmentCloneResponse | null>
}

/**
 * Hook for equipment CRUD operations with loading state and toast notifications.
 *
 * @example
 * ```tsx
 * const { loading, create, remove, clone, updatePosition } = useEquipmentCrud({
 *   onSuccess: () => refetchEquipment(),
 *   onCreateSuccess: (eq) => selectEquipment(eq.id),
 * })
 *
 * // Create equipment at click position
 * await create({
 *   line_id: selectedLineId,
 *   centroid_x: clickX,
 *   centroid_y: clickY,
 * })
 *
 * // Clone selected equipment
 * await clone(selectedEquipmentId)
 *
 * // Delete equipment
 * await remove(equipmentId)
 * ```
 */
export function useEquipmentCrud(options: UseEquipmentCrudOptions = {}): UseEquipmentCrudReturn {
  const [loading, setLoading] = useState(false)
  const { onSuccess, onCreateSuccess, onDeleteSuccess, onCloneSuccess, onPositionUpdateSuccess } = options

  /**
   * Create new equipment
   */
  const create = useCallback(async (data: EquipmentCreateInput): Promise<Equipment | null> => {
    setLoading(true)
    try {
      const equipment = await createEquipment(data)
      toast.success('Equipment created successfully')
      onCreateSuccess?.(equipment)
      onSuccess?.()
      return equipment
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create equipment'
      toast.error(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [onSuccess, onCreateSuccess])

  /**
   * Delete equipment by ID
   */
  const remove = useCallback(async (equipmentId: string): Promise<boolean> => {
    setLoading(true)
    try {
      await deleteEquipment(equipmentId)
      toast.success('Equipment deleted successfully')
      onDeleteSuccess?.(equipmentId)
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete equipment'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess, onDeleteSuccess])

  /**
   * Update equipment position and/or size
   */
  const updatePosition = useCallback(async (
    equipmentId: string,
    data: EquipmentPositionUpdate
  ): Promise<Equipment | null> => {
    setLoading(true)
    try {
      const equipment = await updateEquipmentPosition(equipmentId, data)
      toast.success('Position updated')
      onPositionUpdateSuccess?.(equipment)
      onSuccess?.()
      return equipment
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update position'
      toast.error(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [onSuccess, onPositionUpdateSuccess])

  /**
   * Update equipment details (zone, note, type)
   */
  const updateDetails = useCallback(async (
    equipmentId: string,
    data: EquipmentDetailUpdate
  ): Promise<Equipment | null> => {
    setLoading(true)
    try {
      const equipment = await updateEquipmentDetails(equipmentId, data)
      toast.success('Equipment updated')
      onSuccess?.()
      return equipment
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update equipment'
      toast.error(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  /**
   * Clone equipment with position offset
   */
  const clone = useCallback(async (
    equipmentId: string,
    offsetX: number = 1.0,
    offsetY: number = 0.0
  ): Promise<EquipmentCloneResponse | null> => {
    setLoading(true)
    try {
      const equipment = await cloneEquipment(equipmentId, offsetX, offsetY)
      toast.success('Equipment cloned successfully')
      onCloneSuccess?.(equipment)
      onSuccess?.()
      return equipment
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone equipment'
      toast.error(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [onSuccess, onCloneSuccess])

  return {
    loading,
    create,
    remove,
    updatePosition,
    updateDetails,
    clone,
  }
}
```

---

### File 6: Add Equipment Dialog (NEW)

**Path:** `frontend/src/components/AddEquipmentDialog.tsx`

```tsx
// frontend/src/components/AddEquipmentDialog.tsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EquipmentCreateInput } from '@/lib/api'

interface AddEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lineId: string
  /** Pre-filled position from canvas click */
  initialPosition?: { x: number; y: number }
  /** Called when user submits the form */
  onSubmit: (data: EquipmentCreateInput) => Promise<void>
  /** Loading state from parent */
  loading?: boolean
}

export default function AddEquipmentDialog({
  open,
  onOpenChange,
  lineId,
  initialPosition,
  onSubmit,
  loading = false,
}: AddEquipmentDialogProps) {
  // Form state
  const [centroidX, setCentroidX] = useState('')
  const [centroidY, setCentroidY] = useState('')
  const [centroidZ, setCentroidZ] = useState('0')
  const [sizeW, setSizeW] = useState('1.0')
  const [sizeH, setSizeH] = useState('1.0')
  const [sizeD, setSizeD] = useState('1.0')
  const [zone, setZone] = useState('')
  const [note, setNote] = useState('')

  // Reset form when dialog opens with new position
  useEffect(() => {
    if (open && initialPosition) {
      setCentroidX(initialPosition.x.toFixed(2))
      setCentroidY(initialPosition.y.toFixed(2))
    }
  }, [open, initialPosition])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCentroidX('')
      setCentroidY('')
      setCentroidZ('0')
      setSizeW('1.0')
      setSizeH('1.0')
      setSizeD('1.0')
      setZone('')
      setNote('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const data: EquipmentCreateInput = {
      line_id: lineId,
      centroid_x: parseFloat(centroidX),
      centroid_y: parseFloat(centroidY),
      centroid_z: parseFloat(centroidZ) || 0,
      size_w: parseFloat(sizeW) || 1.0,
      size_h: parseFloat(sizeH) || 1.0,
      size_d: parseFloat(sizeD) || 1.0,
      zone: zone || undefined,
      note: note || undefined,
    }

    await onSubmit(data)
  }

  const isValid = centroidX && centroidY && !isNaN(parseFloat(centroidX)) && !isNaN(parseFloat(centroidY))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
          <DialogDescription>
            Create new equipment at the specified position. Position and size are in meters.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Position Section */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Position (meters)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="centroid_x" className="text-xs">X</Label>
                  <Input
                    id="centroid_x"
                    type="number"
                    step="0.01"
                    value={centroidX}
                    onChange={e => setCentroidX(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="centroid_y" className="text-xs">Y</Label>
                  <Input
                    id="centroid_y"
                    type="number"
                    step="0.01"
                    value={centroidY}
                    onChange={e => setCentroidY(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="centroid_z" className="text-xs">Z</Label>
                  <Input
                    id="centroid_z"
                    type="number"
                    step="0.01"
                    value={centroidZ}
                    onChange={e => setCentroidZ(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Size Section */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Size (meters)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="size_w" className="text-xs">Width</Label>
                  <Input
                    id="size_w"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={sizeW}
                    onChange={e => setSizeW(e.target.value)}
                    placeholder="1.0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="size_h" className="text-xs">Height</Label>
                  <Input
                    id="size_h"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={sizeH}
                    onChange={e => setSizeH(e.target.value)}
                    placeholder="1.0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="size_d" className="text-xs">Depth</Label>
                  <Input
                    id="size_d"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={sizeD}
                    onChange={e => setSizeD(e.target.value)}
                    placeholder="1.0"
                  />
                </div>
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-2">
              <Label htmlFor="zone" className="text-xs">Zone (optional)</Label>
              <Input
                id="zone"
                value={zone}
                onChange={e => setZone(e.target.value)}
                placeholder="e.g., A1, Loading Bay"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-xs">Note (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Additional information about this equipment..."
                maxLength={500}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !isValid}>
              {loading ? 'Creating...' : 'Create Equipment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### File 7: Delete Equipment Dialog (NEW)

**Path:** `frontend/src/components/DeleteEquipmentDialog.tsx`

```tsx
// frontend/src/components/DeleteEquipmentDialog.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Equipment } from '@/lib/api'

interface DeleteEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: Equipment | null
  onConfirm: () => Promise<void>
  loading?: boolean
}

export default function DeleteEquipmentDialog({
  open,
  onOpenChange,
  equipment,
  onConfirm,
  loading = false,
}: DeleteEquipmentDialogProps) {
  if (!equipment) return null

  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this equipment?
            <br />
            <br />
            <strong>Scan Code:</strong> {equipment.scan_code}
            <br />
            <strong>Position:</strong> ({equipment.centroid_x.toFixed(2)}, {equipment.centroid_y.toFixed(2)})
            {equipment.zone && (
              <>
                <br />
                <strong>Zone:</strong> {equipment.zone}
              </>
            )}
            <br />
            <br />
            This action cannot be undone. The equipment will be permanently removed
            from all layouts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

### File 8: Layout Canvas Modifications (MODIFY)

**Path:** `frontend/src/components/LayoutCanvas.tsx`

Add support for "add mode" where clicking the canvas creates new equipment.

```tsx
// frontend/src/components/LayoutCanvas.tsx
// Add these props and functionality to the existing LayoutCanvas component

import { useState, useRef, useCallback, MouseEvent } from 'react'
import { cn } from '@/lib/utils'

// ADD to existing props interface:
interface LayoutCanvasProps {
  // ... existing props ...

  /** When true, clicking canvas creates new equipment */
  addMode?: boolean
  /** Called when canvas is clicked in add mode */
  onAddEquipment?: (position: { x: number; y: number }) => void
  /** Selected equipment ID for highlighting */
  selectedEquipmentId?: string | null
  /** Called when equipment is selected */
  onSelectEquipment?: (equipmentId: string | null) => void
}

// ADD this helper function to convert screen coords to SVG coords:
const getSvgPoint = (
  svgRef: React.RefObject<SVGSVGElement>,
  clientX: number,
  clientY: number,
  viewBox: { minX: number; minY: number; width: number; height: number }
): { x: number; y: number } => {
  const svg = svgRef.current
  if (!svg) return { x: 0, y: 0 }

  const rect = svg.getBoundingClientRect()
  const scaleX = viewBox.width / rect.width
  const scaleY = viewBox.height / rect.height

  return {
    x: viewBox.minX + (clientX - rect.left) * scaleX,
    y: viewBox.minY + (clientY - rect.top) * scaleY,
  }
}

// ADD this to the component:
export default function LayoutCanvas({
  equipment,
  addMode = false,
  onAddEquipment,
  selectedEquipmentId,
  onSelectEquipment,
  // ... other props
}: LayoutCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Handle canvas click
  const handleCanvasClick = useCallback((e: MouseEvent<SVGSVGElement>) => {
    // Check if clicking on equipment (target will be a rect with data-equipment-id)
    const target = e.target as SVGElement
    const equipmentId = target.getAttribute('data-equipment-id')

    if (equipmentId) {
      // Clicked on equipment
      onSelectEquipment?.(equipmentId)
      return
    }

    if (addMode && onAddEquipment) {
      // In add mode, clicking empty space creates equipment
      const point = getSvgPoint(svgRef, e.clientX, e.clientY, viewBox)
      onAddEquipment(point)
    } else {
      // Normal mode, clicking empty space deselects
      onSelectEquipment?.(null)
    }
  }, [addMode, onAddEquipment, onSelectEquipment, viewBox])

  // Calculate viewBox based on equipment bounds
  const viewBox = useMemo(() => {
    if (equipment.length === 0) {
      return { minX: -10, minY: -10, width: 100, height: 100 }
    }

    const padding = 5
    const minX = Math.min(...equipment.map(e => e.centroid_x - e.size_w / 2)) - padding
    const maxX = Math.max(...equipment.map(e => e.centroid_x + e.size_w / 2)) + padding
    const minY = Math.min(...equipment.map(e => e.centroid_y - e.size_h / 2)) - padding
    const maxY = Math.max(...equipment.map(e => e.centroid_y + e.size_h / 2)) + padding

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }, [equipment])

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      className={cn(
        'w-full h-full bg-muted/20',
        addMode && 'cursor-crosshair'
      )}
      onClick={handleCanvasClick}
    >
      {/* Grid lines */}
      <defs>
        <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="currentColor" strokeWidth="0.02" className="text-muted-foreground/20" />
        </pattern>
      </defs>
      <rect x={viewBox.minX} y={viewBox.minY} width={viewBox.width} height={viewBox.height} fill="url(#grid)" />

      {/* Equipment rectangles */}
      {equipment.map(eq => {
        const x = eq.centroid_x - eq.size_w / 2
        const y = eq.centroid_y - eq.size_h / 2
        const isSelected = eq.id === selectedEquipmentId

        return (
          <g key={eq.id}>
            <rect
              data-equipment-id={eq.id}
              x={x}
              y={y}
              width={eq.size_w}
              height={eq.size_h}
              fill={isSelected ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--card))'}
              stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
              strokeWidth={isSelected ? 0.05 : 0.02}
              className="cursor-pointer hover:fill-primary/20 transition-colors"
            />
            {/* Equipment label */}
            <text
              x={eq.centroid_x}
              y={eq.centroid_y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(eq.size_w, eq.size_h) * 0.3}
              fill="currentColor"
              className="pointer-events-none text-foreground/70"
            >
              {eq.scan_code.slice(-4)}
            </text>
          </g>
        )
      })}

      {/* Add mode indicator */}
      {addMode && (
        <text
          x={viewBox.minX + 1}
          y={viewBox.minY + 1}
          fontSize="0.8"
          fill="hsl(var(--primary))"
          className="font-medium"
        >
          Click to add equipment
        </text>
      )}
    </svg>
  )
}
```

---

### File 9: Layout Editor Page Modifications (MODIFY)

**Path:** `frontend/src/pages/LayoutEditorPage.tsx`

Add equipment CRUD controls and integrate with the canvas.

```tsx
// frontend/src/pages/LayoutEditorPage.tsx
// Add these imports and modifications to the existing LayoutEditorPage

import { useState, useCallback } from 'react'
import { useEquipmentCrud } from '@/hooks/useEquipmentCrud'
import AddEquipmentDialog from '@/components/AddEquipmentDialog'
import DeleteEquipmentDialog from '@/components/DeleteEquipmentDialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Trash2, Copy, MousePointer } from 'lucide-react'
import { Equipment, EquipmentCreateInput } from '@/lib/api'
import { toast } from 'sonner'

export default function LayoutEditorPage() {
  // ... existing state and hooks ...

  // Equipment CRUD state
  const [addMode, setAddMode] = useState(false)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDialogPosition, setAddDialogPosition] = useState<{ x: number; y: number } | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Equipment CRUD hook
  const equipmentCrud = useEquipmentCrud({
    onSuccess: () => {
      // Refetch equipment after any CRUD operation
      refetchEquipment()
    },
    onCreateSuccess: (eq) => {
      // Select newly created equipment
      setSelectedEquipmentId(eq.id)
      setAddMode(false)
    },
    onCloneSuccess: (eq) => {
      // Select cloned equipment
      setSelectedEquipmentId(eq.id)
    },
    onDeleteSuccess: () => {
      // Clear selection after delete
      setSelectedEquipmentId(null)
    },
  })

  // Get selected equipment object
  const selectedEquipment = equipment.find(eq => eq.id === selectedEquipmentId) ?? null

  // Handle canvas click in add mode
  const handleAddEquipment = useCallback((position: { x: number; y: number }) => {
    setAddDialogPosition(position)
    setAddDialogOpen(true)
  }, [])

  // Handle add form submit
  const handleAddSubmit = useCallback(async (data: EquipmentCreateInput) => {
    const result = await equipmentCrud.create(data)
    if (result) {
      setAddDialogOpen(false)
      setAddDialogPosition(undefined)
    }
  }, [equipmentCrud])

  // Handle clone button click
  const handleClone = useCallback(async () => {
    if (!selectedEquipmentId) return
    await equipmentCrud.clone(selectedEquipmentId)
  }, [selectedEquipmentId, equipmentCrud])

  // Handle delete button click
  const handleDeleteClick = useCallback(() => {
    if (!selectedEquipmentId) return
    setDeleteDialogOpen(true)
  }, [selectedEquipmentId])

  // Handle delete confirm
  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedEquipmentId) return
    await equipmentCrud.remove(selectedEquipmentId)
    setDeleteDialogOpen(false)
  }, [selectedEquipmentId, equipmentCrud])

  // Toggle add mode
  const toggleAddMode = useCallback(() => {
    setAddMode(prev => !prev)
    if (!addMode) {
      setSelectedEquipmentId(null)
    }
  }, [addMode])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        {/* Left side - Layout selector (existing) */}
        <div className="flex items-center gap-2">
          {/* ... existing LayoutSelector ... */}
        </div>

        {/* Center - Equipment tools */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {/* Select Mode */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={!addMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAddMode(false)}
                  className="h-8 px-3"
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select Mode</TooltipContent>
            </Tooltip>

            {/* Add Mode */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={addMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleAddMode}
                  className="h-8 px-3"
                  disabled={!selectedLineId}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {selectedLineId ? 'Add Equipment (click canvas)' : 'Select a line first'}
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Clone */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClone}
                  disabled={!selectedEquipmentId || equipmentCrud.loading}
                  className="h-8 px-3"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clone Selected</TooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteClick}
                  disabled={!selectedEquipmentId || equipmentCrud.loading}
                  className="h-8 px-3 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Selected</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Right side - Save button (existing) */}
        <div className="flex items-center gap-2">
          {/* ... existing save button ... */}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <LayoutCanvas
          equipment={equipment}
          addMode={addMode}
          onAddEquipment={handleAddEquipment}
          selectedEquipmentId={selectedEquipmentId}
          onSelectEquipment={setSelectedEquipmentId}
          // ... other existing props ...
        />

        {/* Add mode overlay hint */}
        {addMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md shadow-lg">
            Click on the canvas to place equipment. Press ESC or click the select button to exit.
          </div>
        )}
      </div>

      {/* Equipment Details Panel (when equipment selected) */}
      {selectedEquipment && !addMode && (
        <div className="absolute right-4 top-20 w-64 bg-card border rounded-lg shadow-lg p-4">
          <h3 className="font-semibold mb-2">Equipment Details</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Code:</dt>
              <dd className="font-mono">{selectedEquipment.scan_code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Position:</dt>
              <dd>({selectedEquipment.centroid_x.toFixed(2)}, {selectedEquipment.centroid_y.toFixed(2)})</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Size:</dt>
              <dd>{selectedEquipment.size_w.toFixed(1)} x {selectedEquipment.size_h.toFixed(1)} m</dd>
            </div>
            {selectedEquipment.zone && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Zone:</dt>
                <dd>{selectedEquipment.zone}</dd>
              </div>
            )}
          </dl>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleClone}
              disabled={equipmentCrud.loading}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Clone
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={handleDeleteClick}
              disabled={equipmentCrud.loading}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Add Equipment Dialog */}
      <AddEquipmentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        lineId={selectedLineId ?? ''}
        initialPosition={addDialogPosition}
        onSubmit={handleAddSubmit}
        loading={equipmentCrud.loading}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteEquipmentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        equipment={selectedEquipment}
        onConfirm={handleDeleteConfirm}
        loading={equipmentCrud.loading}
      />
    </div>
  )
}
```

---

## Acceptance Criteria

Complete these checkboxes to verify the section is fully implemented:

### Backend API
- [ ] POST /api/equipment creates equipment with MANUAL_ scan_code prefix
- [ ] POST /api/equipment validates line_id exists
- [ ] DELETE /api/equipment/{id} removes equipment
- [ ] DELETE /api/equipment/{id} returns 404 for non-existent equipment
- [ ] PATCH /api/equipment/{id}/position updates only provided fields
- [ ] PATCH /api/equipment/{id}/position returns 404 for non-existent equipment
- [ ] POST /api/equipment/{id}/clone creates copy with CLONE_ prefix
- [ ] POST /api/equipment/{id}/clone applies X offset (default 1m)
- [ ] All endpoints return appropriate error messages

### Frontend Hook
- [ ] useEquipmentCrud hook provides create function
- [ ] useEquipmentCrud hook provides remove function
- [ ] useEquipmentCrud hook provides updatePosition function
- [ ] useEquipmentCrud hook provides clone function
- [ ] Hook shows loading state during operations
- [ ] Hook shows success toast on completion
- [ ] Hook shows error toast on failure
- [ ] Hook calls onSuccess callback after operations

### UI Components
- [ ] AddEquipmentDialog shows position and size fields
- [ ] AddEquipmentDialog pre-fills position from canvas click
- [ ] AddEquipmentDialog validates required fields
- [ ] DeleteEquipmentDialog shows equipment details
- [ ] DeleteEquipmentDialog requires confirmation

### Canvas Integration
- [ ] "Add" button toggles add mode
- [ ] Canvas shows crosshair cursor in add mode
- [ ] Clicking canvas in add mode opens AddEquipmentDialog
- [ ] Canvas click position is converted to SVG coordinates
- [ ] Equipment can be selected by clicking
- [ ] Selected equipment is visually highlighted
- [ ] Clicking empty space deselects equipment

### Editor Page Integration
- [ ] Toolbar shows Select/Add/Clone/Delete buttons
- [ ] Clone button is disabled when no equipment selected
- [ ] Delete button is disabled when no equipment selected
- [ ] Equipment details panel shows when equipment selected
- [ ] New equipment appears immediately after creation
- [ ] Equipment disappears immediately after deletion
- [ ] Cloned equipment appears offset from original

---

## Files Summary

### New Files
| File | Description |
|------|-------------|
| `backend/app/schemas/equipment.py` | Pydantic schemas for equipment CRUD |
| `frontend/src/hooks/useEquipmentCrud.ts` | React hook for equipment operations |
| `frontend/src/components/AddEquipmentDialog.tsx` | Dialog for creating new equipment |
| `frontend/src/components/DeleteEquipmentDialog.tsx` | Confirmation dialog for deletion |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/api/endpoints/equipment.py` | Add POST, DELETE, PATCH, clone endpoints |
| `backend/app/api/__init__.py` | Verify equipment router registration |
| `frontend/src/lib/api.ts` | Add equipment CRUD API functions |
| `frontend/src/components/LayoutCanvas.tsx` | Add addMode, selection, click handling |
| `frontend/src/pages/LayoutEditorPage.tsx` | Add CRUD controls and dialogs |

---

## Testing Guide

### Manual Testing Steps

1. **Create Equipment via Form**
   - Open Layout Editor page
   - Select a factory and line
   - Click "Add" button in toolbar
   - Fill in position (X, Y) and size
   - Click "Create Equipment"
   - Verify: Equipment appears on canvas

2. **Create Equipment via Canvas Click**
   - Enable add mode (click Add button)
   - Click anywhere on the canvas
   - Verify: Dialog opens with pre-filled position
   - Complete the form
   - Verify: Equipment appears at clicked position

3. **Clone Equipment**
   - Select existing equipment on canvas
   - Click "Clone" button
   - Verify: New equipment appears 1m to the right
   - Verify: New equipment has CLONE_ prefix

4. **Delete Equipment**
   - Select equipment on canvas
   - Click "Delete" button
   - Verify: Confirmation dialog shows equipment details
   - Click "Delete" to confirm
   - Verify: Equipment removed from canvas

5. **Position Update**
   - Drag equipment to new position (if drag is supported)
   - Or use position update dialog
   - Verify: Position persists after page refresh

### API Testing (curl)

```bash
# Create equipment
curl -X POST http://localhost:8000/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"line_id": "LINE_UUID", "centroid_x": 5.0, "centroid_y": 10.0}'

# Clone equipment
curl -X POST "http://localhost:8000/api/equipment/EQUIPMENT_UUID/clone?offset_x=2.0"

# Update position
curl -X PATCH http://localhost:8000/api/equipment/EQUIPMENT_UUID/position \
  -H "Content-Type: application/json" \
  -d '{"centroid_x": 7.5}'

# Delete equipment
curl -X DELETE http://localhost:8000/api/equipment/EQUIPMENT_UUID
```

---

## Troubleshooting

### Common Issues

**Issue:** Canvas click position is incorrect
- **Cause:** SVG viewBox not matching actual coordinates
- **Solution:** Ensure `getSvgPoint` correctly transforms client coordinates using viewBox

**Issue:** Equipment not appearing after creation
- **Cause:** `refetchEquipment` not being called
- **Solution:** Verify `onSuccess` callback is properly wired to data fetch

**Issue:** Clone offset seems wrong
- **Cause:** Using wrong coordinate system (Y-up vs Y-down)
- **Solution:** Adjust offset direction based on your coordinate convention

**Issue:** Delete fails silently
- **Cause:** 404 error not being displayed
- **Solution:** Check error handling in hook and ensure toast.error is called

---

## Notes for Implementer

1. **Coordinate System**: Ensure consistency between canvas coordinates (often Y-down for SVG) and equipment coordinates (often Y-up for 3D). The `getSvgPoint` function may need adjustment.

2. **Line Selection**: Equipment creation requires a selected line. Make sure the line selector is properly integrated and `selectedLineId` is available.

3. **Layout vs Base Position**: This implementation updates `equipment_scans` directly. If you want to support layout-specific positions, extend the update logic to check if a layout is active and update `layout_equipment` instead.

4. **Optimistic Updates**: For better UX, consider implementing optimistic updates where the UI updates immediately and reverts on error.

5. **Keyboard Shortcuts**: Consider adding ESC key to exit add mode and Delete key to delete selected equipment.

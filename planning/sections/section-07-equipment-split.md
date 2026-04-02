# Section 07: Equipment Split Feature

Generated: 2026-04-01

---

## Background

The FACTOR Digital Twin equipment registration system currently lacks the ability to edit equipment after registration. When the DBSCAN clustering algorithm incorrectly groups two separate pieces of equipment as one, or when equipment boundaries are inaccurate, users have no way to correct this within the system. They must either re-run the entire pipeline with different parameters or manually edit data in the database.

The Equipment Split feature addresses this by allowing users to visually divide a single equipment entry into two separate entries using a plane-based division tool. This is essential for correcting clustering errors and improving equipment inventory accuracy.

This feature is part of the Phase 2 UX improvements, specifically within the "Editing Features" stream that builds upon the Zustand-based editing state management (Section 05) and the Editing Toolbar UI (Section 06).

---

## Dependencies

### Requires (must be complete before starting)

**Section 06: Editing Toolbar UI**
- The `useEditingStore` Zustand store must be implemented with:
  - `activeTool` state management
  - `splitPlane` state for storing plane position/normal
  - `pushOperation()` for recording operations in history
  - `undo()`/`redo()` functionality
- The `EditingToolbar` component must exist with the split tool button
- Keyboard shortcuts hook (`useEditingKeyboard`) must be functional

### Blocks (cannot start until this is complete)

**Section 09: Apply Selection Changes**
- The split operation workflow establishes patterns used by the apply selection feature
- The backend equipment modification endpoints are foundational for point operations

---

## Requirements

When this section is complete, the following must be true:

1. Users can activate the split tool from the editing toolbar
2. A visual split plane appears on the selected equipment
3. Users can position and rotate the split plane interactively
4. Executing the split creates exactly two new equipment entries
5. The original equipment is marked as superseded (not deleted)
6. The split operation is recorded in the editing history
7. The operation is atomic (all-or-nothing via database transaction)
8. Loading state is shown during the split operation
9. Equipment list refreshes automatically after successful split

---

## Implementation Details

### Backend Implementation

#### 1. Create Equipment Operations Service

**File to create:** `backend/app/services/equipment_ops.py`

```python
import numpy as np
from typing import Tuple
from app.schemas.equipment import Equipment
from app.db import get_supabase_client

def split_equipment(
    equipment_id: str,
    plane_point: list[float],
    plane_normal: list[float]
) -> Tuple[Equipment, Equipment]:
    """
    Split equipment into two based on a dividing plane.

    Args:
        equipment_id: The ID of the equipment to split
        plane_point: A point on the dividing plane [x, y, z]
        plane_normal: The normal vector of the plane [nx, ny, nz]

    Returns:
        Tuple of two new Equipment objects
    """
    # Load point cloud from storage
    points, colors = load_points(equipment_id)

    # Compute signed distance to plane for each point
    point = np.array(plane_point)
    normal = np.array(plane_normal) / np.linalg.norm(plane_normal)
    distances = np.dot(points - point, normal)

    # Split points based on which side of the plane they're on
    mask_a = distances >= 0
    mask_b = distances < 0
    points_a = points[mask_a]
    points_b = points[mask_b]
    colors_a = colors[mask_a] if colors is not None else None
    colors_b = colors[mask_b] if colors is not None else None

    # Validate both sides have points
    if len(points_a) == 0 or len(points_b) == 0:
        raise ValueError("Split plane must divide equipment into two non-empty parts")

    # Create two new equipment entries (within transaction)
    eq_a = create_equipment_from_points(
        points_a,
        colors_a,
        parent_id=equipment_id,
        suffix="_A"
    )
    eq_b = create_equipment_from_points(
        points_b,
        colors_b,
        parent_id=equipment_id,
        suffix="_B"
    )

    # Mark original as superseded
    mark_superseded(equipment_id, [eq_a.id, eq_b.id])

    return eq_a, eq_b


def load_points(equipment_id: str) -> Tuple[np.ndarray, np.ndarray]:
    """Load point cloud data for an equipment entry."""
    supabase = get_supabase_client()

    # Get equipment record to find PLY URL
    result = supabase.table("equipment").select("ply_url").eq("id", equipment_id).single().execute()
    ply_url = result.data["ply_url"]

    # Download PLY file from storage
    ply_data = supabase.storage.from_("pointclouds").download(ply_url)

    # Parse PLY file
    # (Use plyfile library or custom parser)
    points, colors = parse_ply(ply_data)

    return points, colors


def create_equipment_from_points(
    points: np.ndarray,
    colors: np.ndarray,
    parent_id: str,
    suffix: str
) -> Equipment:
    """Create a new equipment entry from a point cloud."""
    supabase = get_supabase_client()

    # Compute metadata
    centroid = points.mean(axis=0)
    min_bounds = points.min(axis=0)
    max_bounds = points.max(axis=0)
    size = max_bounds - min_bounds

    # Generate new ID
    new_id = f"{parent_id}{suffix}"

    # Save PLY file to storage
    ply_path = f"equipment/{new_id}.ply"
    ply_bytes = create_ply_bytes(points, colors)
    supabase.storage.from_("pointclouds").upload(ply_path, ply_bytes)

    # Create database record
    equipment_data = {
        "id": new_id,
        "parent_id": parent_id,
        "centroid_x": float(centroid[0]),
        "centroid_y": float(centroid[1]),
        "centroid_z": float(centroid[2]),
        "size_w": float(size[0]),
        "size_h": float(size[1]),
        "size_d": float(size[2]),
        "point_count": len(points),
        "ply_url": ply_path,
        "verified": False,
        "status": "active"
    }

    result = supabase.table("equipment").insert(equipment_data).execute()
    return Equipment(**result.data[0])


def mark_superseded(equipment_id: str, successor_ids: list[str]):
    """Mark equipment as superseded by new entries."""
    supabase = get_supabase_client()

    supabase.table("equipment").update({
        "status": "superseded",
        "superseded_by": successor_ids
    }).eq("id", equipment_id).execute()
```

#### 2. Create Split Request Schema

**File to modify:** `backend/app/schemas/equipment.py`

Add the following schemas:

```python
from pydantic import BaseModel, validator
from typing import List

class SplitRequest(BaseModel):
    plane_point: List[float]
    plane_normal: List[float]

    @validator('plane_point')
    def validate_plane_point(cls, v):
        if len(v) != 3:
            raise ValueError('plane_point must have exactly 3 coordinates')
        return v

    @validator('plane_normal')
    def validate_plane_normal(cls, v):
        if len(v) != 3:
            raise ValueError('plane_normal must have exactly 3 coordinates')
        # Check for zero vector
        import math
        magnitude = math.sqrt(sum(x**2 for x in v))
        if magnitude < 1e-10:
            raise ValueError('plane_normal cannot be a zero vector')
        return v

class SplitResponse(BaseModel):
    equipment_a: Equipment
    equipment_b: Equipment
    original_id: str
```

#### 3. Add Split Endpoint

**File to modify:** `backend/app/api/endpoints/equipment.py`

```python
from fastapi import APIRouter, HTTPException
from app.schemas.equipment import SplitRequest, SplitResponse
from app.services.equipment_ops import split_equipment

router = APIRouter()

@router.post("/{equipment_id}/split", response_model=SplitResponse)
async def split_equipment_endpoint(
    equipment_id: str,
    body: SplitRequest
):
    """
    Split an equipment entry into two using a plane.

    The plane is defined by a point on the plane and a normal vector.
    Points on the positive side of the normal become equipment A,
    points on the negative side become equipment B.

    This operation is atomic - either both new entries are created
    and the original is marked superseded, or nothing changes.
    """
    try:
        eq_a, eq_b = split_equipment(
            equipment_id,
            body.plane_point,
            body.plane_normal
        )
        return SplitResponse(
            equipment_a=eq_a,
            equipment_b=eq_b,
            original_id=equipment_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Split operation failed: {str(e)}")
```

### Frontend Implementation

#### 1. Add Split API Function

**File to modify:** `frontend/src/lib/api.ts`

```typescript
export interface SplitRequest {
  plane_point: [number, number, number]
  plane_normal: [number, number, number]
}

export interface SplitResponse {
  equipment_a: Equipment
  equipment_b: Equipment
  original_id: string
}

export async function splitEquipment(
  equipmentId: string,
  planePoint: [number, number, number],
  planeNormal: [number, number, number]
): Promise<SplitResponse> {
  const response = await fetch(`${API_BASE}/equipment/${equipmentId}/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plane_point: planePoint,
      plane_normal: planeNormal
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Split failed')
  }

  return response.json()
}
```

#### 2. Create Split Plane Helper Component

**File to create:** `frontend/src/components/SplitPlaneHelper.tsx`

```tsx
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Plane, Html } from '@react-three/drei'
import { DoubleSide, Euler, Vector3, Quaternion } from 'three'
import { useEditingStore } from '@/stores/useEditingStore'

interface Props {
  equipmentBounds: {
    center: [number, number, number]
    size: [number, number, number]
  }
  onConfirm: () => void
  onCancel: () => void
}

export default function SplitPlaneHelper({ equipmentBounds, onConfirm, onCancel }: Props) {
  const { splitPlane, setSplitPlane } = useEditingStore()
  const planeRef = useRef<THREE.Mesh>(null)
  const { camera, gl } = useThree()

  // Initialize plane at equipment center if not set
  useEffect(() => {
    if (!splitPlane) {
      setSplitPlane({
        point: equipmentBounds.center,
        normal: [1, 0, 0] // Default: YZ plane
      })
    }
  }, [equipmentBounds, splitPlane, setSplitPlane])

  // Compute plane dimensions based on equipment bounds
  const planeSize = useMemo(() => {
    const maxDim = Math.max(...equipmentBounds.size) * 1.5
    return [maxDim, maxDim] as [number, number]
  }, [equipmentBounds])

  // Compute rotation from normal vector
  const rotation = useMemo(() => {
    if (!splitPlane) return new Euler(0, 0, 0)

    const normal = new Vector3(...splitPlane.normal).normalize()
    const up = new Vector3(0, 0, 1) // Plane default normal

    const quaternion = new Quaternion().setFromUnitVectors(up, normal)
    return new Euler().setFromQuaternion(quaternion)
  }, [splitPlane])

  // Handle keyboard for plane manipulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!splitPlane) return

      const step = e.shiftKey ? 0.5 : 0.1
      const point = [...splitPlane.point] as [number, number, number]
      const normal = [...splitPlane.normal] as [number, number, number]

      switch (e.key) {
        case 'ArrowLeft':
          point[0] -= step
          break
        case 'ArrowRight':
          point[0] += step
          break
        case 'ArrowUp':
          point[1] += step
          break
        case 'ArrowDown':
          point[1] -= step
          break
        case 'PageUp':
          point[2] += step
          break
        case 'PageDown':
          point[2] -= step
          break
        case 'x':
          setSplitPlane({ point, normal: [1, 0, 0] })
          return
        case 'y':
          setSplitPlane({ point, normal: [0, 1, 0] })
          return
        case 'z':
          setSplitPlane({ point, normal: [0, 0, 1] })
          return
        case 'Enter':
          onConfirm()
          return
        case 'Escape':
          onCancel()
          return
        default:
          return
      }

      setSplitPlane({ point, normal })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [splitPlane, setSplitPlane, onConfirm, onCancel])

  if (!splitPlane) return null

  return (
    <group>
      {/* Split plane visualization */}
      <Plane
        ref={planeRef}
        args={planeSize}
        position={splitPlane.point}
        rotation={rotation}
      >
        <meshBasicMaterial
          color="#ff6b6b"
          transparent
          opacity={0.4}
          side={DoubleSide}
        />
      </Plane>

      {/* Plane outline for better visibility */}
      <Plane
        args={planeSize}
        position={splitPlane.point}
        rotation={rotation}
      >
        <meshBasicMaterial
          color="#ff6b6b"
          wireframe
          side={DoubleSide}
        />
      </Plane>

      {/* Helper text */}
      <Html position={[splitPlane.point[0], splitPlane.point[1] + planeSize[1] / 2 + 0.5, splitPlane.point[2]]}>
        <div className="bg-card border rounded px-2 py-1 text-xs whitespace-nowrap">
          <p>Arrow keys: Move plane</p>
          <p>X/Y/Z: Align to axis</p>
          <p>Enter: Confirm | Esc: Cancel</p>
        </div>
      </Html>
    </group>
  )
}
```

#### 3. Create Split Equipment Hook

**File to create:** `frontend/src/hooks/useSplitEquipment.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { splitEquipment, SplitResponse } from '@/lib/api'
import { useEditingStore } from '@/stores/useEditingStore'
import { toast } from 'sonner'

interface SplitParams {
  equipmentId: string
  planePoint: [number, number, number]
  planeNormal: [number, number, number]
}

export function useSplitEquipment() {
  const queryClient = useQueryClient()
  const { pushOperation, setSplitPlane, setActiveTool } = useEditingStore()

  return useMutation<SplitResponse, Error, SplitParams>({
    mutationFn: ({ equipmentId, planePoint, planeNormal }) =>
      splitEquipment(equipmentId, planePoint, planeNormal),

    onMutate: () => {
      // Show loading toast
      toast.loading('Splitting equipment...', { id: 'split-operation' })
    },

    onSuccess: (data, variables) => {
      // Record operation in history
      pushOperation({
        type: 'split',
        equipmentId: variables.equipmentId,
        data: {
          originalId: variables.equipmentId,
          newIds: [data.equipment_a.id, data.equipment_b.id],
          plane: {
            point: variables.planePoint,
            normal: variables.planeNormal
          }
        }
      })

      // Clear split plane state
      setSplitPlane(null)
      setActiveTool(null)

      // Refresh equipment list
      queryClient.invalidateQueries({ queryKey: ['equipment'] })

      // Success notification
      toast.success(
        `Equipment split into ${data.equipment_a.id} and ${data.equipment_b.id}`,
        { id: 'split-operation' }
      )
    },

    onError: (error) => {
      toast.error(`Split failed: ${error.message}`, { id: 'split-operation' })
    }
  })
}
```

#### 4. Update Scene3D to Include Split Plane

**File to modify:** `frontend/src/components/Scene3D.tsx`

Add the following to the Scene3D component:

```tsx
import SplitPlaneHelper from './SplitPlaneHelper'
import { useEditingStore } from '@/stores/useEditingStore'
import { useSplitEquipment } from '@/hooks/useSplitEquipment'

// Inside the component:
const { activeTool, splitPlane } = useEditingStore()
const splitMutation = useSplitEquipment()

// Find selected equipment bounds
const selectedEquipmentBounds = useMemo(() => {
  if (!selectedEquipment) return null
  const eq = equipment.find(e => e.id === selectedEquipment)
  if (!eq) return null
  return {
    center: [eq.centroid_x, eq.centroid_y, eq.centroid_z] as [number, number, number],
    size: [eq.size_w, eq.size_h, eq.size_d] as [number, number, number]
  }
}, [selectedEquipment, equipment])

const handleSplitConfirm = () => {
  if (selectedEquipment && splitPlane) {
    splitMutation.mutate({
      equipmentId: selectedEquipment,
      planePoint: splitPlane.point,
      planeNormal: splitPlane.normal
    })
  }
}

const handleSplitCancel = () => {
  setSplitPlane(null)
  setActiveTool(null)
}

// In the JSX, add:
{activeTool === 'split' && selectedEquipmentBounds && (
  <SplitPlaneHelper
    equipmentBounds={selectedEquipmentBounds}
    onConfirm={handleSplitConfirm}
    onCancel={handleSplitCancel}
  />
)}
```

#### 5. Update Editing Toolbar for Split Status

**File to modify:** `frontend/src/components/EditingToolbar.tsx`

Add split confirmation buttons when split tool is active:

```tsx
import { useSplitEquipment } from '@/hooks/useSplitEquipment'

// Inside component:
const splitMutation = useSplitEquipment()
const { activeTool, splitPlane } = useEditingStore()

// Add to JSX (after the tool buttons):
{activeTool === 'split' && splitPlane && (
  <>
    <Separator orientation="vertical" className="h-6" />
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setSplitPlane(null)
        setActiveTool(null)
      }}
    >
      Cancel
    </Button>
    <Button
      size="sm"
      disabled={splitMutation.isPending}
      onClick={() => {
        // Trigger split via event or callback
        window.dispatchEvent(new CustomEvent('confirm-split'))
      }}
    >
      {splitMutation.isPending ? 'Splitting...' : 'Confirm Split'}
    </Button>
  </>
)}
```

---

## Database Considerations

### Transaction Handling

The split operation must be atomic. If using Supabase, wrap the operations:

```python
# Using Supabase RPC for transaction
# Create a PostgreSQL function for atomic split

CREATE OR REPLACE FUNCTION split_equipment(
  p_equipment_id TEXT,
  p_equipment_a JSONB,
  p_equipment_b JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Insert equipment A
  INSERT INTO equipment SELECT * FROM jsonb_populate_record(NULL::equipment, p_equipment_a);

  -- Insert equipment B
  INSERT INTO equipment SELECT * FROM jsonb_populate_record(NULL::equipment, p_equipment_b);

  -- Mark original as superseded
  UPDATE equipment
  SET status = 'superseded',
      superseded_by = ARRAY[p_equipment_a->>'id', p_equipment_b->>'id']
  WHERE id = p_equipment_id;

  -- Return result
  v_result := jsonb_build_object(
    'equipment_a', p_equipment_a,
    'equipment_b', p_equipment_b,
    'original_id', p_equipment_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### Schema Updates

Ensure the equipment table has these columns:

```sql
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS superseded_by TEXT[];
```

---

## Acceptance Criteria

- [ ] Split tool button in editing toolbar activates split mode
- [ ] Split plane is visualized in the 3D view as a semi-transparent red plane
- [ ] User can move the split plane using arrow keys
- [ ] User can align the split plane to X/Y/Z axes using keyboard shortcuts
- [ ] User can confirm the split with Enter key or confirm button
- [ ] User can cancel the split with Escape key or cancel button
- [ ] Split operation creates exactly two new equipment entries in the database
- [ ] New equipment entries have correct centroids and bounding boxes computed from their points
- [ ] New equipment entries have their PLY files saved to storage
- [ ] Original equipment is marked with status='superseded' and references the new IDs
- [ ] Split operation is recorded in the editing history for undo tracking
- [ ] Loading indicator is shown during the split operation
- [ ] Success/error toast notifications are displayed
- [ ] Equipment list refreshes automatically after successful split
- [ ] Split fails gracefully if the plane doesn't divide the equipment (all points on one side)
- [ ] Database transaction ensures atomicity (partial failure rolls back completely)

---

## Files to Create

| File Path | Description |
|-----------|-------------|
| `backend/app/services/equipment_ops.py` | Equipment operations service with split logic |
| `frontend/src/components/SplitPlaneHelper.tsx` | 3D split plane visualization component |
| `frontend/src/hooks/useSplitEquipment.ts` | React Query mutation hook for split operation |

## Files to Modify

| File Path | Changes |
|-----------|---------|
| `backend/app/schemas/equipment.py` | Add SplitRequest and SplitResponse schemas |
| `backend/app/api/endpoints/equipment.py` | Add POST /{equipment_id}/split endpoint |
| `frontend/src/lib/api.ts` | Add splitEquipment() API function |
| `frontend/src/components/Scene3D.tsx` | Integrate SplitPlaneHelper when split tool is active |
| `frontend/src/components/EditingToolbar.tsx` | Add split confirmation buttons |

---

## Error Handling

| Error Condition | Handling |
|-----------------|----------|
| Equipment not found | Return 404 with clear message |
| Invalid plane parameters | Return 400 with validation error |
| Plane doesn't divide equipment | Return 400 "Split plane must divide equipment into two non-empty parts" |
| Storage upload fails | Roll back database changes, return 500 |
| Database transaction fails | Automatic rollback, return 500 |
| Network error on frontend | Show error toast, allow retry |

---

## Testing Checklist

### Backend Tests

- [ ] Unit test: `split_equipment()` correctly divides points based on plane
- [ ] Unit test: Plane normal normalization works correctly
- [ ] Unit test: Invalid plane (zero normal) raises ValueError
- [ ] Integration test: Full split endpoint creates two equipment records
- [ ] Integration test: Original equipment marked superseded
- [ ] Integration test: PLY files saved to storage
- [ ] Integration test: Transaction rollback on partial failure

### Frontend Tests

- [ ] Component test: SplitPlaneHelper renders at correct position
- [ ] Component test: Keyboard controls move plane correctly
- [ ] Component test: Axis alignment shortcuts work (X/Y/Z keys)
- [ ] Hook test: useSplitEquipment calls API correctly
- [ ] Hook test: Success callback records operation in history
- [ ] Hook test: Error handling shows toast notification
- [ ] E2E test: Complete split workflow from tool activation to refresh

---

## Performance Notes

- Point cloud loading for split may be slow for large equipment (>500K points)
- Consider showing a loading state while points are being processed
- The PLY file parsing should be done in a background task if synchronous processing causes timeout
- For very large equipment, consider streaming the points rather than loading all into memory

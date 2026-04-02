# Section 09: Apply Selection Changes

Generated: 2026-04-01

---

## Background

The FACTOR Digital Twin equipment registration system includes editing capabilities for manipulating equipment point clouds. Sections 07 (Equipment Split) and 08 (Box Selection) provide users with tools to select specific points within an equipment's point cloud. However, these selections exist only in the frontend state until they are persisted to the backend.

This section implements the persistence layer that saves selection-based modifications to the backend. When a user selects points using the box selection tool (Section 08) or creates split operations (Section 07), they need a way to apply those changes permanently. This includes:
- Excluding selected points from an equipment's point cloud
- Including points from another equipment (for merging operations)
- Updating equipment metadata (centroid, bounding box) after point modifications
- Updating the stored PLY file in Supabase storage

Without this section, all selection and editing operations would be lost when the user navigates away or refreshes the page.

---

## Dependencies

**Requires:**
- Section 07 (Equipment Split Feature): Provides split plane operations and establishes the pattern for equipment mutations
- Section 08 (Box Selection Feature): Provides the box selection UI and the `selectedPoints` state in the Zustand store

**Blocks:**
- None (this is a terminal section in the editing feature stream)

---

## Requirements

When this section is complete, the following must be true:

1. Users can exclude selected points from an equipment's point cloud
2. Equipment metadata (centroid, bounding box) is automatically recalculated after point modifications
3. The PLY file in Supabase storage is updated to reflect point changes
4. The selection is cleared after successful application
5. The equipment list is refreshed to show updated data
6. Error handling exists for failed operations

---

## Implementation Details

### Backend Implementation

#### 1. Create Request/Response Schemas

**File:** `backend/app/schemas/equipment.py`

Add the following schema for point update requests:

```python
from pydantic import BaseModel
from typing import List, Optional

class PointsUpdateRequest(BaseModel):
    """Request body for updating equipment points."""
    exclude_indices: Optional[List[int]] = None  # Points to remove
    include_indices: Optional[List[int]] = None  # Points to add (from another equipment)
    source_equipment_id: Optional[str] = None    # Required if include_indices is provided

class PointsUpdateResponse(BaseModel):
    """Response after updating equipment points."""
    id: str
    point_count: int
    centroid_x: float
    centroid_y: float
    centroid_z: float
    size_w: float
    size_h: float
    size_d: float
    ply_url: str
    updated_at: str
```

#### 2. Create Point Update Service

**File:** `backend/app/services/equipment_ops.py`

Add the following function (this file should already exist from Section 07):

```python
import numpy as np
from typing import Optional, List
import tempfile
import os

def update_equipment_points(
    equipment_id: str,
    exclude_indices: Optional[List[int]] = None,
    include_indices: Optional[List[int]] = None,
    source_equipment_id: Optional[str] = None,
    supabase_client = None
) -> dict:
    """
    Update equipment point cloud by excluding or including points.

    Args:
        equipment_id: ID of the equipment to update
        exclude_indices: List of point indices to remove
        include_indices: List of point indices to include from source equipment
        source_equipment_id: ID of source equipment (required if include_indices provided)
        supabase_client: Supabase client instance

    Returns:
        Updated equipment metadata dict
    """
    # Load current equipment and points
    equipment = get_equipment_by_id(equipment_id, supabase_client)
    points, colors = load_ply_arrays(equipment.ply_url)

    # Apply exclusions
    if exclude_indices:
        mask = np.ones(len(points), dtype=bool)
        mask[exclude_indices] = False
        points = points[mask]
        colors = colors[mask]

    # Apply inclusions from source equipment
    if include_indices and source_equipment_id:
        source_equipment = get_equipment_by_id(source_equipment_id, supabase_client)
        source_points, source_colors = load_ply_arrays(source_equipment.ply_url)

        # Extract specified points from source
        new_points = source_points[include_indices]
        new_colors = source_colors[include_indices]

        # Append to current points
        points = np.vstack([points, new_points])
        colors = np.vstack([colors, new_colors])

    # Recompute metadata
    centroid = points.mean(axis=0)
    min_bounds = points.min(axis=0)
    max_bounds = points.max(axis=0)
    size = max_bounds - min_bounds

    # Save updated PLY file
    new_ply_url = save_ply_to_storage(
        points,
        colors,
        equipment_id,
        supabase_client
    )

    # Update database record
    updated_equipment = update_equipment_record(
        equipment_id,
        {
            "point_count": len(points),
            "centroid_x": float(centroid[0]),
            "centroid_y": float(centroid[1]),
            "centroid_z": float(centroid[2]),
            "size_w": float(size[0]),
            "size_h": float(size[1]),
            "size_d": float(size[2]),
            "ply_url": new_ply_url,
            "updated_at": datetime.utcnow().isoformat()
        },
        supabase_client
    )

    return updated_equipment


def load_ply_arrays(ply_url: str) -> tuple[np.ndarray, np.ndarray]:
    """Load PLY file and return points and colors as numpy arrays."""
    # Download PLY from Supabase storage
    # Parse PLY format
    # Return (positions, colors) as numpy arrays
    # positions shape: (N, 3) - x, y, z
    # colors shape: (N, 3) - r, g, b normalized 0-1
    pass  # Implementation depends on PLY library (e.g., plyfile, open3d)


def save_ply_to_storage(
    points: np.ndarray,
    colors: np.ndarray,
    equipment_id: str,
    supabase_client
) -> str:
    """Save point cloud as PLY and upload to Supabase storage."""
    # Create temporary PLY file
    with tempfile.NamedTemporaryFile(suffix='.ply', delete=False) as tmp:
        # Write PLY header and data
        write_ply(tmp.name, points, colors)

        # Upload to Supabase storage
        storage_path = f"equipment/{equipment_id}/points.ply"
        with open(tmp.name, 'rb') as f:
            supabase_client.storage.from_('pointclouds').upload(
                storage_path,
                f,
                {"upsert": "true"}
            )

        # Clean up temp file
        os.unlink(tmp.name)

    # Return public URL
    return supabase_client.storage.from_('pointclouds').get_public_url(storage_path)
```

#### 3. Create API Endpoint

**File:** `backend/app/api/endpoints/equipment.py`

Add the following endpoint:

```python
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.equipment import PointsUpdateRequest, PointsUpdateResponse
from app.services.equipment_ops import update_equipment_points
from app.core.deps import get_supabase_client

router = APIRouter()

@router.patch("/{equipment_id}/points", response_model=PointsUpdateResponse)
async def update_equipment_points_endpoint(
    equipment_id: str,
    body: PointsUpdateRequest,
    supabase = Depends(get_supabase_client)
):
    """
    Update equipment point cloud.

    - **exclude_indices**: List of point indices to remove from this equipment
    - **include_indices**: List of point indices to add from source equipment
    - **source_equipment_id**: Required when include_indices is provided

    After modification:
    - Centroid and bounding box are recalculated
    - PLY file is updated in storage
    - Database record is updated
    """
    # Validate include request
    if body.include_indices and not body.source_equipment_id:
        raise HTTPException(
            status_code=400,
            detail="source_equipment_id required when include_indices provided"
        )

    # Validate at least one operation
    if not body.exclude_indices and not body.include_indices:
        raise HTTPException(
            status_code=400,
            detail="Either exclude_indices or include_indices must be provided"
        )

    try:
        updated = update_equipment_points(
            equipment_id=equipment_id,
            exclude_indices=body.exclude_indices,
            include_indices=body.include_indices,
            source_equipment_id=body.source_equipment_id,
            supabase_client=supabase
        )
        return PointsUpdateResponse(**updated)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update points: {str(e)}")
```

### Frontend Implementation

#### 1. Add API Function

**File:** `frontend/src/lib/api.ts`

Add the following function:

```typescript
export interface PointsUpdateRequest {
  exclude_indices?: number[]
  include_indices?: number[]
  source_equipment_id?: string
}

export interface PointsUpdateResponse {
  id: string
  point_count: number
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
  ply_url: string
  updated_at: string
}

export async function updateEquipmentPoints(
  equipmentId: string,
  request: PointsUpdateRequest
): Promise<PointsUpdateResponse> {
  const response = await fetch(`${API_BASE}/equipment/${equipmentId}/points`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to update equipment points')
  }

  return response.json()
}
```

#### 2. Create useApplySelection Hook

**File:** `frontend/src/hooks/useApplySelection.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditingStore } from '@/stores/useEditingStore'
import { updateEquipmentPoints, PointsUpdateRequest } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

type SelectionAction = 'exclude' | 'include'

interface ApplySelectionParams {
  equipmentId: string
  action: SelectionAction
  sourceEquipmentId?: string  // Required for 'include' action
}

export function useApplySelection() {
  const queryClient = useQueryClient()
  const { selectedPoints, clearSelection, pushOperation } = useEditingStore()

  const mutation = useMutation({
    mutationFn: async ({ equipmentId, action, sourceEquipmentId }: ApplySelectionParams) => {
      const indices = Array.from(selectedPoints)

      if (indices.length === 0) {
        throw new Error('No points selected')
      }

      const request: PointsUpdateRequest = {}

      if (action === 'exclude') {
        request.exclude_indices = indices
      } else if (action === 'include') {
        if (!sourceEquipmentId) {
          throw new Error('Source equipment ID required for include action')
        }
        request.include_indices = indices
        request.source_equipment_id = sourceEquipmentId
      }

      return updateEquipmentPoints(equipmentId, request)
    },

    onSuccess: (data, variables) => {
      // Record operation in history
      pushOperation({
        type: variables.action === 'exclude' ? 'exclude_points' : 'include_points',
        equipmentId: variables.equipmentId,
        data: {
          indices: Array.from(selectedPoints),
          resultingPointCount: data.point_count,
          sourceEquipmentId: variables.sourceEquipmentId
        }
      })

      // Clear selection
      clearSelection()

      // Invalidate equipment queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      queryClient.invalidateQueries({ queryKey: ['equipment', variables.equipmentId] })
      queryClient.invalidateQueries({ queryKey: ['equipment', variables.equipmentId, 'points'] })

      // Show success toast
      toast({
        title: 'Changes applied',
        description: `Equipment updated. ${data.point_count} points remaining.`,
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Failed to apply changes',
        description: error.message,
        variant: 'destructive',
      })
    }
  })

  return {
    applySelection: mutation.mutate,
    applySelectionAsync: mutation.mutateAsync,
    isApplying: mutation.isPending,
    error: mutation.error,
  }
}
```

#### 3. Create Apply Selection UI Component

**File:** `frontend/src/components/ApplySelectionActions.tsx`

```typescript
import { useEditingStore } from '@/stores/useEditingStore'
import { useApplySelection } from '@/hooks/useApplySelection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Props {
  equipmentId: string
  sourceEquipmentId?: string  // For include operations
}

export default function ApplySelectionActions({ equipmentId, sourceEquipmentId }: Props) {
  const { selectedPoints } = useEditingStore()
  const { applySelection, isApplying } = useApplySelection()

  const selectedCount = selectedPoints.size

  if (selectedCount === 0) {
    return null
  }

  const handleExclude = () => {
    applySelection({ equipmentId, action: 'exclude' })
  }

  const handleInclude = () => {
    if (sourceEquipmentId) {
      applySelection({ equipmentId, action: 'include', sourceEquipmentId })
    }
  }

  return (
    <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
      <Badge variant="secondary">
        {selectedCount} points selected
      </Badge>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            disabled={isApplying}
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Exclude Points
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exclude selected points?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedCount} points from this equipment.
              The equipment metadata will be recalculated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExclude}>
              Exclude Points
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sourceEquipmentId && (
        <Button
          variant="outline"
          size="sm"
          disabled={isApplying}
          onClick={handleInclude}
        >
          {isApplying ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Include in Equipment
        </Button>
      )}
    </div>
  )
}
```

#### 4. Integrate with Editing Toolbar

**File:** `frontend/src/components/EditingToolbar.tsx`

Modify the existing EditingToolbar (from Section 06) to include the apply selection actions:

```typescript
// Add import
import ApplySelectionActions from './ApplySelectionActions'

// Inside the EditingToolbar component, add after existing toolbar buttons:
export default function EditingToolbar({ selectedEquipmentId }: { selectedEquipmentId?: string }) {
  const {
    activeTool, setActiveTool,
    undo, redo, canUndo, canRedo,
    selectedPoints
  } = useEditingStore()

  const hasSelection = selectedPoints.size > 0

  return (
    <div className="flex items-center gap-4">
      {/* Existing tool buttons */}
      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
        {/* ... existing buttons ... */}
      </div>

      {/* Selection actions - only show when points are selected */}
      {hasSelection && selectedEquipmentId && (
        <ApplySelectionActions equipmentId={selectedEquipmentId} />
      )}
    </div>
  )
}
```

---

## Files to Create/Modify

### Backend

**Modify:**
- `backend/app/schemas/equipment.py` - Add `PointsUpdateRequest` and `PointsUpdateResponse` schemas
- `backend/app/services/equipment_ops.py` - Add `update_equipment_points`, `load_ply_arrays`, `save_ply_to_storage` functions
- `backend/app/api/endpoints/equipment.py` - Add `PATCH /{equipment_id}/points` endpoint

### Frontend

**Create:**
- `frontend/src/hooks/useApplySelection.ts` - Hook for applying selection changes
- `frontend/src/components/ApplySelectionActions.tsx` - UI for selection actions

**Modify:**
- `frontend/src/lib/api.ts` - Add `updateEquipmentPoints` function and types
- `frontend/src/components/EditingToolbar.tsx` - Integrate ApplySelectionActions component

---

## Acceptance Criteria

- [ ] `PATCH /equipment/{equipment_id}/points` endpoint exists and accepts exclude_indices/include_indices
- [ ] Selected points can be excluded from equipment point cloud
- [ ] Equipment metadata (centroid, bounding box) is recalculated after point modification
- [ ] PLY file in Supabase storage is updated with new point data
- [ ] Selection is cleared after successful application
- [ ] Equipment list is refreshed to show updated point counts
- [ ] Confirmation dialog shown before destructive exclude operation
- [ ] Loading indicator displayed during API call
- [ ] Error toast shown if operation fails
- [ ] Operation is recorded in editing history for tracking

---

## Testing Checklist

### Backend Tests

```python
# test_equipment_points.py

def test_exclude_points_updates_equipment():
    """Excluding points should update point count and metadata."""
    # Create test equipment with 100 points
    # Exclude indices [0, 1, 2]
    # Verify point_count is now 97
    # Verify centroid has been recalculated

def test_exclude_all_points_fails():
    """Cannot exclude all points from equipment."""
    # Should return 400 or similar error

def test_invalid_indices_handled():
    """Invalid point indices should be handled gracefully."""
    # Exclude index 9999 on equipment with 100 points
    # Should skip invalid indices or return error

def test_ply_file_updated():
    """PLY file should be updated after point changes."""
    # Verify ply_url changes or file content updates

def test_include_requires_source_id():
    """Include operation requires source_equipment_id."""
    # Send include_indices without source_equipment_id
    # Should return 400 error
```

### Frontend Tests

```typescript
// useApplySelection.test.ts

test('applySelection clears selection on success', async () => {
  // Setup mock with selectedPoints
  // Call applySelection
  // Verify selectedPoints is cleared
})

test('applySelection invalidates equipment queries', async () => {
  // Setup query client spy
  // Call applySelection
  // Verify invalidateQueries called with correct keys
})

test('error shows toast notification', async () => {
  // Mock API to reject
  // Call applySelection
  // Verify error toast shown
})
```

### Integration Tests

```typescript
// apply-selection.e2e.ts

test('full exclude workflow', async () => {
  // Navigate to Registry page
  // Select equipment
  // Activate box selection tool
  // Draw selection box
  // Click "Exclude Points"
  // Confirm in dialog
  // Verify equipment point count decreased
  // Verify selection cleared
})
```

---

## Error Handling

| Error Case | Backend Response | Frontend Handling |
|------------|------------------|-------------------|
| Equipment not found | 404 | Show "Equipment not found" toast |
| No indices provided | 400 | Show "No points selected" toast |
| Invalid indices | 400 or skip | Show warning or skip invalid |
| Storage upload fails | 500 | Show "Failed to save" toast |
| Database update fails | 500 | Show "Failed to update" toast |

---

## Performance Considerations

1. **Large Point Clouds**: For equipment with >500K points, the exclude operation may take several seconds. Consider:
   - Showing a progress indicator
   - Processing in chunks on the backend
   - Using background task for very large operations

2. **Index Validation**: Validate indices on the backend before processing to avoid numpy index errors

3. **Atomic Operations**: Ensure PLY upload and database update happen atomically or with proper rollback on failure

---

## Notes

- This section completes the editing feature stream (05 -> 06 -> 07/08 -> 09)
- The include operation enables merging points from one equipment to another, which is useful for correcting clustering errors
- Undo/redo for apply operations is tracked in the editing store but requires backend support for true rollback (out of scope for this section)

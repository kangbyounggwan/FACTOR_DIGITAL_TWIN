# Section 08: Box Selection Feature

**Status:** Pending
**Estimated Effort:** Medium
**Section ID:** 08

---

## Background

The FACTOR Digital Twin system allows users to view and manage equipment detected from LiDAR scans. In Phase 2, we are adding editing capabilities to allow users to refine equipment boundaries after initial detection.

The Box Selection feature enables users to select specific points within a point cloud using a 3D selection box. This is essential for:

1. **Point Exclusion:** Removing incorrectly classified points from an equipment cluster
2. **Point Inclusion:** Adding points that were missed during initial clustering
3. **Fine-grained Editing:** Providing precise control over equipment boundaries

This feature works in conjunction with the Split feature (Section 07) to provide comprehensive equipment editing capabilities. While Split divides equipment using a plane, Box Selection allows granular point-by-point modifications.

---

## Dependencies

### Requires (Must Be Completed First)

- **Section 06: Editing Toolbar UI**
  - The toolbar provides the UI buttons to activate the box selection tool
  - The `useEditingStore` Zustand store must be available for state management
  - The `activeTool` state must support the `'box_select'` value
  - Undo/redo infrastructure must be functional

### Blocks (Cannot Start Until This Is Complete)

- **Section 09: Apply Selection Changes**
  - Section 09 implements the backend persistence of selection changes
  - It requires the selection state and operations created by this section

---

## Requirements

When this section is complete, the following must be true:

1. Users can activate a 3D box selection tool from the editing toolbar
2. Users can click and drag in the 3D view to define a selection box
3. The selection box is visualized in real-time during drag operation
4. Points contained within the box are identified and highlighted
5. Users can add points to selection (additive mode)
6. Users can remove points from selection (subtractive mode)
7. All selection operations are recorded in the editing history for undo/redo
8. Selected points are visually distinct from non-selected points
9. The selection state persists until explicitly cleared or applied

---

## Implementation Details

### File Structure

```
frontend/src/
├── components/
│   └── BoxSelectHelper.tsx    (NEW - 3D selection box visualization)
├── hooks/
│   └── useBoxSelection.ts     (NEW - Selection logic and state management)
```

### BoxSelectHelper Component

Create `frontend/src/components/BoxSelectHelper.tsx`:

```tsx
// components/BoxSelectHelper.tsx
import { useRef, useState } from 'react'
import { Box3, Vector3 } from 'three'
import { useThree } from '@react-three/fiber'

interface BoxSelectHelperProps {
  onSelect: (box: Box3) => void
}

export default function BoxSelectHelper({ onSelect }: BoxSelectHelperProps) {
  const [start, setStart] = useState<Vector3 | null>(null)
  const [end, setEnd] = useState<Vector3 | null>(null)

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setStart(e.point.clone())
    setEnd(null)
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (start) {
      setEnd(e.point.clone())
    }
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (start && end) {
      const box = new Box3().setFromPoints([start, end])
      onSelect(box)
    }
    setStart(null)
    setEnd(null)
  }

  return (
    <>
      {/* Invisible plane to capture pointer events */}
      <mesh
        visible={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[1000, 1000]} />
      </mesh>

      {/* Visual selection box during drag */}
      {start && end && (
        <SelectionBoxVisual start={start} end={end} />
      )}
    </>
  )
}

interface SelectionBoxVisualProps {
  start: Vector3
  end: Vector3
}

function SelectionBoxVisual({ start, end }: SelectionBoxVisualProps) {
  const box = new Box3().setFromPoints([start, end])
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())

  return (
    <mesh position={center}>
      <boxGeometry args={[size.x, size.y, size.z]} />
      <meshBasicMaterial
        color="#3b82f6"
        transparent
        opacity={0.3}
        wireframe={false}
      />
      {/* Wireframe overlay for better visibility */}
      <lineSegments>
        <edgesGeometry args={[new BoxGeometry(size.x, size.y, size.z)]} />
        <lineBasicMaterial color="#3b82f6" linewidth={2} />
      </lineSegments>
    </mesh>
  )
}
```

### useBoxSelection Hook

Create `frontend/src/hooks/useBoxSelection.ts`:

```typescript
// hooks/useBoxSelection.ts
import { useCallback } from 'react'
import { Box3, Vector3 } from 'three'
import { useEditingStore } from '@/stores/useEditingStore'

interface UseBoxSelectionOptions {
  equipmentId: string
  points: Vector3[]
}

export function useBoxSelection({ equipmentId, points }: UseBoxSelectionOptions) {
  const {
    addToSelection,
    removeFromSelection,
    pushOperation,
    selectedPoints
  } = useEditingStore()

  /**
   * Find all point indices contained within the given box
   */
  const getPointsInBox = useCallback((box: Box3): number[] => {
    return points
      .map((point, index) => (box.containsPoint(point) ? index : -1))
      .filter((index) => index >= 0)
  }, [points])

  /**
   * Select points in box (additive - adds to existing selection)
   */
  const selectPointsInBox = useCallback((box: Box3) => {
    const indices = getPointsInBox(box)

    if (indices.length === 0) return

    addToSelection(indices)

    // Record operation for undo/redo
    pushOperation({
      type: 'select_points',
      equipmentId,
      data: {
        indices,
        box: [
          box.min.x, box.min.y, box.min.z,
          box.max.x, box.max.y, box.max.z
        ]
      }
    })
  }, [equipmentId, getPointsInBox, addToSelection, pushOperation])

  /**
   * Deselect points in box (subtractive - removes from existing selection)
   */
  const deselectPointsInBox = useCallback((box: Box3) => {
    const indices = getPointsInBox(box)

    if (indices.length === 0) return

    removeFromSelection(indices)

    // Record operation for undo/redo
    pushOperation({
      type: 'exclude_points',
      equipmentId,
      data: {
        indices,
        box: [
          box.min.x, box.min.y, box.min.z,
          box.max.x, box.max.y, box.max.z
        ]
      }
    })
  }, [equipmentId, getPointsInBox, removeFromSelection, pushOperation])

  /**
   * Handle box selection based on mode
   */
  const handleBoxSelect = useCallback((box: Box3, mode: 'add' | 'remove' = 'add') => {
    if (mode === 'add') {
      selectPointsInBox(box)
    } else {
      deselectPointsInBox(box)
    }
  }, [selectPointsInBox, deselectPointsInBox])

  /**
   * Get count of selected points
   */
  const selectionCount = selectedPoints.size

  /**
   * Check if a point index is selected
   */
  const isPointSelected = useCallback((index: number): boolean => {
    return selectedPoints.has(index)
  }, [selectedPoints])

  return {
    handleBoxSelect,
    selectPointsInBox,
    deselectPointsInBox,
    selectionCount,
    isPointSelected,
    getPointsInBox
  }
}
```

### Integration with PointCloudView

Update `frontend/src/components/PointCloudView.tsx` to highlight selected points:

```tsx
// In PointCloudView.tsx - add selected point highlighting

import { useEditingStore } from '@/stores/useEditingStore'

export default function PointCloudView({ equipmentId, ...props }) {
  const { positions, colors, loading } = useEquipmentPoints(equipmentId)
  const { selectedPoints, activeTool } = useEditingStore()

  // Create modified colors array with selection highlighting
  const displayColors = useMemo(() => {
    if (selectedPoints.size === 0) return colors

    const newColors = [...colors]
    selectedPoints.forEach(index => {
      if (index < newColors.length) {
        // Highlight selected points in cyan
        newColors[index] = [0, 255, 255] // RGB for cyan
      }
    })
    return newColors
  }, [colors, selectedPoints])

  // ... rest of component
}
```

### Integration with Scene3D

Update `frontend/src/components/Scene3D.tsx` to include BoxSelectHelper:

```tsx
// In Scene3D.tsx

import BoxSelectHelper from './BoxSelectHelper'
import { useEditingStore } from '@/stores/useEditingStore'
import { useBoxSelection } from '@/hooks/useBoxSelection'

export default function Scene3D({ equipment, selectedEquipmentId, ... }) {
  const { activeTool } = useEditingStore()
  const selectedEquipment = equipment.find(e => e.id === selectedEquipmentId)

  // Get points for selected equipment (from useEquipmentPoints hook)
  const { points } = useEquipmentPoints(selectedEquipmentId)

  const { handleBoxSelect } = useBoxSelection({
    equipmentId: selectedEquipmentId,
    points: points || []
  })

  const onBoxSelect = (box: Box3) => {
    // Hold Shift for remove mode, default is add mode
    const mode = window.event?.shiftKey ? 'remove' : 'add'
    handleBoxSelect(box, mode)
  }

  return (
    <Canvas>
      {/* ... existing scene content ... */}

      {/* Box selection helper - only active when tool is selected */}
      {activeTool === 'box_select' && selectedEquipmentId && (
        <BoxSelectHelper onSelect={onBoxSelect} />
      )}
    </Canvas>
  )
}
```

### Keyboard Modifier Support

The selection supports keyboard modifiers:
- **Default (no modifier):** Additive selection - adds points to current selection
- **Shift key held:** Subtractive selection - removes points from current selection

### Visual Feedback Requirements

1. **During Drag:**
   - Semi-transparent blue box showing selection area
   - Wireframe edges for clear boundaries

2. **After Selection:**
   - Selected points rendered in cyan color
   - Point size slightly larger for selected points (optional)

3. **Selection Count:**
   - Display count of selected points in toolbar or status bar
   - Example: "1,234 points selected"

---

## Zustand Store Integration

This section uses the `useEditingStore` created in Section 05. The relevant state and actions are:

```typescript
// From stores/useEditingStore.ts (Section 05)

interface EditingStore {
  // Tool state
  activeTool: 'select' | 'split' | 'box_select' | null

  // Selection state
  selectedPoints: Set<number>
  addToSelection: (indices: number[]) => void
  removeFromSelection: (indices: number[]) => void
  clearSelection: () => void

  // History for undo/redo
  pushOperation: (op: Operation) => void
}
```

---

## Operation Types for History

Two operation types are used for undo/redo:

```typescript
// 'select_points' - Adding points to selection
{
  type: 'select_points',
  equipmentId: string,
  data: {
    indices: number[],      // Point indices that were selected
    box: number[]           // [minX, minY, minZ, maxX, maxY, maxZ]
  }
}

// 'exclude_points' - Removing points from selection
{
  type: 'exclude_points',
  equipmentId: string,
  data: {
    indices: number[],      // Point indices that were deselected
    box: number[]           // [minX, minY, minZ, maxX, maxY, maxZ]
  }
}
```

---

## Performance Considerations

1. **Point Containment Check:**
   - For large point clouds (500K+ points), the containment check should be optimized
   - Consider using spatial indexing (octree) for faster queries
   - Simple linear scan is acceptable for initial implementation

2. **Selection State:**
   - Using `Set<number>` for O(1) lookup of selected points
   - Avoid recreating arrays unnecessarily

3. **Color Updates:**
   - Only update colors when selection changes
   - Use `useMemo` to prevent unnecessary recalculations

---

## Files to Create

| File | Type | Description |
|------|------|-------------|
| `frontend/src/components/BoxSelectHelper.tsx` | New | 3D selection box component |
| `frontend/src/hooks/useBoxSelection.ts` | New | Selection logic hook |

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/PointCloudView.tsx` | Add selected point highlighting |
| `frontend/src/components/Scene3D.tsx` | Integrate BoxSelectHelper component |

---

## Acceptance Criteria

- [ ] Box selection helper component created and renders correctly
- [ ] Box selection visualized during drag operation (semi-transparent blue box)
- [ ] Points inside box are correctly identified using Box3.containsPoint()
- [ ] Selected points are highlighted in cyan color in the point cloud view
- [ ] Additive selection works (default mode adds to existing selection)
- [ ] Subtractive selection works (Shift+drag removes from selection)
- [ ] Selection operations are recorded in history (pushOperation called)
- [ ] Undo reverses the last selection operation
- [ ] Redo reapplies the undone selection operation
- [ ] Selection count is accessible from the store
- [ ] Performance is acceptable for 500K+ point clouds (no UI freeze during selection)
- [ ] Box selection only active when 'box_select' tool is selected in toolbar

---

## Testing Checklist

### Unit Tests

- [ ] `useBoxSelection` hook correctly identifies points in box
- [ ] `addToSelection` adds indices to selectedPoints set
- [ ] `removeFromSelection` removes indices from selectedPoints set
- [ ] `pushOperation` records operations with correct type and data

### Integration Tests

- [ ] BoxSelectHelper renders when activeTool === 'box_select'
- [ ] BoxSelectHelper does not render when activeTool !== 'box_select'
- [ ] Pointer events correctly captured and processed
- [ ] Selection state updates trigger re-render of PointCloudView

### Manual Testing

- [ ] Draw selection box in 3D view
- [ ] Verify selected points highlight correctly
- [ ] Hold Shift and draw to deselect points
- [ ] Press Ctrl+Z to undo selection
- [ ] Press Ctrl+Y to redo selection
- [ ] Select across multiple drag operations and verify cumulative selection

---

## Error Handling

1. **No Equipment Selected:**
   - BoxSelectHelper should not render if no equipment is selected
   - Show tooltip: "Select equipment first to use box selection"

2. **Empty Selection:**
   - If drag results in 0 points selected, do not push to history
   - Optionally show feedback: "No points in selection area"

3. **Points Not Loaded:**
   - Disable box selection tool if point cloud data is still loading
   - Show loading indicator on the tool button

---

## Notes for Implementer

1. The `Box3` class from Three.js provides the `containsPoint()` method which is the core of the selection logic.

2. The invisible capture plane in BoxSelectHelper should be oriented to face the camera for best UX. Consider using `useFrame` to update its orientation.

3. Selection is purely frontend state until "Apply Changes" is clicked. This allows for full undo/redo without backend calls.

4. The selection box coordinates are in world space. Ensure the point cloud positions are also in world space for correct containment checks.

5. Consider adding a "Select All" and "Clear Selection" button to the toolbar for convenience (optional enhancement).

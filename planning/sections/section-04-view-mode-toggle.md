# Section 04: Frontend View Mode Toggle

**Status:** Pending
**Estimated Effort:** Medium
**Dependencies:** Requires Section 03 (Point Cloud Data Endpoint)
**Blocks:** Section 10 (R3F Performance Optimization)

---

## Background

The FACTOR Digital Twin equipment registration system currently renders equipment using 3D bounding boxes only. While bounding boxes provide a lightweight visualization, users need the ability to view actual point cloud data for detailed inspection, verification, and editing operations.

This section implements a toggle mechanism that allows users to switch between two rendering modes:
- **Box Mode:** Lightweight bounding box representation (current behavior)
- **Point Cloud Mode:** Full point cloud visualization with colors

The point cloud data is served by the endpoint implemented in Section 03 (`GET /equipment/{id}/points`). This section focuses on the frontend implementation to fetch, cache, and render that data.

---

## Requirements

When this section is complete, the following must be true:

1. Users can toggle between bounding box and point cloud views in the Registry page
2. Point cloud data is fetched from the backend and rendered correctly
3. Colors from the original PLY files are preserved and displayed
4. Selected equipment is visually distinguishable in both view modes
5. Loading states are shown while point cloud data is being fetched
6. Performance is acceptable (30+ FPS with up to 1 million points)

---

## Dependencies

### Requires: Section 03 (Point Cloud Data Endpoint)

Section 03 provides the backend endpoint that serves point cloud data:

```
GET /equipment/{equipment_id}/points?max_points=500000&lod=high
```

Response format:
```json
{
  "positions": [[x, y, z], ...],
  "colors": [[r, g, b], ...],
  "point_count": 500000
}
```

**Important:** Section 03 must be fully implemented and tested before starting this section. The frontend components in this section depend on the exact response format from that endpoint.

### Blocks: Section 10 (R3F Performance Optimization)

Section 10 cannot begin until this section is complete because:
- Performance optimizations (LOD, instanced rendering, frameloop="demand") are applied to the point cloud rendering system
- The base PointCloudView component must exist before it can be optimized

---

## Implementation Details

### 1. View Mode State in RegistryPage

Add state management for the current view mode.

**File:** `frontend/src/pages/RegistryPage.tsx`

```typescript
// Add import
import { useState } from 'react'

// Add state
const [viewMode, setViewMode] = useState<'box' | 'cloud'>('box')
```

### 2. ViewModeToggle Component

Create a toggle button group for switching between modes.

**File to Create:** `frontend/src/components/ViewModeToggle.tsx`

```tsx
import { Button } from '@/components/ui/button'
import { Box, Cloud } from 'lucide-react'

interface ViewModeToggleProps {
  viewMode: 'box' | 'cloud'
  setViewMode: (mode: 'box' | 'cloud') => void
}

export default function ViewModeToggle({ viewMode, setViewMode }: ViewModeToggleProps) {
  return (
    <div className="flex gap-1 bg-secondary rounded-lg p-1">
      <Button
        variant={viewMode === 'box' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('box')}
      >
        <Box className="h-4 w-4 mr-1" /> 박스
      </Button>
      <Button
        variant={viewMode === 'cloud' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setViewMode('cloud')}
      >
        <Cloud className="h-4 w-4 mr-1" /> 포인트
      </Button>
    </div>
  )
}
```

### 3. useEquipmentPoints Hook

Create a custom hook to fetch and cache point cloud data.

**File to Create:** `frontend/src/hooks/useEquipmentPoints.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

interface PointCloudData {
  positions: number[][]
  colors: number[][]
  point_count: number
}

async function fetchEquipmentPoints(
  equipmentId: string,
  maxPoints: number = 500000
): Promise<PointCloudData> {
  const response = await fetch(
    `/api/equipment/${equipmentId}/points?max_points=${maxPoints}`
  )
  if (!response.ok) {
    throw new Error('Failed to fetch point cloud data')
  }
  return response.json()
}

export function useEquipmentPoints(equipmentId: string, enabled: boolean = true) {
  const query = useQuery({
    queryKey: ['equipment-points', equipmentId],
    queryFn: () => fetchEquipmentPoints(equipmentId),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - point data doesn't change often
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
  })

  // Convert to Float32Array for Three.js performance
  const positions = useMemo(() => {
    if (!query.data) return null
    const flat = query.data.positions.flat()
    return new Float32Array(flat)
  }, [query.data])

  const colors = useMemo(() => {
    if (!query.data) return null
    // Normalize colors to 0-1 range if they're 0-255
    const normalized = query.data.colors.flat().map(c =>
      c > 1 ? c / 255 : c
    )
    return new Float32Array(normalized)
  }, [query.data])

  return {
    positions,
    colors,
    pointCount: query.data?.point_count ?? 0,
    loading: query.isLoading,
    error: query.error,
  }
}
```

### 4. PointCloudView Component

Create the React Three Fiber component for rendering point clouds.

**File to Create:** `frontend/src/components/PointCloudView.tsx`

```tsx
import { useRef, useMemo } from 'react'
import { Points, PointMaterial } from '@react-three/drei'
import { BufferGeometry, BufferAttribute } from 'three'
import { useEquipmentPoints } from '@/hooks/useEquipmentPoints'

interface PointCloudViewProps {
  equipmentId: string
  selected: boolean
  onClick: () => void
  centroid?: [number, number, number]
}

function LoadingPlaceholder({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshBasicMaterial color="#888" wireframe />
    </mesh>
  )
}

export default function PointCloudView({
  equipmentId,
  selected,
  onClick,
  centroid = [0, 0, 0],
}: PointCloudViewProps) {
  const { positions, colors, loading, error } = useEquipmentPoints(equipmentId)
  const pointsRef = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    if (!positions || !colors) return null

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('color', new BufferAttribute(colors, 3))
    return geo
  }, [positions, colors])

  if (loading) {
    return <LoadingPlaceholder position={centroid} />
  }

  if (error || !geometry) {
    return (
      <mesh position={centroid}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color="#ff0000" wireframe />
      </mesh>
    )
  }

  return (
    <points ref={pointsRef} geometry={geometry} onClick={onClick}>
      <pointsMaterial
        size={selected ? 0.03 : 0.02}
        vertexColors
        sizeAttenuation
        transparent
        opacity={selected ? 1.0 : 0.8}
      />
    </points>
  )
}
```

### 5. Update Scene3D for Conditional Rendering

Modify the Scene3D component to render either boxes or point clouds based on view mode.

**File:** `frontend/src/components/Scene3D.tsx`

```tsx
// Add imports
import PointCloudView from './PointCloudView'

// Add prop
interface Scene3DProps {
  equipment: Equipment[]
  selectedId: string | null
  onSelect: (id: string) => void
  viewMode: 'box' | 'cloud'  // Add this prop
}

// Update rendering logic
export default function Scene3D({
  equipment,
  selectedId,
  onSelect,
  viewMode
}: Scene3DProps) {
  return (
    <Canvas>
      {/* Camera, lights, controls... */}

      {equipment.map(eq => (
        viewMode === 'box' ? (
          <EquipmentBox
            key={eq.id}
            equipment={eq}
            selected={eq.id === selectedId}
            onClick={() => onSelect(eq.id)}
          />
        ) : (
          <PointCloudView
            key={eq.id}
            equipmentId={eq.id}
            selected={eq.id === selectedId}
            onClick={() => onSelect(eq.id)}
            centroid={[eq.centroid_x, eq.centroid_y, eq.centroid_z]}
          />
        )
      ))}
    </Canvas>
  )
}
```

### 6. Update RegistryPage Layout

Integrate the toggle component and pass view mode to Scene3D.

**File:** `frontend/src/pages/RegistryPage.tsx`

```tsx
import ViewModeToggle from '@/components/ViewModeToggle'

export default function RegistryPage() {
  const [viewMode, setViewMode] = useState<'box' | 'cloud'>('box')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ... existing equipment fetching logic

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar area */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold">설비 등록부</h1>
        <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      {/* 3D View */}
      <div className="flex-1">
        <Scene3D
          equipment={equipment}
          selectedId={selectedId}
          onSelect={setSelectedId}
          viewMode={viewMode}
        />
      </div>
    </div>
  )
}
```

### 7. Update API Types

Add type definitions for the points endpoint response.

**File:** `frontend/src/lib/api.ts`

```typescript
// Add interface
export interface PointCloudResponse {
  positions: number[][]
  colors: number[][]
  point_count: number
}

// Add API function
export async function fetchEquipmentPoints(
  equipmentId: string,
  maxPoints: number = 500000
): Promise<PointCloudResponse> {
  const response = await fetch(
    `${API_BASE}/equipment/${equipmentId}/points?max_points=${maxPoints}`
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch points: ${response.statusText}`)
  }
  return response.json()
}
```

---

## Files to Create

| File Path | Description |
|-----------|-------------|
| `frontend/src/components/ViewModeToggle.tsx` | Toggle button group for box/cloud modes |
| `frontend/src/components/PointCloudView.tsx` | R3F component for rendering point clouds |
| `frontend/src/hooks/useEquipmentPoints.ts` | Hook for fetching and caching point data |

## Files to Modify

| File Path | Changes |
|-----------|---------|
| `frontend/src/pages/RegistryPage.tsx` | Add viewMode state, integrate toggle, pass to Scene3D |
| `frontend/src/components/Scene3D.tsx` | Accept viewMode prop, conditionally render box or cloud |
| `frontend/src/lib/api.ts` | Add PointCloudResponse type and fetchEquipmentPoints function |

---

## Acceptance Criteria

- [ ] Toggle button switches between box and cloud views
- [ ] Toggle shows visual indication of current mode (button highlighted)
- [ ] Point cloud renders correctly when cloud mode is selected
- [ ] Point colors from PLY file are preserved and displayed
- [ ] Selected equipment is visually distinct in both modes (larger points / different opacity)
- [ ] Loading placeholder shown while point cloud data is fetching
- [ ] Error state displayed if point cloud fetch fails
- [ ] Performance is acceptable (30+ FPS for up to 1M points)
- [ ] Point cloud data is cached (switching back to cloud mode doesn't re-fetch)
- [ ] View mode persists when selecting different equipment

---

## Testing Checklist

### Manual Testing

1. **Toggle Functionality**
   - Click "박스" button - verify box rendering is active
   - Click "포인트" button - verify point cloud rendering is active
   - Verify button highlighting reflects current mode

2. **Point Cloud Rendering**
   - Switch to cloud mode with equipment loaded
   - Verify points appear at correct positions
   - Verify colors match original scan data
   - Rotate camera and verify 3D positioning is correct

3. **Selection in Both Modes**
   - Select equipment in box mode - verify visual highlight
   - Switch to cloud mode - verify same equipment remains selected
   - Select different equipment in cloud mode - verify larger point size
   - Switch back to box mode - verify selection persists

4. **Loading States**
   - Switch to cloud mode with slow network (throttle in DevTools)
   - Verify loading placeholder (wireframe sphere) appears
   - Verify it's replaced with points when data arrives

5. **Caching**
   - Switch to cloud mode (observe network request)
   - Switch to box mode, then back to cloud
   - Verify no new network request (data cached)

6. **Performance**
   - Load equipment with 500K+ points
   - Open browser FPS counter (or use React DevTools Profiler)
   - Rotate camera and verify 30+ FPS

### Edge Cases

- [ ] Empty point cloud (0 points) - should show error state
- [ ] Very large point cloud (1M+ points) - should not crash
- [ ] Network error during fetch - should show error placeholder
- [ ] Rapidly toggling modes - should not cause memory leaks

---

## Technical Notes

### Performance Considerations

1. **Float32Array:** Point positions and colors are converted to Float32Array for GPU efficiency. This is significantly faster than using regular JavaScript arrays with Three.js.

2. **React Query Caching:** Point cloud data is cached for 5 minutes (staleTime) and kept in memory for 10 minutes (gcTime). This prevents re-fetching when toggling view modes.

3. **Memoization:** The BufferGeometry is memoized with useMemo to prevent recreation on every render.

4. **Deferred Loading:** Point cloud data is only fetched when cloud mode is active (enabled prop in useQuery). This prevents unnecessary API calls when users only use box mode.

### Memory Management

Point cloud data can be large (500K points = ~6MB for positions + ~6MB for colors). Considerations:

- The React Query gcTime (10 minutes) ensures data is eventually released
- BufferGeometry is reused rather than recreated
- Section 10 will add proper resource disposal with useEffect cleanup

### Three.js Integration

- Using `<points>` element (lowercase) which is the R3F wrapper for THREE.Points
- `<pointsMaterial>` with `vertexColors` attribute enables per-point coloring
- `sizeAttenuation` makes points smaller when further from camera (more realistic)

---

## Rollback Plan

If issues are discovered after deployment:

1. Revert the viewMode state addition in RegistryPage
2. Remove the ViewModeToggle component from the toolbar
3. Remove the viewMode prop from Scene3D (restore original rendering)

The new files (ViewModeToggle.tsx, PointCloudView.tsx, useEquipmentPoints.ts) can remain as unused code until issues are resolved.

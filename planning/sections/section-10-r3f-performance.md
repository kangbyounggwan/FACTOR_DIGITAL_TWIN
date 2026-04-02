# Section 10: R3F Performance Optimization

**Status:** Pending
**Section ID:** 10
**Name:** r3f-performance

---

## Background

The FACTOR Digital Twin application renders 3D equipment visualizations using React Three Fiber (R3F). With point cloud data potentially containing hundreds of thousands to millions of points (supporting LiDAR scans from 100MB to 1GB), rendering performance is critical for maintaining a responsive user interface.

Without proper optimization, large point clouds can cause:
- Frame rate drops below 30 FPS
- Browser memory issues
- UI freezing during camera movement
- GPU memory exhaustion

This section implements performance optimizations that enable smooth rendering even with 1 million+ points, including on-demand rendering, Level of Detail (LOD) support, instanced rendering for equipment boxes, and proper resource disposal.

---

## Dependencies

| Dependency Type | Section | Description |
|-----------------|---------|-------------|
| **Requires** | Section 04 (View Mode Toggle) | Point cloud rendering must be functional before optimization can be applied |
| **Blocks** | None | This is a terminal optimization section |

**Pre-requisites that must be complete:**
- `frontend/src/components/PointCloudView.tsx` exists and renders point clouds
- `frontend/src/pages/RegistryPage.tsx` has view mode toggle (box/cloud)
- `frontend/src/components/Scene3D.tsx` conditionally renders equipment
- Equipment points endpoint (`GET /equipment/{id}/points`) is functional

---

## Requirements

When this section is complete, the following must be true:

1. **On-demand rendering** - Canvas only re-renders when scene changes, not continuously
2. **Instanced rendering** - Equipment bounding boxes use GPU instancing for efficient batch rendering
3. **Level of Detail (LOD)** - Point clouds automatically switch between high/medium/low detail based on camera distance
4. **Resource disposal** - WebGL resources (geometries, materials, textures) are properly disposed when components unmount
5. **Performance target** - Maintain 30+ FPS with 1 million points in the viewport

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/Scene3D.tsx` | Modify | Add frameloop="demand", instanced rendering |
| `frontend/src/components/PointCloudView.tsx` | Modify | Add LOD support, resource disposal |

---

## Implementation Details

### 1. On-Demand Rendering

Change the R3F Canvas from continuous rendering to on-demand rendering. This prevents unnecessary GPU work when the scene is static.

**File:** `frontend/src/components/Scene3D.tsx`

Update the Canvas component:

```tsx
import { Canvas } from '@react-three/fiber'

// Before (continuous rendering - wasteful)
<Canvas>
  ...
</Canvas>

// After (on-demand rendering - efficient)
<Canvas frameloop="demand">
  ...
</Canvas>
```

**Important:** With `frameloop="demand"`, you must manually invalidate the frame when changes occur. Use the `invalidate` function from `useThree()` or `useFrame`:

```tsx
import { useThree } from '@react-three/fiber'

function SomeComponent() {
  const { invalidate } = useThree()

  const handleInteraction = () => {
    // After any state change that affects rendering
    invalidate()
  }

  return (...)
}
```

**OrbitControls automatically invalidates** when the user interacts with the camera, so no additional code is needed for camera controls.

---

### 2. Instanced Rendering for Equipment Boxes

When in "box" view mode, use GPU instancing to render all equipment bounding boxes efficiently. Instead of creating separate mesh objects for each equipment, use a single instanced mesh.

**File:** `frontend/src/components/Scene3D.tsx`

```tsx
import { Instances, Instance } from '@react-three/drei'

interface EquipmentData {
  id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
  verified: boolean
}

interface InstancedEquipmentBoxesProps {
  equipment: EquipmentData[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function InstancedEquipmentBoxes({
  equipment,
  selectedId,
  onSelect
}: InstancedEquipmentBoxesProps) {
  return (
    <Instances limit={1000}>
      <boxGeometry />
      <meshStandardMaterial />
      {equipment.map(eq => (
        <Instance
          key={eq.id}
          position={[eq.centroid_x, eq.centroid_y, eq.centroid_z]}
          scale={[eq.size_w, eq.size_h, eq.size_d]}
          color={
            selectedId === eq.id
              ? '#3b82f6'  // Selected: blue
              : eq.verified
                ? '#22c55e'  // Verified: green
                : '#f59e0b'  // Unverified: amber
          }
          onClick={(e) => {
            e.stopPropagation()
            onSelect(eq.id)
          }}
        />
      ))}
    </Instances>
  )
}
```

**Performance gain:** Instancing reduces draw calls from N (one per equipment) to 1 (single instanced draw call).

---

### 3. Level of Detail (LOD) for Point Clouds

Implement automatic LOD switching based on camera distance. Distant point clouds render fewer points to maintain performance.

**File:** `frontend/src/components/PointCloudView.tsx`

```tsx
import { Detailed } from '@react-three/drei'
import { Points, PointMaterial } from '@react-three/drei'
import { useEquipmentPoints } from '@/hooks/useEquipmentPoints'
import { useMemo, useEffect, useRef } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

interface PointCloudViewProps {
  equipmentId: string
  selected: boolean
  onClick: () => void
  centroid: [number, number, number]
}

// Sub-component for rendering points at specific LOD
function PointCloudLOD({
  positions,
  colors,
  selected,
  onClick,
  pointSize = 0.02
}: {
  positions: Float32Array
  colors: Float32Array
  selected: boolean
  onClick: () => void
  pointSize?: number
}) {
  const geometryRef = useRef<BufferGeometry>(null)

  // Dispose resources on unmount
  useEffect(() => {
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose()
      }
    }
  }, [])

  const geometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return geo
  }, [positions, colors])

  return (
    <points geometry={geometry} onClick={onClick} ref={geometryRef}>
      <pointsMaterial
        size={selected ? pointSize * 1.5 : pointSize}
        vertexColors
        sizeAttenuation
      />
    </points>
  )
}

export default function PointCloudView({
  equipmentId,
  selected,
  onClick,
  centroid
}: PointCloudViewProps) {
  const {
    positions: highPositions,
    colors: highColors,
    loading: highLoading
  } = useEquipmentPoints(equipmentId, 'high')    // 500K points

  const {
    positions: medPositions,
    colors: medColors,
    loading: medLoading
  } = useEquipmentPoints(equipmentId, 'medium')  // 100K points

  const {
    positions: lowPositions,
    colors: lowColors,
    loading: lowLoading
  } = useEquipmentPoints(equipmentId, 'low')     // 20K points

  // Show loading placeholder while fetching
  if (highLoading && medLoading && lowLoading) {
    return <LoadingPlaceholder position={centroid} />
  }

  return (
    <Detailed distances={[0, 30, 60]}>
      {/* High detail: 0-30 units from camera */}
      <PointCloudLOD
        positions={highPositions}
        colors={highColors}
        selected={selected}
        onClick={onClick}
        pointSize={0.02}
      />

      {/* Medium detail: 30-60 units from camera */}
      <PointCloudLOD
        positions={medPositions}
        colors={medColors}
        selected={selected}
        onClick={onClick}
        pointSize={0.025}
      />

      {/* Low detail: 60+ units from camera */}
      <PointCloudLOD
        positions={lowPositions}
        colors={lowColors}
        selected={selected}
        onClick={onClick}
        pointSize={0.03}
      />
    </Detailed>
  )
}

function LoadingPlaceholder({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshBasicMaterial color="#6b7280" wireframe />
    </mesh>
  )
}
```

**LOD distances explained:**
- **0-30 units:** Full detail (500K points) - for close inspection
- **30-60 units:** Medium detail (100K points) - balanced view
- **60+ units:** Low detail (20K points) - distant overview

---

### 4. Resource Disposal

Ensure WebGL resources are properly disposed when components unmount to prevent memory leaks.

**File:** `frontend/src/components/PointCloudView.tsx`

```tsx
import { useEffect, useRef } from 'react'
import { BufferGeometry, Material, Points } from 'three'

function PointCloudWithDisposal({ geometry, material }) {
  const pointsRef = useRef<Points>(null)

  useEffect(() => {
    // Cleanup function runs on unmount
    return () => {
      // Dispose geometry
      if (geometry && typeof geometry.dispose === 'function') {
        geometry.dispose()
      }

      // Dispose material (single or array)
      if (material) {
        if (Array.isArray(material)) {
          material.forEach(m => m.dispose())
        } else if (typeof material.dispose === 'function') {
          material.dispose()
        }
      }

      // Dispose any textures in material
      if (material?.map) material.map.dispose()
    }
  }, [geometry, material])

  return <points ref={pointsRef} geometry={geometry} material={material} />
}
```

**Alternative approach using drei's useTexture disposal:**

```tsx
import { useTexture } from '@react-three/drei'

// drei's useTexture automatically handles disposal
// when the component unmounts
```

---

### 5. Complete Scene3D Implementation

**File:** `frontend/src/components/Scene3D.tsx`

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Instances, Instance, Detailed } from '@react-three/drei'
import { Suspense } from 'react'
import PointCloudView from './PointCloudView'

interface Scene3DProps {
  equipment: EquipmentData[]
  viewMode: 'box' | 'cloud'
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function Scene3D({
  equipment,
  viewMode,
  selectedId,
  onSelect
}: Scene3DProps) {
  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [10, 10, 10], fov: 50 }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance'
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Controls - automatically invalidates frame on interaction */}
      <OrbitControls makeDefault />

      {/* Equipment rendering based on view mode */}
      <Suspense fallback={null}>
        {viewMode === 'box' ? (
          <InstancedEquipmentBoxes
            equipment={equipment}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ) : (
          equipment.map(eq => (
            <PointCloudView
              key={eq.id}
              equipmentId={eq.id}
              selected={selectedId === eq.id}
              onClick={() => onSelect(eq.id)}
              centroid={[eq.centroid_x, eq.centroid_y, eq.centroid_z]}
            />
          ))
        )}
      </Suspense>

      {/* Ground plane reference */}
      <gridHelper args={[100, 100]} />
    </Canvas>
  )
}

// Instanced equipment boxes component (defined above)
function InstancedEquipmentBoxes({ equipment, selectedId, onSelect }) {
  // ... implementation from section 2
}
```

---

### 6. Update useEquipmentPoints Hook for LOD

**File:** `frontend/src/hooks/useEquipmentPoints.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { fetchEquipmentPoints } from '@/lib/api'

type LODLevel = 'high' | 'medium' | 'low'

const LOD_MAX_POINTS: Record<LODLevel, number> = {
  high: 500000,
  medium: 100000,
  low: 20000
}

export function useEquipmentPoints(equipmentId: string, lod: LODLevel = 'high') {
  const maxPoints = LOD_MAX_POINTS[lod]

  return useQuery({
    queryKey: ['equipment-points', equipmentId, lod],
    queryFn: () => fetchEquipmentPoints(equipmentId, maxPoints),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    select: (data) => ({
      positions: new Float32Array(data.positions.flat()),
      colors: new Float32Array(data.colors.flat()),
      pointCount: data.point_count
    })
  })
}
```

---

### 7. Performance Monitoring (Optional)

Add performance monitoring during development:

```tsx
import { useFrame } from '@react-three/fiber'
import { useState, useRef } from 'react'

function PerformanceMonitor() {
  const [fps, setFps] = useState(0)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())

  useFrame(() => {
    frameCount.current++
    const now = performance.now()

    if (now - lastTime.current >= 1000) {
      setFps(frameCount.current)
      frameCount.current = 0
      lastTime.current = now
    }
  })

  return (
    <Html position={[-5, 5, 0]}>
      <div className="bg-black/50 text-white px-2 py-1 rounded text-sm">
        FPS: {fps}
      </div>
    </Html>
  )
}
```

---

## Acceptance Criteria

Complete all items before marking this section done:

- [ ] `frameloop="demand"` is set on the Canvas component
- [ ] Equipment boxes use instanced rendering via `<Instances>` and `<Instance>`
- [ ] Point clouds implement LOD with three detail levels (high/medium/low)
- [ ] LOD switches automatically based on camera distance (0/30/60 units)
- [ ] Geometry and material resources are disposed on component unmount
- [ ] No memory leaks when switching between equipment or view modes
- [ ] Achieves 30+ FPS with 1 million points in viewport
- [ ] OrbitControls properly invalidates frame on camera interaction
- [ ] No visual flickering when switching LOD levels

---

## Testing Checklist

### Manual Testing

1. **On-demand rendering verification:**
   - Open browser DevTools Performance tab
   - Load Registry page in box mode
   - Verify CPU usage drops when not interacting
   - Move camera - verify smooth response

2. **Instanced rendering verification:**
   - Load page with 100+ equipment items
   - Check draw calls in WebGL inspector (should be minimal)
   - Verify all boxes render correctly

3. **LOD verification:**
   - Switch to point cloud mode
   - Zoom in close to equipment - observe high detail
   - Zoom out far - observe reduced detail
   - Check network tab - verify LOD requests

4. **Memory leak testing:**
   - Open Memory tab in DevTools
   - Take heap snapshot
   - Switch between equipment, toggle view modes
   - Take another heap snapshot
   - Compare - no significant memory growth

5. **Performance testing:**
   - Load equipment with 500K+ points
   - Verify 30+ FPS during camera movement
   - Test on mid-range hardware

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LOD transitions cause visual popping | Use gradual LOD distances, consider fade transitions |
| Large point clouds still cause lag | Implement frustum culling, reduce max points further |
| Memory leaks persist | Add explicit dispose calls, use drei's built-in disposal |
| On-demand rendering causes stale visuals | Ensure all state changes call `invalidate()` |

---

## Related Documentation

- [React Three Fiber Performance](https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance)
- [drei Instances](https://github.com/pmndrs/drei#instances)
- [drei LOD/Detailed](https://github.com/pmndrs/drei#detailed)
- [Three.js Memory Management](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)

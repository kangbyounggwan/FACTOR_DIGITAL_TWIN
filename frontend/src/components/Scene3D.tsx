import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { Equipment } from '@/lib/api'
import PointCloudView from './PointCloudView'
import SplitPlaneHelper from './SplitPlaneHelper'
import BoxSelectHelper from './BoxSelectHelper'
import { useEditingStore } from '@/stores/useEditingStore'
import { useSplitEquipment } from '@/hooks/useSplitEquipment'
import { useBoxSelection } from '@/hooks/useBoxSelection'
import { useEquipmentPoints } from '@/hooks/useEquipmentPoints'

const EQ_HEX: Record<string, number> = {
  SMT_LINE:       0x00FF88,
  REFLOW_OVEN:    0xFF6633,
  AOI_MACHINE:    0x66AAFF,
  SCREEN_PRINTER: 0xFFCC00,
  PICK_AND_PLACE: 0x00FF88,
  CONVEYOR:       0x99FF33,
  CONTROL_PANEL:  0xCCCCCC,
  STORAGE_RACK:   0xCCCCCC,
  UNKNOWN:        0xAAAAAA,
}

// Component to trigger re-render when props change (for demand frameloop)
function InvalidateOnChange({ deps }: { deps: any[] }) {
  const { invalidate } = useThree()
  useEffect(() => {
    invalidate()
  }, deps)
  return null
}

interface BoxProps {
  eq: Equipment
  isSelected: boolean
  isDimmed: boolean
  onClick: () => void
}

function EquipmentBox({ eq, isSelected, isDimmed, onClick }: BoxProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const edgesRef = useRef<THREE.LineSegments>(null!)
  const [hovered, setHovered] = useState(false)
  const { invalidate } = useThree()

  const color = EQ_HEX[eq.equipment_type] ?? 0x3a3f3a
  const pos: [number, number, number] = [eq.centroid_x, eq.size_h / 2, eq.centroid_z]
  const size: [number, number, number] = [eq.size_w, eq.size_h, eq.size_d]

  useFrame(() => {
    if (!meshRef.current) return
    // isDimmed일 때 opacity를 낮춤 (선택 안된 설비도 잘 보이게)
    const baseOpacity = isDimmed ? 0.4 : (isSelected ? 0.95 : hovered ? 0.9 : 0.85)
    const targetOpacity = baseOpacity
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const opacityDiff = targetOpacity - mat.opacity
    mat.opacity += opacityDiff * 0.15

    const targetScale = isSelected ? 1.04 : 1.0
    const scaleDiff = targetScale - meshRef.current.scale.y
    meshRef.current.scale.y += scaleDiff * 0.15

    // Continue rendering while animating (demand mode)
    if (Math.abs(opacityDiff) > 0.001 || Math.abs(scaleDiff) > 0.001) {
      invalidate()
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick()
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={pos}
        onClick={handleClick}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'default' }}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={isSelected ? 0xffffff : color}
          transparent
          opacity={0.9}
          emissive={isSelected ? 0x666666 : color}
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* 엣지 라인 */}
      <lineSegments position={pos}>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial
          color={isSelected ? 0xffffff : color}
          transparent
          opacity={isSelected ? 1.0 : 0.9}
          linewidth={2}
        />
      </lineSegments>

      {/* 선택 시 레이블 */}
      {isSelected && (
        <group position={[pos[0], pos[1] + eq.size_h / 2 + 0.3, pos[2]]}>
          {/* Three.js r128에서는 Html 컴포넌트 사용 가능하지만 간단히 선으로 표시 */}
        </group>
      )}
    </group>
  )
}

// Box selection wrapper component (must be inside Canvas for R3F context)
interface BoxSelectWrapperProps {
  selectedId: string | null
}

function BoxSelectWrapper({ selectedId }: BoxSelectWrapperProps) {
  const { activeTool } = useEditingStore()
  const { positions } = useEquipmentPoints(selectedId ?? '', !!selectedId, 'medium')

  const { handleBoxSelect } = useBoxSelection({
    equipmentId: selectedId ?? '',
    positions: positions ?? null,
  })

  const onBoxSelect = (box: THREE.Box3, isSubtractive: boolean) => {
    handleBoxSelect(box, isSubtractive)
  }

  if (activeTool !== 'box_select' || !selectedId) return null

  return <BoxSelectHelper onSelect={onBoxSelect} />
}

// Split plane wrapper component (must be inside Canvas for R3F context)
interface SplitPlaneWrapperProps {
  equipment: Equipment[]
  selectedId: string | null
}

function SplitPlaneWrapper({ equipment, selectedId }: SplitPlaneWrapperProps) {
  const { activeTool, splitPlane, setSplitPlane, setActiveTool } = useEditingStore()
  const splitMutation = useSplitEquipment()

  // Find selected equipment bounds
  const selectedEquipmentBounds = useMemo(() => {
    if (!selectedId) return null
    const eq = equipment.find((e) => e.equipment_id === selectedId)
    if (!eq) return null
    return {
      center: [eq.centroid_x, eq.size_h / 2, eq.centroid_z] as [number, number, number],
      size: [eq.size_w, eq.size_h, eq.size_d] as [number, number, number],
    }
  }, [selectedId, equipment])

  const handleSplitConfirm = () => {
    if (selectedId && splitPlane) {
      splitMutation.mutate({
        equipmentId: selectedId,
        planePoint: splitPlane.point,
        planeNormal: splitPlane.normal,
      })
    }
  }

  const handleSplitCancel = () => {
    setSplitPlane(null)
    setActiveTool(null)
  }

  if (activeTool !== 'split' || !selectedEquipmentBounds) return null

  return (
    <SplitPlaneHelper
      equipmentBounds={selectedEquipmentBounds}
      onConfirm={handleSplitConfirm}
      onCancel={handleSplitCancel}
    />
  )
}

interface FocusTarget {
  x: number
  y: number
  z: number
  lineCode: string
}

interface Props {
  equipment: Equipment[]
  selectedId: string | null
  onSelect: (eq: Equipment) => void
  viewMode?: 'box' | 'cloud'
  focusLineCode?: string
  focusTarget?: FocusTarget | null
}

export default function Scene3D({ equipment, selectedId, onSelect, viewMode = 'box', focusLineCode, focusTarget }: Props) {
  // 포커스 대상이 있으면 해당 위치, 없으면 전체 중심
  const centerX = focusTarget
    ? focusTarget.x
    : equipment.length
      ? equipment.reduce((s, e) => s + e.centroid_x, 0) / equipment.length
      : 8
  const centerZ = focusTarget
    ? focusTarget.z
    : equipment.length
      ? equipment.reduce((s, e) => s + e.centroid_z, 0) / equipment.length
      : 4

  return (
    <Canvas
      camera={{ position: [centerX + 12, 14, centerZ + 14], fov: 45, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      frameloop="demand"
      style={{ background: '#2a3035' }}
      onPointerMissed={() => {}}
    >
      {/* Invalidate on prop changes */}
      <InvalidateOnChange deps={[equipment.length, selectedId, viewMode, focusLineCode]} />

      {/* 환경광 - 매우 밝게 */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <directionalLight position={[-10, 15, -10]} intensity={0.8} />
      <hemisphereLight args={[0xffffff, 0x444444, 0.8]} />

      {/* 바닥 그리드 - 밝게 */}
      <Grid
        position={[centerX, 0, centerZ]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#505550"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#707570"
        fadeDistance={40}
        infiniteGrid
      />

      {/* 설비 렌더링 (박스 또는 포인트클라우드) */}
      {equipment.map(eq => {
        const isDimmed = focusLineCode ? eq.line_code !== focusLineCode : false
        return viewMode === 'box' ? (
          <EquipmentBox
            key={eq.equipment_id}
            eq={eq}
            isSelected={eq.equipment_id === selectedId}
            isDimmed={isDimmed}
            onClick={() => onSelect(eq)}
          />
        ) : (
          <PointCloudView
            key={eq.equipment_id}
            equipment={eq}
            isSelected={eq.equipment_id === selectedId}
            isDimmed={isDimmed}
            onClick={() => onSelect(eq)}
          />
        )
      })}

      {/* Split Plane Helper (when split tool is active) */}
      <SplitPlaneWrapper equipment={equipment} selectedId={selectedId} />

      {/* Box Select Helper (when box_select tool is active) */}
      <BoxSelectWrapper selectedId={selectedId} />

      {/* 카메라 컨트롤 */}
      <OrbitControls
        target={[centerX, 0, centerZ]}
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={60}
        maxPolarAngle={Math.PI * 0.48}
      />

      {/* 좌표계 가이즈모 */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#D85A30', '#1D9E75', '#378ADD']} labelColor="#7a8079" />
      </GizmoHelper>
    </Canvas>
  )
}

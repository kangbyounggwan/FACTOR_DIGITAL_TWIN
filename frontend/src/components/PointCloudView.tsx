import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useEquipmentPoints } from '@/hooks/useEquipmentPoints'
import { useEditingStore } from '@/stores/useEditingStore'
import { Equipment } from '@/lib/api'

interface PointCloudViewProps {
  equipment: Equipment
  isSelected: boolean
  isDimmed?: boolean
  onClick: () => void
}

export default function PointCloudView({ equipment, isSelected, isDimmed = false, onClick }: PointCloudViewProps) {
  const pointsRef = useRef<THREE.Points>(null!)
  const materialRef = useRef<THREE.PointsMaterial>(null!)
  const { invalidate } = useThree()
  const { positions, colors, loading, pointCount } = useEquipmentPoints(
    equipment.equipment_id,
    true,
    'medium'
  )
  const { selectedPoints } = useEditingStore()

  // Create modified colors array with selection highlighting and brightness boost
  const displayColors = useMemo(() => {
    if (!colors) return colors

    // Clone the colors array to avoid mutating the original
    const newColors = new Float32Array(colors)

    // Boost brightness for non-selected equipment so they're visible
    if (!isSelected) {
      const minBrightness = 0.35
      for (let i = 0; i < newColors.length; i += 3) {
        // Boost each channel to ensure minimum visibility
        newColors[i] = Math.max(newColors[i], minBrightness)
        newColors[i + 1] = Math.max(newColors[i + 1], minBrightness)
        newColors[i + 2] = Math.max(newColors[i + 2], minBrightness)
      }
    }

    // Highlight selected points in cyan (0, 1, 1) for selected equipment
    if (isSelected && selectedPoints.size > 0) {
      selectedPoints.forEach((index) => {
        const colorIndex = index * 3
        if (colorIndex + 2 < newColors.length) {
          newColors[colorIndex] = 0 // R
          newColors[colorIndex + 1] = 1 // G
          newColors[colorIndex + 2] = 1 // B
        }
      })
    }

    return newColors
  }, [colors, selectedPoints, isSelected])

  // Create buffer geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()

    if (positions && displayColors) {
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(displayColors, 3))
    }

    return geo
  }, [positions, displayColors])

  // Cleanup geometry and material on unmount
  useEffect(() => {
    return () => {
      geometry.dispose()
      if (materialRef.current) {
        materialRef.current.dispose()
      }
    }
  }, [geometry])

  // Invalidate when data loads
  useEffect(() => {
    if (positions && colors) {
      invalidate()
    }
  }, [positions, colors, invalidate])

  // Animate size on selection
  useFrame(() => {
    if (!pointsRef.current) return
    const mat = pointsRef.current.material as THREE.PointsMaterial
    const targetSize = isSelected ? 0.04 : 0.035
    mat.size += (targetSize - mat.size) * 0.1
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick()
  }

  // Show loading placeholder
  if (loading || !positions) {
    const pos: [number, number, number] = [equipment.centroid_x, equipment.size_h / 2, equipment.centroid_z]
    return (
      <mesh position={pos}>
        <boxGeometry args={[equipment.size_w * 0.5, equipment.size_h * 0.5, equipment.size_d * 0.5]} />
        <meshBasicMaterial color={0x3a3f3a} transparent opacity={0.3} wireframe />
      </mesh>
    )
  }

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      onClick={handleClick}
      onPointerEnter={() => { document.body.style.cursor = 'pointer' }}
      onPointerLeave={() => { document.body.style.cursor = 'default' }}
    >
      <pointsMaterial
        ref={materialRef}
        size={0.035}
        vertexColors
        sizeAttenuation
        transparent
        opacity={isDimmed ? 0.15 : isSelected ? 1.0 : 0.95}
      />
    </points>
  )
}

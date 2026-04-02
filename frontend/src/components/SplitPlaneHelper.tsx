import { useMemo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Html } from '@react-three/drei'
import * as THREE from 'three'
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
  const { invalidate } = useThree()

  // Initialize plane at equipment center if not set
  useEffect(() => {
    if (!splitPlane) {
      setSplitPlane({
        point: equipmentBounds.center,
        normal: [1, 0, 0], // Default: YZ plane
      })
    }
  }, [equipmentBounds, splitPlane, setSplitPlane])

  // Invalidate when split plane changes
  useEffect(() => {
    if (splitPlane) {
      invalidate()
    }
  }, [splitPlane, invalidate])

  // Compute plane dimensions based on equipment bounds
  const planeSize = useMemo(() => {
    const maxDim = Math.max(...equipmentBounds.size) * 1.5
    return [maxDim, maxDim] as [number, number]
  }, [equipmentBounds])

  // Compute rotation from normal vector
  const rotation = useMemo(() => {
    if (!splitPlane) return new THREE.Euler(0, 0, 0)

    const normal = new THREE.Vector3(...splitPlane.normal).normalize()
    const up = new THREE.Vector3(0, 0, 1) // Plane default normal

    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal)
    return new THREE.Euler().setFromQuaternion(quaternion)
  }, [splitPlane])

  // Handle keyboard for plane manipulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!splitPlane) return

      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

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
          e.preventDefault()
          point[2] -= step
          break
        case 'ArrowDown':
          e.preventDefault()
          point[2] += step
          break
        case 'PageUp':
          point[1] += step
          break
        case 'PageDown':
          point[1] -= step
          break
        case 'x':
        case 'X':
          setSplitPlane({ point, normal: [1, 0, 0] })
          return
        case 'y':
        case 'Y':
          setSplitPlane({ point, normal: [0, 1, 0] })
          return
        case 'z':
        case 'Z':
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
      <Plane args={planeSize} position={splitPlane.point} rotation={rotation}>
        <meshBasicMaterial color="#ff6b6b" transparent opacity={0.4} side={THREE.DoubleSide} />
      </Plane>

      {/* Plane outline for better visibility */}
      <Plane args={planeSize} position={splitPlane.point} rotation={rotation}>
        <meshBasicMaterial color="#ff6b6b" wireframe side={THREE.DoubleSide} />
      </Plane>

      {/* Helper text */}
      <Html
        position={[
          splitPlane.point[0],
          splitPlane.point[1] + planeSize[1] / 2 + 0.5,
          splitPlane.point[2],
        ]}
        center
      >
        <div className="bg-card/95 border rounded-lg px-3 py-2 text-xs font-mono whitespace-nowrap backdrop-blur-sm shadow-lg">
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">화살표:</span> 이동
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">X/Y/Z:</span> 축 정렬
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Enter:</span> 확인 |{' '}
            <span className="text-foreground font-medium">Esc:</span> 취소
          </p>
        </div>
      </Html>
    </group>
  )
}

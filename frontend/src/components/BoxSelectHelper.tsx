import { useRef, useState, useEffect } from 'react'
import { useThree, useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

interface BoxSelectHelperProps {
  onSelect: (box: THREE.Box3, isShiftHeld: boolean) => void
}

export default function BoxSelectHelper({ onSelect }: BoxSelectHelperProps) {
  const [start, setStart] = useState<THREE.Vector3 | null>(null)
  const [end, setEnd] = useState<THREE.Vector3 | null>(null)
  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const planeRef = useRef<THREE.Mesh>(null!)
  const { camera, invalidate } = useThree()

  // Track shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Orient the capture plane to face the camera
  useFrame(() => {
    if (planeRef.current) {
      planeRef.current.quaternion.copy(camera.quaternion)
    }
  })

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setStart(e.point.clone())
    setEnd(null)
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (start) {
      setEnd(e.point.clone())
      invalidate()
    }
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (start && end) {
      const box = new THREE.Box3().setFromPoints([start, end])
      onSelect(box, isShiftHeld)
    }
    setStart(null)
    setEnd(null)
    invalidate()
  }

  return (
    <>
      {/* Invisible plane to capture pointer events */}
      <mesh
        ref={planeRef}
        visible={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Visual selection box during drag */}
      {start && end && <SelectionBoxVisual start={start} end={end} isSubtractive={isShiftHeld} />}
    </>
  )
}

interface SelectionBoxVisualProps {
  start: THREE.Vector3
  end: THREE.Vector3
  isSubtractive: boolean
}

function SelectionBoxVisual({ start, end, isSubtractive }: SelectionBoxVisualProps) {
  const box = new THREE.Box3().setFromPoints([start, end])
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  // Use different colors for add (blue) vs remove (red) mode
  const color = isSubtractive ? '#ef4444' : '#3b82f6'

  return (
    <group position={center}>
      {/* Solid fill */}
      <mesh>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
      </mesh>

      {/* Wireframe edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(size.x, size.y, size.z)]} />
        <lineBasicMaterial color={color} />
      </lineSegments>
    </group>
  )
}

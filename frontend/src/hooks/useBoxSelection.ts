import { useCallback } from 'react'
import * as THREE from 'three'
import { useEditingStore } from '@/stores/useEditingStore'

interface UseBoxSelectionOptions {
  equipmentId: string
  positions: Float32Array | null
}

export function useBoxSelection({ equipmentId, positions }: UseBoxSelectionOptions) {
  const { addToSelection, removeFromSelection, pushOperation, selectedPoints } = useEditingStore()

  /**
   * Find all point indices contained within the given box
   */
  const getPointsInBox = useCallback(
    (box: THREE.Box3): number[] => {
      if (!positions) return []

      const indices: number[] = []
      const point = new THREE.Vector3()

      // Iterate through all points (each point is 3 floats: x, y, z)
      const numPoints = positions.length / 3
      for (let i = 0; i < numPoints; i++) {
        point.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
        if (box.containsPoint(point)) {
          indices.push(i)
        }
      }

      return indices
    },
    [positions]
  )

  /**
   * Select points in box (additive - adds to existing selection)
   */
  const selectPointsInBox = useCallback(
    (box: THREE.Box3) => {
      const indices = getPointsInBox(box)

      if (indices.length === 0) return

      addToSelection(indices)

      // Record operation for undo/redo
      pushOperation({
        type: 'select_points',
        equipmentId,
        data: {
          indices,
          box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
        },
      })
    },
    [equipmentId, getPointsInBox, addToSelection, pushOperation]
  )

  /**
   * Deselect points in box (subtractive - removes from existing selection)
   */
  const deselectPointsInBox = useCallback(
    (box: THREE.Box3) => {
      const indices = getPointsInBox(box)

      if (indices.length === 0) return

      removeFromSelection(indices)

      // Record operation for undo/redo
      pushOperation({
        type: 'exclude_points',
        equipmentId,
        data: {
          indices,
          box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
        },
      })
    },
    [equipmentId, getPointsInBox, removeFromSelection, pushOperation]
  )

  /**
   * Handle box selection based on mode
   */
  const handleBoxSelect = useCallback(
    (box: THREE.Box3, isSubtractive: boolean = false) => {
      if (isSubtractive) {
        deselectPointsInBox(box)
      } else {
        selectPointsInBox(box)
      }
    },
    [selectPointsInBox, deselectPointsInBox]
  )

  /**
   * Get count of selected points
   */
  const selectionCount = selectedPoints.size

  /**
   * Check if a point index is selected
   */
  const isPointSelected = useCallback(
    (index: number): boolean => {
      return selectedPoints.has(index)
    },
    [selectedPoints]
  )

  return {
    handleBoxSelect,
    selectPointsInBox,
    deselectPointsInBox,
    selectionCount,
    isPointSelected,
    getPointsInBox,
  }
}

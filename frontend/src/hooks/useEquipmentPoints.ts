import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchEquipmentPoints, PointCloudData } from '@/lib/api'
import * as THREE from 'three'

interface UseEquipmentPointsResult {
  positions: Float32Array | null
  colors: Float32Array | null
  pointCount: number
  loading: boolean
  error: Error | null
}

export function useEquipmentPoints(
  equipmentId: string,
  enabled: boolean = true,
  lod: 'high' | 'medium' | 'low' = 'medium'
): UseEquipmentPointsResult {
  const query = useQuery({
    queryKey: ['equipment-points', equipmentId, lod],
    queryFn: () => fetchEquipmentPoints(equipmentId, lod),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,   // 30 minutes (formerly cacheTime)
  })

  // Convert arrays to Float32Array for Three.js
  const { positions, colors } = useMemo(() => {
    if (!query.data) {
      return { positions: null, colors: null }
    }

    const { positions: posArray, colors: colArray } = query.data

    // Flatten positions: [[x,y,z], ...] -> Float32Array
    const posFlat = new Float32Array(posArray.length * 3)
    for (let i = 0; i < posArray.length; i++) {
      posFlat[i * 3] = posArray[i][0]
      posFlat[i * 3 + 1] = posArray[i][1]
      posFlat[i * 3 + 2] = posArray[i][2]
    }

    // Flatten and normalize colors: [[r,g,b], ...] -> Float32Array (0-1 range)
    const colFlat = new Float32Array(colArray.length * 3)
    for (let i = 0; i < colArray.length; i++) {
      colFlat[i * 3] = colArray[i][0] / 255
      colFlat[i * 3 + 1] = colArray[i][1] / 255
      colFlat[i * 3 + 2] = colArray[i][2] / 255
    }

    return { positions: posFlat, colors: colFlat }
  }, [query.data])

  return {
    positions,
    colors,
    pointCount: query.data?.point_count ?? 0,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

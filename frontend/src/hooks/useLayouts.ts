import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Layout,
  LayoutDetail,
  LayoutEquipmentCreate,
  fetchLayouts,
  fetchActiveLayout,
  createLayout,
  updateLayout,
  deleteLayout,
  activateLayout,
  cloneLayout,
  saveLayoutFromViewer,
  updateLayoutEquipment,
} from '@/lib/api'

/**
 * Hook for managing layouts list for a factory
 * React Query로 캐싱하여 페이지 전환 시 재호출 방지
 */
export function useLayouts(factoryId: string | null) {
  const queryClient = useQueryClient()

  const { data: layouts = [], isLoading: loading, error } = useQuery({
    queryKey: ['layouts', factoryId],
    queryFn: () => fetchLayouts(factoryId!),
    enabled: !!factoryId,
    staleTime: 5 * 60 * 1000,
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['layouts', factoryId] })
  }, [queryClient, factoryId])

  return { layouts, loading, error: error as Error | null, reload }
}

/**
 * Hook for managing the active layout for a factory
 */
export function useActiveLayout(factoryId: string | null) {
  const queryClient = useQueryClient()

  const { data: layout = null, isLoading: loading, error } = useQuery({
    queryKey: ['active-layout', factoryId],
    queryFn: () => fetchActiveLayout(factoryId!),
    enabled: !!factoryId,
    staleTime: 5 * 60 * 1000,
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['active-layout', factoryId] })
  }, [queryClient, factoryId])

  return { layout, loading, error: error as Error | null, reload }
}

/**
 * Hook for layout mutations (create, update, delete, activate, clone)
 */
export function useLayoutMutations() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const queryClient = useQueryClient()

  // 레이아웃 관련 캐시 무효화 헬퍼
  const invalidateLayoutQueries = useCallback((factoryId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['layouts'] })
    queryClient.invalidateQueries({ queryKey: ['active-layout'] })
    if (factoryId) {
      queryClient.invalidateQueries({ queryKey: ['layouts', factoryId] })
      queryClient.invalidateQueries({ queryKey: ['active-layout', factoryId] })
    }
  }, [queryClient])

  const create = useCallback(async (
    factoryId: string,
    name: string,
    description?: string,
    equipment?: LayoutEquipmentCreate[],
    isActive?: boolean
  ) => {
    try {
      setSaving(true)
      setError(null)
      const result = await createLayout({
        factory_id: factoryId,
        name,
        description,
        equipment,
        is_active: isActive,
      })
      invalidateLayoutQueries(factoryId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [invalidateLayoutQueries])

  const update = useCallback(async (
    layoutId: string,
    data: {
      name?: string
      description?: string
      floor_x?: number | null
      floor_y?: number | null
      floor_width?: number | null
      floor_height?: number | null
      background_image?: string | null
      background_opacity?: number | null
    }
  ) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateLayout(layoutId, data)
      queryClient.invalidateQueries({ queryKey: ['layout', layoutId] })
      queryClient.invalidateQueries({ queryKey: ['layouts'] })
      queryClient.invalidateQueries({ queryKey: ['active-layout'] })
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [queryClient])

  const remove = useCallback(async (layoutId: string) => {
    try {
      setSaving(true)
      setError(null)
      await deleteLayout(layoutId)
      invalidateLayoutQueries()
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [invalidateLayoutQueries])

  const activate = useCallback(async (layoutId: string) => {
    try {
      setSaving(true)
      setError(null)
      const result = await activateLayout(layoutId)
      invalidateLayoutQueries()
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [invalidateLayoutQueries])

  const clone = useCallback(async (
    layoutId: string,
    newName: string,
    newDescription?: string
  ) => {
    try {
      setSaving(true)
      setError(null)
      const result = await cloneLayout(layoutId, newName, newDescription)
      invalidateLayoutQueries()
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [invalidateLayoutQueries])

  const saveFromViewer = useCallback(async (
    factoryId: string,
    name: string,
    equipment: LayoutEquipmentCreate[],
    description?: string,
    setActive?: boolean,
    floorBounds?: { x: number; y: number; width: number; height: number } | null,
    backgroundImage?: string | null,
    backgroundOpacity?: number | null
  ) => {
    try {
      setSaving(true)
      setError(null)
      const result = await saveLayoutFromViewer(factoryId, name, equipment, description, setActive, floorBounds, backgroundImage, backgroundOpacity)
      invalidateLayoutQueries(factoryId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [invalidateLayoutQueries])

  const updateEquipment = useCallback(async (
    layoutId: string,
    equipment: LayoutEquipmentCreate[]
  ) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateLayoutEquipment(layoutId, equipment)
      queryClient.invalidateQueries({ queryKey: ['layout', layoutId] })
      queryClient.invalidateQueries({ queryKey: ['active-layout'] })
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [queryClient])

  return {
    saving,
    error,
    create,
    update,
    remove,
    activate,
    clone,
    saveFromViewer,
    updateEquipment,
  }
}

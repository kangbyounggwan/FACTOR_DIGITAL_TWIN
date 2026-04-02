import { useState, useEffect, useCallback } from 'react'
import {
  Layout,
  LayoutDetail,
  LayoutEquipmentCreate,
  LayoutCompareResponse,
  fetchLayouts,
  fetchLayout,
  fetchActiveLayout,
  createLayout,
  updateLayout,
  deleteLayout,
  activateLayout,
  cloneLayout,
  compareLayouts,
  saveLayoutFromViewer,
  updateLayoutEquipment,
} from '@/lib/api'

/**
 * Hook for managing layouts list for a factory
 */
export function useLayouts(factoryId: string | null) {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryId) {
      setLayouts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchLayouts(factoryId)
      setLayouts(data)
    } catch (e) {
      setError(e as Error)
      setLayouts([])
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  useEffect(() => {
    load()
  }, [load])

  return { layouts, loading, error, reload: load }
}

/**
 * Hook for managing a single layout's details
 */
export function useLayout(layoutId: string | null) {
  const [layout, setLayout] = useState<LayoutDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!layoutId) {
      setLayout(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchLayout(layoutId)
      setLayout(data)
    } catch (e) {
      setError(e as Error)
      setLayout(null)
    } finally {
      setLoading(false)
    }
  }, [layoutId])

  useEffect(() => {
    load()
  }, [load])

  return { layout, loading, error, reload: load }
}

/**
 * Hook for managing the active layout for a factory
 */
export function useActiveLayout(factoryId: string | null) {
  const [layout, setLayout] = useState<LayoutDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryId) {
      setLayout(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchActiveLayout(factoryId)
      setLayout(data)
    } catch (e) {
      setError(e as Error)
      setLayout(null)
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  useEffect(() => {
    load()
  }, [load])

  return { layout, loading, error, reload: load }
}

/**
 * Hook for layout mutations (create, update, delete, activate, clone)
 */
export function useLayoutMutations() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

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
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

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
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (layoutId: string) => {
    try {
      setSaving(true)
      setError(null)
      await deleteLayout(layoutId)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const activate = useCallback(async (layoutId: string) => {
    try {
      setSaving(true)
      setError(null)
      const result = await activateLayout(layoutId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const clone = useCallback(async (
    layoutId: string,
    newName: string,
    newDescription?: string
  ) => {
    try {
      setSaving(true)
      setError(null)
      const result = await cloneLayout(layoutId, newName, newDescription)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

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
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const updateEquipment = useCallback(async (
    layoutId: string,
    equipment: LayoutEquipmentCreate[]
  ) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateLayoutEquipment(layoutId, equipment)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

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

/**
 * Hook for comparing two layouts
 */
export function useLayoutComparison(layoutAId: string | null, layoutBId: string | null) {
  const [comparison, setComparison] = useState<LayoutCompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const compare = useCallback(async () => {
    if (!layoutAId || !layoutBId) {
      setComparison(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await compareLayouts(layoutAId, layoutBId)
      setComparison(data)
    } catch (e) {
      setError(e as Error)
      setComparison(null)
    } finally {
      setLoading(false)
    }
  }, [layoutAId, layoutBId])

  useEffect(() => {
    compare()
  }, [compare])

  return { comparison, loading, error, reload: compare }
}

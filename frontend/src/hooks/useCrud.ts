import { useState, useCallback, useEffect } from 'react'
import {
  Company,
  CompanyCreate,
  CompanyUpdate,
  CompanyDeleteInfo,
  FactoryFull,
  FactoryCreate,
  FactoryUpdate,
  FactoryDeleteInfo,
  LineFull,
  LineCreate,
  LineUpdate,
  LineDeleteInfo,
  Equipment,
  EquipmentCreate,
  EquipmentUpdate,
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyDeleteInfo,
  createFactory,
  getFactoryById,
  updateFactory,
  deleteFactory,
  getFactoryDeleteInfo,
  fetchLines,
  getLineById,
  createLine,
  updateLine,
  deleteLine,
  getLineDeleteInfo,
  createEquipment,
  deleteEquipment,
  fetchLineEquipment,
  updateEquipment,
} from '@/lib/api'

// =============================================================================
// COMPANY CRUD HOOKS
// =============================================================================

/**
 * Hook for company CRUD mutations
 */
export function useCompanyMutations() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (data: CompanyCreate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await createCompany(data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const update = useCallback(async (companyId: string, data: CompanyUpdate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateCompany(companyId, data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (companyId: string) => {
    try {
      setSaving(true)
      setError(null)
      await deleteCompany(companyId)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const getDeleteInfo = useCallback(async (companyId: string): Promise<CompanyDeleteInfo> => {
    try {
      setError(null)
      const result = await getCompanyDeleteInfo(companyId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  const getById = useCallback(async (companyId: string): Promise<Company> => {
    try {
      setError(null)
      const result = await getCompanyById(companyId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  return {
    saving,
    error,
    create,
    update,
    remove,
    getDeleteInfo,
    getById,
  }
}

// =============================================================================
// FACTORY CRUD HOOKS
// =============================================================================

/**
 * Hook for factory CRUD mutations
 */
export function useFactoryMutations() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (data: FactoryCreate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await createFactory(data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const update = useCallback(async (factoryId: string, data: FactoryUpdate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateFactory(factoryId, data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (factoryId: string) => {
    try {
      setSaving(true)
      setError(null)
      await deleteFactory(factoryId)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const getDeleteInfo = useCallback(async (factoryId: string): Promise<FactoryDeleteInfo> => {
    try {
      setError(null)
      const result = await getFactoryDeleteInfo(factoryId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  const getById = useCallback(async (factoryId: string): Promise<FactoryFull> => {
    try {
      setError(null)
      const result = await getFactoryById(factoryId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  return {
    saving,
    error,
    create,
    update,
    remove,
    getDeleteInfo,
    getById,
  }
}

// =============================================================================
// LINE CRUD HOOKS
// =============================================================================

/**
 * Hook for fetching lines list
 */
export function useLines(factoryId: string | null) {
  const [lines, setLines] = useState<LineFull[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryId) {
      setLines([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchLines(factoryId)
      setLines(data)
    } catch (e) {
      setError(e as Error)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  // Auto-load on mount and when factoryId changes
  useEffect(() => {
    load()
  }, [load])

  return { lines, loading, error, reload: load }
}

/**
 * Hook for line CRUD mutations
 */
export function useLineMutations() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (data: LineCreate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await createLine(data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const update = useCallback(async (lineId: string, data: LineUpdate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateLine(lineId, data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (lineId: string) => {
    try {
      setSaving(true)
      setError(null)
      await deleteLine(lineId)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const getDeleteInfo = useCallback(async (lineId: string): Promise<LineDeleteInfo> => {
    try {
      setError(null)
      const result = await getLineDeleteInfo(lineId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  const getById = useCallback(async (lineId: string): Promise<LineFull> => {
    try {
      setError(null)
      const result = await getLineById(lineId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  return {
    saving,
    error,
    create,
    update,
    remove,
    getDeleteInfo,
    getById,
  }
}

// =============================================================================
// GENERIC DELETE CONFIRMATION HOOK
// =============================================================================

export interface DeleteInfo {
  entityType: 'company' | 'factory' | 'line'
  entityId: string
  entityName: string
  childCounts: {
    factories?: number
    lines?: number
    equipment?: number
    layouts?: number
  }
}

/**
 * Hook for managing delete confirmation flow
 */
export function useDeleteConfirmation() {
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const prepareDelete = useCallback(async (
    entityType: 'company' | 'factory' | 'line',
    entityId: string
  ) => {
    try {
      setLoading(true)
      setError(null)

      let info: DeleteInfo

      switch (entityType) {
        case 'company': {
          const result = await getCompanyDeleteInfo(entityId)
          info = {
            entityType,
            entityId,
            entityName: result.company_name,
            childCounts: {
              factories: result.factory_count,
              lines: result.line_count,
              equipment: result.equipment_count,
            },
          }
          break
        }
        case 'factory': {
          const result = await getFactoryDeleteInfo(entityId)
          info = {
            entityType,
            entityId,
            entityName: result.factory_name,
            childCounts: {
              lines: result.line_count,
              equipment: result.equipment_count,
              layouts: result.layout_count,
            },
          }
          break
        }
        case 'line': {
          const result = await getLineDeleteInfo(entityId)
          info = {
            entityType,
            entityId,
            entityName: result.line_name,
            childCounts: {
              equipment: result.equipment_count,
            },
          }
          break
        }
      }

      setDeleteInfo(info)
      return info
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteInfo) return

    try {
      setLoading(true)
      setError(null)

      switch (deleteInfo.entityType) {
        case 'company':
          await deleteCompany(deleteInfo.entityId)
          break
        case 'factory':
          await deleteFactory(deleteInfo.entityId)
          break
        case 'line':
          await deleteLine(deleteInfo.entityId)
          break
      }

      setDeleteInfo(null)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setLoading(false)
    }
  }, [deleteInfo])

  const cancelDelete = useCallback(() => {
    setDeleteInfo(null)
    setError(null)
  }, [])

  return {
    deleteInfo,
    loading,
    error,
    prepareDelete,
    confirmDelete,
    cancelDelete,
  }
}

// =============================================================================
// EQUIPMENT CRUD HOOKS
// =============================================================================

/**
 * Hook for fetching equipment by line
 */
export function useLineEquipment(lineId: string | null) {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!lineId) {
      setEquipment([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchLineEquipment(lineId)
      setEquipment(data)
    } catch (e) {
      setError(e as Error)
      setEquipment([])
    } finally {
      setLoading(false)
    }
  }, [lineId])

  useEffect(() => {
    load()
  }, [load])

  return { equipment, loading, error, reload: load }
}

/**
 * Hook for equipment CRUD mutations
 */
export function useEquipmentMutations() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (data: EquipmentCreate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await createEquipment(data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const update = useCallback(async (equipmentId: string, data: EquipmentUpdate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateEquipment(equipmentId, data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (equipmentId: string) => {
    try {
      setSaving(true)
      setError(null)
      await deleteEquipment(equipmentId)
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
  }
}

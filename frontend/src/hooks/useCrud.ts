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
import { useCrudMutation } from './useCrudMutation'

// =============================================================================
// COMPANY CRUD HOOKS
// =============================================================================

export function useCompanyMutations() {
  return useCrudMutation<Company, CompanyCreate, CompanyUpdate, CompanyDeleteInfo>({
    create: createCompany,
    update: updateCompany,
    remove: deleteCompany,
    getById: getCompanyById,
    getDeleteInfo: getCompanyDeleteInfo,
  })
}

// =============================================================================
// FACTORY CRUD HOOKS
// =============================================================================

export function useFactoryMutations() {
  return useCrudMutation<FactoryFull, FactoryCreate, FactoryUpdate, FactoryDeleteInfo>({
    create: createFactory,
    update: updateFactory,
    remove: deleteFactory,
    getById: getFactoryById,
    getDeleteInfo: getFactoryDeleteInfo,
  })
}

// =============================================================================
// LINE CRUD HOOKS
// =============================================================================

export function useLineMutations() {
  return useCrudMutation<LineFull, LineCreate, LineUpdate, LineDeleteInfo>({
    create: createLine,
    update: updateLine,
    remove: deleteLine,
    getById: getLineById,
    getDeleteInfo: getLineDeleteInfo,
  })
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

export function useEquipmentMutations() {
  return useCrudMutation<Equipment, EquipmentCreate, EquipmentUpdate>({
    create: createEquipment,
    update: updateEquipment,
    remove: deleteEquipment,
  })
}

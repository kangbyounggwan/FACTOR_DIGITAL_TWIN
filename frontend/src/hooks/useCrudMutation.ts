import { useState, useCallback, useMemo } from 'react'

/**
 * 제너릭 CRUD Mutation Hook
 * 중복되는 try-catch 에러 핸들링 패턴을 추출하여 재사용
 */

type AsyncFn<T extends any[], R> = (...args: T) => Promise<R>

interface CrudConfig<T, C, U, D = void, I = void> {
  create?: (data: C) => Promise<T>
  update?: (id: string, data: U) => Promise<T>
  remove?: (id: string) => Promise<void>
  getById?: (id: string) => Promise<T>
  getDeleteInfo?: (id: string) => Promise<D>
}

interface CrudMutationResult<T, C, U, D, I> {
  saving: boolean
  error: Error | null
  create?: (data: C) => Promise<T>
  update?: (id: string, data: U) => Promise<T>
  remove?: (id: string) => Promise<void>
  getById?: (id: string) => Promise<T>
  getDeleteInfo?: (id: string) => Promise<D>
}

export function useCrudMutation<T, C = unknown, U = unknown, D = unknown, I = unknown>(
  config: CrudConfig<T, C, U, D, I>
): CrudMutationResult<T, C, U, D, I> {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 에러 핸들링 래퍼 (saving 상태 포함)
  const withSaving = useCallback(<Args extends any[], R>(
    fn: AsyncFn<Args, R>
  ): AsyncFn<Args, R> => {
    return async (...args: Args): Promise<R> => {
      try {
        setSaving(true)
        setError(null)
        return await fn(...args)
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setSaving(false)
      }
    }
  }, [])

  // 에러 핸들링 래퍼 (saving 상태 없음)
  const withError = useCallback(<Args extends any[], R>(
    fn: AsyncFn<Args, R>
  ): AsyncFn<Args, R> => {
    return async (...args: Args): Promise<R> => {
      try {
        setError(null)
        return await fn(...args)
      } catch (e) {
        setError(e as Error)
        throw e
      }
    }
  }, [])

  // 래핑된 함수들을 useMemo로 메모이제이션
  const create = useMemo(
    () => config.create ? withSaving(config.create) : undefined,
    [config.create, withSaving]
  )

  const update = useMemo(
    () => config.update ? withSaving((id: string, data: U) => config.update!(id, data)) : undefined,
    [config.update, withSaving]
  )

  const remove = useMemo(
    () => config.remove ? withSaving(config.remove) : undefined,
    [config.remove, withSaving]
  )

  const getById = useMemo(
    () => config.getById ? withError(config.getById) : undefined,
    [config.getById, withError]
  )

  const getDeleteInfo = useMemo(
    () => config.getDeleteInfo ? withError(config.getDeleteInfo) : undefined,
    [config.getDeleteInfo, withError]
  )

  return {
    saving,
    error,
    create,
    update,
    remove,
    getById,
    getDeleteInfo,
  }
}

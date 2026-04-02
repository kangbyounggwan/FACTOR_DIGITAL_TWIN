# Section 02: useCrud.ts 리팩토링

## Overview

| 항목 | 내용 |
|------|------|
| **목표** | 555줄의 useCrud.ts를 제너릭 훅으로 리팩토링하여 ~200줄로 감소 |
| **예상 시간** | 30-45분 |
| **난이도** | 중간 |
| **영향 범위** | `src/hooks/useCrud.ts`, `src/hooks/useCrudMutation.ts` (신규) |

---

## 1. Background (배경)

### 1.1 현재 문제점

현재 `useCrud.ts` 파일은 **555줄**로, 동일한 try-catch 에러 핸들링 패턴이 여러 mutation 훅에서 반복됩니다.

**반복되는 패턴 분석:**

```typescript
// 이 패턴이 22개 함수에서 반복됨
const someAction = useCallback(async (data: SomeType) => {
  try {
    setSaving(true)
    setError(null)
    const result = await apiCall(data)
    return result
  } catch (e) {
    setError(e as Error)
    throw e
  } finally {
    setSaving(false)
  }
}, [])
```

**중복 발생 위치:**

| 훅 이름 | 중복 함수 수 | 라인 범위 |
|--------|------------|----------|
| `useCompanyMutations` | 5개 (create, update, remove, getDeleteInfo, getById) | 47-123 |
| `useFactoryMutations` | 5개 (create, update, remove, getDeleteInfo, getById) | 132-208 |
| `useLineMutations` | 5개 (create, update, remove, getDeleteInfo, getById) | 253-329 |
| `useEquipmentMutations` | 3개 (create, update, remove) | 503-555 |
| `useDeleteConfirmation` | 2개 (prepareDelete, confirmDelete) | 350-459 |

**총 22개 함수에서 동일 패턴 반복**

### 1.2 리팩토링 필요성

- **코드 중복**: 동일한 에러 핸들링 로직이 22회 반복
- **유지보수성**: 에러 핸들링 방식 변경 시 22곳 수정 필요
- **일관성 부재**: 일부 함수는 `setSaving` 사용, 일부는 미사용 (불일치)
- **테스트 부담**: 각 함수마다 동일한 에러 케이스 테스트 필요

---

## 2. Requirements (완료 조건)

### 2.1 기능 요구사항

- [ ] 제너릭 `useCrudMutation` 훅 생성
- [ ] 기존 4개 mutation 훅을 새 패턴으로 리팩토링
- [ ] 기존 API 인터페이스 100% 호환 유지
- [ ] 타입 안전성 유지 (TypeScript 에러 없음)

### 2.2 비기능 요구사항

- [ ] `useCrud.ts` 라인 수 280줄 이하 (현재 555줄 대비 ~50% 감소)
- [ ] 빌드 성공 (`npm run build`)
- [ ] 기존 테스트 통과 (있는 경우)

---

## 3. Dependencies (의존성)

### 3.1 선행 작업

```
requires: 없음 (독립적으로 실행 가능)
```

### 3.2 후행 작업

```
blocks: 없음 (다른 섹션에 영향 없음)
```

### 3.3 관련 파일

| 파일 | 역할 |
|-----|------|
| `src/hooks/useCrud.ts` | 리팩토링 대상 |
| `src/hooks/useCrudMutation.ts` | 신규 생성 |
| `src/lib/api.ts` | API 함수 (변경 없음) |
| `src/pages/AdminPage.tsx` | 주요 사용처 (변경 없음) |

---

## 4. Implementation Details (구현 상세)

### 4.1 Step 1: useCrudMutation.ts 생성

**파일 경로:** `src/hooks/useCrudMutation.ts`

```typescript
// src/hooks/useCrudMutation.ts
import { useState, useCallback, useMemo } from 'react'

/**
 * CRUD 작업 설정 인터페이스
 * @template T - 엔티티 타입 (예: Company, Factory)
 * @template C - Create DTO 타입 (예: CompanyCreate)
 * @template U - Update DTO 타입 (예: CompanyUpdate)
 * @template D - DeleteInfo 타입 (예: CompanyDeleteInfo)
 */
export interface CrudConfig<T, C = unknown, U = unknown, D = unknown> {
  /** 엔티티 생성 API 함수 */
  create?: (data: C) => Promise<T>
  /** 엔티티 수정 API 함수 */
  update?: (id: string, data: U) => Promise<T>
  /** 엔티티 삭제 API 함수 */
  remove?: (id: string) => Promise<void>
  /** ID로 엔티티 조회 API 함수 */
  getById?: (id: string) => Promise<T>
  /** 삭제 전 정보 조회 API 함수 */
  getDeleteInfo?: (id: string) => Promise<D>
}

/**
 * useCrudMutation 반환 타입
 */
export interface CrudMutationResult<T, C, U, D> {
  /** 저장 중 여부 */
  saving: boolean
  /** 마지막 에러 */
  error: Error | null
  /** 생성 함수 (설정된 경우) */
  create?: (data: C) => Promise<T>
  /** 수정 함수 (설정된 경우) */
  update?: (id: string, data: U) => Promise<T>
  /** 삭제 함수 (설정된 경우) */
  remove?: (id: string) => Promise<void>
  /** ID로 조회 함수 (설정된 경우) */
  getById?: (id: string) => Promise<T>
  /** 삭제 정보 조회 함수 (설정된 경우) */
  getDeleteInfo?: (id: string) => Promise<D>
}

/**
 * 에러 핸들링이 포함된 비동기 함수를 생성하는 고차 함수
 */
function createWrappedFunction<F extends (...args: any[]) => Promise<any>>(
  fn: F | undefined,
  setSaving: (saving: boolean) => void,
  setError: (error: Error | null) => void,
  useSavingState: boolean = true
): F | undefined {
  if (!fn) return undefined

  return (async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    try {
      if (useSavingState) setSaving(true)
      setError(null)
      const result = await fn(...args)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      if (useSavingState) setSaving(false)
    }
  }) as F
}

/**
 * 제너릭 CRUD mutation 훅
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const { saving, error, create, update, remove } = useCrudMutation<Company, CompanyCreate, CompanyUpdate>({
 *   create: createCompany,
 *   update: (id, data) => updateCompany(id, data),
 *   remove: deleteCompany,
 * })
 * ```
 *
 * @template T - 엔티티 타입
 * @template C - Create DTO 타입
 * @template U - Update DTO 타입
 * @template D - DeleteInfo 타입
 */
export function useCrudMutation<T, C = unknown, U = unknown, D = unknown>(
  config: CrudConfig<T, C, U, D>
): CrudMutationResult<T, C, U, D> {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // config 객체의 함수들을 메모이제이션
  const { create, update, remove, getById, getDeleteInfo } = config

  // 래핑된 함수들 생성 (useMemo로 안정적인 참조 유지)
  const wrappedCreate = useMemo(
    () => createWrappedFunction(create, setSaving, setError, true),
    [create]
  )

  const wrappedUpdate = useMemo(
    () => createWrappedFunction(update, setSaving, setError, true),
    [update]
  )

  const wrappedRemove = useMemo(
    () => createWrappedFunction(remove, setSaving, setError, true),
    [remove]
  )

  // getById와 getDeleteInfo는 saving 상태를 변경하지 않음 (읽기 전용)
  const wrappedGetById = useMemo(
    () => createWrappedFunction(getById, setSaving, setError, false),
    [getById]
  )

  const wrappedGetDeleteInfo = useMemo(
    () => createWrappedFunction(getDeleteInfo, setSaving, setError, false),
    [getDeleteInfo]
  )

  return {
    saving,
    error,
    create: wrappedCreate,
    update: wrappedUpdate,
    remove: wrappedRemove,
    getById: wrappedGetById,
    getDeleteInfo: wrappedGetDeleteInfo,
  }
}

/**
 * 에러 핸들링만 적용하는 간단한 래퍼 (saving 상태 없음)
 * useDeleteConfirmation 등 복잡한 훅에서 부분적으로 사용
 */
export function withErrorHandling<F extends (...args: any[]) => Promise<any>>(
  fn: F,
  setError: (error: Error | null) => void
): F {
  return (async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    try {
      setError(null)
      return await fn(...args)
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }) as F
}
```

### 4.2 Step 2: useCrud.ts 리팩토링

#### 4.2.1 useCompanyMutations 리팩토링

**Before (77줄):**

```typescript
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
```

**After (12줄):**

```typescript
export function useCompanyMutations() {
  return useCrudMutation<Company, CompanyCreate, CompanyUpdate, CompanyDeleteInfo>({
    create: createCompany,
    update: updateCompany,
    remove: deleteCompany,
    getById: getCompanyById,
    getDeleteInfo: getCompanyDeleteInfo,
  })
}
```

#### 4.2.2 useFactoryMutations 리팩토링

**After:**

```typescript
export function useFactoryMutations() {
  return useCrudMutation<FactoryFull, FactoryCreate, FactoryUpdate, FactoryDeleteInfo>({
    create: createFactory,
    update: updateFactory,
    remove: deleteFactory,
    getById: getFactoryById,
    getDeleteInfo: getFactoryDeleteInfo,
  })
}
```

#### 4.2.3 useLineMutations 리팩토링

**After:**

```typescript
export function useLineMutations() {
  return useCrudMutation<LineFull, LineCreate, LineUpdate, LineDeleteInfo>({
    create: createLine,
    update: updateLine,
    remove: deleteLine,
    getById: getLineById,
    getDeleteInfo: getLineDeleteInfo,
  })
}
```

#### 4.2.4 useEquipmentMutations 리팩토링

**After:**

```typescript
export function useEquipmentMutations() {
  return useCrudMutation<Equipment, EquipmentCreate, EquipmentUpdate>({
    create: createEquipment,
    update: updateEquipment,
    remove: deleteEquipment,
  })
}
```

### 4.3 Step 3: 전체 useCrud.ts 리팩토링 결과

**리팩토링 후 전체 파일:**

```typescript
// src/hooks/useCrud.ts
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
import { useCrudMutation } from './useCrudMutation'

// =============================================================================
// COMPANY CRUD HOOKS
// =============================================================================

/**
 * Hook for company CRUD mutations
 */
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

/**
 * Hook for factory CRUD mutations
 */
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

  useEffect(() => {
    load()
  }, [load])

  return { lines, loading, error, reload: load }
}

/**
 * Hook for line CRUD mutations
 */
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

/**
 * Hook for managing delete confirmation flow
 * Note: 이 훅은 복잡한 상태 관리가 필요하여 useCrudMutation으로 대체하지 않음
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
  return useCrudMutation<Equipment, EquipmentCreate, EquipmentUpdate>({
    create: createEquipment,
    update: updateEquipment,
    remove: deleteEquipment,
  })
}
```

---

## 5. Acceptance Criteria (검증 체크리스트)

### 5.1 코드 품질

- [ ] `useCrudMutation.ts` 파일이 `src/hooks/` 디렉토리에 생성됨
- [ ] `useCrud.ts` 라인 수가 280줄 이하로 감소
- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 경고/에러 없음

### 5.2 기능 검증

- [ ] `npm run build` 성공
- [ ] Admin 페이지에서 회사 CRUD 정상 동작
  - [ ] 회사 생성
  - [ ] 회사 수정
  - [ ] 회사 삭제 (삭제 확인 모달 포함)
- [ ] Admin 페이지에서 공장 CRUD 정상 동작
  - [ ] 공장 생성
  - [ ] 공장 수정
  - [ ] 공장 삭제
- [ ] Admin 페이지에서 라인 CRUD 정상 동작
  - [ ] 라인 생성
  - [ ] 라인 수정
  - [ ] 라인 삭제
- [ ] 설비 관련 기능 정상 동작
  - [ ] 설비 추가
  - [ ] 설비 수정
  - [ ] 설비 삭제

### 5.3 API 호환성

- [ ] 모든 기존 훅의 반환 타입이 동일하게 유지됨
- [ ] `saving`, `error` 상태가 기존과 동일하게 동작
- [ ] 에러 발생 시 기존과 동일하게 throw됨

---

## 6. Files to Create/Modify (파일 목록)

### 6.1 신규 생성 파일

| 파일 경로 | 설명 |
|----------|------|
| `src/hooks/useCrudMutation.ts` | 제너릭 CRUD mutation 훅 |

### 6.2 수정 파일

| 파일 경로 | 수정 내용 |
|----------|----------|
| `src/hooks/useCrud.ts` | useCrudMutation 사용하도록 리팩토링 |

### 6.3 변경 없는 관련 파일 (참고용)

| 파일 경로 | 역할 |
|----------|------|
| `src/lib/api.ts` | API 함수 정의 |
| `src/pages/AdminPage.tsx` | CRUD 훅 사용처 |

---

## 7. Rollback Plan (롤백 계획)

문제 발생 시:

```bash
# Git으로 변경 사항 되돌리기
git checkout -- src/hooks/useCrud.ts
git rm src/hooks/useCrudMutation.ts
```

---

## 8. Expected Results (예상 결과)

| 지표 | Before | After | 개선율 |
|-----|--------|-------|--------|
| useCrud.ts 라인 수 | 555줄 | ~250줄 | ~55% 감소 |
| 중복 try-catch 패턴 | 22개 | 0개 | 100% 제거 |
| 새 엔티티 추가 시 코드량 | ~70줄 | ~10줄 | ~85% 감소 |

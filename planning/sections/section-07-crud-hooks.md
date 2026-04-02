# Section 07: Frontend CRUD Hooks

**Status:** Pending
**Estimated Effort:** 3-4 hours

---

## Background

The FACTOR Digital Twin system currently has read-only functionality for companies, factories, and production lines. Users can view hierarchical entity data but cannot create, update, or delete entries from the frontend. This section implements the React hooks that connect the frontend to the new CRUD APIs, enabling full data management capabilities.

These hooks follow the established patterns in the codebase (see `useFactories.ts`) and integrate with the existing API layer (`lib/api.ts`). They provide:
- Create operations with success/error feedback
- Update operations with optimistic UI support
- Delete operations with pre-deletion impact information
- Loading states for UI feedback
- Toast notifications for user feedback

The hooks will be consumed by the Admin Page (Section 08) to provide a complete entity management experience.

---

## Dependencies

### Requires (must be completed first)
- **Section 05: CASCADE FK** - Database must have proper CASCADE delete constraints
- **Section 06: CRUD APIs** - Backend must expose these endpoints:
  - `POST /api/companies/` - Create company
  - `PUT /api/companies/{id}` - Update company
  - `GET /api/companies/{id}/delete-info` - Get delete impact info
  - `DELETE /api/companies/{id}` - Delete company
  - `POST /api/factories/` - Create factory
  - `PUT /api/factories/{id}` - Update factory
  - `GET /api/factories/{id}/delete-info` - Get delete impact info
  - `DELETE /api/factories/{id}` - Delete factory
  - `POST /api/lines/` - Create line
  - `PUT /api/lines/{id}` - Update line
  - `GET /api/lines/{id}/delete-info` - Get delete impact info
  - `DELETE /api/lines/{id}` - Delete line

### Blocks (cannot start until this section is complete)
- **Section 08: Admin Page UI** - Needs these hooks to perform CRUD operations

### Parallelizable With
- **Section 03: Layout Hooks** - No dependencies between these sections

---

## Requirements

When this section is complete, the following must be true:

1. `useCompanyCrud` hook provides create, update, getDeleteInfo, and remove functions
2. `useFactoryCrud` hook provides create, update, getDeleteInfo, and remove functions
3. `useLineCrud` hook provides create, update, getDeleteInfo, and remove functions
4. All hooks provide a `loading` state for UI feedback
5. All hooks accept an optional `onSuccess` callback for triggering data refresh
6. API functions are added to `lib/api.ts` using the existing axios instance
7. Toast notifications display on success and error for all operations
8. TypeScript interfaces are properly defined for all request/response types
9. Delete info responses include counts of affected child entities

---

## Implementation Details

### File 1: api.ts (MODIFY)

**Path:** `frontend/src/lib/api.ts`

Add the following types and functions to the existing file. The file already uses axios with a baseURL of `/api`.

#### Type Definitions

Add these interfaces after the existing interface definitions (after `EquipmentType` interface around line 180):

```typescript
// ============================================
// CRUD Types
// ============================================

// Company CRUD Types
export interface CompanyCreate {
  code: string
  name: string
  description?: string
}

export interface CompanyUpdate {
  name?: string
  description?: string
  is_active?: boolean
}

export interface CompanyDeleteInfo {
  factories_count: number
  lines_count: number
  equipment_count: number
}

// Factory CRUD Types
export interface FactoryCreate {
  company_id: string
  code: string
  name: string
  address?: string
}

export interface FactoryUpdate {
  name?: string
  address?: string
  is_active?: boolean
}

export interface FactoryDeleteInfo {
  lines_count: number
  equipment_count: number
}

// Line (Production Line) CRUD Types
export interface LineCreate {
  factory_id: string
  code: string
  name: string
  building?: string
  floor?: number
  area?: string
}

export interface LineUpdate {
  name?: string
  building?: string
  floor?: number
  area?: string
  is_active?: boolean
}

export interface LineDeleteInfo {
  equipment_count: number
}
```

#### API Functions

Add these functions after the existing API functions (after `ensureEquipmentType` around line 187):

```typescript
// ============================================
// Company CRUD API
// ============================================

export const createCompany = (data: CompanyCreate) =>
  api.post<Company>('/companies/', data).then(r => r.data)

export const updateCompany = (companyId: string, data: CompanyUpdate) =>
  api.put<Company>(`/companies/${companyId}`, data).then(r => r.data)

export const getCompanyDeleteInfo = (companyId: string) =>
  api.get<CompanyDeleteInfo>(`/companies/${companyId}/delete-info`).then(r => r.data)

export const deleteCompany = (companyId: string) =>
  api.delete<{ message: string }>(`/companies/${companyId}`).then(r => r.data)

// ============================================
// Factory CRUD API
// ============================================

export const createFactory = (data: FactoryCreate) =>
  api.post<Factory>('/factories/', data).then(r => r.data)

export const updateFactory = (factoryId: string, data: FactoryUpdate) =>
  api.put<Factory>(`/factories/${factoryId}`, data).then(r => r.data)

export const getFactoryDeleteInfo = (factoryId: string) =>
  api.get<FactoryDeleteInfo>(`/factories/${factoryId}/delete-info`).then(r => r.data)

export const deleteFactory = (factoryId: string) =>
  api.delete<{ message: string }>(`/factories/${factoryId}`).then(r => r.data)

// ============================================
// Line (Production Line) CRUD API
// ============================================

export const createLine = (data: LineCreate) =>
  api.post<ProductionLine>('/lines/', data).then(r => r.data)

export const updateLine = (lineId: string, data: LineUpdate) =>
  api.put<ProductionLine>(`/lines/${lineId}`, data).then(r => r.data)

export const getLineDeleteInfo = (lineId: string) =>
  api.get<LineDeleteInfo>(`/lines/${lineId}/delete-info`).then(r => r.data)

export const deleteLine = (lineId: string) =>
  api.delete<{ message: string }>(`/lines/${lineId}`).then(r => r.data)
```

---

### File 2: useCrud.ts (NEW)

**Path:** `frontend/src/hooks/useCrud.ts`

Create this new file with the complete implementation:

```typescript
// hooks/useCrud.ts
// CRUD hooks for Company, Factory, and Line entities
// Provides create, update, delete operations with loading states and toast notifications

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  // Company
  CompanyCreate,
  CompanyUpdate,
  CompanyDeleteInfo,
  createCompany,
  updateCompany,
  getCompanyDeleteInfo,
  deleteCompany,
  // Factory
  FactoryCreate,
  FactoryUpdate,
  FactoryDeleteInfo,
  createFactory,
  updateFactory,
  getFactoryDeleteInfo,
  deleteFactory,
  // Line
  LineCreate,
  LineUpdate,
  LineDeleteInfo,
  createLine,
  updateLine,
  getLineDeleteInfo,
  deleteLine,
} from '@/lib/api'

// ============================================
// Company CRUD Hook
// ============================================

export interface UseCompanyCrudOptions {
  onSuccess?: () => void
}

export interface UseCompanyCrudReturn {
  loading: boolean
  create: (data: CompanyCreate) => Promise<boolean>
  update: (id: string, data: CompanyUpdate) => Promise<boolean>
  getDeleteInfo: (id: string) => Promise<CompanyDeleteInfo | null>
  remove: (id: string) => Promise<boolean>
}

export function useCompanyCrud(options: UseCompanyCrudOptions = {}): UseCompanyCrudReturn {
  const { onSuccess } = options
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (data: CompanyCreate): Promise<boolean> => {
    setLoading(true)
    try {
      await createCompany(data)
      toast.success('회사가 생성되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '회사 생성에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const update = useCallback(async (id: string, data: CompanyUpdate): Promise<boolean> => {
    setLoading(true)
    try {
      await updateCompany(id, data)
      toast.success('회사 정보가 수정되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '회사 수정에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const getDeleteInfoFn = useCallback(async (id: string): Promise<CompanyDeleteInfo | null> => {
    try {
      return await getCompanyDeleteInfo(id)
    } catch (err) {
      toast.error('삭제 정보 조회에 실패했습니다')
      return null
    }
  }, [])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    try {
      await deleteCompany(id)
      toast.success('회사가 삭제되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '회사 삭제에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  return {
    loading,
    create,
    update,
    getDeleteInfo: getDeleteInfoFn,
    remove,
  }
}

// ============================================
// Factory CRUD Hook
// ============================================

export interface UseFactoryCrudOptions {
  onSuccess?: () => void
}

export interface UseFactoryCrudReturn {
  loading: boolean
  create: (data: FactoryCreate) => Promise<boolean>
  update: (id: string, data: FactoryUpdate) => Promise<boolean>
  getDeleteInfo: (id: string) => Promise<FactoryDeleteInfo | null>
  remove: (id: string) => Promise<boolean>
}

export function useFactoryCrud(options: UseFactoryCrudOptions = {}): UseFactoryCrudReturn {
  const { onSuccess } = options
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (data: FactoryCreate): Promise<boolean> => {
    setLoading(true)
    try {
      await createFactory(data)
      toast.success('공장이 생성되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '공장 생성에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const update = useCallback(async (id: string, data: FactoryUpdate): Promise<boolean> => {
    setLoading(true)
    try {
      await updateFactory(id, data)
      toast.success('공장 정보가 수정되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '공장 수정에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const getDeleteInfoFn = useCallback(async (id: string): Promise<FactoryDeleteInfo | null> => {
    try {
      return await getFactoryDeleteInfo(id)
    } catch (err) {
      toast.error('삭제 정보 조회에 실패했습니다')
      return null
    }
  }, [])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    try {
      await deleteFactory(id)
      toast.success('공장이 삭제되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '공장 삭제에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  return {
    loading,
    create,
    update,
    getDeleteInfo: getDeleteInfoFn,
    remove,
  }
}

// ============================================
// Line (Production Line) CRUD Hook
// ============================================

export interface UseLineCrudOptions {
  onSuccess?: () => void
}

export interface UseLineCrudReturn {
  loading: boolean
  create: (data: LineCreate) => Promise<boolean>
  update: (id: string, data: LineUpdate) => Promise<boolean>
  getDeleteInfo: (id: string) => Promise<LineDeleteInfo | null>
  remove: (id: string) => Promise<boolean>
}

export function useLineCrud(options: UseLineCrudOptions = {}): UseLineCrudReturn {
  const { onSuccess } = options
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (data: LineCreate): Promise<boolean> => {
    setLoading(true)
    try {
      await createLine(data)
      toast.success('라인이 생성되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '라인 생성에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const update = useCallback(async (id: string, data: LineUpdate): Promise<boolean> => {
    setLoading(true)
    try {
      await updateLine(id, data)
      toast.success('라인 정보가 수정되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '라인 수정에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const getDeleteInfoFn = useCallback(async (id: string): Promise<LineDeleteInfo | null> => {
    try {
      return await getLineDeleteInfo(id)
    } catch (err) {
      toast.error('삭제 정보 조회에 실패했습니다')
      return null
    }
  }, [])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    try {
      await deleteLine(id)
      toast.success('라인이 삭제되었습니다')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '라인 삭제에 실패했습니다'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  return {
    loading,
    create,
    update,
    getDeleteInfo: getDeleteInfoFn,
    remove,
  }
}
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/lib/api.ts` | MODIFY | Add CRUD type definitions and API functions for Company, Factory, and Line entities |
| `frontend/src/hooks/useCrud.ts` | CREATE | Implement useCompanyCrud, useFactoryCrud, and useLineCrud hooks |

---

## Required Dependencies

The implementation uses these existing dependencies (already installed):

- **react** - useState, useCallback hooks
- **sonner** - Toast notifications (already used in the project)
- **axios** - HTTP client (already configured in api.ts)

Verify sonner is configured in the app. If not, the toast provider needs to be added to the root component:

```tsx
// In App.tsx or main.tsx
import { Toaster } from 'sonner'

function App() {
  return (
    <>
      {/* ... existing app content ... */}
      <Toaster position="top-right" />
    </>
  )
}
```

---

## Usage Examples

### Basic Usage

```tsx
import { useCompanyCrud, useFactoryCrud, useLineCrud } from '@/hooks/useCrud'
import { useCompanies } from '@/hooks/useFactories'

function AdminPage() {
  const { companies, reload: reloadCompanies } = useCompanies()

  // Pass reload function as onSuccess callback
  const companyCrud = useCompanyCrud({ onSuccess: reloadCompanies })
  const factoryCrud = useFactoryCrud({ onSuccess: reloadFactories })
  const lineCrud = useLineCrud({ onSuccess: reloadLines })

  // Create a new company
  const handleCreateCompany = async () => {
    const success = await companyCrud.create({
      code: 'NEWCO',
      name: 'New Company',
      description: 'A new company'
    })
    if (success) {
      // Data will be refreshed via onSuccess callback
    }
  }

  // Update existing company
  const handleUpdateCompany = async (id: string) => {
    await companyCrud.update(id, { name: 'Updated Name' })
  }

  // Delete with confirmation
  const handleDeleteCompany = async (id: string) => {
    // First, get impact information
    const info = await companyCrud.getDeleteInfo(id)
    if (info) {
      const confirmed = window.confirm(
        `이 회사를 삭제하면 ${info.factories_count}개 공장, ` +
        `${info.lines_count}개 라인, ${info.equipment_count}개 설비가 함께 삭제됩니다.`
      )
      if (confirmed) {
        await companyCrud.remove(id)
      }
    }
  }

  // Disable buttons while loading
  return (
    <button disabled={companyCrud.loading} onClick={handleCreateCompany}>
      {companyCrud.loading ? '처리 중...' : '회사 추가'}
    </button>
  )
}
```

### With Multiple Refresh Callbacks

```tsx
function AdminPage() {
  const { reload: reloadCompanies } = useCompanies()
  const { reload: reloadFactories } = useCompanyFactories(selectedCompanyId)

  // Factory operations need to refresh both companies (for counts) and factories
  const factoryCrud = useFactoryCrud({
    onSuccess: () => {
      reloadCompanies()
      reloadFactories()
    }
  })
}
```

---

## API Response Examples

### Company Delete Info Response

```json
{
  "factories_count": 3,
  "lines_count": 12,
  "equipment_count": 156
}
```

### Factory Delete Info Response

```json
{
  "lines_count": 4,
  "equipment_count": 52
}
```

### Line Delete Info Response

```json
{
  "equipment_count": 13
}
```

---

## Acceptance Criteria

### API Functions (lib/api.ts)

- [ ] `CompanyCreate`, `CompanyUpdate`, `CompanyDeleteInfo` interfaces defined
- [ ] `FactoryCreate`, `FactoryUpdate`, `FactoryDeleteInfo` interfaces defined
- [ ] `LineCreate`, `LineUpdate`, `LineDeleteInfo` interfaces defined
- [ ] `createCompany()` function implemented
- [ ] `updateCompany()` function implemented
- [ ] `getCompanyDeleteInfo()` function implemented
- [ ] `deleteCompany()` function implemented
- [ ] `createFactory()` function implemented
- [ ] `updateFactory()` function implemented
- [ ] `getFactoryDeleteInfo()` function implemented
- [ ] `deleteFactory()` function implemented
- [ ] `createLine()` function implemented
- [ ] `updateLine()` function implemented
- [ ] `getLineDeleteInfo()` function implemented
- [ ] `deleteLine()` function implemented

### useCompanyCrud Hook

- [ ] Hook exports from `useCrud.ts`
- [ ] `loading` state tracks async operation status
- [ ] `create()` calls `createCompany()` API
- [ ] `create()` shows success toast on success
- [ ] `create()` shows error toast on failure
- [ ] `create()` calls `onSuccess` callback on success
- [ ] `create()` returns `true` on success, `false` on failure
- [ ] `update()` calls `updateCompany()` API
- [ ] `update()` shows success toast on success
- [ ] `update()` shows error toast on failure
- [ ] `update()` calls `onSuccess` callback on success
- [ ] `getDeleteInfo()` calls `getCompanyDeleteInfo()` API
- [ ] `getDeleteInfo()` returns delete info object or null on error
- [ ] `remove()` calls `deleteCompany()` API
- [ ] `remove()` shows success toast on success
- [ ] `remove()` shows error toast on failure
- [ ] `remove()` calls `onSuccess` callback on success

### useFactoryCrud Hook

- [ ] Hook exports from `useCrud.ts`
- [ ] All CRUD functions work correctly (create, update, getDeleteInfo, remove)
- [ ] Loading state works correctly
- [ ] Toast notifications display correctly
- [ ] onSuccess callback triggers correctly

### useLineCrud Hook

- [ ] Hook exports from `useCrud.ts`
- [ ] All CRUD functions work correctly (create, update, getDeleteInfo, remove)
- [ ] Loading state works correctly
- [ ] Toast notifications display correctly
- [ ] onSuccess callback triggers correctly

### Integration

- [ ] TypeScript compiles without errors
- [ ] No console errors when using hooks
- [ ] Toast notifications appear in UI

---

## Testing Checklist

### Unit Testing (Optional)

If unit tests are implemented, test:

1. **API Functions**
   - Mock axios and verify correct endpoint calls
   - Verify request body structure
   - Verify response handling

2. **Hooks**
   - Test loading state changes
   - Test success callbacks
   - Test error handling

### Manual Testing

1. **Create Operations**
   - Call `create()` with valid data
   - Verify toast appears with "~가 생성되었습니다"
   - Verify `onSuccess` callback is called
   - Verify `loading` is true during operation

2. **Update Operations**
   - Call `update()` with valid ID and data
   - Verify toast appears with "~정보가 수정되었습니다"
   - Verify `onSuccess` callback is called

3. **Delete Info Operations**
   - Call `getDeleteInfo()` with valid ID
   - Verify return value contains count properties
   - Verify error toast on invalid ID

4. **Delete Operations**
   - Call `remove()` with valid ID
   - Verify toast appears with "~가 삭제되었습니다"
   - Verify `onSuccess` callback is called

5. **Error Handling**
   - Test with invalid IDs or network errors
   - Verify error toasts display
   - Verify `loading` returns to false

### Integration Testing with Backend

Once Section 06 (CRUD APIs) is complete:

1. Start the backend server
2. Open browser developer tools (Network tab)
3. Test each CRUD operation
4. Verify correct HTTP methods and endpoints
5. Verify request/response bodies
6. Verify database changes in Supabase

---

## Error Handling Details

The hooks handle errors at multiple levels:

1. **Network Errors**: Axios throws on network failures, caught in try/catch
2. **HTTP Errors**: Axios throws on 4xx/5xx responses, caught in try/catch
3. **Backend Validation Errors**: Returned in error response body

Error messages flow:
1. Backend returns error with message
2. Axios throws error with response data
3. Hook catches error, extracts message or uses default
4. Toast displays error message to user

---

## Notes for Implementer

1. **Toast Library**: The project uses `sonner` for toast notifications. Import as `import { toast } from 'sonner'`. If you see import errors, install with `npm install sonner`.

2. **Axios Instance**: The existing `api` axios instance in `lib/api.ts` is pre-configured with `baseURL: '/api'`. All endpoint paths should omit the `/api` prefix as it's already included.

3. **Korean Labels**: All toast messages use Korean:
   - 회사 = Company
   - 공장 = Factory
   - 라인 = Line (Production Line)
   - 생성 = Created
   - 수정 = Updated
   - 삭제 = Deleted

4. **TypeScript Strictness**: The code uses strict TypeScript. Ensure all types are properly defined and functions return the correct types.

5. **Loading State**: The `loading` state is shared across all operations in each hook. If concurrent operations are needed, consider separate loading states per operation type.

6. **Callback Pattern**: The `onSuccess` callback pattern allows parent components to refresh data after mutations. This is more flexible than coupling the hooks to specific data-fetching hooks.

7. **Return Values**: CRUD operations return `boolean` (true/false) to indicate success. This allows callers to take conditional action after operations complete.

8. **getDeleteInfo Does Not Set Loading**: The `getDeleteInfo` function doesn't set the `loading` state because it's typically called before showing a confirmation dialog, not as the primary action.

---

## Relation to Other Sections

- **Section 05 (CASCADE FK)**: Ensures database properly cascades deletes. Without this, delete operations would fail due to foreign key constraints.

- **Section 06 (CRUD APIs)**: Provides the backend endpoints this section consumes. The API function signatures must match the backend schemas.

- **Section 08 (Admin Page)**: The primary consumer of these hooks. The Admin Page uses all three hooks to manage the entity hierarchy.

- **Section 09 (Equipment CRUD)**: Will follow a similar pattern for equipment-specific CRUD operations.

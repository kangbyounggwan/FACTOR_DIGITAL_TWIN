# Section 03: Frontend Layout Hooks

Generated: 2026-04-01

---

## Background

The FACTOR Digital Twin system is implementing a layout versioning feature that allows users to save, load, and manage multiple equipment position snapshots per factory. Section 01 created the database schema (`layouts` and `layout_equipment` tables), and Section 02 implemented the backend REST API endpoints.

This section creates the React hooks and API client functions that enable the frontend to interact with the layout management system. The hooks follow the existing pattern established in `useFactories.ts` - using `useState`, `useEffect`, and `useCallback` for data fetching with loading and error states.

**Key Features:**
- Fetch layouts for a factory
- Create new layouts with equipment positions
- Load layout details (including equipment positions)
- Activate, clone, and delete layouts
- Compare layouts to detect changes
- Toast notifications for user feedback

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| Requires | Section 02 (Layout API) | The backend endpoints must exist before these hooks can function |
| Blocks | Section 04 (Layout UI) | The UI components will use these hooks to interact with layouts |
| Parallelizable | Section 07 (CRUD Hooks) | Can be developed alongside CRUD hooks as they are independent |

---

## Requirements

When this section is complete, the following must be true:

1. `frontend/src/lib/api.ts` contains all layout-related TypeScript interfaces and API functions
2. `frontend/src/hooks/useLayouts.ts` exports `useFactoryLayouts` hook for managing factory layouts
3. `frontend/src/hooks/useLayouts.ts` exports `useLayoutDetail` hook for fetching layout details
4. All API calls handle errors gracefully with toast notifications
5. The hooks follow existing patterns in `useFactories.ts` (useState, useEffect, useCallback)
6. Loading states are tracked for all async operations
7. The hooks are importable and usable from any React component

---

## Implementation Details

### File 1: API Types and Functions

**Path:** `frontend/src/lib/api.ts`

**Action:** Add the following interfaces and functions to the existing `api.ts` file.

#### Type Definitions to Add

```typescript
// ===========================================
// Layout Management Types
// ===========================================

/**
 * Layout summary for list views
 */
export interface Layout {
  id: string
  factory_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  equipment_count: number
}

/**
 * Individual equipment position within a layout
 */
export interface LayoutEquipmentPosition {
  equipment_id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
}

/**
 * Full layout detail including equipment positions
 */
export interface LayoutDetail extends Layout {
  equipment_positions: LayoutEquipmentPosition[]
}

/**
 * Request payload for creating a new layout
 */
export interface LayoutCreate {
  name: string
  description?: string
  equipment_positions: LayoutEquipmentPosition[]
}

/**
 * Request payload for updating layout metadata
 */
export interface LayoutUpdate {
  name?: string
  description?: string
}

/**
 * Response from layout comparison endpoint
 */
export interface LayoutCompare {
  changed_equipment_count: number
  added_equipment_count: number
  removed_equipment_count: number
}
```

#### API Functions to Add

```typescript
// ===========================================
// Layout API Functions
// ===========================================

/**
 * Get all layouts for a factory
 * @param factoryId - Factory UUID or code
 * @returns Array of layout summaries
 */
export const fetchFactoryLayouts = (factoryId: string) =>
  api.get<Layout[]>(`/factories/${factoryId}/layouts`).then(r => r.data)

/**
 * Create a new layout with equipment positions
 * @param factoryId - Factory UUID or code
 * @param data - Layout name, description, and equipment positions
 * @returns Created layout
 */
export const createLayout = (factoryId: string, data: LayoutCreate) =>
  api.post<Layout>(`/factories/${factoryId}/layouts`, data).then(r => r.data)

/**
 * Get layout detail including all equipment positions
 * @param layoutId - Layout UUID
 * @returns Full layout detail with positions
 */
export const fetchLayoutDetail = (layoutId: string) =>
  api.get<LayoutDetail>(`/layouts/${layoutId}`).then(r => r.data)

/**
 * Update layout metadata (name and/or description)
 * @param layoutId - Layout UUID
 * @param data - Fields to update
 * @returns Updated layout
 */
export const updateLayout = (layoutId: string, data: LayoutUpdate) =>
  api.put<Layout>(`/layouts/${layoutId}`, data).then(r => r.data)

/**
 * Delete a layout
 * @param layoutId - Layout UUID
 */
export const deleteLayout = (layoutId: string) =>
  api.delete(`/layouts/${layoutId}`).then(r => r.data)

/**
 * Activate a layout (makes it the active version for the factory)
 * @param layoutId - Layout UUID
 * @returns Activated layout
 */
export const activateLayout = (layoutId: string) =>
  api.post<Layout>(`/layouts/${layoutId}/activate`).then(r => r.data)

/**
 * Clone a layout (creates a copy with "(Copy)" suffix)
 * @param layoutId - Layout UUID
 * @returns Cloned layout
 */
export const cloneLayout = (layoutId: string) =>
  api.post<Layout>(`/layouts/${layoutId}/clone`).then(r => r.data)

/**
 * Compare a layout with the currently active layout
 * @param layoutId - Layout UUID to compare
 * @returns Comparison statistics
 */
export const compareLayout = (layoutId: string) =>
  api.get<LayoutCompare>(`/layouts/${layoutId}/compare`).then(r => r.data)
```

---

### File 2: Layout Hooks

**Path:** `frontend/src/hooks/useLayouts.ts`

**Action:** Create this new file.

#### Complete Implementation

```typescript
// hooks/useLayouts.ts
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Layout,
  LayoutDetail,
  LayoutCreate,
  LayoutCompare,
  fetchFactoryLayouts,
  createLayout,
  fetchLayoutDetail,
  updateLayout,
  deleteLayout,
  activateLayout,
  cloneLayout,
  compareLayout,
} from '@/lib/api'

/**
 * Hook for managing layouts for a specific factory.
 * Provides CRUD operations, activation, cloning, and comparison.
 *
 * @param factoryId - Factory UUID or code. Pass null to reset state.
 *
 * @example
 * ```tsx
 * function LayoutManager() {
 *   const { layouts, activeLayout, loading, create, activate, remove } = useFactoryLayouts(factoryId)
 *
 *   return (
 *     <div>
 *       {layouts.map(layout => (
 *         <LayoutCard key={layout.id} layout={layout} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useFactoryLayouts(factoryId: string | null) {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [activeLayout, setActiveLayout] = useState<Layout | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Reload layouts from the server
   */
  const reload = useCallback(async () => {
    if (!factoryId) {
      setLayouts([])
      setActiveLayout(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchFactoryLayouts(factoryId)
      setLayouts(data)
      setActiveLayout(data.find(l => l.is_active) ?? null)
    } catch (err) {
      const error = err as Error
      setError(error)
      toast.error('레이아웃 목록을 불러오는데 실패했습니다')
      setLayouts([])
      setActiveLayout(null)
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  // Load layouts when factoryId changes
  useEffect(() => {
    reload()
  }, [reload])

  /**
   * Create a new layout with equipment positions
   * @param data - Layout name, description, and equipment positions
   * @returns Created layout or null on error
   */
  const create = useCallback(async (data: LayoutCreate): Promise<Layout | null> => {
    if (!factoryId) {
      toast.error('공장이 선택되지 않았습니다')
      return null
    }

    try {
      const layout = await createLayout(factoryId, data)
      toast.success('레이아웃이 저장되었습니다')
      await reload()
      return layout
    } catch (err) {
      toast.error('레이아웃 저장에 실패했습니다')
      return null
    }
  }, [factoryId, reload])

  /**
   * Update layout metadata (name and/or description)
   * @param layoutId - Layout UUID
   * @param data - Fields to update
   * @returns Updated layout or null on error
   */
  const update = useCallback(async (layoutId: string, data: { name?: string; description?: string }): Promise<Layout | null> => {
    try {
      const layout = await updateLayout(layoutId, data)
      toast.success('레이아웃이 수정되었습니다')
      await reload()
      return layout
    } catch (err) {
      toast.error('레이아웃 수정에 실패했습니다')
      return null
    }
  }, [reload])

  /**
   * Activate a layout (makes it the current version)
   * @param layoutId - Layout UUID
   */
  const activate = useCallback(async (layoutId: string): Promise<void> => {
    try {
      await activateLayout(layoutId)
      toast.success('레이아웃이 활성화되었습니다')
      await reload()
    } catch (err) {
      toast.error('레이아웃 활성화에 실패했습니다')
    }
  }, [reload])

  /**
   * Delete a layout
   * @param layoutId - Layout UUID
   */
  const remove = useCallback(async (layoutId: string): Promise<void> => {
    try {
      await deleteLayout(layoutId)
      toast.success('레이아웃이 삭제되었습니다')
      await reload()
    } catch (err) {
      toast.error('레이아웃 삭제에 실패했습니다')
    }
  }, [reload])

  /**
   * Clone a layout (creates a copy)
   * @param layoutId - Layout UUID
   * @returns Cloned layout or null on error
   */
  const duplicate = useCallback(async (layoutId: string): Promise<Layout | null> => {
    try {
      const layout = await cloneLayout(layoutId)
      toast.success('레이아웃이 복제되었습니다')
      await reload()
      return layout
    } catch (err) {
      toast.error('레이아웃 복제에 실패했습니다')
      return null
    }
  }, [reload])

  /**
   * Compare a layout with the currently active layout
   * @param layoutId - Layout UUID
   * @returns Comparison statistics or null on error
   */
  const compare = useCallback(async (layoutId: string): Promise<LayoutCompare | null> => {
    try {
      return await compareLayout(layoutId)
    } catch (err) {
      toast.error('레이아웃 비교에 실패했습니다')
      return null
    }
  }, [])

  return {
    /** List of all layouts for the factory */
    layouts,
    /** The currently active layout (if any) */
    activeLayout,
    /** Whether layouts are being loaded */
    loading,
    /** Error from last operation (if any) */
    error,
    /** Reload layouts from server */
    reload,
    /** Create a new layout */
    create,
    /** Update layout metadata */
    update,
    /** Activate a layout */
    activate,
    /** Delete a layout */
    remove,
    /** Clone a layout */
    duplicate,
    /** Compare layout with active */
    compare,
  }
}

/**
 * Hook for fetching a single layout's full details including equipment positions.
 * Use this when you need to load a specific layout into the editor.
 *
 * @param layoutId - Layout UUID. Pass null to reset state.
 *
 * @example
 * ```tsx
 * function LayoutEditor() {
 *   const { detail, loading } = useLayoutDetail(selectedLayoutId)
 *
 *   if (loading) return <Spinner />
 *   if (!detail) return <EmptyState />
 *
 *   return (
 *     <Canvas equipmentPositions={detail.equipment_positions} />
 *   )
 * }
 * ```
 */
export function useLayoutDetail(layoutId: string | null) {
  const [detail, setDetail] = useState<LayoutDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Reload layout detail from server
   */
  const reload = useCallback(async () => {
    if (!layoutId) {
      setDetail(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchLayoutDetail(layoutId)
      setDetail(data)
    } catch (err) {
      const error = err as Error
      setError(error)
      toast.error('레이아웃 상세를 불러오는데 실패했습니다')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [layoutId])

  // Load detail when layoutId changes
  useEffect(() => {
    reload()
  }, [reload])

  return {
    /** Full layout detail including equipment positions */
    detail,
    /** Whether the detail is being loaded */
    loading,
    /** Error from last load (if any) */
    error,
    /** Reload detail from server */
    reload,
  }
}
```

---

## Usage Examples

### Example 1: Layout List and Selection

```tsx
import { useFactoryLayouts } from '@/hooks/useLayouts'

function LayoutSelector({ factoryId }: { factoryId: string }) {
  const {
    layouts,
    activeLayout,
    loading,
    activate,
    remove,
    duplicate,
  } = useFactoryLayouts(factoryId)

  if (loading) return <div>Loading layouts...</div>

  return (
    <div className="space-y-2">
      {layouts.map(layout => (
        <div key={layout.id} className="flex items-center gap-2 p-2 border rounded">
          <span className="flex-1">
            {layout.name}
            {layout.is_active && <span className="ml-2 text-green-500">(Active)</span>}
          </span>
          <span className="text-sm text-muted-foreground">
            {layout.equipment_count} equipment
          </span>
          {!layout.is_active && (
            <button onClick={() => activate(layout.id)}>Activate</button>
          )}
          <button onClick={() => duplicate(layout.id)}>Clone</button>
          <button onClick={() => remove(layout.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

### Example 2: Creating a New Layout

```tsx
import { useFactoryLayouts } from '@/hooks/useLayouts'
import { LayoutEquipmentPosition } from '@/lib/api'

function SaveLayoutButton({
  factoryId,
  equipmentPositions,
}: {
  factoryId: string
  equipmentPositions: LayoutEquipmentPosition[]
}) {
  const { create } = useFactoryLayouts(factoryId)
  const [name, setName] = useState('')

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a layout name')
      return
    }

    const layout = await create({
      name: name.trim(),
      description: `Created on ${new Date().toLocaleDateString()}`,
      equipment_positions: equipmentPositions,
    })

    if (layout) {
      setName('')
      // Layout was saved successfully
    }
  }

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Layout name"
      />
      <button onClick={handleSave}>Save Layout</button>
    </div>
  )
}
```

### Example 3: Loading Layout into Editor

```tsx
import { useLayoutDetail } from '@/hooks/useLayouts'

function LayoutEditor({ layoutId }: { layoutId: string | null }) {
  const { detail, loading, error } = useLayoutDetail(layoutId)

  if (loading) {
    return <div className="flex items-center justify-center h-full">
      <Spinner />
    </div>
  }

  if (error) {
    return <div className="text-red-500">Failed to load layout</div>
  }

  if (!detail) {
    return <div>Select a layout to edit</div>
  }

  return (
    <div>
      <h2>{detail.name}</h2>
      <p>{detail.description}</p>
      <p>{detail.equipment_positions.length} equipment items</p>

      {/* Pass positions to canvas */}
      <Canvas equipmentPositions={detail.equipment_positions} />
    </div>
  )
}
```

### Example 4: Comparing Layouts

```tsx
import { useFactoryLayouts } from '@/hooks/useLayouts'

function LayoutComparison({ factoryId, layoutId }: { factoryId: string; layoutId: string }) {
  const { compare } = useFactoryLayouts(factoryId)
  const [comparison, setComparison] = useState<LayoutCompare | null>(null)

  useEffect(() => {
    compare(layoutId).then(setComparison)
  }, [layoutId, compare])

  if (!comparison) return null

  return (
    <div className="text-sm text-muted-foreground">
      <p>Changed: {comparison.changed_equipment_count}</p>
      <p>Added: {comparison.added_equipment_count}</p>
      <p>Removed: {comparison.removed_equipment_count}</p>
    </div>
  )
}
```

---

## Converting Equipment to LayoutEquipmentPosition

When saving a layout from the editor, you need to convert the current equipment state to `LayoutEquipmentPosition` format:

```typescript
import { Equipment, LayoutEquipmentPosition } from '@/lib/api'

/**
 * Convert Equipment array to LayoutEquipmentPosition array
 * @param equipment - Array of equipment from the editor
 * @returns Array suitable for creating a layout
 */
function equipmentToPositions(equipment: Equipment[]): LayoutEquipmentPosition[] {
  return equipment.map(eq => ({
    equipment_id: eq.equipment_id,
    centroid_x: eq.centroid_x,
    centroid_y: eq.centroid_y,
    centroid_z: eq.centroid_z,
    size_w: eq.size_w,
    size_h: eq.size_h,
    size_d: eq.size_d,
  }))
}

// Usage in save handler:
const positions = equipmentToPositions(currentEquipment)
await create({
  name: 'My Layout',
  equipment_positions: positions,
})
```

---

## Files to Create/Modify

| Action | Path | Description |
|--------|------|-------------|
| Modify | `frontend/src/lib/api.ts` | Add Layout interfaces and API functions |
| Create | `frontend/src/hooks/useLayouts.ts` | Layout management hooks |

---

## Prerequisites Check

Before implementing, verify:

1. **Section 02 is complete:** The backend layout API endpoints must be running:
   - `GET /api/factories/{factory_id}/layouts`
   - `POST /api/factories/{factory_id}/layouts`
   - `GET /api/layouts/{layout_id}`
   - `PUT /api/layouts/{layout_id}`
   - `DELETE /api/layouts/{layout_id}`
   - `POST /api/layouts/{layout_id}/activate`
   - `POST /api/layouts/{layout_id}/clone`
   - `GET /api/layouts/{layout_id}/compare`

2. **Axios is installed:** The existing `api.ts` uses axios:
   ```bash
   cd frontend && npm list axios
   ```

3. **Sonner is installed:** For toast notifications:
   ```bash
   cd frontend && npm list sonner
   ```
   If not installed:
   ```bash
   npm install sonner
   ```

4. **Sonner Toaster is configured:** Ensure `<Toaster />` is in your app root:
   ```tsx
   // In App.tsx or layout
   import { Toaster } from 'sonner'

   function App() {
     return (
       <>
         {/* ... other components */}
         <Toaster position="top-right" />
       </>
     )
   }
   ```

---

## Acceptance Criteria

### API Types (api.ts)
- [ ] `Layout` interface is defined with all required fields
- [ ] `LayoutEquipmentPosition` interface is defined with position and size fields
- [ ] `LayoutDetail` interface extends `Layout` with `equipment_positions` array
- [ ] `LayoutCreate` interface is defined for creating layouts
- [ ] `LayoutUpdate` interface is defined for updating layouts
- [ ] `LayoutCompare` interface is defined for comparison results

### API Functions (api.ts)
- [ ] `fetchFactoryLayouts(factoryId)` calls `GET /factories/{id}/layouts`
- [ ] `createLayout(factoryId, data)` calls `POST /factories/{id}/layouts`
- [ ] `fetchLayoutDetail(layoutId)` calls `GET /layouts/{id}`
- [ ] `updateLayout(layoutId, data)` calls `PUT /layouts/{id}`
- [ ] `deleteLayout(layoutId)` calls `DELETE /layouts/{id}`
- [ ] `activateLayout(layoutId)` calls `POST /layouts/{id}/activate`
- [ ] `cloneLayout(layoutId)` calls `POST /layouts/{id}/clone`
- [ ] `compareLayout(layoutId)` calls `GET /layouts/{id}/compare`

### useFactoryLayouts Hook
- [ ] Returns `layouts` array state
- [ ] Returns `activeLayout` (the layout with `is_active: true`)
- [ ] Returns `loading` boolean state
- [ ] Returns `error` state for error handling
- [ ] `reload()` fetches layouts and updates state
- [ ] `create(data)` creates layout, shows success toast, reloads
- [ ] `update(id, data)` updates layout, shows success toast, reloads
- [ ] `activate(id)` activates layout, shows success toast, reloads
- [ ] `remove(id)` deletes layout, shows success toast, reloads
- [ ] `duplicate(id)` clones layout, shows success toast, reloads
- [ ] `compare(id)` returns comparison data
- [ ] All operations show error toast on failure
- [ ] State resets when `factoryId` is null

### useLayoutDetail Hook
- [ ] Returns `detail` state (LayoutDetail or null)
- [ ] Returns `loading` boolean state
- [ ] Returns `error` state for error handling
- [ ] `reload()` fetches detail and updates state
- [ ] Shows error toast on fetch failure
- [ ] State resets when `layoutId` is null

### Integration
- [ ] Hooks are importable from `@/hooks/useLayouts`
- [ ] API functions are importable from `@/lib/api`
- [ ] TypeScript compilation passes with no errors
- [ ] Hooks work correctly when used in components

---

## Testing Approach

### Manual Testing

1. **Test Layout List Loading:**
   ```tsx
   // In a test component
   const { layouts, loading, error } = useFactoryLayouts('factory-code-here')
   console.log({ layouts, loading, error })
   ```
   - Verify layouts load when factory ID is valid
   - Verify empty array when factory ID is null
   - Verify error toast when backend is unavailable

2. **Test Layout Creation:**
   ```tsx
   const { create } = useFactoryLayouts(factoryId)
   const result = await create({
     name: 'Test Layout',
     equipment_positions: [
       { equipment_id: 'eq-1', centroid_x: 0, centroid_y: 0, centroid_z: 0, size_w: 1, size_h: 1, size_d: 1 }
     ]
   })
   console.log(result) // Should be the created layout
   ```

3. **Test Layout Activation:**
   ```tsx
   const { layouts, activate } = useFactoryLayouts(factoryId)
   await activate(layouts[0].id)
   // Verify success toast
   // Verify layouts reloaded with updated is_active
   ```

4. **Test Layout Detail Loading:**
   ```tsx
   const { detail, loading } = useLayoutDetail(layoutId)
   console.log(detail?.equipment_positions)
   ```

### API Testing with curl

Before testing hooks, verify the API is working:

```bash
# List layouts
curl http://localhost:8000/api/factories/FACTORY_CODE/layouts

# Create layout
curl -X POST http://localhost:8000/api/factories/FACTORY_CODE/layouts \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","equipment_positions":[]}'

# Get layout detail
curl http://localhost:8000/api/layouts/LAYOUT_ID

# Activate layout
curl -X POST http://localhost:8000/api/layouts/LAYOUT_ID/activate
```

---

## Error Handling

All hooks follow a consistent error handling pattern:

1. **Network errors:** Caught in try/catch, stored in `error` state, toast shown
2. **API errors (4xx, 5xx):** Axios throws, caught in try/catch, toast shown
3. **Null/undefined IDs:** Early return with empty state, no API call made

Example error flow:
```typescript
try {
  const data = await fetchFactoryLayouts(factoryId)
  setLayouts(data)
} catch (err) {
  const error = err as Error
  setError(error)                                    // Store for component use
  toast.error('레이아웃 목록을 불러오는데 실패했습니다')  // User feedback
  setLayouts([])                                     // Reset state
}
```

---

## Downstream Dependencies

After completing this section, **Section 04 (Layout UI)** can begin. The UI will:
- Use `useFactoryLayouts` to display layout list in a dropdown
- Use `create` to save current editor state as a new layout
- Use `activate` to switch between layouts
- Use `remove` and `duplicate` for layout management
- Use `useLayoutDetail` to load layout positions into the editor canvas

---

## Troubleshooting

**Issue:** Layouts not loading after factory selection
- Verify the factory ID/code is correct
- Check browser Network tab for API response
- Ensure Section 02 API endpoints are deployed

**Issue:** Toast notifications not showing
- Ensure `<Toaster />` component is mounted in the app
- Check that `sonner` package is installed

**Issue:** TypeScript errors on Layout types
- Ensure all interface fields match the API response
- Check that `equipment_positions` is an array, not object

**Issue:** `activeLayout` is always null
- Verify at least one layout has `is_active: true` in the database
- Check that the `layouts` array includes the active layout

**Issue:** API calls fail with 404
- Verify Section 02 is complete and router is registered
- Check the API URL path matches exactly

---

## Related Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/api.ts` | Axios instance and all API functions |
| `frontend/src/hooks/useFactories.ts` | Similar hook pattern for reference |
| `backend/app/api/endpoints/layouts.py` | Backend API implementation (Section 02) |
| `backend/app/schemas/layout.py` | Backend Pydantic schemas (Section 02) |

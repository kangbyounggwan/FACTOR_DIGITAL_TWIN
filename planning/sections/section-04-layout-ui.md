# Section 04: Layout UI Components

Generated: 2026-04-01

---

## Background

The FACTOR Digital Twin system allows users to edit equipment positions and sizes in a 2D layout editor (LayoutEditorPage). Currently, all position changes are stored only in local React state and cannot be persisted to the database. Users need the ability to:

1. Save the current equipment arrangement as a named "layout"
2. Load previously saved layouts to restore equipment positions
3. Manage multiple layout versions per factory (activate, delete, clone)
4. Compare layouts to see what changed

This section implements the frontend UI components that enable layout version management. The components integrate with the hooks from Section 03 (useLayouts) and the backend APIs from Section 02.

**Why layouts?** Manufacturing facilities frequently reconfigure equipment. Layout versioning allows:
- Saving snapshots before major changes
- Comparing "before" and "after" arrangements
- Quickly switching between different production configurations
- Rolling back to previous arrangements if needed

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| Requires | Section 02 (Layout API) | Backend endpoints for CRUD operations |
| Requires | Section 03 (Layout Hooks) | useFactoryLayouts and useLayoutDetail hooks |
| Blocks | Section 09 (Equipment CRUD) | Equipment CRUD depends on layout system |
| Blocks | Section 10 (Viewer Integration) | 3D viewer needs to load positions from active layout |
| Parallelizable With | Section 08 (Admin Page) | Can be developed simultaneously |

---

## Requirements

When this section is complete, the following must be true:

1. A `LayoutSelector` component exists that shows a dropdown of available layouts
2. A `SaveLayoutDialog` component exists that allows saving new layouts or updating existing ones
3. The `LayoutEditorPage` is modified to integrate both components
4. Users can select a layout and equipment positions update accordingly
5. Users can save the current positions as a new layout with name and description
6. Users can activate a layout (making it the "default" for the factory)
7. Users can delete or clone layouts from the selector
8. A visual indicator shows when there are unsaved changes
9. Toast notifications confirm successful operations

---

## Implementation Details

### File 1: LayoutSelector Component

**Path:** `frontend/src/components/LayoutSelector.tsx`

This component provides a dropdown to select from available layouts, plus action buttons for the selected layout.

```tsx
// frontend/src/components/LayoutSelector.tsx
import { Layout } from '@/lib/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Check, Copy, Trash2, MoreHorizontal, Database } from 'lucide-react'
import { useState } from 'react'

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

interface LayoutSelectorProps {
  layouts: Layout[]
  activeLayout: Layout | null
  selectedLayoutId: string | null
  onSelect: (layoutId: string | null) => void
  onActivate: (layoutId: string) => void
  onDelete: (layoutId: string) => void
  onDuplicate: (layoutId: string) => void
  loading?: boolean
}

export default function LayoutSelector({
  layouts,
  activeLayout,
  selectedLayoutId,
  onSelect,
  onActivate,
  onDelete,
  onDuplicate,
  loading = false,
}: LayoutSelectorProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [layoutToDelete, setLayoutToDelete] = useState<Layout | null>(null)

  const selectedLayout = layouts.find(l => l.id === selectedLayoutId)

  const handleDeleteClick = (layout: Layout) => {
    setLayoutToDelete(layout)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (layoutToDelete) {
      onDelete(layoutToDelete.id)
      setDeleteDialogOpen(false)
      setLayoutToDelete(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedLayoutId ?? 'original'}
        onValueChange={(value) => onSelect(value === 'original' ? null : value)}
        disabled={loading}
      >
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="레이아웃 선택..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="original">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span>원본 (equipment_scans)</span>
            </div>
          </SelectItem>
          {layouts.map(layout => (
            <SelectItem key={layout.id} value={layout.id}>
              <div className="flex items-center gap-2">
                <span className="truncate max-w-[140px]">{layout.name}</span>
                {layout.is_active && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    활성
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {layout.equipment_count}개
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedLayout && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {formatDate(selectedLayout.updated_at)}
            </div>
            <DropdownMenuSeparator />
            {!selectedLayout.is_active && (
              <DropdownMenuItem onClick={() => onActivate(selectedLayout.id)}>
                <Check className="h-4 w-4 mr-2" />
                활성화
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDuplicate(selectedLayout.id)}>
              <Copy className="h-4 w-4 mr-2" />
              복제
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDeleteClick(selectedLayout)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>레이아웃 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{layoutToDelete?.name}" 레이아웃을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
              {layoutToDelete?.is_active && (
                <span className="block mt-2 text-warning">
                  경고: 이 레이아웃은 현재 활성화되어 있습니다.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

---

### File 2: SaveLayoutDialog Component

**Path:** `frontend/src/components/SaveLayoutDialog.tsx`

This dialog allows users to save the current equipment positions as a new layout or update an existing one.

```tsx
// frontend/src/components/SaveLayoutDialog.tsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, RefreshCw } from 'lucide-react'

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

export interface LayoutEquipmentPosition {
  equipment_id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
}

interface SaveLayoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingLayouts: Layout[]
  equipmentPositions: LayoutEquipmentPosition[]
  onSaveNew: (name: string, description: string) => Promise<void>
  onUpdateExisting: (layoutId: string) => Promise<void>
}

export default function SaveLayoutDialog({
  open,
  onOpenChange,
  existingLayouts,
  equipmentPositions,
  onSaveNew,
  onUpdateExisting,
}: SaveLayoutDialogProps) {
  const [mode, setMode] = useState<'new' | 'update'>('new')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMode('new')
      setName('')
      setDescription('')
      setSelectedLayoutId('')
      setError(null)
    }
  }, [open])

  // Generate default name with date
  const generateDefaultName = () => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '-').replace('.', '')
    const timeStr = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return `레이아웃 ${dateStr} ${timeStr}`
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)

    try {
      if (mode === 'new') {
        const layoutName = name.trim() || generateDefaultName()
        await onSaveNew(layoutName, description.trim())
      } else {
        if (!selectedLayoutId) {
          setError('업데이트할 레이아웃을 선택해주세요')
          setSaving(false)
          return
        }
        await onUpdateExisting(selectedLayoutId)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const canSave = mode === 'new' || (mode === 'update' && selectedLayoutId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            레이아웃 저장
          </DialogTitle>
          <DialogDescription>
            현재 설비 배치를 레이아웃으로 저장합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mode Selection */}
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as 'new' | 'update')}
            className="gap-3"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="new" id="mode-new" />
              <Label htmlFor="mode-new" className="font-normal cursor-pointer">
                새 레이아웃으로 저장
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem
                value="update"
                id="mode-update"
                disabled={existingLayouts.length === 0}
              />
              <Label
                htmlFor="mode-update"
                className={`font-normal cursor-pointer ${
                  existingLayouts.length === 0 ? 'text-muted-foreground' : ''
                }`}
              >
                기존 레이아웃 업데이트
                {existingLayouts.length === 0 && ' (저장된 레이아웃 없음)'}
              </Label>
            </div>
          </RadioGroup>

          {/* New Layout Form */}
          {mode === 'new' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="layout-name">레이아웃 이름</Label>
                <Input
                  id="layout-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={generateDefaultName()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="layout-description">설명 (선택)</Label>
                <Textarea
                  id="layout-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="이 레이아웃에 대한 메모..."
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Update Existing Form */}
          {mode === 'update' && (
            <div className="space-y-2">
              <Label htmlFor="layout-select">업데이트할 레이아웃</Label>
              <Select
                value={selectedLayoutId}
                onValueChange={setSelectedLayoutId}
              >
                <SelectTrigger id="layout-select">
                  <SelectValue placeholder="레이아웃 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {existingLayouts.map((layout) => (
                    <SelectItem key={layout.id} value={layout.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{layout.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {layout.equipment_count}개 설비
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLayoutId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  기존 위치 데이터가 현재 위치로 대체됩니다.
                </p>
              )}
            </div>
          )}

          {/* Equipment Count Info */}
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{equipmentPositions.length}</span>
            <span className="text-muted-foreground">개 설비 위치가 저장됩니다.</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                저장
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### File 3: API Types Addition

**Path:** `frontend/src/lib/api.ts` (Modify - Add to existing file)

Add these types and functions to the existing api.ts file:

```typescript
// Add to frontend/src/lib/api.ts

// ============================================
// Layout Types and API Functions
// ============================================

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

export interface LayoutEquipmentPosition {
  equipment_id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
}

export interface LayoutDetail extends Layout {
  equipment_positions: LayoutEquipmentPosition[]
}

export interface LayoutCreate {
  name: string
  description?: string
  equipment_positions: LayoutEquipmentPosition[]
}

export interface LayoutCompare {
  changed_equipment_count: number
  added_equipment_count: number
  removed_equipment_count: number
}

// Get all layouts for a factory
export const fetchFactoryLayouts = (factoryId: string) =>
  api.get<Layout[]>(`/factories/${factoryId}/layouts`).then(r => r.data)

// Create a new layout
export const createLayout = (factoryId: string, data: LayoutCreate) =>
  api.post<Layout>(`/factories/${factoryId}/layouts`, data).then(r => r.data)

// Get layout detail with equipment positions
export const fetchLayoutDetail = (layoutId: string) =>
  api.get<LayoutDetail>(`/layouts/${layoutId}`).then(r => r.data)

// Update layout metadata (name, description)
export const updateLayoutMetadata = (layoutId: string, data: { name?: string; description?: string }) =>
  api.put<Layout>(`/layouts/${layoutId}`, data).then(r => r.data)

// Update layout positions (replace all positions)
export const updateLayoutPositions = (layoutId: string, positions: LayoutEquipmentPosition[]) =>
  api.put<Layout>(`/layouts/${layoutId}/positions`, { equipment_positions: positions }).then(r => r.data)

// Delete a layout
export const deleteLayout = (layoutId: string) =>
  api.delete(`/layouts/${layoutId}`).then(r => r.data)

// Activate a layout (make it the default for the factory)
export const activateLayout = (layoutId: string) =>
  api.post<Layout>(`/layouts/${layoutId}/activate`).then(r => r.data)

// Clone a layout
export const cloneLayout = (layoutId: string) =>
  api.post<Layout>(`/layouts/${layoutId}/clone`).then(r => r.data)

// Compare layout with active layout
export const compareLayout = (layoutId: string) =>
  api.get<LayoutCompare>(`/layouts/${layoutId}/compare`).then(r => r.data)
```

---

### File 4: useLayouts Hook

**Path:** `frontend/src/hooks/useLayouts.ts`

This hook manages layout data fetching and mutations.

```typescript
// frontend/src/hooks/useLayouts.ts
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Layout,
  LayoutDetail,
  LayoutCreate,
  LayoutCompare,
  LayoutEquipmentPosition,
  fetchFactoryLayouts,
  createLayout,
  fetchLayoutDetail,
  updateLayoutPositions,
  deleteLayout,
  activateLayout,
  cloneLayout,
  compareLayout,
} from '@/lib/api'

/**
 * Hook for managing layouts for a factory
 */
export function useFactoryLayouts(factoryId: string | null) {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [activeLayout, setActiveLayout] = useState<Layout | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch layouts for the factory
  const reload = useCallback(async () => {
    if (!factoryId) {
      setLayouts([])
      setActiveLayout(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchFactoryLayouts(factoryId)
      setLayouts(data)
      const active = data.find(l => l.is_active) ?? null
      setActiveLayout(active)
    } catch (err) {
      const message = err instanceof Error ? err.message : '레이아웃 목록을 불러오는데 실패했습니다'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  // Load on mount and when factoryId changes
  useEffect(() => {
    reload()
  }, [reload])

  // Create a new layout
  const create = useCallback(async (data: LayoutCreate): Promise<Layout | null> => {
    if (!factoryId) return null

    try {
      const layout = await createLayout(factoryId, data)
      toast.success('레이아웃이 저장되었습니다')
      await reload()
      return layout
    } catch (err) {
      const message = err instanceof Error ? err.message : '레이아웃 저장에 실패했습니다'
      toast.error(message)
      return null
    }
  }, [factoryId, reload])

  // Activate a layout
  const activate = useCallback(async (layoutId: string) => {
    try {
      await activateLayout(layoutId)
      toast.success('레이아웃이 활성화되었습니다')
      await reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : '레이아웃 활성화에 실패했습니다'
      toast.error(message)
    }
  }, [reload])

  // Delete a layout
  const remove = useCallback(async (layoutId: string) => {
    try {
      await deleteLayout(layoutId)
      toast.success('레이아웃이 삭제되었습니다')
      await reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : '레이아웃 삭제에 실패했습니다'
      toast.error(message)
    }
  }, [reload])

  // Duplicate a layout
  const duplicate = useCallback(async (layoutId: string): Promise<Layout | null> => {
    try {
      const layout = await cloneLayout(layoutId)
      toast.success('레이아웃이 복제되었습니다')
      await reload()
      return layout
    } catch (err) {
      const message = err instanceof Error ? err.message : '레이아웃 복제에 실패했습니다'
      toast.error(message)
      return null
    }
  }, [reload])

  // Update positions in an existing layout
  const updatePositions = useCallback(async (
    layoutId: string,
    positions: LayoutEquipmentPosition[]
  ): Promise<boolean> => {
    try {
      await updateLayoutPositions(layoutId, positions)
      toast.success('레이아웃이 업데이트되었습니다')
      await reload()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '레이아웃 업데이트에 실패했습니다'
      toast.error(message)
      return false
    }
  }, [reload])

  // Compare with active layout
  const compare = useCallback(async (layoutId: string): Promise<LayoutCompare | null> => {
    try {
      return await compareLayout(layoutId)
    } catch (err) {
      const message = err instanceof Error ? err.message : '레이아웃 비교에 실패했습니다'
      toast.error(message)
      return null
    }
  }, [])

  return {
    layouts,
    activeLayout,
    loading,
    error,
    reload,
    create,
    activate,
    remove,
    duplicate,
    updatePositions,
    compare,
  }
}

/**
 * Hook for loading a specific layout's details
 */
export function useLayoutDetail(layoutId: string | null) {
  const [detail, setDetail] = useState<LayoutDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!layoutId) {
      setDetail(null)
      return
    }

    setLoading(true)
    setError(null)

    fetchLayoutDetail(layoutId)
      .then(setDetail)
      .catch(err => {
        const message = err instanceof Error ? err.message : '레이아웃 상세를 불러오는데 실패했습니다'
        setError(message)
        toast.error(message)
      })
      .finally(() => setLoading(false))
  }, [layoutId])

  return { detail, loading, error }
}
```

---

### File 5: LayoutEditorPage Modifications

**Path:** `frontend/src/pages/LayoutEditorPage.tsx` (Modify existing file)

Add layout integration to the existing page. The key changes are:

1. Import layout components and hooks
2. Add state for selected layout
3. Load layout positions when a layout is selected
4. Add layout toolbar with save button
5. Implement save handlers

Below is the complete modified file:

```tsx
// frontend/src/pages/LayoutEditorPage.tsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useCompanies, useCompanyFactories, useFactoryLines } from '@/hooks/useFactories'
import { useFactoryEquipment } from '@/hooks/useEquipment'
import { useFactoryLayouts, useLayoutDetail } from '@/hooks/useLayouts'
import { Company, Factory, ProductionLine, Equipment, LayoutEquipmentPosition } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, RefreshCw, ChevronRight, ChevronDown, Save, RotateCcw, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import LayoutCanvas from '@/components/LayoutCanvas'
import EquipmentList from '@/components/EquipmentList'
import RegPanel from '@/components/RegPanel'
import LayoutSelector from '@/components/LayoutSelector'
import SaveLayoutDialog from '@/components/SaveLayoutDialog'
import { toast } from 'sonner'
import { SelectionState } from '@/App'

interface Props {
  selection: SelectionState
  onSelectCompany: (company: Company | null) => void
  onSelectFactory: (factory: Factory | null) => void
  onSelectLine: (line: ProductionLine | null) => void
}

export default function LayoutEditorPage({ selection, onSelectCompany, onSelectFactory, onSelectLine }: Props) {
  const { companies, loading: companiesLoading, reload: reloadCompanies } = useCompanies()
  const { factories, loading: factoriesLoading } = useCompanyFactories(selection.company?.code ?? null)
  const { lines, loading: linesLoading } = useFactoryLines(selection.factory?.code ?? null)

  // Aliases for easier access
  const selectedCompany = selection.company
  const selectedFactory = selection.factory
  const selectedLine = selection.line

  // Layout management
  const {
    layouts,
    activeLayout,
    loading: layoutsLoading,
    reload: reloadLayouts,
    create: createLayout,
    activate: activateLayout,
    remove: removeLayout,
    duplicate: duplicateLayout,
    updatePositions,
  } = useFactoryLayouts(selectedFactory?.id ?? null)

  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null)
  const { detail: layoutDetail, loading: layoutDetailLoading } = useLayoutDetail(selectedLayoutId)

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  // Equipment data
  const { equipment, stats, loading: equipmentLoading, selected, setSelected, save } = useFactoryEquipment(
    selectedFactory?.code ?? ''
  )

  // Local position/size changes (before save)
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [localSizes, setLocalSizes] = useState<Record<string, { w: number; d: number }>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Filter equipment by selected line
  const filteredEquipment = useMemo(() => {
    if (!selectedLine) return equipment
    return equipment.filter(e => e.line_code === selectedLine.code)
  }, [equipment, selectedLine])

  // Build position map from selected layout
  const layoutPositionMap = useMemo(() => {
    const map: Record<string, LayoutEquipmentPosition> = {}
    if (layoutDetail?.equipment_positions) {
      layoutDetail.equipment_positions.forEach(pos => {
        map[pos.equipment_id] = pos
      })
    }
    return map
  }, [layoutDetail])

  // Equipment with layout positions and local overrides applied
  const equipmentWithPositions = useMemo(() => {
    return filteredEquipment.map(eq => {
      let result = eq

      // Apply layout positions first (if a layout is selected)
      const layoutPos = layoutPositionMap[eq.equipment_id]
      if (layoutPos) {
        result = {
          ...result,
          centroid_x: layoutPos.centroid_x,
          centroid_y: layoutPos.centroid_y,
          centroid_z: layoutPos.centroid_z,
          size_w: layoutPos.size_w,
          size_d: layoutPos.size_d,
          size_h: layoutPos.size_h,
        }
      }

      // Apply local overrides on top
      const localPos = localPositions[eq.equipment_id]
      const localSize = localSizes[eq.equipment_id]
      if (localPos) {
        result = { ...result, centroid_x: localPos.x, centroid_y: localPos.y }
      }
      if (localSize) {
        result = { ...result, size_w: localSize.w, size_d: localSize.d }
      }

      return result
    })
  }, [filteredEquipment, layoutPositionMap, localPositions, localSizes])

  // Line code -> line name mapping
  const lineMap = useMemo(() => {
    const map: Record<string, string> = {}
    lines.forEach(line => {
      map[line.code] = line.name
    })
    return map
  }, [lines])

  // Reset local changes when layout or factory changes
  useEffect(() => {
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
  }, [selectedLayoutId, selectedFactory?.id])

  // Position update handler
  const handleUpdatePosition = useCallback((equipmentId: string, x: number, y: number) => {
    setLocalPositions(prev => ({
      ...prev,
      [equipmentId]: { x, y }
    }))
    setHasChanges(true)
  }, [])

  // Size update handler
  const handleUpdateSize = useCallback((equipmentId: string, w: number, d: number) => {
    setLocalSizes(prev => ({
      ...prev,
      [equipmentId]: { w, d }
    }))
    setHasChanges(true)
  }, [])

  // Get current positions for saving
  const getCurrentPositions = useCallback((): LayoutEquipmentPosition[] => {
    return equipmentWithPositions.map(eq => ({
      equipment_id: eq.equipment_id,
      centroid_x: eq.centroid_x,
      centroid_y: eq.centroid_y,
      centroid_z: eq.centroid_z,
      size_w: eq.size_w,
      size_h: eq.size_h,
      size_d: eq.size_d,
    }))
  }, [equipmentWithPositions])

  // Save as new layout
  const handleSaveNew = useCallback(async (name: string, description: string) => {
    const positions = getCurrentPositions()
    await createLayout({
      name,
      description: description || undefined,
      equipment_positions: positions,
    })
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
  }, [createLayout, getCurrentPositions])

  // Update existing layout
  const handleUpdateExisting = useCallback(async (layoutId: string) => {
    const positions = getCurrentPositions()
    const success = await updatePositions(layoutId, positions)
    if (success) {
      setLocalPositions({})
      setLocalSizes({})
      setHasChanges(false)
    }
  }, [updatePositions, getCurrentPositions])

  // Layout selection handler
  const handleLayoutSelect = useCallback((layoutId: string | null) => {
    if (hasChanges) {
      const confirmed = window.confirm('저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?')
      if (!confirmed) return
    }
    setSelectedLayoutId(layoutId)
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
  }, [hasChanges])

  // Reset changes handler
  const handleResetChanges = useCallback(() => {
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
  }, [])

  const handleSelectCompany = (company: Company) => {
    onSelectCompany(company)
    setSelectedLayoutId(null)
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
  }

  const handleSelectFactory = (factory: Factory) => {
    onSelectFactory(factory)
    setSelectedLayoutId(null)
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Company list panel */}
      <div className="w-48 flex-shrink-0 border-r flex flex-col bg-muted/30">
        <div className="flex items-center justify-between px-4 h-11 border-b bg-card">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            회사
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={reloadCompanies}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {companiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              등록된 회사가 없습니다
            </div>
          ) : (
            <div className="py-1">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleSelectCompany(company)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group',
                    selectedCompany?.id === company.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <p className="font-medium text-sm truncate">{company.name}</p>
                  <ChevronRight className={cn(
                    'h-4 w-4 flex-shrink-0 ml-2',
                    selectedCompany?.id === company.id
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                  )} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Factory/Line list panel */}
      <div className={cn(
        'flex-shrink-0 border-r flex flex-col transition-all duration-300 bg-muted/20',
        selectedCompany ? 'w-56' : 'w-0 overflow-hidden'
      )}>
        <div className="flex items-center px-4 h-11 border-b bg-card">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground truncate">
            공장 / 라인
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {factoriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : factories.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              등록된 공장이 없습니다
            </div>
          ) : (
            <div className="py-1">
              {factories.map((factory) => (
                <div key={factory.id}>
                  <button
                    onClick={() => handleSelectFactory(factory)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group',
                      selectedFactory?.id === factory.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <p className="font-medium text-sm truncate">{factory.name}</p>
                    {selectedFactory?.id === factory.id ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2 text-primary-foreground/70" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 ml-2 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                  </button>

                  {selectedFactory?.id === factory.id && (
                    <div className="ml-4 border-l border-border">
                      <button
                        onClick={() => onSelectLine(null)}
                        className={cn(
                          'w-full text-left px-4 py-2 text-sm transition-colors',
                          !selectedLine
                            ? 'bg-accent/50 text-accent-foreground'
                            : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span className="font-medium">전체 보기</span>
                      </button>

                      {linesLoading ? (
                        <div className="py-3 px-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : lines.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-3 px-4">라인 없음</p>
                      ) : (
                        lines.map((line) => (
                          <button
                            key={line.id}
                            onClick={() => onSelectLine(line)}
                            className={cn(
                              'w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between',
                              selectedLine?.id === line.id
                                ? 'bg-accent/50 text-accent-foreground'
                                : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <span className="truncate">{line.name}</span>
                            <span className="text-xs font-mono text-muted-foreground ml-2">
                              {line.equipment_count}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2D Canvas area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Layout toolbar */}
        {selectedFactory && (
          <div className="flex items-center justify-between px-4 h-12 border-b bg-card flex-shrink-0">
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <LayoutSelector
                layouts={layouts}
                activeLayout={activeLayout}
                selectedLayoutId={selectedLayoutId}
                onSelect={handleLayoutSelect}
                onActivate={activateLayout}
                onDelete={removeLayout}
                onDuplicate={duplicateLayout}
                loading={layoutsLoading || layoutDetailLoading}
              />
            </div>

            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="outline" className="text-amber-600 border-amber-600/50">
                  변경사항 있음
                </Badge>
              )}
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetChanges}
                disabled={!hasChanges}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                초기화
              </Button>
              <Button
                size="sm"
                onClick={() => setSaveDialogOpen(true)}
                disabled={!hasChanges && !selectedLayoutId}
              >
                <Save className="h-4 w-4 mr-1" />
                레이아웃 저장
              </Button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {!selectedFactory ? (
            <div className="flex-1 flex items-center justify-center bg-background">
              <p className="text-sm text-muted-foreground">
                {!selectedCompany ? '회사를 선택하세요' : '공장을 선택하세요'}
              </p>
            </div>
          ) : equipmentLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Equipment List */}
              <EquipmentList
                equipment={equipmentWithPositions}
                selectedId={selected?.equipment_id ?? null}
                onSelect={eq => setSelected(eq)}
                lineMap={lineMap}
              />

              {/* 2D Canvas */}
              <div className="flex-1 relative overflow-hidden">
                <LayoutCanvas
                  equipment={equipmentWithPositions}
                  selectedId={selected?.equipment_id ?? null}
                  onSelect={eq => setSelected(eq)}
                  onUpdatePosition={handleUpdatePosition}
                  onUpdateSize={handleUpdateSize}
                />

                {/* Top left badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    2D 레이아웃
                  </Badge>
                </div>

                {/* Current location info */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selectedFactory.name}{selectedLine ? ` / ${selectedLine.name}` : ' (전체)'}
                  </Badge>
                </div>

                {/* Stats */}
                {stats && (
                  <div className="absolute bottom-4 right-4 flex gap-1.5 pointer-events-none">
                    {[
                      { label: '전체', val: stats.total, color: 'text-foreground' },
                      { label: '완료', val: stats.verified, color: 'text-success' },
                      { label: '대기', val: stats.pending, color: 'text-warning' },
                    ].map(s => (
                      <Card key={s.label} className="px-2.5 py-1.5 bg-card/90 backdrop-blur-sm min-w-[52px]">
                        <p className={cn('font-mono text-base font-semibold tabular-nums text-center', s.color)}>
                          {s.val}
                        </p>
                        <p className="font-mono text-[9px] text-muted-foreground uppercase text-center">
                          {s.label}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Registration Panel */}
              {selected && (
                <RegPanel
                  equipment={selected}
                  onSave={async (id, body) => {
                    await save(id, body)
                    setSelected(prev => prev ? { ...prev, ...body } : null)
                  }}
                  onClose={() => setSelected(null)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Save Layout Dialog */}
      <SaveLayoutDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        existingLayouts={layouts}
        equipmentPositions={getCurrentPositions()}
        onSaveNew={handleSaveNew}
        onUpdateExisting={handleUpdateExisting}
      />
    </div>
  )
}
```

---

## Files to Create/Modify

| Action | Path | Description |
|--------|------|-------------|
| Create | `frontend/src/components/LayoutSelector.tsx` | Dropdown for layout selection with actions |
| Create | `frontend/src/components/SaveLayoutDialog.tsx` | Dialog for saving new/updating existing layouts |
| Create | `frontend/src/hooks/useLayouts.ts` | Hooks for layout data management |
| Modify | `frontend/src/lib/api.ts` | Add layout types and API functions |
| Modify | `frontend/src/pages/LayoutEditorPage.tsx` | Integrate layout components |

---

## Prerequisites Check

Before implementing, verify:

1. **shadcn/ui components are installed:**
   ```bash
   cd frontend
   # Check if required components exist
   ls -la src/components/ui/select.tsx
   ls -la src/components/ui/dialog.tsx
   ls -la src/components/ui/alert-dialog.tsx
   ls -la src/components/ui/radio-group.tsx
   ls -la src/components/ui/dropdown-menu.tsx
   ls -la src/components/ui/separator.tsx
   ```

   If any are missing, install them:
   ```bash
   npx shadcn@latest add select dialog alert-dialog radio-group dropdown-menu separator
   ```

2. **Section 02 (Layout API) is complete** - Backend endpoints must exist:
   - GET `/api/factories/{factory_id}/layouts`
   - POST `/api/factories/{factory_id}/layouts`
   - GET `/api/layouts/{layout_id}`
   - PUT `/api/layouts/{layout_id}`
   - PUT `/api/layouts/{layout_id}/positions`
   - DELETE `/api/layouts/{layout_id}`
   - POST `/api/layouts/{layout_id}/activate`
   - POST `/api/layouts/{layout_id}/clone`

3. **Lucide icons are available:**
   ```bash
   npm list lucide-react
   ```

4. **Sonner (toast library) is installed:**
   ```bash
   npm list sonner
   ```

---

## Acceptance Criteria

- [ ] `LayoutSelector.tsx` component exists and renders correctly
- [ ] `SaveLayoutDialog.tsx` component exists and renders correctly
- [ ] `useLayouts.ts` hook file exists with `useFactoryLayouts` and `useLayoutDetail` exports
- [ ] Layout types and API functions are added to `api.ts`
- [ ] `LayoutEditorPage.tsx` imports and uses layout components
- [ ] User can select a layout from the dropdown
- [ ] Selecting a layout loads its equipment positions
- [ ] Selecting "원본" shows equipment_scans positions
- [ ] User can open save dialog with the save button
- [ ] User can save current positions as a new layout with name
- [ ] User can update an existing layout's positions
- [ ] User can activate a layout from the dropdown menu
- [ ] User can delete a layout (with confirmation dialog)
- [ ] User can clone a layout
- [ ] "변경사항 있음" badge appears when positions are modified
- [ ] Reset button clears local changes
- [ ] Changing layout warns if there are unsaved changes
- [ ] Toast notifications appear for all operations
- [ ] All loading states display spinners appropriately
- [ ] Error states are handled gracefully

---

## Testing Approach

### Manual Testing Checklist

1. **Layout Selection:**
   - [ ] Open LayoutEditorPage, select a factory
   - [ ] Verify layout dropdown shows "원본" and any existing layouts
   - [ ] Select a saved layout, verify equipment positions update
   - [ ] Select "원본", verify equipment returns to database positions

2. **Saving New Layout:**
   - [ ] Drag an equipment to a new position
   - [ ] Verify "변경사항 있음" badge appears
   - [ ] Click "레이아웃 저장"
   - [ ] Enter a name and click save
   - [ ] Verify toast shows success
   - [ ] Verify new layout appears in dropdown

3. **Updating Existing Layout:**
   - [ ] Select an existing layout
   - [ ] Make position changes
   - [ ] Click "레이아웃 저장"
   - [ ] Select "기존 레이아웃 업데이트"
   - [ ] Select the layout and save
   - [ ] Verify toast shows success

4. **Layout Actions:**
   - [ ] Select a layout
   - [ ] Click the menu button (...)
   - [ ] Click "활성화" - verify layout is marked as active
   - [ ] Click "복제" - verify new layout appears with "(복사본)"
   - [ ] Click "삭제" - verify confirmation dialog appears
   - [ ] Confirm delete - verify layout is removed

5. **Change Warning:**
   - [ ] Make position changes
   - [ ] Try to select a different layout
   - [ ] Verify warning dialog appears
   - [ ] Cancel - changes should remain
   - [ ] Confirm - changes should be discarded

---

## Troubleshooting

**Issue:** Layout dropdown is empty
- Check that Section 02 (Layout API) endpoints are working
- Verify `selectedFactory?.id` is being passed to `useFactoryLayouts`
- Check browser console for API errors

**Issue:** Positions don't update when selecting a layout
- Verify `useLayoutDetail` is fetching the correct layout
- Check that `equipment_positions` array exists in the response
- Verify `equipmentWithPositions` memo is recalculating

**Issue:** Save button doesn't work
- Check browser console for API errors
- Verify `createLayout` and `updateLayoutPositions` functions are correct
- Ensure `getCurrentPositions` returns valid data

**Issue:** Toast notifications not appearing
- Verify Sonner `<Toaster />` component is in the app root
- Check that `toast` is imported from `sonner`

**Issue:** "변경사항 있음" badge not appearing
- Verify `hasChanges` state is being set in position/size handlers
- Check that handlers are being called on drag

---

## Downstream Dependencies

After completing this section:

- **Section 09 (Equipment CRUD)** can add equipment creation/deletion UI
- **Section 10 (Viewer Integration)** can load active layout positions in 3D viewer

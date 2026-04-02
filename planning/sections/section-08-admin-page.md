# Section 08: Admin Page UI

**Status:** Pending
**Estimated Effort:** 4-5 hours

---

## Background

The FACTOR Digital Twin system currently supports viewing companies, factories, and production lines, but lacks administrative capabilities for creating, editing, and deleting these entities. This section implements a dedicated Admin Page that provides full CRUD (Create, Read, Update, Delete) functionality for the hierarchical entity structure.

The admin page follows a 3-column master-detail layout:
1. **Companies Column** - List all companies, create new, edit/delete existing
2. **Factories Column** - Shows factories for the selected company
3. **Lines Column** - Shows production lines for the selected factory

This design allows administrators to manage the entire organizational hierarchy from a single page while maintaining clear visual relationships between parent and child entities.

**Key Design Decisions:**
- Cascade deletes are handled at the database level (Section 05), but the UI must warn users about affected child data
- Delete confirmation dialog shows exact counts of child entities that will be removed
- Entity dialogs are reusable for Company/Factory/Line with dynamic field configuration
- The page integrates with existing hooks from Section 07 (useCrud.ts)

---

## Dependencies

### Requires (must be completed first)
- **Section 05: CASCADE FK Migration** - Database must support cascade deletes
- **Section 06: CRUD APIs** - Backend endpoints for create/update/delete operations
- **Section 07: CRUD Hooks** - Frontend hooks (useCompanyCrud, useFactoryCrud, useLineCrud)

### Blocks (cannot start until this section is complete)
- **Section 09: Equipment CRUD** - Equipment management builds on this admin UI pattern
- **Section 10: Viewer Integration** - Layout system needs admin page for context selection

---

## Requirements

When this section is complete, the following must be true:

1. AdminPage is accessible via navigation (new "Admin" or "Management" tab)
2. AdminPage displays 3-column layout (Companies | Factories | Lines)
3. Each column shows a list of entities with Add/Edit/Delete buttons
4. Clicking a company shows its factories in the middle column
5. Clicking a factory shows its lines in the right column
6. EntityDialog opens for creating new entities
7. EntityDialog opens for editing existing entities (pre-filled form)
8. DeleteConfirmDialog shows before any delete operation
9. DeleteConfirmDialog displays counts of child data to be cascade-deleted
10. Successful operations show toast notifications
11. Lists refresh automatically after CRUD operations
12. Route `/admin` is added to the application

---

## Implementation Details

### File 1: AdminPage.tsx (NEW)

**Path:** `frontend/src/pages/AdminPage.tsx`

```tsx
// pages/AdminPage.tsx
import { useState, useEffect } from 'react'
import { useCompanies, useCompanyFactories, useFactoryLines } from '@/hooks/useFactories'
import { useCompanyCrud, useFactoryCrud, useLineCrud } from '@/hooks/useCrud'
import { Company, Factory, ProductionLine } from '@/lib/api'
import EntityDialog from '@/components/EntityDialog'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, ChevronRight, Building2, Factory as FactoryIcon, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

type EntityType = 'company' | 'factory' | 'line'

interface EntityDialogState {
  type: EntityType
  mode: 'create' | 'edit'
  data?: Company | Factory | ProductionLine
  parentId?: string  // company_id for factory, factory_id for line
}

interface DeleteDialogState {
  type: EntityType
  id: string
  name: string
  loading: boolean
}

export default function AdminPage() {
  // Data hooks
  const { companies, loading: companiesLoading, reload: reloadCompanies } = useCompanies()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null)

  // Get selected company's code for fetching factories
  const selectedCompany = companies.find(c => c.id === selectedCompanyId)
  const { factories, loading: factoriesLoading, reload: reloadFactories } = useCompanyFactories(selectedCompany?.code ?? null)

  // Get selected factory's code for fetching lines
  const selectedFactory = factories.find(f => f.id === selectedFactoryId)
  const { lines, loading: linesLoading, reload: reloadLines } = useFactoryLines(selectedFactory?.code ?? null)

  // CRUD hooks
  const companyCrud = useCompanyCrud(() => {
    reloadCompanies()
  })
  const factoryCrud = useFactoryCrud(() => {
    reloadFactories()
  })
  const lineCrud = useLineCrud(() => {
    reloadLines()
  })

  // Dialog states
  const [entityDialog, setEntityDialog] = useState<EntityDialogState | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [deleteInfo, setDeleteInfo] = useState<{
    factories_count?: number
    lines_count?: number
    equipment_count: number
  } | null>(null)

  // Clear factory selection when company changes
  useEffect(() => {
    setSelectedFactoryId(null)
  }, [selectedCompanyId])

  // Load delete info when delete dialog opens
  useEffect(() => {
    if (!deleteDialog) {
      setDeleteInfo(null)
      return
    }

    const loadDeleteInfo = async () => {
      let info = null
      if (deleteDialog.type === 'company') {
        info = await companyCrud.getDeleteInfo(deleteDialog.id)
      } else if (deleteDialog.type === 'factory') {
        info = await factoryCrud.getDeleteInfo(deleteDialog.id)
      } else if (deleteDialog.type === 'line') {
        info = await lineCrud.getDeleteInfo(deleteDialog.id)
      }
      setDeleteInfo(info)
    }

    loadDeleteInfo()
  }, [deleteDialog, companyCrud, factoryCrud, lineCrud])

  // Handlers
  const handleCreateEntity = (type: EntityType, parentId?: string) => {
    setEntityDialog({ type, mode: 'create', parentId })
  }

  const handleEditEntity = (type: EntityType, data: Company | Factory | ProductionLine) => {
    setEntityDialog({ type, mode: 'edit', data })
  }

  const handleDeleteEntity = (type: EntityType, id: string, name: string) => {
    setDeleteDialog({ type, id, name, loading: false })
  }

  const handleEntitySubmit = async (formData: Record<string, string | number | boolean>) => {
    if (!entityDialog) return

    let success = false
    if (entityDialog.type === 'company') {
      if (entityDialog.mode === 'create') {
        success = await companyCrud.create({
          code: formData.code as string,
          name: formData.name as string,
        })
      } else {
        success = await companyCrud.update(entityDialog.data!.id, {
          name: formData.name as string,
        })
      }
    } else if (entityDialog.type === 'factory') {
      if (entityDialog.mode === 'create') {
        success = await factoryCrud.create({
          company_id: entityDialog.parentId!,
          code: formData.code as string,
          name: formData.name as string,
          address: (formData.address as string) || undefined,
        })
      } else {
        success = await factoryCrud.update(entityDialog.data!.id, {
          name: formData.name as string,
          address: (formData.address as string) || undefined,
        })
      }
    } else if (entityDialog.type === 'line') {
      if (entityDialog.mode === 'create') {
        success = await lineCrud.create({
          factory_id: entityDialog.parentId!,
          code: formData.code as string,
          name: formData.name as string,
          building: (formData.building as string) || undefined,
          floor: formData.floor ? Number(formData.floor) : undefined,
          area: (formData.area as string) || undefined,
        })
      } else {
        success = await lineCrud.update(entityDialog.data!.id, {
          name: formData.name as string,
          building: (formData.building as string) || undefined,
          floor: formData.floor ? Number(formData.floor) : undefined,
          area: (formData.area as string) || undefined,
        })
      }
    }

    if (success) {
      setEntityDialog(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return

    setDeleteDialog(prev => prev ? { ...prev, loading: true } : null)

    let success = false
    if (deleteDialog.type === 'company') {
      success = await companyCrud.remove(deleteDialog.id)
      if (success && selectedCompanyId === deleteDialog.id) {
        setSelectedCompanyId(null)
      }
    } else if (deleteDialog.type === 'factory') {
      success = await factoryCrud.remove(deleteDialog.id)
      if (success && selectedFactoryId === deleteDialog.id) {
        setSelectedFactoryId(null)
      }
    } else if (deleteDialog.type === 'line') {
      success = await lineCrud.remove(deleteDialog.id)
    }

    if (success) {
      setDeleteDialog(null)
    } else {
      setDeleteDialog(prev => prev ? { ...prev, loading: false } : null)
    }
  }

  // Entity list item component
  const EntityItem = ({
    icon: Icon,
    name,
    subtitle,
    selected,
    onClick,
    onEdit,
    onDelete,
    badge,
  }: {
    icon: React.ElementType
    name: string
    subtitle?: string | null
    selected?: boolean
    onClick?: () => void
    onEdit: () => void
    onDelete: () => void
    badge?: string | number
  }) => (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
        selected ? 'bg-primary/10 border-primary' : 'bg-card hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{name}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        {badge !== undefined && (
          <Badge variant="secondary" className="ml-2 flex-shrink-0">
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={e => {
            e.stopPropagation()
            onEdit()
          }}
          title="Edit"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  )

  // Column component
  const Column = ({
    title,
    icon: Icon,
    loading,
    isEmpty,
    emptyMessage,
    onAdd,
    addDisabled,
    children,
  }: {
    title: string
    icon: React.ElementType
    loading: boolean
    isEmpty: boolean
    emptyMessage: string
    onAdd: () => void
    addDisabled?: boolean
    children: React.ReactNode
  }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">{title}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={addDisabled}
          className="h-7"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Loading...
            </div>
          ) : isEmpty ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {emptyMessage}
            </div>
          ) : (
            children
          )}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Companies Column */}
      <Card className="w-1/3 border-r rounded-none">
        <Column
          title="Companies"
          icon={Building2}
          loading={companiesLoading}
          isEmpty={companies.length === 0}
          emptyMessage="No companies found. Create one to get started."
          onAdd={() => handleCreateEntity('company')}
        >
          {companies.map(company => (
            <EntityItem
              key={company.id}
              icon={Building2}
              name={company.name}
              subtitle={company.code}
              selected={selectedCompanyId === company.id}
              onClick={() => setSelectedCompanyId(company.id)}
              onEdit={() => handleEditEntity('company', company)}
              onDelete={() => handleDeleteEntity('company', company.id, company.name)}
            />
          ))}
        </Column>
      </Card>

      {/* Factories Column */}
      <Card className="w-1/3 border-r rounded-none">
        <Column
          title="Factories"
          icon={FactoryIcon}
          loading={factoriesLoading}
          isEmpty={!selectedCompanyId || factories.length === 0}
          emptyMessage={!selectedCompanyId ? "Select a company to view factories" : "No factories found. Create one to get started."}
          onAdd={() => handleCreateEntity('factory', selectedCompanyId!)}
          addDisabled={!selectedCompanyId}
        >
          {factories.map(factory => (
            <EntityItem
              key={factory.id}
              icon={FactoryIcon}
              name={factory.name}
              subtitle={factory.address || factory.code}
              selected={selectedFactoryId === factory.id}
              onClick={() => setSelectedFactoryId(factory.id)}
              onEdit={() => handleEditEntity('factory', factory)}
              onDelete={() => handleDeleteEntity('factory', factory.id, factory.name)}
            />
          ))}
        </Column>
      </Card>

      {/* Lines Column */}
      <Card className="w-1/3 rounded-none">
        <Column
          title="Production Lines"
          icon={Layers}
          loading={linesLoading}
          isEmpty={!selectedFactoryId || lines.length === 0}
          emptyMessage={!selectedFactoryId ? "Select a factory to view lines" : "No lines found. Create one to get started."}
          onAdd={() => handleCreateEntity('line', selectedFactoryId!)}
          addDisabled={!selectedFactoryId}
        >
          {lines.map(line => (
            <EntityItem
              key={line.id}
              icon={Layers}
              name={line.name}
              subtitle={line.location || line.code}
              badge={line.equipment_count}
              onEdit={() => handleEditEntity('line', line)}
              onDelete={() => handleDeleteEntity('line', line.id, line.name)}
            />
          ))}
        </Column>
      </Card>

      {/* Entity Create/Edit Dialog */}
      {entityDialog && (
        <EntityDialog
          open={true}
          onOpenChange={open => !open && setEntityDialog(null)}
          type={entityDialog.type}
          mode={entityDialog.mode}
          data={entityDialog.data}
          onSubmit={handleEntitySubmit}
          loading={
            entityDialog.type === 'company' ? companyCrud.loading :
            entityDialog.type === 'factory' ? factoryCrud.loading :
            lineCrud.loading
          }
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialog && (
        <DeleteConfirmDialog
          open={true}
          onOpenChange={open => !open && setDeleteDialog(null)}
          type={deleteDialog.type}
          name={deleteDialog.name}
          info={deleteInfo}
          onConfirm={handleDeleteConfirm}
          loading={deleteDialog.loading}
        />
      )}
    </div>
  )
}
```

### File 2: EntityDialog.tsx (NEW)

**Path:** `frontend/src/components/EntityDialog.tsx`

```tsx
// components/EntityDialog.tsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Company, Factory, ProductionLine } from '@/lib/api'

type EntityType = 'company' | 'factory' | 'line'

interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'number'
  required: boolean
  placeholder?: string
  disabled?: boolean  // For edit mode, code should not be editable
}

const FIELD_CONFIGS: Record<EntityType, FieldConfig[]> = {
  company: [
    { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., ACME' },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g., ACME Corporation' },
  ],
  factory: [
    { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., FAC001' },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Main Factory' },
    { name: 'address', label: 'Address', type: 'text', required: false, placeholder: 'e.g., 123 Industrial Way' },
  ],
  line: [
    { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., LINE01' },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Assembly Line A' },
    { name: 'building', label: 'Building', type: 'text', required: false, placeholder: 'e.g., Building A' },
    { name: 'floor', label: 'Floor', type: 'number', required: false, placeholder: 'e.g., 1' },
    { name: 'area', label: 'Area', type: 'text', required: false, placeholder: 'e.g., North Wing' },
  ],
}

const TYPE_LABELS: Record<EntityType, string> = {
  company: 'Company',
  factory: 'Factory',
  line: 'Production Line',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: EntityType
  mode: 'create' | 'edit'
  data?: Company | Factory | ProductionLine
  onSubmit: (data: Record<string, string | number | boolean>) => Promise<void>
  loading?: boolean
}

export default function EntityDialog({
  open,
  onOpenChange,
  type,
  mode,
  data,
  onSubmit,
  loading = false,
}: Props) {
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fields = FIELD_CONFIGS[type]
  const typeLabel = TYPE_LABELS[type]

  // Initialize form data when dialog opens or data changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && data) {
        const initialData: Record<string, string> = {}
        fields.forEach(field => {
          const value = (data as Record<string, unknown>)[field.name]
          initialData[field.name] = value != null ? String(value) : ''
        })
        setFormData(initialData)
      } else {
        setFormData({})
      }
      setErrors({})
    }
  }, [open, mode, data, fields])

  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    fields.forEach(field => {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = `${field.label} is required`
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    // Convert form data to appropriate types
    const submitData: Record<string, string | number | boolean> = {}
    fields.forEach(field => {
      const value = formData[field.name]?.trim()
      if (value) {
        if (field.type === 'number') {
          submitData[field.name] = Number(value)
        } else {
          submitData[field.name] = value
        }
      }
    })

    await onSubmit(submitData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create' : 'Edit'} {typeLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.map(field => {
            const isCodeField = field.name === 'code'
            const isDisabled = mode === 'edit' && isCodeField

            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={field.name}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={formData[field.name] || ''}
                  onChange={e => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isDisabled || loading}
                  className={errors[field.name] ? 'border-destructive' : ''}
                />
                {errors[field.name] && (
                  <p className="text-xs text-destructive">{errors[field.name]}</p>
                )}
                {isDisabled && (
                  <p className="text-xs text-muted-foreground">
                    Code cannot be changed after creation
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### File 3: DeleteConfirmDialog.tsx (NEW)

**Path:** `frontend/src/components/DeleteConfirmDialog.tsx`

```tsx
// components/DeleteConfirmDialog.tsx
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
import { AlertTriangle, Loader2 } from 'lucide-react'

type EntityType = 'company' | 'factory' | 'line'

interface DeleteInfo {
  factories_count?: number
  lines_count?: number
  equipment_count: number
}

const TYPE_LABELS: Record<EntityType, string> = {
  company: 'company',
  factory: 'factory',
  line: 'production line',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: EntityType
  name: string
  info: DeleteInfo | null
  onConfirm: () => Promise<void>
  loading?: boolean
}

export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  type,
  name,
  info,
  onConfirm,
  loading = false,
}: Props) {
  const typeLabel = TYPE_LABELS[type]

  const getChildrenDescription = (): string | null => {
    if (!info) return null

    const parts: string[] = []

    if (info.factories_count && info.factories_count > 0) {
      parts.push(`${info.factories_count} factor${info.factories_count === 1 ? 'y' : 'ies'}`)
    }
    if (info.lines_count && info.lines_count > 0) {
      parts.push(`${info.lines_count} production line${info.lines_count === 1 ? '' : 's'}`)
    }
    if (info.equipment_count && info.equipment_count > 0) {
      parts.push(`${info.equipment_count} equipment item${info.equipment_count === 1 ? '' : 's'}`)
    }

    if (parts.length === 0) return null

    return parts.join(', ')
  }

  const childrenDescription = getChildrenDescription()
  const hasChildren = childrenDescription !== null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete {typeLabel}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the {typeLabel}{' '}
                <span className="font-semibold text-foreground">"{name}"</span>?
              </p>

              {info === null ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking for related data...</span>
                </div>
              ) : hasChildren ? (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2">
                  <p className="font-medium text-destructive">
                    Warning: This will also delete:
                  </p>
                  <p className="text-sm">{childrenDescription}</p>
                  <p className="text-xs text-muted-foreground">
                    This action cannot be undone.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This {typeLabel} has no child data. This action cannot be undone.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={e => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading || info === null}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### File 4: useCrud.ts (NEW)

**Path:** `frontend/src/hooks/useCrud.ts`

This file implements the CRUD hooks that AdminPage depends on.

```typescript
// hooks/useCrud.ts
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api'

export interface DeleteInfo {
  factories_count?: number
  lines_count?: number
  equipment_count: number
}

// ============================================
// Company CRUD Hook
// ============================================

export function useCompanyCrud(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (data: { code: string; name: string }) => {
    setLoading(true)
    try {
      await api.createCompany(data)
      toast.success('Company created successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create company'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const update = useCallback(async (id: string, data: { name?: string }) => {
    setLoading(true)
    try {
      await api.updateCompany(id, data)
      toast.success('Company updated successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update company'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const getDeleteInfo = useCallback(async (id: string): Promise<DeleteInfo | null> => {
    try {
      return await api.getCompanyDeleteInfo(id)
    } catch (err) {
      toast.error('Failed to load delete information')
      return null
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await api.deleteCompany(id)
      toast.success('Company deleted successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete company'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  return { loading, create, update, getDeleteInfo, remove }
}

// ============================================
// Factory CRUD Hook
// ============================================

export interface FactoryCreateData {
  company_id: string
  code: string
  name: string
  address?: string
}

export interface FactoryUpdateData {
  name?: string
  address?: string
}

export function useFactoryCrud(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (data: FactoryCreateData) => {
    setLoading(true)
    try {
      await api.createFactory(data)
      toast.success('Factory created successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create factory'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const update = useCallback(async (id: string, data: FactoryUpdateData) => {
    setLoading(true)
    try {
      await api.updateFactory(id, data)
      toast.success('Factory updated successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update factory'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const getDeleteInfo = useCallback(async (id: string): Promise<DeleteInfo | null> => {
    try {
      return await api.getFactoryDeleteInfo(id)
    } catch (err) {
      toast.error('Failed to load delete information')
      return null
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await api.deleteFactory(id)
      toast.success('Factory deleted successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete factory'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  return { loading, create, update, getDeleteInfo, remove }
}

// ============================================
// Line CRUD Hook
// ============================================

export interface LineCreateData {
  factory_id: string
  code: string
  name: string
  building?: string
  floor?: number
  area?: string
}

export interface LineUpdateData {
  name?: string
  building?: string
  floor?: number
  area?: string
}

export function useLineCrud(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (data: LineCreateData) => {
    setLoading(true)
    try {
      await api.createLine(data)
      toast.success('Production line created successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create line'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const update = useCallback(async (id: string, data: LineUpdateData) => {
    setLoading(true)
    try {
      await api.updateLine(id, data)
      toast.success('Production line updated successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update line'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const getDeleteInfo = useCallback(async (id: string): Promise<DeleteInfo | null> => {
    try {
      return await api.getLineDeleteInfo(id)
    } catch (err) {
      toast.error('Failed to load delete information')
      return null
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await api.deleteLine(id)
      toast.success('Production line deleted successfully')
      onSuccess?.()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete line'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  return { loading, create, update, getDeleteInfo, remove }
}
```

### File 5: api.ts (MODIFY)

**Path:** `frontend/src/lib/api.ts`

Add the following CRUD API functions to the existing api.ts file:

```typescript
// Add these to the existing api.ts file

// ============================================
// Company CRUD APIs
// ============================================

export interface CompanyCreateData {
  code: string
  name: string
}

export const createCompany = (data: CompanyCreateData) =>
  api.post<Company>('/companies/', data).then(r => r.data)

export const updateCompany = (id: string, data: { name?: string }) =>
  api.put<Company>(`/companies/${id}`, data).then(r => r.data)

export interface CompanyDeleteInfo {
  factories_count: number
  lines_count: number
  equipment_count: number
}

export const getCompanyDeleteInfo = (id: string) =>
  api.get<CompanyDeleteInfo>(`/companies/${id}/delete-info`).then(r => r.data)

export const deleteCompany = (id: string) =>
  api.delete(`/companies/${id}`).then(r => r.data)

// ============================================
// Factory CRUD APIs
// ============================================

export interface FactoryCreateData {
  company_id: string
  code: string
  name: string
  address?: string
}

export const createFactory = (data: FactoryCreateData) =>
  api.post<Factory>('/factories/', data).then(r => r.data)

export const updateFactory = (id: string, data: { name?: string; address?: string }) =>
  api.put<Factory>(`/factories/${id}`, data).then(r => r.data)

export interface FactoryDeleteInfo {
  lines_count: number
  equipment_count: number
}

export const getFactoryDeleteInfo = (id: string) =>
  api.get<FactoryDeleteInfo>(`/factories/${id}/delete-info`).then(r => r.data)

export const deleteFactory = (id: string) =>
  api.delete(`/factories/${id}`).then(r => r.data)

// ============================================
// Line CRUD APIs
// ============================================

export interface LineCreateData {
  factory_id: string
  code: string
  name: string
  building?: string
  floor?: number
  area?: string
}

export const createLine = (data: LineCreateData) =>
  api.post<ProductionLine>('/lines/', data).then(r => r.data)

export const updateLine = (id: string, data: { name?: string; building?: string; floor?: number; area?: string }) =>
  api.put<ProductionLine>(`/lines/${id}`, data).then(r => r.data)

export interface LineDeleteInfo {
  equipment_count: number
}

export const getLineDeleteInfo = (id: string) =>
  api.get<LineDeleteInfo>(`/lines/${id}/delete-info`).then(r => r.data)

export const deleteLine = (id: string) =>
  api.delete(`/lines/${id}`).then(r => r.data)
```

### File 6: App.tsx (MODIFY)

**Path:** `frontend/src/App.tsx`

Add the Admin page route and navigation tab:

```tsx
// App.tsx - Complete modified version

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Box, LayoutGrid, Settings } from 'lucide-react'
import { Company, Factory, ProductionLine } from '@/lib/api'
import FactoryLinePage from './pages/FactoryLinePage'
import LayoutEditorPage from './pages/LayoutEditorPage'
import AdminPage from './pages/AdminPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

type PageType = '3d' | '2d' | 'admin'

export interface SelectionState {
  company: Company | null
  factory: Factory | null
  line: ProductionLine | null
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('3d')

  // Shared selection state
  const [selection, setSelection] = useState<SelectionState>({
    company: null,
    factory: null,
    line: null,
  })

  const handleSelectCompany = (company: Company | null) => {
    setSelection({ company, factory: null, line: null })
  }

  const handleSelectFactory = (factory: Factory | null) => {
    setSelection(prev => ({ ...prev, factory, line: null }))
  }

  const handleSelectLine = (line: ProductionLine | null) => {
    setSelection(prev => ({ ...prev, line }))
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          {/* Header */}
          <header className="flex items-center justify-between px-6 h-12 border-b bg-card flex-shrink-0">
            <span className="font-mono text-sm font-semibold tracking-widest text-primary">
              FACTOR
            </span>

            {/* Page Navigation */}
            <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
              <Button
                variant={currentPage === '3d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('3d')}
                className="font-mono text-xs h-7 px-3"
              >
                <Box className="h-3.5 w-3.5 mr-1.5" />
                3D Viewer
              </Button>
              <Button
                variant={currentPage === '2d' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('2d')}
                className="font-mono text-xs h-7 px-3"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                2D Layout
              </Button>
              <Button
                variant={currentPage === 'admin' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('admin')}
                className="font-mono text-xs h-7 px-3"
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Admin
              </Button>
            </div>

            <div className="w-20" /> {/* Spacer for centering */}
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {currentPage === '3d' && (
              <FactoryLinePage
                selection={selection}
                onSelectCompany={handleSelectCompany}
                onSelectFactory={handleSelectFactory}
                onSelectLine={handleSelectLine}
              />
            )}
            {currentPage === '2d' && (
              <LayoutEditorPage
                selection={selection}
                onSelectCompany={handleSelectCompany}
                onSelectFactory={handleSelectFactory}
                onSelectLine={handleSelectLine}
              />
            )}
            {currentPage === 'admin' && (
              <AdminPage />
            )}
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/AdminPage.tsx` | CREATE | Main admin page with 3-column entity management layout |
| `frontend/src/components/EntityDialog.tsx` | CREATE | Reusable dialog for creating/editing Company, Factory, or Line |
| `frontend/src/components/DeleteConfirmDialog.tsx` | CREATE | Confirmation dialog showing cascade delete impact |
| `frontend/src/hooks/useCrud.ts` | CREATE | CRUD operation hooks with loading states and toast notifications |
| `frontend/src/lib/api.ts` | MODIFY | Add CRUD API functions for companies, factories, and lines |
| `frontend/src/App.tsx` | MODIFY | Add Admin tab to navigation and AdminPage route |

---

## UI Components Required

The admin page uses the following shadcn/ui components (should already be installed):

- `Button` - Action buttons throughout the UI
- `Card` / `CardContent` - Column containers
- `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogFooter` - Entity dialog
- `AlertDialog` and related components - Delete confirmation
- `Input` - Form fields
- `Label` - Form labels
- `ScrollArea` - Scrollable entity lists
- `Badge` - Equipment count badges

The following lucide-react icons are used:

- `Plus` - Add button
- `Edit` - Edit button
- `Trash2` - Delete button
- `ChevronRight` - Navigation indicator
- `Building2` - Company icon
- `Factory` - Factory icon
- `Layers` - Line icon
- `Settings` - Admin nav tab icon
- `AlertTriangle` - Delete warning icon
- `Loader2` - Loading spinner

---

## Acceptance Criteria

- [ ] AdminPage component renders without errors
- [ ] Navigation shows "Admin" tab that switches to AdminPage
- [ ] Companies column displays all companies from API
- [ ] Clicking a company shows its factories in middle column
- [ ] Clicking a factory shows its lines in right column
- [ ] Add button in Companies column opens EntityDialog for company creation
- [ ] Add button in Factories column is disabled when no company selected
- [ ] Add button in Lines column is disabled when no factory selected
- [ ] Edit button opens EntityDialog with pre-filled data
- [ ] Code field is disabled in edit mode
- [ ] Delete button opens DeleteConfirmDialog
- [ ] DeleteConfirmDialog shows loading state while fetching delete info
- [ ] DeleteConfirmDialog shows child entity counts when available
- [ ] DeleteConfirmDialog shows appropriate message when no children
- [ ] Creating a company refreshes the companies list
- [ ] Updating a company refreshes the companies list
- [ ] Deleting a company removes it from list and clears selection if selected
- [ ] Same behavior for factory and line operations
- [ ] Toast notifications appear for all CRUD operations (success and error)
- [ ] Loading states shown during API calls
- [ ] Form validation prevents submission with missing required fields

---

## Testing Checklist

### Manual Testing

1. **Navigation**
   - Click "Admin" tab in header
   - Verify AdminPage loads
   - Click other tabs and return to Admin
   - Verify state is preserved

2. **Company CRUD**
   - Click Add in Companies column
   - Fill form and submit - verify toast and list refresh
   - Click Edit on a company
   - Verify code is disabled, change name and submit
   - Click Delete on a company with children
   - Verify warning shows child counts
   - Confirm delete - verify cascade deletion

3. **Factory CRUD**
   - Select a company
   - Click Add in Factories column
   - Fill form and submit
   - Edit and delete operations
   - Verify factory selection clears when company changes

4. **Line CRUD**
   - Select a factory
   - Click Add in Lines column
   - Test all fields including optional ones
   - Verify equipment count badge displays

5. **Error Handling**
   - Disconnect network and try operations
   - Verify error toasts appear
   - Verify UI remains usable after errors

6. **Loading States**
   - Observe loading spinners during API calls
   - Verify buttons are disabled during operations
   - Test delete info loading in delete dialog

### Integration Testing

After Sections 05, 06, and 07 are complete:
- Verify cascade deletes work correctly
- Verify API endpoints return correct data
- Verify delete-info endpoints return accurate counts
- Test with real backend data

---

## Notes for Implementer

1. **Hook Dependencies**: This section requires useCrud.ts hooks which depend on the CRUD API functions. If Section 07 provides different hook implementations, adapt accordingly.

2. **API Endpoint Paths**: The API paths used (`/companies/`, `/factories/`, `/lines/`) should match the backend implementation from Section 06. Verify path formats (trailing slashes, etc.).

3. **Delete Info Loading**: The delete confirmation dialog shows a loading state while fetching cascade delete information. This provides a better UX than blocking the dialog.

4. **Form Validation**: Currently only checks required fields. Add more validation (e.g., code format, max length) if needed.

5. **Selection Persistence**: When entities are deleted, the component handles clearing the selection state. This prevents stale data in child columns.

6. **Scrolling**: Each column uses ScrollArea for smooth scrolling with many items. Ensure the component is available from shadcn/ui.

7. **Responsive Design**: The current 3-column layout works best on larger screens. Consider adding responsive breakpoints for mobile/tablet if needed.

8. **Korean/English Labels**: The current implementation uses English labels. Update TYPE_LABELS and button text if Korean is preferred:
   ```typescript
   const TYPE_LABELS: Record<EntityType, string> = {
     company: '회사',
     factory: '공장',
     line: '생산라인',
   }
   ```

9. **AlertDialog Accessibility**: The delete confirmation uses AlertDialog which has proper focus trapping and ARIA attributes. Ensure the component is properly imported from shadcn/ui.

10. **Error Messages**: Error messages from the API are displayed in toasts. Ensure the backend returns meaningful error messages for better UX.

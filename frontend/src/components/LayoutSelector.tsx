import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Layout, LayoutEquipmentCreate } from '@/lib/api'
import { useLayouts, useLayoutMutations } from '@/hooks/useLayouts'
import { SaveLayoutDialog } from './SaveLayoutDialog'
import { Copy, Trash2, Check, Plus } from 'lucide-react'

interface LayoutSelectorProps {
  factoryId: string
  selectedLayoutId: string | null
  onLayoutSelect: (layoutId: string | null) => void
  onLayoutActivate?: (layoutId: string) => void
  onLayoutDelete?: (layoutId: string) => void
  /** Equipment data to save when creating/updating layout */
  getCurrentEquipment?: () => LayoutEquipmentCreate[]
}

export function LayoutSelector({
  factoryId,
  selectedLayoutId,
  onLayoutSelect,
  onLayoutActivate,
  onLayoutDelete,
  getCurrentEquipment,
}: LayoutSelectorProps) {
  const { layouts, loading, reload } = useLayouts(factoryId)
  const { activate, clone, remove, saving } = useLayoutMutations()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const selectedLayout = layouts.find(l => l.id === selectedLayoutId)

  const handleActivate = async (layoutId: string) => {
    try {
      await activate(layoutId)
      reload()
      onLayoutActivate?.(layoutId)
    } catch (e) {
      console.error('Failed to activate layout:', e)
    }
  }

  const handleClone = async (layoutId: string, newName: string, newDescription?: string) => {
    try {
      const cloned = await clone(layoutId, newName, newDescription)
      reload()
      onLayoutSelect(cloned.id)
      setCloneDialogOpen(false)
    } catch (e) {
      console.error('Failed to clone layout:', e)
    }
  }

  const handleDelete = async (layoutId: string) => {
    if (!confirm('정말로 이 레이아웃을 삭제하시겠습니까?')) return

    try {
      await remove(layoutId)
      reload()
      if (selectedLayoutId === layoutId) {
        onLayoutSelect(null)
      }
      onLayoutDelete?.(layoutId)
    } catch (e) {
      console.error('Failed to delete layout:', e)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Layout Selector Dropdown */}
      <Select
        value={selectedLayoutId ?? ''}
        onValueChange={(value) => onLayoutSelect(value || null)}
        disabled={loading}
      >
        <SelectTrigger className="w-[200px] h-8">
          <SelectValue placeholder="레이아웃 선택...">
            {selectedLayout && (
              <span className="flex items-center gap-1.5 truncate text-sm">
                <span className="truncate max-w-[120px]">{selectedLayout.name}</span>
                {selectedLayout.is_active && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                    활성
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  ({selectedLayout.equipment_count}개)
                </span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {layouts.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground text-center">
              저장된 레이아웃이 없습니다
            </div>
          ) : (
            layouts.map((layout) => (
              <SelectItem key={layout.id} value={layout.id}>
                <div className="flex items-center gap-2">
                  <span className="truncate">{layout.name}</span>
                  {layout.is_active && (
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      활성
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    ({layout.equipment_count}개)
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Layout Actions (when a layout is selected) */}
        {selectedLayout && (
          <>
            {/* Activate Button */}
            {!selectedLayout.is_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleActivate(selectedLayout.id)}
                disabled={saving}
                title="이 레이아웃을 활성화"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}

            {/* Clone Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCloneDialogOpen(true)}
              disabled={saving}
              title="레이아웃 복제"
            >
              <Copy className="h-4 w-4" />
            </Button>

            {/* Delete Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(selectedLayout.id)}
              disabled={saving}
              title="레이아웃 삭제"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Save New Layout Dialog */}
      <SaveLayoutDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        factoryId={factoryId}
        getCurrentEquipment={getCurrentEquipment}
        onSaved={(newLayout) => {
          reload()
          onLayoutSelect(newLayout.id)
        }}
      />

      {/* Clone Layout Dialog */}
      {selectedLayout && (
        <SaveLayoutDialog
          open={cloneDialogOpen}
          onOpenChange={setCloneDialogOpen}
          factoryId={factoryId}
          mode="clone"
          sourceLayout={selectedLayout}
          onCloned={(clonedLayout) => {
            reload()
            onLayoutSelect(clonedLayout.id)
          }}
        />
      )}
    </div>
  )
}

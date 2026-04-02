import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Layout, LayoutDetail, LayoutEquipmentCreate } from '@/lib/api'
import { useLayoutMutations } from '@/hooks/useLayouts'

interface SaveLayoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  factoryId: string
  /** Function to get current equipment positions from viewer */
  getCurrentEquipment?: () => LayoutEquipmentCreate[]
  /** Current floor bounds */
  floorBounds?: { x: number; y: number; width: number; height: number } | null
  /** Background image (base64 data URL) */
  backgroundImage?: string | null
  /** Background opacity (0-1) */
  backgroundOpacity?: number
  /** Callback when layout is saved */
  onSaved?: (layout: LayoutDetail) => void
  /** Mode: 'save' for new, 'clone' for cloning existing */
  mode?: 'save' | 'clone'
  /** Source layout when cloning */
  sourceLayout?: Layout
  /** Callback when layout is cloned */
  onCloned?: (layout: LayoutDetail) => void
}

export function SaveLayoutDialog({
  open,
  onOpenChange,
  factoryId,
  getCurrentEquipment,
  floorBounds,
  backgroundImage,
  backgroundOpacity,
  onSaved,
  mode = 'save',
  sourceLayout,
  onCloned,
}: SaveLayoutDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [setActive, setSetActive] = useState(false)
  const { saveFromViewer, clone, saving, error } = useLayoutMutations()

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (mode === 'clone' && sourceLayout) {
        setName(`${sourceLayout.name} (복사본)`)
        setDescription(sourceLayout.description || '')
      } else {
        const now = new Date()
        const defaultName = `레이아웃 ${now.toLocaleDateString('ko-KR')} ${now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
        setName(defaultName)
        setDescription('')
      }
      setSetActive(false)
    }
  }, [open, mode, sourceLayout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return

    try {
      if (mode === 'clone' && sourceLayout) {
        // Clone mode
        const cloned = await clone(sourceLayout.id, name.trim(), description.trim() || undefined)
        onCloned?.(cloned)
        onOpenChange(false)
      } else {
        // Save new layout mode
        if (!getCurrentEquipment) return

        const equipment = getCurrentEquipment()
        const saved = await saveFromViewer(
          factoryId,
          name.trim(),
          equipment,
          description.trim() || undefined,
          setActive,
          floorBounds,
          backgroundImage,
          backgroundOpacity
        )
        onSaved?.(saved)
        onOpenChange(false)
      }
    } catch (e) {
      console.error('Failed to save layout:', e)
    }
  }

  const isCloneMode = mode === 'clone' && sourceLayout

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCloneMode ? '레이아웃 복제' : '레이아웃 저장'}
          </DialogTitle>
          <DialogDescription>
            {isCloneMode
              ? `"${sourceLayout?.name}" 레이아웃을 복제합니다.`
              : '현재 설비 배치를 새 레이아웃으로 저장합니다.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                이름
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="레이아웃 이름"
                className="col-span-3"
                required
                autoFocus
              />
            </div>

            {/* Description Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                설명
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="선택 사항"
                className="col-span-3"
              />
            </div>

            {/* Set Active Switch (only for new layouts) */}
            {!isCloneMode && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="set-active" className="text-right">
                  활성화
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Switch
                    id="set-active"
                    checked={setActive}
                    onCheckedChange={setSetActive}
                  />
                  <span className="text-sm text-muted-foreground">
                    저장 후 바로 이 레이아웃을 활성화
                  </span>
                </div>
              </div>
            )}

            {/* Equipment Count Preview (for save mode) */}
            {!isCloneMode && getCurrentEquipment && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-muted-foreground">
                  설비 수
                </Label>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {getCurrentEquipment().length}개 설비가 저장됩니다
                </div>
              </div>
            )}

            {/* Source Layout Info (for clone mode) */}
            {isCloneMode && sourceLayout && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-muted-foreground">
                  원본
                </Label>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {sourceLayout.equipment_count}개 설비 포함
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-sm text-destructive text-center">
                저장 중 오류가 발생했습니다: {error.message}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? '저장 중...' : isCloneMode ? '복제' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

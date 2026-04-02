import { useEditingStore } from '@/stores/useEditingStore'
import { useApplySelection } from '@/hooks/useApplySelection'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Scissors, Square, Undo, Redo, Trash2, Loader2 } from 'lucide-react'

interface EditingToolbarProps {
  selectedEquipmentId?: string | null
}

export default function EditingToolbar({ selectedEquipmentId }: EditingToolbarProps) {
  const {
    activeTool,
    setActiveTool,
    undo,
    redo,
    canUndo,
    canRedo,
    historyIndex,
    selectedPoints,
    clearHistory,
  } = useEditingStore()

  const { applySelection, isApplying } = useApplySelection()

  const hasPendingChanges = historyIndex >= 0
  const selectionCount = selectedPoints.size

  const discardChanges = () => {
    clearHistory()
  }

  const handleExcludePoints = () => {
    if (selectedEquipmentId && selectionCount > 0) {
      applySelection({
        equipmentId: selectedEquipmentId,
        action: 'exclude',
      })
    }
  }

  return (
    <div className="flex items-center gap-1.5 bg-card border rounded-md px-2 py-1">
      {/* Split Tool */}
      <Button
        variant={activeTool === 'split' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setActiveTool(activeTool === 'split' ? null : 'split')}
        title="분할 도구 (Split Tool)"
        className="text-xs h-7 px-2"
      >
        <Scissors className="h-3.5 w-3.5 mr-1" /> 분할
      </Button>

      {/* Box Selection Tool */}
      <Button
        variant={activeTool === 'box_select' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setActiveTool(activeTool === 'box_select' ? null : 'box_select')}
        title="선택 도구 (Selection Tool)"
        className="text-xs h-7 px-2"
      >
        <Square className="h-3.5 w-3.5 mr-1" /> 선택
      </Button>

      <Separator orientation="vertical" className="h-5" />

      {/* Undo */}
      <Button
        variant="ghost"
        size="icon"
        disabled={!canUndo()}
        onClick={undo}
        title="실행 취소 (Ctrl+Z)"
        className="h-7 w-7"
      >
        <Undo className="h-3.5 w-3.5" />
      </Button>

      {/* Redo */}
      <Button
        variant="ghost"
        size="icon"
        disabled={!canRedo()}
        onClick={redo}
        title="다시 실행 (Ctrl+Y)"
        className="h-7 w-7"
      >
        <Redo className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5" />

      {/* Selection count and exclude action */}
      {selectionCount > 0 && (
        <>
          <Badge variant="secondary" className="font-mono text-xs h-6">
            {selectionCount.toLocaleString()} 선택
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            disabled={isApplying || !selectedEquipmentId}
            onClick={handleExcludePoints}
            title="선택한 포인트 제외"
            className="text-xs h-7 px-2"
          >
            {isApplying ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1" />
            )}
            제외
          </Button>
        </>
      )}

      {/* Pending changes indicator + actions */}
      {hasPendingChanges && selectionCount === 0 && (
        <>
          <Badge variant="outline" className="text-warning border-warning text-xs h-6">
            변경 대기
          </Badge>
          <Button variant="outline" size="sm" onClick={discardChanges} className="text-xs h-7 px-2">
            취소
          </Button>
        </>
      )}

      {/* No pending changes state */}
      {!hasPendingChanges && selectionCount === 0 && (
        <span className="text-xs text-muted-foreground font-mono">변경사항 없음</span>
      )}
    </div>
  )
}

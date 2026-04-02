import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { DeleteInfo } from '@/hooks/useCrud'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deleteInfo: DeleteInfo | null
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

const entityTypeLabels: Record<DeleteInfo['entityType'], string> = {
  company: '회사',
  factory: '공장',
  line: '생산라인',
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  deleteInfo,
  loading,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  if (!deleteInfo) return null

  const { entityType, entityName, childCounts } = deleteInfo

  const hasChildren = Object.values(childCounts).some((count) => count && count > 0)

  const getChildCountItems = () => {
    const items: string[] = []

    if (childCounts.factories && childCounts.factories > 0) {
      items.push(`공장 ${childCounts.factories}개`)
    }
    if (childCounts.lines && childCounts.lines > 0) {
      items.push(`생산라인 ${childCounts.lines}개`)
    }
    if (childCounts.equipment && childCounts.equipment > 0) {
      items.push(`설비 ${childCounts.equipment}개`)
    }
    if (childCounts.layouts && childCounts.layouts > 0) {
      items.push(`레이아웃 ${childCounts.layouts}개`)
    }

    return items
  }

  const childItems = getChildCountItems()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {entityTypeLabels[entityType]} 삭제
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              <span className="font-medium text-foreground">"{entityName}"</span>을(를)
              삭제하시겠습니까?
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {hasChildren ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive mb-2">
                다음 항목들이 함께 삭제됩니다:
              </p>
              <ul className="list-disc list-inside text-sm text-destructive/80 space-y-1">
                {childItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              이 {entityTypeLabels[entityType]}에는 연결된 하위 데이터가 없습니다.
            </p>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '삭제 중...' : '삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditingStore } from '@/stores/useEditingStore'
import { updateEquipmentPoints, PointsUpdateRequest } from '@/lib/api'
import { toast } from 'sonner'

type SelectionAction = 'exclude' | 'include'

interface ApplySelectionParams {
  equipmentId: string
  action: SelectionAction
  sourceEquipmentId?: string // Required for 'include' action
}

export function useApplySelection() {
  const queryClient = useQueryClient()
  const { selectedPoints, clearSelection, clearHistory } = useEditingStore()

  const mutation = useMutation({
    mutationFn: async ({ equipmentId, action, sourceEquipmentId }: ApplySelectionParams) => {
      const indices = Array.from(selectedPoints)

      if (indices.length === 0) {
        throw new Error('선택된 포인트가 없습니다')
      }

      const request: PointsUpdateRequest = {}

      if (action === 'exclude') {
        request.exclude_indices = indices
      } else if (action === 'include') {
        if (!sourceEquipmentId) {
          throw new Error('포함 작업에는 소스 설비 ID가 필요합니다')
        }
        request.include_indices = indices
        request.source_equipment_id = sourceEquipmentId
      }

      return updateEquipmentPoints(equipmentId, request)
    },

    onMutate: () => {
      toast.loading('변경 적용 중...', { id: 'apply-selection' })
    },

    onSuccess: (data, variables) => {
      // Clear selection and history
      clearSelection()
      clearHistory()

      // Invalidate equipment queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      queryClient.invalidateQueries({ queryKey: ['equipment-points', variables.equipmentId] })

      // Show success toast
      toast.success(`변경 적용 완료. ${data.point_count} 포인트 남음.`, { id: 'apply-selection' })
    },

    onError: (error: Error) => {
      toast.error(`적용 실패: ${error.message}`, { id: 'apply-selection' })
    },
  })

  return {
    applySelection: mutation.mutate,
    applySelectionAsync: mutation.mutateAsync,
    isApplying: mutation.isPending,
    error: mutation.error,
  }
}

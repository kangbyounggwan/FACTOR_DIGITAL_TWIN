import { useMutation, useQueryClient } from '@tanstack/react-query'
import { splitEquipment, SplitResponse } from '@/lib/api'
import { useEditingStore } from '@/stores/useEditingStore'
import { toast } from 'sonner'

interface SplitParams {
  equipmentId: string
  planePoint: [number, number, number]
  planeNormal: [number, number, number]
}

export function useSplitEquipment() {
  const queryClient = useQueryClient()
  const { pushOperation, setSplitPlane, setActiveTool } = useEditingStore()

  return useMutation<SplitResponse, Error, SplitParams>({
    mutationFn: ({ equipmentId, planePoint, planeNormal }) =>
      splitEquipment(equipmentId, planePoint, planeNormal),

    onMutate: () => {
      toast.loading('설비 분할 중...', { id: 'split-operation' })
    },

    onSuccess: (data, variables) => {
      // Record operation in history
      pushOperation({
        type: 'split',
        equipmentId: variables.equipmentId,
        data: {
          originalId: variables.equipmentId,
          newIds: [data.equipment_a.equipment_id, data.equipment_b.equipment_id],
          plane: {
            point: variables.planePoint,
            normal: variables.planeNormal,
          },
        },
      })

      // Clear split plane state
      setSplitPlane(null)
      setActiveTool(null)

      // Refresh equipment list
      queryClient.invalidateQueries({ queryKey: ['equipment'] })

      // Success notification
      toast.success(
        `설비 분할 완료: ${data.equipment_a.equipment_id}, ${data.equipment_b.equipment_id}`,
        { id: 'split-operation' }
      )
    },

    onError: (error) => {
      toast.error(`분할 실패: ${error.message}`, { id: 'split-operation' })
    },
  })
}

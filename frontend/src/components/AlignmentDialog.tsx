import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Equipment } from '@/lib/api'
import { Grid3X3, MoveHorizontal, MoveVertical } from 'lucide-react'

export type AlignmentOption =
  | 'horizontal-distribute'  // 가로 균등 배치
  | 'vertical-distribute'    // 세로 균등 배치
  | 'horizontal-align-top'   // 상단 정렬
  | 'horizontal-align-center' // 가운데 정렬 (가로)
  | 'horizontal-align-bottom' // 하단 정렬
  | 'vertical-align-left'    // 좌측 정렬
  | 'vertical-align-center'  // 가운데 정렬 (세로)
  | 'vertical-align-right'   // 우측 정렬
  | 'grid'                   // 그리드 배치

interface AlignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEquipment: Equipment[]
  selectionBounds: { x: number; y: number; width: number; height: number } | null
  onAlign: (option: AlignmentOption, equipment: Equipment[], bounds: { x: number; y: number; width: number; height: number }, spacing?: number) => void
  /** 전체 설비 목록 (구역 선택용) */
  allEquipment?: Equipment[]
}

export function AlignmentDialog({
  open,
  onOpenChange,
  selectedEquipment,
  selectionBounds,
  onAlign,
  allEquipment,
}: AlignmentDialogProps) {
  const [selectedZone, setSelectedZone] = useState<string>('_selection')
  const [spacing, setSpacing] = useState<string>('0')

  // 다이얼로그 열릴 때 선택 초기화
  useEffect(() => {
    if (open) {
      setSelectedZone('_selection')
      setSpacing('0')
    }
  }, [open])

  // 사용 가능한 구역 목록
  const availableZones = useMemo(() => {
    if (!allEquipment) return []
    const zones = new Set(allEquipment.map(eq => eq.zone || '미지정'))
    return Array.from(zones).sort((a, b) => {
      if (a === '미지정') return 1
      if (b === '미지정') return -1
      return a.localeCompare(b)
    })
  }, [allEquipment])

  // 현재 선택된 설비 (영역 선택 또는 구역 필터)
  const currentEquipment = useMemo(() => {
    if (selectedZone === '_selection') {
      return selectedEquipment
    }
    if (!allEquipment) return selectedEquipment
    return allEquipment.filter(eq => (eq.zone || '미지정') === selectedZone)
  }, [selectedZone, selectedEquipment, allEquipment])

  // 현재 선택된 설비의 bounds 계산 (IQR 기반으로 이상치 제외)
  const currentBounds = useMemo(() => {
    if (selectedZone === '_selection' && selectionBounds) {
      return selectionBounds
    }
    if (currentEquipment.length === 0) return null

    // 이상치를 제외한 bounds 계산 (IQR 방식)
    const getFilteredBounds = (values: number[], halfSizes: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const n = sorted.length

      if (n <= 3) {
        // 설비 3개 이하면 모두 포함
        const min = Math.min(...values.map((v, i) => v - halfSizes[i]))
        const max = Math.max(...values.map((v, i) => v + halfSizes[i]))
        return { min, max }
      }

      // Q1, Q3 계산
      const q1Idx = Math.floor(n * 0.25)
      const q3Idx = Math.floor(n * 0.75)
      const q1 = sorted[q1Idx]
      const q3 = sorted[q3Idx]
      const iqr = q3 - q1

      // IQR 범위 내의 설비만 포함 (1.5 * IQR)
      const lowerBound = q1 - 1.5 * iqr
      const upperBound = q3 + 1.5 * iqr

      const filtered = values.map((v, i) => ({ v, halfSize: halfSizes[i] }))
        .filter(({ v }) => v >= lowerBound && v <= upperBound)

      if (filtered.length === 0) {
        // 모두 이상치인 경우 전체 포함
        const min = Math.min(...values.map((v, i) => v - halfSizes[i]))
        const max = Math.max(...values.map((v, i) => v + halfSizes[i]))
        return { min, max }
      }

      const min = Math.min(...filtered.map(f => f.v - f.halfSize))
      const max = Math.max(...filtered.map(f => f.v + f.halfSize))
      return { min, max }
    }

    const xValues = currentEquipment.map(eq => eq.centroid_x)
    const xHalfSizes = currentEquipment.map(eq => eq.size_w / 2)
    const yValues = currentEquipment.map(eq => eq.centroid_z)
    const yHalfSizes = currentEquipment.map(eq => eq.size_d / 2)

    const xBounds = getFilteredBounds(xValues, xHalfSizes)
    const yBounds = getFilteredBounds(yValues, yHalfSizes)

    return {
      x: xBounds.min,
      y: yBounds.min,
      width: xBounds.max - xBounds.min,
      height: yBounds.max - yBounds.min,
    }
  }, [selectedZone, selectionBounds, currentEquipment])

  const handleAlign = (option: AlignmentOption) => {
    if (currentEquipment.length > 0 && currentBounds) {
      const spacingValue = parseFloat(spacing) || 0
      onAlign(option, currentEquipment, currentBounds, spacingValue)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>설비 자동 정렬</DialogTitle>
          <DialogDescription>
            선택된 {currentEquipment.length}개 설비를 정렬합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 구역 선택 */}
          {allEquipment && availableZones.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">대상 선택</p>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_selection">
                    영역 선택 ({selectedEquipment.length}개)
                  </SelectItem>
                  {availableZones.map(zone => {
                    const count = allEquipment.filter(eq => (eq.zone || '미지정') === zone).length
                    return (
                      <SelectItem key={zone} value={zone}>
                        {zone} ({count}개)
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 설비 간격 설정 */}
          <div>
            <Label htmlFor="spacing" className="text-sm font-medium">설비 간격 (m)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="spacing"
                type="text"
                inputMode="decimal"
                value={spacing}
                onChange={(e) => setSpacing(e.target.value)}
                placeholder="0"
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">0 = 자동 균등 배치</span>
            </div>
          </div>

          {/* 균등 배치 */}
          <div>
            <p className="text-sm font-medium mb-2">균등 배치</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => handleAlign('horizontal-distribute')}
              >
                <MoveHorizontal className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <p className="text-sm font-medium">가로 균등</p>
                  <p className="text-xs text-muted-foreground">X축으로 균등 간격</p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => handleAlign('vertical-distribute')}
              >
                <MoveVertical className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <p className="text-sm font-medium">세로 균등</p>
                  <p className="text-xs text-muted-foreground">Y축으로 균등 간격</p>
                </div>
              </Button>
            </div>
          </div>

          {/* 정렬 */}
          <div>
            <p className="text-sm font-medium mb-2">가로축 정렬</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlign('horizontal-align-top')}
              >
                상단
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlign('horizontal-align-center')}
              >
                중앙
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlign('horizontal-align-bottom')}
              >
                하단
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">세로축 정렬</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlign('vertical-align-left')}
              >
                좌측
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlign('vertical-align-center')}
              >
                중앙
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAlign('vertical-align-right')}
              >
                우측
              </Button>
            </div>
          </div>

          {/* 그리드 배치 */}
          <div>
            <p className="text-sm font-medium mb-2">자동 배치</p>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={() => handleAlign('grid')}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              <div className="text-left">
                <p className="text-sm font-medium">그리드 배치</p>
                <p className="text-xs text-muted-foreground">행/열 형태로 자동 정렬</p>
              </div>
            </Button>
          </div>
        </div>

        {/* 선택 영역 정보 */}
        {currentBounds && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            선택 영역: {currentBounds.width.toFixed(2)}m × {currentBounds.height.toFixed(2)}m
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * 정렬 알고리즘 유틸리티
 * @param spacing - 설비 간격 (m). 0이면 영역 내에서 자동 균등 배치, >0이면 지정된 간격으로 배치
 */
export function calculateAlignedPositions(
  equipment: Equipment[],
  option: AlignmentOption,
  bounds: { x: number; y: number; width: number; height: number },
  spacing: number = 0
): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {}

  if (equipment.length === 0) return result

  // 현재 위치 기준으로 정렬
  const sorted = [...equipment]

  switch (option) {
    case 'horizontal-distribute': {
      // X축 기준으로 정렬 후 균등 배치 (bounds 영역 내에서)
      sorted.sort((a, b) => a.centroid_x - b.centroid_x)

      if (sorted.length < 2) {
        for (const eq of sorted) {
          result[eq.equipment_id] = { x: eq.centroid_x, y: eq.centroid_z }
        }
        break
      }

      // 소수점 2자리 반올림 함수 (1cm 단위)
      const round2 = (n: number) => Math.round(n * 100) / 100

      if (spacing > 0) {
        // 사용자가 지정한 간격 사용 (엣지 간 간격)
        let currentX = round2(bounds.x + sorted[0].size_w / 2)

        for (let i = 0; i < sorted.length; i++) {
          const eq = sorted[i]
          result[eq.equipment_id] = {
            x: currentX,
            y: eq.centroid_z,
          }
          if (i < sorted.length - 1) {
            // 현재 설비 우측 엣지 + 간격 + 다음 설비 좌측 절반
            currentX = round2(currentX + eq.size_w / 2 + spacing + sorted[i + 1].size_w / 2)
          }
        }
      } else {
        // 자동 균등 배치: 중심점 간 균등 간격 (설비 크기와 무관하게 중심 기준)
        const firstX = sorted[0].centroid_x
        const lastX = sorted[sorted.length - 1].centroid_x
        const totalCenterSpan = lastX - firstX
        const centerSpacing = totalCenterSpan / (sorted.length - 1)

        for (let i = 0; i < sorted.length; i++) {
          const eq = sorted[i]
          result[eq.equipment_id] = {
            x: round2(firstX + centerSpacing * i),
            y: eq.centroid_z,
          }
        }
      }
      break
    }

    case 'vertical-distribute': {
      // Y축(Z) 기준으로 정렬 후 균등 배치 (bounds 영역 내에서)
      sorted.sort((a, b) => a.centroid_z - b.centroid_z)

      if (sorted.length < 2) {
        for (const eq of sorted) {
          result[eq.equipment_id] = { x: eq.centroid_x, y: eq.centroid_z }
        }
        break
      }

      // 소수점 2자리 반올림 함수 (1cm 단위)
      const round2 = (n: number) => Math.round(n * 100) / 100

      if (spacing > 0) {
        // 사용자가 지정한 간격 사용 (엣지 간 간격)
        let currentY = round2(bounds.y + sorted[0].size_d / 2)

        for (let i = 0; i < sorted.length; i++) {
          const eq = sorted[i]
          result[eq.equipment_id] = {
            x: eq.centroid_x,
            y: currentY,
          }
          if (i < sorted.length - 1) {
            currentY = round2(currentY + eq.size_d / 2 + spacing + sorted[i + 1].size_d / 2)
          }
        }
      } else {
        // 자동 균등 배치: 중심점 간 균등 간격 (설비 크기와 무관하게 중심 기준)
        const firstY = sorted[0].centroid_z
        const lastY = sorted[sorted.length - 1].centroid_z
        const totalCenterSpan = lastY - firstY
        const centerSpacing = totalCenterSpan / (sorted.length - 1)

        for (let i = 0; i < sorted.length; i++) {
          const eq = sorted[i]
          result[eq.equipment_id] = {
            x: eq.centroid_x,
            y: round2(firstY + centerSpacing * i),
          }
        }
      }
      break
    }

    case 'horizontal-align-top': {
      // 상단 정렬 (선택 영역 상단에 맞춤)
      const targetY = bounds.y
      for (const eq of equipment) {
        result[eq.equipment_id] = {
          x: eq.centroid_x,
          y: targetY + eq.size_d / 2,
        }
      }
      break
    }

    case 'horizontal-align-center': {
      // 가운데 정렬 (가로축 중심)
      const centerY = bounds.y + bounds.height / 2
      for (const eq of equipment) {
        result[eq.equipment_id] = {
          x: eq.centroid_x,
          y: centerY,
        }
      }
      break
    }

    case 'horizontal-align-bottom': {
      // 하단 정렬
      const targetY = bounds.y + bounds.height
      for (const eq of equipment) {
        result[eq.equipment_id] = {
          x: eq.centroid_x,
          y: targetY - eq.size_d / 2,
        }
      }
      break
    }

    case 'vertical-align-left': {
      // 좌측 정렬
      const targetX = bounds.x
      for (const eq of equipment) {
        result[eq.equipment_id] = {
          x: targetX + eq.size_w / 2,
          y: eq.centroid_z,
        }
      }
      break
    }

    case 'vertical-align-center': {
      // 가운데 정렬 (세로축 중심)
      const centerX = bounds.x + bounds.width / 2
      for (const eq of equipment) {
        result[eq.equipment_id] = {
          x: centerX,
          y: eq.centroid_z,
        }
      }
      break
    }

    case 'vertical-align-right': {
      // 우측 정렬
      const targetX = bounds.x + bounds.width
      for (const eq of equipment) {
        result[eq.equipment_id] = {
          x: targetX - eq.size_w / 2,
          y: eq.centroid_z,
        }
      }
      break
    }

    case 'grid': {
      // 그리드 배치: 가로 우선으로 배치
      const avgWidth = equipment.reduce((sum, eq) => sum + eq.size_w, 0) / equipment.length
      const avgDepth = equipment.reduce((sum, eq) => sum + eq.size_d, 0) / equipment.length

      // 열 수 계산 (가로 공간에 맞게)
      const cols = Math.max(1, Math.floor(bounds.width / (avgWidth * 1.2)))
      const rows = Math.ceil(equipment.length / cols)

      // 간격 계산
      const spacingX = bounds.width / cols
      const spacingY = bounds.height / rows

      // X 위치 기준으로 정렬하여 순서 유지
      sorted.sort((a, b) => a.centroid_x - b.centroid_x)

      for (let i = 0; i < sorted.length; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const eq = sorted[i]

        result[eq.equipment_id] = {
          x: bounds.x + spacingX * (col + 0.5),
          y: bounds.y + spacingY * (row + 0.5),
        }
      }
      break
    }
  }

  return result
}

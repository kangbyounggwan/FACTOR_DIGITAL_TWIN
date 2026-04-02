import { useState, useMemo } from 'react'
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
import { X, Grid3X3, MoveHorizontal, MoveVertical, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal } from 'lucide-react'
import { AlignmentOption } from './AlignmentDialog'

interface MultiSelectToolbarProps {
  selectedIds: string[]
  equipment: Equipment[]
  onAlign: (option: AlignmentOption, equipment: Equipment[], bounds: { x: number; y: number; width: number; height: number }, spacing?: number) => void
  onClearSelection: () => void
}

export function MultiSelectToolbar({
  selectedIds,
  equipment,
  onAlign,
  onClearSelection,
}: MultiSelectToolbarProps) {
  const [spacing, setSpacing] = useState<string>('0')
  const [selectedZone, setSelectedZone] = useState<string>('_selection')

  // 선택된 설비 목록
  const selectedEquipment = useMemo(() => {
    return equipment.filter(eq => selectedIds.includes(eq.equipment_id))
  }, [equipment, selectedIds])

  // 사용 가능한 구역 목록
  const availableZones = useMemo(() => {
    const zones = new Set(equipment.map(eq => eq.zone || '미지정'))
    return Array.from(zones).sort((a, b) => {
      if (a === '미지정') return 1
      if (b === '미지정') return -1
      return a.localeCompare(b)
    })
  }, [equipment])

  // 현재 선택된 설비 (영역 선택 또는 구역 필터)
  const currentEquipment = useMemo(() => {
    if (selectedZone === '_selection') {
      return selectedEquipment
    }
    return equipment.filter(eq => (eq.zone || '미지정') === selectedZone)
  }, [selectedZone, selectedEquipment, equipment])

  // 현재 선택된 설비의 bounds 계산
  const currentBounds = useMemo(() => {
    if (currentEquipment.length === 0) return null

    // IQR 기반으로 이상치 제외
    const getFilteredBounds = (values: number[], halfSizes: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const n = sorted.length

      if (n <= 3) {
        const min = Math.min(...values.map((v, i) => v - halfSizes[i]))
        const max = Math.max(...values.map((v, i) => v + halfSizes[i]))
        return { min, max }
      }

      const q1Idx = Math.floor(n * 0.25)
      const q3Idx = Math.floor(n * 0.75)
      const q1 = sorted[q1Idx]
      const q3 = sorted[q3Idx]
      const iqr = q3 - q1

      const lowerBound = q1 - 1.5 * iqr
      const upperBound = q3 + 1.5 * iqr

      const filtered = values.map((v, i) => ({ v, halfSize: halfSizes[i] }))
        .filter(({ v }) => v >= lowerBound && v <= upperBound)

      if (filtered.length === 0) {
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
  }, [currentEquipment])

  const handleAlign = (option: AlignmentOption) => {
    if (currentEquipment.length > 0 && currentBounds) {
      const spacingValue = parseFloat(spacing) || 0
      onAlign(option, currentEquipment, currentBounds, spacingValue)
    }
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="w-64 flex-shrink-0 border-l flex flex-col bg-card">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 h-11 border-b">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          다중 선택 ({selectedIds.length}개)
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearSelection}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 구역 선택 */}
        {availableZones.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">대상 선택</Label>
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_selection">
                  영역 선택 ({selectedEquipment.length}개)
                </SelectItem>
                {availableZones.map(zone => {
                  const count = equipment.filter(eq => (eq.zone || '미지정') === zone).length
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

        {/* 설비 간격 */}
        <div>
          <Label className="text-xs text-muted-foreground">설비 간격 (m)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="text"
              inputMode="decimal"
              value={spacing}
              onChange={(e) => setSpacing(e.target.value)}
              placeholder="0"
              className="h-8 text-xs w-20"
            />
            <span className="text-[10px] text-muted-foreground">0 = 자동</span>
          </div>
        </div>

        {/* 균등 배치 */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">균등 배치</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAlign('horizontal-distribute')}
            >
              <MoveHorizontal className="h-3 w-3 mr-1" />
              가로
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAlign('vertical-distribute')}
            >
              <MoveVertical className="h-3 w-3 mr-1" />
              세로
            </Button>
          </div>
        </div>

        {/* 정렬 */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">가로축 정렬</Label>
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-1"
              onClick={() => handleAlign('horizontal-align-top')}
              title="상단 정렬"
            >
              <AlignStartHorizontal className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-1"
              onClick={() => handleAlign('horizontal-align-center')}
              title="중앙 정렬"
            >
              <AlignCenterHorizontal className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-1"
              onClick={() => handleAlign('horizontal-align-bottom')}
              title="하단 정렬"
            >
              <AlignEndHorizontal className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">세로축 정렬</Label>
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-1"
              onClick={() => handleAlign('vertical-align-left')}
              title="좌측 정렬"
            >
              <AlignStartVertical className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-1"
              onClick={() => handleAlign('vertical-align-center')}
              title="중앙 정렬"
            >
              <AlignCenterVertical className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-1"
              onClick={() => handleAlign('vertical-align-right')}
              title="우측 정렬"
            >
              <AlignEndVertical className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 그리드 배치 */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">자동 배치</Label>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => handleAlign('grid')}
          >
            <Grid3X3 className="h-3 w-3 mr-1" />
            그리드 배치
          </Button>
        </div>

        {/* 선택 영역 정보 */}
        {currentBounds && (
          <div className="text-[10px] text-muted-foreground border-t pt-3 mt-3">
            선택 영역: {currentBounds.width.toFixed(2)}m x {currentBounds.height.toFixed(2)}m
          </div>
        )}

        {/* 힌트 */}
        <div className="text-[10px] text-muted-foreground border-t pt-3">
          화살표 키: 선택 설비 이동<br />
          Shift + 화살표: 큰 이동
        </div>
      </div>
    </div>
  )
}

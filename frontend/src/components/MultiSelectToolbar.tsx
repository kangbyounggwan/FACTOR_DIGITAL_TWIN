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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Equipment, EquipmentUpdate, FlowConnection, createEquipmentGroup, createFlowConnection, deleteFlowConnection } from '@/lib/api'
import { X, Grid3X3, MoveHorizontal, MoveVertical, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Link2, ArrowRight, Trash2 } from 'lucide-react'
import { AlignmentOption } from './AlignmentDialog'
import { toast } from 'sonner'

interface MultiSelectToolbarProps {
  selectedIds: string[]
  equipment: Equipment[]
  onAlign: (option: AlignmentOption, equipment: Equipment[], bounds: { x: number; y: number; width: number; height: number }, spacing?: number) => void
  onClearSelection: () => void
  onBatchUpdate?: (equipmentIds: string[], updates: EquipmentUpdate) => void
  lineCode?: string  // 그룹 생성 시 필요
  onGroupCreated?: () => void  // 그룹 생성 후 콜백
  factoryId?: string  // 연결 생성 시 필요
  flowConnections?: FlowConnection[]  // 기존 연결 (삭제용)
  onFlowConnectionChanged?: () => void  // 연결 생성/삭제 후 콜백
}

export function MultiSelectToolbar({
  selectedIds,
  equipment,
  onAlign,
  onClearSelection,
  onBatchUpdate,
  lineCode,
  onGroupCreated,
  factoryId,
  flowConnections = [],
  onFlowConnectionChanged,
}: MultiSelectToolbarProps) {
  const [spacing, setSpacing] = useState<string>('0')
  const [selectedZone, setSelectedZone] = useState<string>('_selection')
  const [batchW, setBatchW] = useState<string>('')
  const [batchD, setBatchD] = useState<string>('')

  // 그룹 생성 다이얼로그 상태
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState('BRIDGE')
  const [creatingGroup, setCreatingGroup] = useState(false)

  // 연결 생성 다이얼로그 상태
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
  const [connectionName, setConnectionName] = useState('')
  const [connectionColor, setConnectionColor] = useState('#ff8800')
  const [connectionLineStyle, setConnectionLineStyle] = useState('solid')
  const [connectionReversed, setConnectionReversed] = useState(false)
  const [creatingConnection, setCreatingConnection] = useState(false)

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

  // 그룹 생성 가능한 라인 코드 (props 또는 선택된 설비에서 추출)
  const effectiveLineCode = useMemo(() => {
    if (lineCode) return lineCode
    // 선택된 설비의 line_code 사용 (모두 같은 라인이어야 함)
    const lineCodes = new Set(currentEquipment.map(eq => eq.line_code).filter(Boolean))
    if (lineCodes.size === 1) {
      return Array.from(lineCodes)[0]
    }
    return null
  }, [lineCode, currentEquipment])

  // 그룹 생성 핸들러
  const handleCreateGroup = async () => {
    if (!effectiveLineCode || currentEquipment.length < 2) return

    const name = groupName.trim() || `그룹 (${currentEquipment.map(eq => eq.equipment_id.split('_').pop()).join(', ')})`

    setCreatingGroup(true)
    try {
      await createEquipmentGroup({
        line_id: effectiveLineCode,
        name,
        group_type: groupType,
        equipment_ids: currentEquipment.map(eq => eq.equipment_id),
      })
      toast.success(`그룹 "${name}" 생성 완료`)
      setGroupDialogOpen(false)
      setGroupName('')
      onGroupCreated?.()
    } catch (error) {
      console.error('Failed to create group:', error)
      toast.error('그룹 생성 실패')
    } finally {
      setCreatingGroup(false)
    }
  }

  // 선택된 2개 설비 간 기존 연결 확인
  const existingConnection = useMemo(() => {
    if (currentEquipment.length !== 2) return null
    const [a, b] = currentEquipment
    return flowConnections.find(fc =>
      (fc.source_equipment_id === a.equipment_id && fc.target_equipment_id === b.equipment_id) ||
      (fc.source_equipment_id === b.equipment_id && fc.target_equipment_id === a.equipment_id)
    ) ?? null
  }, [currentEquipment, flowConnections])

  // 연결 생성 핸들러
  const handleCreateConnection = async () => {
    if (!factoryId || currentEquipment.length !== 2) return

    const [a, b] = currentEquipment
    const sourceId = connectionReversed ? b.equipment_id : a.equipment_id
    const targetId = connectionReversed ? a.equipment_id : b.equipment_id
    const name = connectionName.trim() || `${sourceId.split('_').pop()} → ${targetId.split('_').pop()}`

    setCreatingConnection(true)
    try {
      await createFlowConnection({
        factory_id: factoryId,
        name,
        source_equipment_id: sourceId,
        target_equipment_id: targetId,
        color: connectionColor,
        line_style: connectionLineStyle,
      })
      toast.success(`연결 "${name}" 생성 완료`)
      setConnectionDialogOpen(false)
      setConnectionName('')
      setConnectionReversed(false)
      onFlowConnectionChanged?.()
    } catch (error) {
      console.error('Failed to create flow connection:', error)
      toast.error('연결 생성 실패')
    } finally {
      setCreatingConnection(false)
    }
  }

  // 연결 삭제 핸들러
  const handleDeleteConnection = async (connectionId: string) => {
    try {
      await deleteFlowConnection(connectionId)
      toast.success('연결 삭제 완료')
      onFlowConnectionChanged?.()
    } catch (error) {
      console.error('Failed to delete flow connection:', error)
      toast.error('연결 삭제 실패')
    }
  }

  // W, D 크기 일괄 적용 (로컬 상태만 업데이트)
  const handleApplySize = () => {
    if (!onBatchUpdate || currentEquipment.length === 0) return

    const updates: EquipmentUpdate = {}
    const wValue = parseFloat(batchW)
    const dValue = parseFloat(batchD)

    if (!isNaN(wValue) && batchW !== '') updates.size_w = wValue
    if (!isNaN(dValue) && batchD !== '') updates.size_d = dValue

    if (Object.keys(updates).length === 0) return

    const ids = currentEquipment.map(eq => eq.equipment_id)
    onBatchUpdate(ids, updates)
    setBatchW('')
    setBatchD('')
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

        {/* W, D 크기 일괄 적용 */}
        {onBatchUpdate && (
          <div>
            <Label className="text-xs text-muted-foreground">크기 일괄 적용 (m)</Label>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-muted-foreground w-4">W</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={batchW}
                  onChange={(e) => setBatchW(e.target.value)}
                  placeholder="너비"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-muted-foreground w-4">D</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={batchD}
                  onChange={(e) => setBatchD(e.target.value)}
                  placeholder="깊이"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              className="w-full h-8 text-xs mt-1.5"
              onClick={handleApplySize}
              disabled={(!batchW && !batchD) || currentEquipment.length === 0}
            >
              크기 적용
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">
              {currentEquipment.length}개 설비에 적용
            </p>
          </div>
        )}

        {/* 균등 배치 */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">균등 배치</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAlign('horizontal-distribute')}
              title="위치 기준 정렬"
            >
              <MoveHorizontal className="h-3 w-3 mr-1" />
              가로
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAlign('horizontal-distribute-reverse')}
              title="EQ번호 역순 정렬"
            >
              <MoveHorizontal className="h-3 w-3 mr-1" />
              가로↺
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAlign('vertical-distribute')}
              title="위치 기준 정렬"
            >
              <MoveVertical className="h-3 w-3 mr-1" />
              세로
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleAlign('vertical-distribute-reverse')}
              title="EQ번호 역순 정렬"
            >
              <MoveVertical className="h-3 w-3 mr-1" />
              세로↺
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

        {/* 그룹 생성 */}
        {effectiveLineCode && currentEquipment.length >= 2 && (
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">설비 그룹</Label>
            <Button
              variant="default"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setGroupDialogOpen(true)}
            >
              <Link2 className="h-3 w-3 mr-1" />
              그룹 생성 ({currentEquipment.length}개)
            </Button>
          </div>
        )}

        {/* 설비 연결 (Flow Connection) - 2개 선택 시 */}
        {factoryId && currentEquipment.length === 2 && (
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">설비 연결</Label>
            <div className="text-[10px] text-muted-foreground mb-1.5 font-mono">
              {currentEquipment[0].equipment_id.split('_').pop()} → {currentEquipment[1].equipment_id.split('_').pop()}
            </div>
            {existingConnection ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: existingConnection.color }}
                  />
                  <span className="truncate flex-1">{existingConnection.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteConnection(existingConnection.id)}
                    title="연결 삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setConnectionDialogOpen(true)}
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  새 연결 추가
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => setConnectionDialogOpen(true)}
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                연결 생성
              </Button>
            )}
          </div>
        )}

        {/* 선택된 설비의 기존 연결 목록 */}
        {factoryId && currentEquipment.length >= 1 && (() => {
          const selectedEqIds = new Set(currentEquipment.map(eq => eq.equipment_id))
          const relatedConnections = flowConnections.filter(fc =>
            selectedEqIds.has(fc.source_equipment_id) || selectedEqIds.has(fc.target_equipment_id)
          )
          if (relatedConnections.length === 0) return null
          return (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                기존 연결 ({relatedConnections.length})
              </Label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {relatedConnections.map(fc => (
                  <div key={fc.id} className="flex items-center gap-1.5 p-1.5 bg-muted/30 rounded text-[10px] font-mono">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: fc.color }}
                    />
                    <span className="truncate flex-1">
                      {fc.source_equipment_id.split('_').pop()} → {fc.target_equipment_id.split('_').pop()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteConnection(fc.id)}
                      title="삭제"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

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

      {/* 그룹 생성 다이얼로그 */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>설비 그룹 생성</DialogTitle>
            <DialogDescription>
              {currentEquipment.length}개 설비를 하나의 그룹으로 묶습니다.
              <br />
              <span className="text-xs">
                {currentEquipment.map(eq => eq.equipment_id.split('_').pop()).join(', ')}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">그룹 이름</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={`그룹 (${currentEquipment.map(eq => eq.equipment_id.split('_').pop()).join(', ')})`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-type">그룹 타입</Label>
              <Select value={groupType} onValueChange={setGroupType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRIDGE">브릿지 (존 연결)</SelectItem>
                  <SelectItem value="CLUSTER">클러스터 (동일 기능)</SelectItem>
                  <SelectItem value="FLOW">플로우 (공정 흐름)</SelectItem>
                  <SelectItem value="OTHER">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateGroup} disabled={creatingGroup}>
              {creatingGroup ? '생성 중...' : '그룹 생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 연결 생성 다이얼로그 */}
      <Dialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>설비 연결 생성</DialogTitle>
            <DialogDescription>
              두 설비 간 흐름 연결(화살표)을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          {currentEquipment.length === 2 && (
            <div className="space-y-4 py-4">
              {/* 방향 표시 및 반전 */}
              <div className="space-y-2">
                <Label>연결 방향</Label>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <span className="font-mono text-sm font-medium flex-1 text-right truncate">
                    {(connectionReversed ? currentEquipment[1] : currentEquipment[0]).equipment_id.split('_').pop()}
                  </span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="font-mono text-sm font-medium flex-1 truncate">
                    {(connectionReversed ? currentEquipment[0] : currentEquipment[1]).equipment_id.split('_').pop()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setConnectionReversed(!connectionReversed)}
                >
                  방향 반전
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="conn-name">연결 이름</Label>
                <Input
                  id="conn-name"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder={`${(connectionReversed ? currentEquipment[1] : currentEquipment[0]).equipment_id.split('_').pop()} → ${(connectionReversed ? currentEquipment[0] : currentEquipment[1]).equipment_id.split('_').pop()}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="conn-color">색상</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="conn-color"
                      type="color"
                      value={connectionColor}
                      onChange={(e) => setConnectionColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border"
                    />
                    <span className="font-mono text-xs text-muted-foreground">{connectionColor}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>선 스타일</Label>
                  <Select value={connectionLineStyle} onValueChange={setConnectionLineStyle}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">실선</SelectItem>
                      <SelectItem value="dashed">점선</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectionDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateConnection} disabled={creatingConnection}>
              {creatingConnection ? '생성 중...' : '연결 생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

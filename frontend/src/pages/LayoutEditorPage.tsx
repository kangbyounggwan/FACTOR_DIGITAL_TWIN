import { useState, useMemo, useCallback, useEffect } from 'react'
import { useCompanies, useCompanyFactories, useFactoryLines } from '@/hooks/useFactories'
import { useFactoryEquipment, useEquipmentGroups } from '@/hooks/useEquipment'
import { useLayouts, useActiveLayout, useLayoutMutations } from '@/hooks/useLayouts'
import { Company, Factory, ProductionLine, Equipment, EquipmentUpdate, LayoutEquipmentCreate, updateEquipmentBatch, EquipmentBatchUpdate, fetchLayout } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, RefreshCw, ChevronRight, ChevronDown, Save, RotateCcw, Plus, Grid3X3, Image, ImageOff, AlignHorizontalJustifyCenter } from 'lucide-react'
import { cn } from '@/lib/utils'
import LayoutCanvas, { FloorBounds } from '@/components/LayoutCanvas'
import EquipmentList from '@/components/EquipmentList'
import RegPanel from '@/components/RegPanel'
import { LayoutSelector } from '@/components/LayoutSelector'
import { SaveLayoutDialog } from '@/components/SaveLayoutDialog'
import { AlignmentOption, calculateAlignedPositions } from '@/components/AlignmentDialog'
import { MultiSelectToolbar } from '@/components/MultiSelectToolbar'
import { toast } from 'sonner'
import { SelectionState } from '@/App'

interface Props {
  selection: SelectionState
  onSelectCompany: (company: Company | null) => void
  onSelectFactory: (factory: Factory | null) => void
  onSelectLine: (line: ProductionLine | null) => void
}

export default function LayoutEditorPage({ selection, onSelectCompany, onSelectFactory, onSelectLine }: Props) {
  const { companies, loading: companiesLoading, reload: reloadCompanies } = useCompanies()
  const { factories, loading: factoriesLoading } = useCompanyFactories(selection.company?.code ?? null)
  const { lines, loading: linesLoading } = useFactoryLines(selection.factory?.code ?? null)

  // Aliases for easier access
  const selectedCompany = selection.company
  const selectedFactory = selection.factory
  const selectedLine = selection.line

  // 설비 데이터
  const { equipment, stats, loading: equipmentLoading, selected, setSelected, save, reload: reloadEquipment } = useFactoryEquipment(
    selectedFactory?.code ?? ''
  )

  // Equipment groups (라인 선택 시 라인별, 전체 보기 시 공장 전체)
  const { groups, reload: reloadGroups } = useEquipmentGroups(selectedLine?.code ?? null, selectedFactory?.code ?? null)
  const [selectedGroup, setSelectedGroup] = useState<import('@/lib/api').EquipmentGroup | null>(null)

  // 레이아웃 데이터
  const { layouts, loading: layoutsLoading, reload: reloadLayouts } = useLayouts(selectedFactory?.id ?? null)
  const { layout: activeLayout, reload: reloadActiveLayout } = useActiveLayout(selectedFactory?.id ?? null)
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null)
  const { saveFromViewer, updateEquipment: updateLayoutEquipment, update: updateLayoutMeta, saving: savingLayout } = useLayoutMutations()

  // 로컬 위치/크기 변경 상태 (저장 전)
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [localSizes, setLocalSizes] = useState<Record<string, { w: number; d: number }>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  // 공장 바닥 설정
  const [floorBounds, setFloorBounds] = useState<FloorBounds | null>(null)
  const [showFloorSettings, setShowFloorSettings] = useState(false)
  const [hasFloorChanges, setHasFloorChanges] = useState(false)

  // 배경 이미지 설정
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [showBackgroundImage, setShowBackgroundImage] = useState(true)
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.5)
  const [hasBackgroundChanges, setHasBackgroundChanges] = useState(false)

  // RegPanel 변경사항 추적 및 확인 다이얼로그
  const [regPanelHasChanges, setRegPanelHasChanges] = useState(false)
  const [pendingDeselect, setPendingDeselect] = useState<Equipment | null | 'deselect'>(null)

  // 다중 선택 상태
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([])

  // 바닥 설정 변경 핸들러 (변경사항 추적)
  const updateFloorBounds = useCallback((updater: (prev: FloorBounds | null) => FloorBounds | null) => {
    setFloorBounds(updater)
    setHasFloorChanges(true)
  }, [])

  // 배경 이미지 업로드 핸들러
  const handleBackgroundImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setBackgroundImage(dataUrl)
      setShowBackgroundImage(true)
      setHasBackgroundChanges(true)
      toast.success('배경 이미지 업로드 완료')
    }
    reader.readAsDataURL(file)
  }, [])

  // 설비 선택 핸들러 (RegPanel 변경사항 확인)
  const handleSelectEquipment = useCallback((eq: Equipment | null) => {
    // 현재 선택된 설비가 있고 변경사항이 있으면 확인
    if (selected && regPanelHasChanges && eq?.equipment_id !== selected.equipment_id) {
      setPendingDeselect(eq === null ? 'deselect' : eq)
      return
    }
    setSelected(eq)
  }, [selected, regPanelHasChanges, setSelected])

  // 활성 레이아웃이 로드되면 자동 선택 (위치/크기는 항상 DB 최신값 사용)
  useEffect(() => {
    if (activeLayout && !selectedLayoutId) {
      setSelectedLayoutId(activeLayout.id)
      // 위치/크기는 로드하지 않음 - 항상 최신 equipment_scans 데이터 사용
      // 바닥 정보 로드
      if (activeLayout.floor_x != null && activeLayout.floor_width != null) {
        setFloorBounds({
          x: activeLayout.floor_x,
          y: activeLayout.floor_y ?? 0,
          width: activeLayout.floor_width,
          height: activeLayout.floor_height ?? 0,
        })
      }
      // 배경 이미지 로드
      if (activeLayout.background_image) {
        setBackgroundImage(activeLayout.background_image)
        setBackgroundOpacity(activeLayout.background_opacity ?? 0.5)
        setShowBackgroundImage(true)
      }
    }
  }, [activeLayout, selectedLayoutId])

  // 선택된 라인 설비 필터링
  const filteredEquipment = useMemo(() => {
    if (!selectedLine) return equipment
    return equipment.filter(e => e.line_code === selectedLine.code)
  }, [equipment, selectedLine])

  // 로컬 위치/크기가 적용된 설비 데이터
  const equipmentWithLocalPositions = useMemo(() => {
    return filteredEquipment.map(eq => {
      const localPos = localPositions[eq.equipment_id]
      const localSize = localSizes[eq.equipment_id]
      let result = eq
      if (localPos) {
        // 2D 레이아웃에서 y는 실제 3D의 z좌표
        result = { ...result, centroid_x: localPos.x, centroid_z: localPos.y }
      }
      if (localSize) {
        result = { ...result, size_w: localSize.w, size_d: localSize.d }
      }
      return result
    })
  }, [filteredEquipment, localPositions, localSizes])

  // 라인 코드 -> 라인 이름 매핑
  const lineMap = useMemo(() => {
    const map: Record<string, string> = {}
    lines.forEach(line => {
      map[line.code] = line.name
    })
    return map
  }, [lines])

  // 선택된 설비에 로컬 변경사항 적용
  const selectedWithLocalChanges = useMemo(() => {
    if (!selected) return null
    const localPos = localPositions[selected.equipment_id]
    const localSize = localSizes[selected.equipment_id]
    let result = selected
    if (localPos) {
      // 2D 레이아웃에서 y는 실제 3D의 z좌표
      result = { ...result, centroid_x: localPos.x, centroid_z: localPos.y }
    }
    if (localSize) {
      result = { ...result, size_w: localSize.w, size_d: localSize.d }
    }
    return result
  }, [selected, localPositions, localSizes])

  // 위치 업데이트 핸들러
  const handleUpdatePosition = useCallback((equipmentId: string, x: number, y: number) => {
    setLocalPositions(prev => ({
      ...prev,
      [equipmentId]: { x, y }
    }))
    setHasChanges(true)
  }, [])

  // 크기 업데이트 핸들러
  const handleUpdateSize = useCallback((equipmentId: string, w: number, d: number) => {
    setLocalSizes(prev => ({
      ...prev,
      [equipmentId]: { w, d }
    }))
    setHasChanges(true)
  }, [])

  // 다중 선택 해제 핸들러
  const handleClearMultiSelection = useCallback(() => {
    setMultiSelectedIds([])
  }, [])

  // 다중 선택 핸들러
  const handleMultiSelect = useCallback((ids: string[]) => {
    setMultiSelectedIds(ids)
  }, [])

  // 다중 선택된 설비 일괄 이동
  const handleMoveMultiple = useCallback((ids: string[], dx: number, dy: number) => {
    setLocalPositions(prev => {
      const newPositions = { ...prev }
      for (const id of ids) {
        const eq = equipmentWithLocalPositions.find(e => e.equipment_id === id)
        if (eq) {
          const currentX = newPositions[id]?.x ?? eq.centroid_x
          const currentY = newPositions[id]?.y ?? eq.centroid_z
          newPositions[id] = {
            x: Math.round((currentX + dx) * 100) / 100,
            y: Math.round((currentY + dy) * 100) / 100,
          }
        }
      }
      return newPositions
    })
    setHasChanges(true)
  }, [equipmentWithLocalPositions])

  // 정렬 적용 핸들러
  const handleAlignment = useCallback((
    option: AlignmentOption,
    eqList: Equipment[],
    bounds: { x: number; y: number; width: number; height: number },
    spacing?: number
  ) => {
    if (eqList.length === 0) return

    const alignedPositions = calculateAlignedPositions(eqList, option, bounds, spacing)

    // 로컬 위치 업데이트
    setLocalPositions(prev => ({
      ...prev,
      ...alignedPositions,
    }))
    setHasChanges(true)

    toast.success(`${eqList.length}개 설비 정렬 완료`)
  }, [])

  // 다중 선택 설비 크기 일괄 업데이트 핸들러 (로컬 상태만 업데이트, 저장 버튼 시 실제 저장)
  const handleBatchUpdate = useCallback((equipmentIds: string[], updates: EquipmentUpdate) => {
    if (updates.size_w !== undefined || updates.size_d !== undefined) {
      setLocalSizes(prev => {
        const newSizes = { ...prev }
        for (const id of equipmentIds) {
          const eq = equipment.find(e => e.equipment_id === id)
          if (eq) {
            const currentW = newSizes[id]?.w ?? eq.size_w
            const currentD = newSizes[id]?.d ?? eq.size_d
            newSizes[id] = {
              w: updates.size_w ?? currentW,
              d: updates.size_d ?? currentD,
            }
          }
        }
        return newSizes
      })
      setHasChanges(true)
      toast.success(`${equipmentIds.length}개 설비 크기 변경 (저장 필요)`)
    }
  }, [equipment])

  // 현재 설비 위치를 레이아웃 형식으로 반환 (소수점 2자리)
  const getCurrentEquipmentForLayout = useCallback((): LayoutEquipmentCreate[] => {
    const round2 = (n: number) => Math.round(n * 100) / 100
    return equipmentWithLocalPositions.map(eq => ({
      equipment_id: eq.equipment_id,
      centroid_x: round2(eq.centroid_x),
      centroid_y: round2(eq.centroid_y),
      centroid_z: round2(eq.centroid_z),
      size_w: round2(eq.size_w),
      size_h: round2(eq.size_h),
      size_d: round2(eq.size_d),
      rotation_x: 0,
      rotation_y: 0,
      rotation_z: 0,
    }))
  }, [equipmentWithLocalPositions])

  // 변경사항 저장 (설비 원본 데이터에 저장) - 비동기 처리
  const handleSaveAll = useCallback(() => {
    if (!selectedFactory) return

    // 저장할 데이터 캡처
    const positionsToSave = { ...localPositions }
    const sizesToSave = { ...localSizes }
    const layoutId = selectedLayoutId || activeLayout?.id
    const equipmentData = getCurrentEquipmentForLayout()
    const floorData = floorBounds ? { ...floorBounds } : null
    const bgImage = backgroundImage
    const bgOpacity = backgroundOpacity

    // 즉시 로컬 상태 초기화 (UI 반응성)
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    setHasFloorChanges(false)
    setHasBackgroundChanges(false)

    // 비동기 저장 시작
    const saveAsync = async () => {
      // 소수점 2자리 반올림
      const round2 = (n: number) => Math.round(n * 100) / 100

      // 위치/크기 변경을 하나의 배치 업데이트로 합침
      const batchUpdates: EquipmentBatchUpdate[] = []
      const equipmentIdsToUpdate = new Set([
        ...Object.keys(positionsToSave),
        ...Object.keys(sizesToSave),
      ])

      for (const equipmentId of equipmentIdsToUpdate) {
        const pos = positionsToSave[equipmentId]
        const size = sizesToSave[equipmentId]
        const update: EquipmentBatchUpdate = { equipment_id: equipmentId }

        if (pos) {
          update.centroid_x = round2(pos.x)
          update.centroid_z = round2(pos.y)  // 2D의 y는 3D의 z
        }
        if (size) {
          update.size_w = round2(size.w)
          update.size_d = round2(size.d)
        }

        batchUpdates.push(update)
      }

      // 한 번의 API 호출로 모든 설비 업데이트
      if (batchUpdates.length > 0) {
        await updateEquipmentBatch(batchUpdates)
      }

      // 레이아웃에도 저장 (선택적)
      if (layoutId) {
        if (equipmentData.length > 0) {
          await updateLayoutEquipment(layoutId, equipmentData)
        }
        // 바닥 정보 및 배경 이미지도 저장
        await updateLayoutMeta(layoutId, {
          floor_x: floorData?.x ?? null,
          floor_y: floorData?.y ?? null,
          floor_width: floorData?.width ?? null,
          floor_height: floorData?.height ?? null,
          background_image: bgImage ?? null,
          background_opacity: bgOpacity,
        })
      }

      // 설비 데이터 새로고침 (silent: 깜빡임 방지)
      await reloadEquipment(true)
    }

    // toast.promise로 비동기 작업 표시
    toast.promise(saveAsync(), {
      loading: '저장 중...',
      success: '저장 완료',
      error: '저장 실패',
    })
  }, [
    selectedFactory,
    selectedLayoutId,
    activeLayout,
    localPositions,
    localSizes,
    floorBounds,
    backgroundImage,
    backgroundOpacity,
    getCurrentEquipmentForLayout,
    updateLayoutEquipment,
    updateLayoutMeta,
    reloadEquipment,
  ])

  // 변경사항 초기화
  const handleResetChanges = useCallback(() => {
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    setHasFloorChanges(false)
    setHasBackgroundChanges(false)
  }, [])

  // 레이아웃 선택 핸들러
  const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
    setSelectedLayoutId(layoutId)

    if (!layoutId) {
      setLocalPositions({})
      setLocalSizes({})
      setHasChanges(false)
      setHasFloorChanges(false)
      setHasBackgroundChanges(false)
      return
    }

    try {
      const layoutDetail = await fetchLayout(layoutId)

      if (layoutDetail?.equipment && layoutDetail.equipment.length > 0) {
        const newPositions: Record<string, { x: number; y: number }> = {}
        const newSizes: Record<string, { w: number; d: number }> = {}

        for (const eq of layoutDetail.equipment) {
          // 2D 레이아웃에서 y는 3D의 z좌표
          newPositions[eq.equipment_id] = {
            x: eq.centroid_x,
            y: eq.centroid_z,
          }
          newSizes[eq.equipment_id] = {
            w: eq.size_w,
            d: eq.size_d,
          }
        }

        setLocalPositions(newPositions)
        setLocalSizes(newSizes)
        setHasChanges(false)
        setHasFloorChanges(false)
        setHasBackgroundChanges(false)
        toast.success(`레이아웃 로드 완료 (${layoutDetail.equipment.length}개 설비)`)
      } else {
        toast.warning('레이아웃에 설비 데이터가 없습니다')
      }

      // 바닥 정보 로드
      if (layoutDetail?.floor_x != null && layoutDetail?.floor_width != null) {
        setFloorBounds({
          x: layoutDetail.floor_x,
          y: layoutDetail.floor_y ?? 0,
          width: layoutDetail.floor_width,
          height: layoutDetail.floor_height ?? 0,
        })
      } else {
        setFloorBounds(null)
      }

      // 배경 이미지 로드
      if (layoutDetail?.background_image) {
        setBackgroundImage(layoutDetail.background_image)
        setBackgroundOpacity(layoutDetail.background_opacity ?? 0.5)
        setShowBackgroundImage(true)
      } else {
        setBackgroundImage(null)
        setShowBackgroundImage(false)
      }
    } catch (error) {
      console.error('[Layout] Failed to load layout:', error)
      toast.error('레이아웃 로드 실패')
    }
  }, [equipment])

  // 레이아웃 활성화 핸들러
  const handleLayoutActivate = useCallback((layoutId: string) => {
    reloadActiveLayout()
    reloadLayouts()
    toast.success('레이아웃이 활성화되었습니다')
  }, [reloadActiveLayout, reloadLayouts])

  // 레이아웃 삭제 핸들러
  const handleLayoutDelete = useCallback((layoutId: string) => {
    reloadLayouts()
    toast.success('레이아웃이 삭제되었습니다')
  }, [reloadLayouts])

  const handleSelectCompany = (company: Company) => {
    onSelectCompany(company)
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    setHasFloorChanges(false)
    setHasBackgroundChanges(false)
  }

  const handleSelectFactory = (factory: Factory) => {
    onSelectFactory(factory)
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    setHasFloorChanges(false)
    setHasBackgroundChanges(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 회사 목록 패널 */}
      <div className="w-48 flex-shrink-0 border-r flex flex-col bg-muted/30">
        <div className="flex items-center justify-between px-4 h-11 border-b bg-card">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            회사
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={reloadCompanies}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {companiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              등록된 회사가 없습니다
            </div>
          ) : (
            <div className="py-1">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleSelectCompany(company)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group',
                    selectedCompany?.id === company.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <p className="font-medium text-sm truncate">{company.name}</p>
                  <ChevronRight className={cn(
                    'h-4 w-4 flex-shrink-0 ml-2',
                    selectedCompany?.id === company.id
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                  )} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 공장/라인 목록 패널 */}
      <div className={cn(
        'flex-shrink-0 border-r flex flex-col transition-all duration-300 bg-muted/20',
        selectedCompany ? 'w-56' : 'w-0 overflow-hidden'
      )}>
        <div className="flex items-center px-4 h-11 border-b bg-card">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground truncate">
            공장 / 라인
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {factoriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : factories.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              등록된 공장이 없습니다
            </div>
          ) : (
            <div className="py-1">
              {factories.map((factory) => (
                <div key={factory.id}>
                  <button
                    onClick={() => handleSelectFactory(factory)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between group',
                      selectedFactory?.id === factory.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <p className="font-medium text-sm truncate">{factory.name}</p>
                    {selectedFactory?.id === factory.id ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2 text-primary-foreground/70" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 ml-2 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                  </button>

                  {selectedFactory?.id === factory.id && (
                    <div className="ml-4 border-l border-border">
                      <button
                        onClick={() => onSelectLine(null)}
                        className={cn(
                          'w-full text-left px-4 py-2 text-sm transition-colors',
                          !selectedLine
                            ? 'bg-accent/50 text-accent-foreground'
                            : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span className="font-medium">전체 보기</span>
                      </button>

                      {linesLoading ? (
                        <div className="py-3 px-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : lines.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-3 px-4">라인 없음</p>
                      ) : (
                        lines.map((line) => (
                          <button
                            key={line.id}
                            onClick={() => onSelectLine(line)}
                            className={cn(
                              'w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between',
                              selectedLine?.id === line.id
                                ? 'bg-accent/50 text-accent-foreground'
                                : 'hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <span className="truncate">{line.name}</span>
                            <span className="text-xs font-mono text-muted-foreground ml-2">
                              {line.equipment_count}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2D 캔버스 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {!selectedFactory ? (
          <div className="flex-1 flex items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">
              {!selectedCompany ? '회사를 선택하세요' : '공장을 선택하세요'}
            </p>
          </div>
        ) : equipmentLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Equipment List */}
            <EquipmentList
              equipment={equipmentWithLocalPositions}
              selectedId={selected?.equipment_id ?? null}
              onSelect={handleSelectEquipment}
              lineMap={lineMap}
              groups={groups}
              selectedGroupId={selectedGroup?.id ?? null}
              onSelectGroup={setSelectedGroup}
            />

            {/* 2D Canvas */}
            <div className="flex-1 relative overflow-hidden">
              <LayoutCanvas
                equipment={equipmentWithLocalPositions}
                selectedId={selected?.equipment_id ?? null}
                onSelect={handleSelectEquipment}
                onUpdatePosition={handleUpdatePosition}
                onUpdateSize={handleUpdateSize}
                floorBounds={floorBounds}
                backgroundImage={backgroundImage}
                showBackgroundImage={showBackgroundImage}
                backgroundOpacity={backgroundOpacity}
                multiSelectedIds={multiSelectedIds}
                onMultiSelect={handleMultiSelect}
                onMoveMultiple={handleMoveMultiple}
                groups={groups}
                selectedGroupId={selectedGroup?.id ?? null}
                onSelectGroup={setSelectedGroup}
              />

              {/* 상단 툴바 - 단일 행 */}
              <div className="absolute top-3 left-3 right-3 flex items-center gap-3 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-sm">
                {/* 바닥 설정 버튼 */}
                <Button
                  variant={floorBounds ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFloorSettings(!showFloorSettings)}
                  className="text-xs h-7"
                  title="공장 바닥 설정"
                >
                  <Grid3X3 className="h-3.5 w-3.5 mr-1" />
                  바닥
                </Button>

                {/* 배경 이미지 버튼들 */}
                <div className="flex items-center gap-1">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBackgroundImageUpload}
                    />
                    <Button
                      variant={backgroundImage ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7 pointer-events-none"
                      title="배경 이미지 업로드"
                      asChild
                    >
                      <span>
                        <Image className="h-3.5 w-3.5 mr-1" />
                        배경
                      </span>
                    </Button>
                  </label>
                  {backgroundImage && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowBackgroundImage(!showBackgroundImage)}
                        title={showBackgroundImage ? "배경 숨기기" : "배경 보이기"}
                      >
                        {showBackgroundImage ? (
                          <ImageOff className="h-3.5 w-3.5" />
                        ) : (
                          <Image className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={backgroundOpacity * 100}
                        onChange={(e) => {
                          setBackgroundOpacity(parseInt(e.target.value) / 100)
                          setHasBackgroundChanges(true)
                        }}
                        className="w-16 h-1 accent-primary"
                        title={`투명도: ${Math.round(backgroundOpacity * 100)}%`}
                      />
                    </>
                  )}
                </div>

                {/* 레이아웃 셀렉터 */}
                {selectedFactory && (
                  <LayoutSelector
                    factoryId={selectedFactory.id}
                    selectedLayoutId={selectedLayoutId}
                    onLayoutSelect={handleLayoutSelect}
                    onLayoutActivate={handleLayoutActivate}
                    onLayoutDelete={handleLayoutDelete}
                    getCurrentEquipment={getCurrentEquipmentForLayout}
                  />
                )}

                {/* 스페이서 */}
                <div className="flex-1" />

                {/* 오른쪽: 저장 버튼들 */}
                {(hasChanges || hasFloorChanges || hasBackgroundChanges) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetChanges}
                    className="text-xs h-7"
                    disabled={savingLayout}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    초기화
                  </Button>
                )}

                {/* 새 레이아웃 생성 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  className="text-xs h-7"
                  disabled={savingLayout}
                  title="새 레이아웃으로 저장"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  새 레이아웃
                </Button>

                {/* 저장 버튼 (선택된 레이아웃이 있을 때만) */}
                {(selectedLayoutId || activeLayout) && (
                  <Button
                    size="sm"
                    onClick={handleSaveAll}
                    className="text-xs h-7"
                    disabled={savingLayout || (!hasChanges && !hasFloorChanges && !hasBackgroundChanges)}
                  >
                    {savingLayout ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1" />
                    )}
                    저장
                    {hasChanges && ` (${new Set([...Object.keys(localPositions), ...Object.keys(localSizes)]).size})`}
                  </Button>
                )}
              </div>

              {/* 바닥 설정 패널 */}
              {showFloorSettings && (
                <div className="absolute top-14 left-3 bg-card/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg z-20 w-64">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-medium">공장 바닥 설정</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setShowFloorSettings(false)}
                    >
                      ×
                    </Button>
                  </div>

                  {/* 바닥 활성화 토글 */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="floor-enabled"
                      checked={!!floorBounds}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // 기본값: 설비 기준으로 계산
                          const minX = Math.min(...equipment.map(eq => eq.centroid_x - eq.size_w / 2))
                          const maxX = Math.max(...equipment.map(eq => eq.centroid_x + eq.size_w / 2))
                          const minZ = Math.min(...equipment.map(eq => eq.centroid_z - eq.size_d / 2))
                          const maxZ = Math.max(...equipment.map(eq => eq.centroid_z + eq.size_d / 2))
                          const padding = 2
                          setFloorBounds({
                            x: Math.floor(minX - padding),
                            y: Math.floor(minZ - padding),
                            width: Math.ceil(maxX - minX + padding * 2),
                            height: Math.ceil(maxZ - minZ + padding * 2),
                          })
                        } else {
                          setFloorBounds(null)
                        }
                        setHasFloorChanges(true)
                      }}
                      className="rounded"
                    />
                    <label htmlFor="floor-enabled" className="text-xs">바닥 표시</label>
                  </div>

                  {floorBounds && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground mb-1">바닥 평면 (X-Y), 높이는 Z축</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">X (m)</label>
                          <input
                            type="number"
                            value={floorBounds.x}
                            onChange={(e) => updateFloorBounds(prev => prev ? { ...prev, x: parseFloat(e.target.value) || 0 } : null)}
                            className="w-full bg-background border rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Y (m)</label>
                          <input
                            type="number"
                            value={floorBounds.y}
                            onChange={(e) => updateFloorBounds(prev => prev ? { ...prev, y: parseFloat(e.target.value) || 0 } : null)}
                            className="w-full bg-background border rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">너비 (m)</label>
                          <input
                            type="number"
                            min="1"
                            value={floorBounds.width}
                            onChange={(e) => updateFloorBounds(prev => prev ? { ...prev, width: parseFloat(e.target.value) || 1 } : null)}
                            className="w-full bg-background border rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">길이 (m)</label>
                          <input
                            type="number"
                            min="1"
                            value={floorBounds.height}
                            onChange={(e) => updateFloorBounds(prev => prev ? { ...prev, height: parseFloat(e.target.value) || 1 } : null)}
                            className="w-full bg-background border rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="pt-2 border-t flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 flex-1"
                          onClick={() => {
                            // 설비 기준으로 자동 계산
                            const minX = Math.min(...equipment.map(eq => eq.centroid_x - eq.size_w / 2))
                            const maxX = Math.max(...equipment.map(eq => eq.centroid_x + eq.size_w / 2))
                            const minZ = Math.min(...equipment.map(eq => eq.centroid_z - eq.size_d / 2))
                            const maxZ = Math.max(...equipment.map(eq => eq.centroid_z + eq.size_d / 2))
                            const padding = 2
                            setFloorBounds({
                              x: Math.floor(minX - padding),
                              y: Math.floor(minZ - padding),
                              width: Math.ceil(maxX - minX + padding * 2),
                              height: Math.ceil(maxZ - minZ + padding * 2),
                            })
                            setHasFloorChanges(true)
                          }}
                        >
                          자동 맞춤
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 공장/라인 정보 - 좌측 하단 */}
              <div className="absolute bottom-4 left-4 pointer-events-none">
                <Badge variant="secondary" className="font-mono text-xs bg-card/90 backdrop-blur-sm">
                  {selectedFactory.name}{selectedLine ? ` / ${selectedLine.name}` : ' (전체)'}
                </Badge>
              </div>

              {/* Stats */}
              {stats && (
                <div className="absolute bottom-4 right-4 flex gap-1.5 pointer-events-none">
                  {[
                    { label: '전체', val: stats.total, color: 'text-foreground' },
                    { label: '완료', val: stats.verified, color: 'text-success' },
                    { label: '대기', val: stats.pending, color: 'text-warning' },
                  ].map(s => (
                    <Card key={s.label} className="px-2.5 py-1.5 bg-card/90 backdrop-blur-sm min-w-[52px]">
                      <p className={cn('font-mono text-base font-semibold tabular-nums text-center', s.color)}>
                        {s.val}
                      </p>
                      <p className="font-mono text-[9px] text-muted-foreground uppercase text-center">
                        {s.label}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Registration Panel (단일 선택) */}
            {selectedWithLocalChanges && multiSelectedIds.length === 0 && (
              <RegPanel
                equipment={selectedWithLocalChanges}
                lineName={selectedWithLocalChanges.line_code ? lineMap[selectedWithLocalChanges.line_code] : undefined}
                onSave={async (id, body) => {
                  await save(id, body)
                  setSelected(prev => prev ? { ...prev, ...body } : null)
                  setRegPanelHasChanges(false)
                }}
                onClose={() => {
                  setSelected(null)
                  setRegPanelHasChanges(false)
                }}
                onUpdatePosition={handleUpdatePosition}
                onUpdateSize={handleUpdateSize}
                onChangeStatus={setRegPanelHasChanges}
              />
            )}

            {/* Multi Select Toolbar (다중 선택) */}
            {multiSelectedIds.length > 0 && (
              <MultiSelectToolbar
                selectedIds={multiSelectedIds}
                equipment={equipmentWithLocalPositions}
                onAlign={handleAlignment}
                onClearSelection={handleClearMultiSelection}
                onBatchUpdate={handleBatchUpdate}
                lineCode={selectedLine?.code}
                onGroupCreated={() => {
                  reloadEquipment(true)
                  reloadGroups()
                }}
              />
            )}

            {/* Save Layout Dialog */}
            {selectedFactory && (
              <SaveLayoutDialog
                open={saveDialogOpen}
                onOpenChange={setSaveDialogOpen}
                factoryId={selectedFactory.id}
                getCurrentEquipment={getCurrentEquipmentForLayout}
                floorBounds={floorBounds}
                backgroundImage={backgroundImage}
                backgroundOpacity={backgroundOpacity}
                onSaved={(newLayout) => {
                  reloadLayouts()
                  setSelectedLayoutId(newLayout.id)
                  setLocalPositions({})
                  setLocalSizes({})
                  setHasChanges(false)
                  setHasFloorChanges(false)
                  setHasBackgroundChanges(false)
                }}
              />
            )}

            {/* RegPanel 변경사항 확인 다이얼로그 */}
            <AlertDialog open={pendingDeselect !== null} onOpenChange={(open) => !open && setPendingDeselect(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>설비 설정 변경사항</AlertDialogTitle>
                  <AlertDialogDescription>
                    현재 설비 설정에 저장되지 않은 변경사항이 있습니다. 저장하지 않고 다른 설비를 선택하시겠습니까?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const nextEquipment = pendingDeselect === 'deselect' ? null : pendingDeselect
                      setSelected(nextEquipment)
                      setRegPanelHasChanges(false)
                      setPendingDeselect(null)
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    저장 없이 이동
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  )
}

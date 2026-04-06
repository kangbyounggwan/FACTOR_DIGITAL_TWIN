import { useEffect, useState, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Equipment, EquipmentUpdate, fetchEquipmentTypes, ensureEquipmentType } from '@/lib/api'
import { CONV_ROLE_COLORS } from '@/lib/colors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { X, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Fallback types when API is not available
const FALLBACK_TYPES = [
  'SMT_LINE', 'REFLOW_OVEN', 'AOI_MACHINE', 'SCREEN_PRINTER',
  'PICK_AND_PLACE', 'CONVEYOR', 'CONTROL_PANEL', 'STORAGE_RACK', 'UNKNOWN',
]

interface Props {
  equipment: Equipment | null
  onSave: (id: string, body: EquipmentUpdate) => Promise<void>
  onClose: () => void
  /** Production line name from lineMap */
  lineName?: string
  /** Real-time position update (X, Y in 2D = centroid_x, centroid_z) */
  onUpdatePosition?: (equipmentId: string, x: number, y: number) => void
  /** Real-time size update (W, D = size_w, size_d) */
  onUpdateSize?: (equipmentId: string, w: number, d: number) => void
  /** Notify parent when change status changes */
  onChangeStatus?: (hasChanges: boolean) => void
}

export default function RegPanel({ equipment: eq, onSave, onClose, lineName, onUpdatePosition, onUpdateSize, onChangeStatus }: Props) {
  const [type, setType] = useState('')
  const [typeInput, setTypeInput] = useState('')
  const [typeOpen, setTypeOpen] = useState(false)
  const [zone, setZone] = useState('')
  const [verified, setVerified] = useState(false)
  const [note, setNote] = useState('')
  const [subType, setSubType] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const typeInputRef = useRef<HTMLInputElement>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  // Editable position and size (문자열로 관리하여 자유로운 입력 허용)
  const [centroidX, setCentroidX] = useState('')
  const [centroidY, setCentroidY] = useState('')
  const [centroidZ, setCentroidZ] = useState('')
  const [sizeW, setSizeW] = useState('')
  const [sizeD, setSizeD] = useState('')
  const [sizeH, setSizeH] = useState('')

  // 입력 중인 필드 추적 (입력 중에는 외부 업데이트 무시)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // 변경사항 추적 (소수점 2자리 기준)
  const changeCount = useMemo(() => {
    if (!eq) return 0
    let count = 0
    if (type !== eq.equipment_type) count++
    if (zone !== (eq.zone ?? '')) count++
    if (verified !== eq.verified) count++
    if (note !== (eq.note ?? '')) count++
    if ((subType ?? null) !== (eq.sub_type ?? null)) count++
    // 소수점 2자리 기준 비교
    const round2 = (n: number) => Math.round(n * 100) / 100
    if (round2(parseFloat(centroidX) || 0) !== round2(eq.centroid_x)) count++
    if (round2(parseFloat(centroidY) || 0) !== round2(eq.centroid_y)) count++
    if (round2(parseFloat(centroidZ) || 0) !== round2(eq.centroid_z)) count++
    if (round2(parseFloat(sizeW) || 0) !== round2(eq.size_w)) count++
    if (round2(parseFloat(sizeD) || 0) !== round2(eq.size_d)) count++
    if (round2(parseFloat(sizeH) || 0) !== round2(eq.size_h)) count++
    return count
  }, [eq, type, zone, verified, note, subType, centroidX, centroidY, centroidZ, sizeW, sizeD, sizeH])

  const hasChanges = changeCount > 0

  // 변경 상태를 부모에게 알림
  useEffect(() => {
    onChangeStatus?.(hasChanges)
  }, [hasChanges, onChangeStatus])

  // 닫기 시도 핸들러
  const handleCloseAttempt = () => {
    if (hasChanges) {
      setShowCloseConfirm(true)
    } else {
      onClose()
    }
  }

  // Fetch equipment types from API
  const { data: equipmentTypes } = useQuery({
    queryKey: ['equipment-types'],
    queryFn: fetchEquipmentTypes,
    staleTime: 5 * 60 * 1000,
  })

  // Available types (from API or fallback)
  const availableTypes = equipmentTypes?.map(t => t.code) ?? FALLBACK_TYPES

  // 설비 변경 시 전체 상태 초기화
  useEffect(() => {
    if (!eq) return
    setType(eq.equipment_type)
    setTypeInput(eq.equipment_type)
    setZone(eq.zone ?? '')
    setVerified(eq.verified)
    setNote(eq.note ?? '')
    setSubType(eq.sub_type ?? null)
  }, [eq?.equipment_id])

  // 위치/크기 실시간 업데이트 (드래그 시 반영) - 입력 중인 필드는 제외
  // 소수점 2자리까지 표시
  useEffect(() => {
    if (!eq) return
    const fmt = (n: number) => n.toFixed(2)
    if (focusedField !== 'centroidX') setCentroidX(fmt(eq.centroid_x))
    if (focusedField !== 'centroidY') setCentroidY(fmt(eq.centroid_y))
    if (focusedField !== 'centroidZ') setCentroidZ(fmt(eq.centroid_z))
    if (focusedField !== 'sizeW') setSizeW(fmt(eq.size_w))
    if (focusedField !== 'sizeD') setSizeD(fmt(eq.size_d))
    if (focusedField !== 'sizeH') setSizeH(fmt(eq.size_h))
  }, [eq?.equipment_id, eq?.centroid_x, eq?.centroid_y, eq?.centroid_z, eq?.size_w, eq?.size_d, eq?.size_h, focusedField])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (typeInputRef.current && !typeInputRef.current.parentElement?.contains(e.target as Node)) {
        setTypeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!eq) return null

  const shortNum = eq.equipment_id.split('_').pop()

  const handleTypeSelect = (selectedType: string) => {
    setType(selectedType)
    setTypeInput(selectedType)
    setTypeOpen(false)
  }

  const handleTypeInputChange = (value: string) => {
    setTypeInput(value)
    // Convert to uppercase and replace spaces with underscores for code format
    const codeFormat = value.toUpperCase().replace(/\s+/g, '_')
    setType(codeFormat)
    setTypeOpen(true)
  }

  function handleSave() {
    if (!eq) return
    if (!type.trim()) {
      toast.error('설비 타입을 입력해주세요')
      return
    }

    // 소수점 2자리 반올림
    const round2 = (n: number) => Math.round(n * 100) / 100

    // 저장할 데이터 캡처 (비동기 실행 전)
    const saveData = {
      equipment_id: eq.equipment_id,
      equipment_type: type,
      zone,
      verified,
      note,
      sub_type: subType ?? '',
      centroid_x: round2(parseFloat(centroidX) || 0),
      centroid_y: round2(parseFloat(centroidY) || 0),
      centroid_z: round2(parseFloat(centroidZ) || 0),
      size_w: round2(parseFloat(sizeW) || 0.1),
      size_d: round2(parseFloat(sizeD) || 0.1),
      size_h: round2(parseFloat(sizeH) || 0.1),
    }
    const needNewType = !availableTypes.includes(type)
    const typeToCreate = type

    // 비동기 저장 시작 (UI 비차단)
    setSaving(true)
    const saveAsync = async () => {
      try {
        if (needNewType) {
          await ensureEquipmentType(typeToCreate)
        }
        const { equipment_id, ...body } = saveData
        await onSave(equipment_id, body)
      } finally {
        setSaving(false)
      }
    }

    toast.promise(saveAsync(), {
      loading: '설비 저장 중...',
      success: '설비 저장 완료',
      error: '설비 저장 실패',
    })
  }

  return (
    <aside className="w-80 flex-shrink-0 border-l bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b flex-shrink-0">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-2">설비 등록</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-base font-medium text-foreground">EQ_{shortNum}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCloseAttempt}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <p className="font-mono text-sm text-muted-foreground mt-1">{eq.equipment_id}</p>
      </div>

      {/* Form */}
      <ScrollArea className="flex-1">
        <div className="px-5 py-5 flex flex-col gap-5">

          {/* Equipment Type - Combobox */}
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-widest">설비 타입</Label>
            <div className="relative">
              <div className="relative">
                <Input
                  ref={typeInputRef}
                  type="text"
                  value={typeInput}
                  onChange={e => handleTypeInputChange(e.target.value)}
                  onFocus={() => setTypeOpen(true)}
                  placeholder="타입 선택 또는 직접 입력"
                  className="text-sm font-mono h-10 pr-8"
                />
                <button
                  type="button"
                  onClick={() => setTypeOpen(!typeOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", typeOpen && "rotate-180")} />
                </button>
              </div>

              {/* Dropdown List */}
              {typeOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {/* 새 타입 추가 옵션 (입력값이 기존 목록에 없을 때) */}
                  {typeInput && !availableTypes.includes(type) && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleTypeSelect(type)
                      }}
                      className="w-full text-left px-3 py-2 text-sm font-mono bg-primary/20 hover:bg-primary/30 border-b border-primary/30 text-primary"
                    >
                      + "{type}" 새 타입 추가
                    </button>
                  )}
                  {/* 전체 타입 목록 (필터링 매치 우선 정렬) */}
                  {[...availableTypes]
                    .sort((a, b) => {
                      const aMatch = a.toLowerCase().includes(typeInput.toLowerCase())
                      const bMatch = b.toLowerCase().includes(typeInput.toLowerCase())
                      if (aMatch && !bMatch) return -1
                      if (!aMatch && bMatch) return 1
                      return a.localeCompare(b)
                    })
                    .map(t => {
                      const isMatch = !typeInput || t.toLowerCase().includes(typeInput.toLowerCase())
                      return (
                        <button
                          key={t}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleTypeSelect(t)
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm font-mono hover:bg-muted flex items-center justify-between",
                            t === type && "bg-muted text-foreground",
                            !isMatch && "opacity-40"
                          )}
                        >
                          <span>{t.replace(/_/g, ' ')}</span>
                          {t === type && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      )
                    })}
                  {/* 직접 입력 옵션 */}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setTypeInput('')
                      setType('')
                      setTypeOpen(false)
                      setTimeout(() => {
                        typeInputRef.current?.focus()
                        setTypeOpen(true)
                      }, 50)
                    }}
                    className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-muted border-t text-muted-foreground"
                  >
                    + 직접 입력...
                  </button>
                </div>
              )}
            </div>
            {!availableTypes.includes(type) && type && (
              <p className="text-xs text-primary">* 새로운 설비 타입이 등록됩니다</p>
            )}
          </div>

          {/* 컨베이어 역할 (CONV 타입일 때만) */}
          {(type === 'CONV' || type === 'CONVEYOR') && (
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-widest">컨베이어 역할</Label>
              <div className="flex gap-2">
                {[
                  { value: null as string | null, label: '없음', bgClass: 'bg-zinc-600' },
                  { value: 'INPUT' as string | null, label: '투입', bgClass: 'bg-blue-500' },
                  { value: 'OUTPUT' as string | null, label: '수취', bgClass: 'bg-rose-500' },
                ].map(option => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setSubType(option.value)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-md text-sm font-mono font-medium transition-all border-2',
                      subType === option.value
                        ? `${option.bgClass} text-white border-white/50`
                        : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Production Line (Read-only) */}
          {lineName && (
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-widest">라인</Label>
              <div className="bg-secondary border rounded-md px-3 py-2.5 font-mono text-sm text-secondary-foreground">
                {lineName}
              </div>
            </div>
          )}

          {/* Zone */}
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-widest">구역</Label>
            <Input
              type="text"
              value={zone}
              onChange={e => setZone(e.target.value)}
              placeholder="예) A구역, SMT-1"
              className="text-sm h-10"
            />
          </div>

          {/* 2D 레이아웃 설정 (바닥 평면 X-Y) */}
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium">2D 레이아웃</span>
              <span className="text-[10px] text-muted-foreground">(바닥 평면)</span>
            </div>

            {/* 2D 위치: X, Y */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">위치 (m)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1.5 border-r">X</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={centroidX}
                    onFocus={() => setFocusedField('centroidX')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => {
                      const str = e.target.value
                      setCentroidX(str)
                      const val = parseFloat(str)
                      if (!isNaN(val) && eq && onUpdatePosition) {
                        onUpdatePosition(eq.equipment_id, val, parseFloat(centroidZ) || 0)
                      }
                    }}
                    className="bg-background px-2 py-1.5 font-mono text-sm outline-none focus:bg-muted/50 w-full"
                  />
                </div>
                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1.5 border-r">Y</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={centroidZ}
                    onFocus={() => setFocusedField('centroidZ')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => {
                      const str = e.target.value
                      setCentroidZ(str)
                      const val = parseFloat(str)
                      if (!isNaN(val) && eq && onUpdatePosition) {
                        onUpdatePosition(eq.equipment_id, parseFloat(centroidX) || 0, val)
                      }
                    }}
                    className="bg-background px-2 py-1.5 font-mono text-sm outline-none focus:bg-muted/50 w-full"
                  />
                </div>
              </div>
            </div>

            {/* 2D 크기: W, D */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">크기 (m)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1.5 border-r">W</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sizeW}
                    onFocus={() => setFocusedField('sizeW')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => {
                      const str = e.target.value
                      setSizeW(str)
                      const val = parseFloat(str)
                      if (!isNaN(val) && val > 0 && eq && onUpdateSize) {
                        onUpdateSize(eq.equipment_id, val, parseFloat(sizeD) || 0.1)
                      }
                    }}
                    className="bg-background px-2 py-1.5 font-mono text-sm outline-none focus:bg-muted/50 w-full"
                  />
                </div>
                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1.5 border-r">D</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sizeD}
                    onFocus={() => setFocusedField('sizeD')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => {
                      const str = e.target.value
                      setSizeD(str)
                      const val = parseFloat(str)
                      if (!isNaN(val) && val > 0 && eq && onUpdateSize) {
                        onUpdateSize(eq.equipment_id, parseFloat(sizeW) || 0.1, val)
                      }
                    }}
                    className="bg-background px-2 py-1.5 font-mono text-sm outline-none focus:bg-muted/50 w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3D 높이 설정 (Z축) */}
          <div className="space-y-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium">3D 높이</span>
              <span className="text-[10px] text-muted-foreground">(Z축)</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* 높이 위치: Z */}
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">위치 (m)</Label>
                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1.5 border-r">Z</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={centroidY}
                    onFocus={() => setFocusedField('centroidY')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => setCentroidY(e.target.value)}
                    className="bg-background px-2 py-1.5 font-mono text-sm outline-none focus:bg-muted/50 w-full"
                  />
                </div>
              </div>

              {/* 높이 크기: H */}
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">크기 (m)</Label>
                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1.5 border-r">H</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sizeH}
                    onFocus={() => setFocusedField('sizeH')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => setSizeH(e.target.value)}
                    className="bg-background px-2 py-1.5 font-mono text-sm outline-none focus:bg-muted/50 w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-widest">포인트 수</Label>
            <div className="bg-secondary border rounded-md px-3 py-2.5 font-mono text-sm text-secondary-foreground">
              {eq.point_count.toLocaleString()} pts
            </div>
          </div>

          {/* Verified Toggle */}
          <div className="flex items-center justify-between py-1">
            <Label className="font-mono text-xs uppercase tracking-widest">검수 완료</Label>
            <div className="flex items-center gap-3">
              <Switch checked={verified} onCheckedChange={setVerified} />
              <span className={cn(
                'font-mono text-sm',
                verified ? 'text-success' : 'text-muted-foreground'
              )}>
                {verified ? '완료' : '대기'}
              </span>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-widest">메모</Label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="설비 특이사항, 보정 내용 등"
              className="w-full bg-background border border-input rounded-md text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none leading-relaxed"
            />
          </div>
        </div>
      </ScrollArea>

      {/* Save Button */}
      <div className="px-5 py-4 border-t flex-shrink-0">
        {hasChanges && (
          <p className="text-xs text-muted-foreground mb-2 text-center">
            {changeCount}개 항목이 변경되었습니다
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCloseAttempt}>
            닫기
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? '저장 중...' : hasChanges ? `저장 (${changeCount})` : '저장'}
          </Button>
        </div>
      </div>

      {/* 닫기 확인 다이얼로그 */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>변경사항이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              {changeCount}개 항목이 변경되었습니다. 저장하지 않고 나가시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={onClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              저장 없이 나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

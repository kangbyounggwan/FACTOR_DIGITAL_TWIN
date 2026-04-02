# Section 10: Viewer Integration

## Background

레이아웃 시스템(Section 1-4)과 CRUD 시스템(Section 5-9)이 완성된 후, 기존 3D/2D 뷰어와 통합하는 최종 단계입니다. 뷰어에서 활성 레이아웃의 설비 위치를 표시하고, 레이아웃 전환 시 변경사항을 시각화합니다.

**핵심 기능:**
1. 3D 뷰어(FactoryLinePage)에서 활성 레이아웃의 설비 위치 사용
2. 2D 편집기(LayoutEditorPage)에서 선택한 레이아웃의 위치 로드
3. 레이아웃이 없으면 원본(equipment_scans) 위치 사용
4. 레이아웃 전환 시 변경사항 비교 표시

## Dependencies

- **Requires**: Section 09 (Equipment CRUD) - 설비 위치 업데이트 API 필요
- **Blocks**: Section 11 (Testing)

## Prerequisite: API & Types (Section 02-03에서 생성됨)

### Layout Types (lib/api.ts에 추가됨)

```typescript
// Layout Types
export interface LayoutEquipmentPosition {
  equipment_id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
}

export interface Layout {
  id: string
  factory_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LayoutDetail extends Layout {
  equipment_positions: LayoutEquipmentPosition[]
}

// Layout API functions (Section 02에서 추가됨)
export const fetchLayouts = (factoryId: string) =>
  api.get<Layout[]>(`/layouts/?factory_id=${factoryId}`).then(r => r.data)

export const fetchActiveLayout = (factoryId: string) =>
  api.get<LayoutDetail | null>(`/layouts/active?factory_id=${factoryId}`).then(r => r.data)

export const fetchLayoutDetail = (layoutId: string) =>
  api.get<LayoutDetail>(`/layouts/${layoutId}`).then(r => r.data)
```

### useLayouts Hook (Section 03에서 생성됨)

```typescript
// hooks/useLayouts.ts - 이미 Section 03에서 생성됨
export function useLayouts(factoryId: string | null) { ... }
export function useActiveLayout(factoryId: string | null) { ... }
export function useLayoutDetail(layoutId: string | null) { ... }
```

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/hooks/useEquipment.ts` | **MODIFY** | layoutId 파라미터 추가, 레이아웃 위치 오버라이드 |
| `frontend/src/pages/FactoryLinePage.tsx` | **MODIFY** | 활성 레이아웃 자동 적용, 레이아웃 표시 배지 |
| `frontend/src/pages/LayoutEditorPage.tsx` | **MODIFY** | 레이아웃 선택 시 위치 로드 (Section 04에서 대부분 구현) |
| `frontend/src/lib/api.ts` | **VERIFY** | Layout API 함수 존재 확인 |

---

## Implementation

### 1. useEquipment.ts 확장

`useFactoryEquipment` 훅에 레이아웃 위치 오버라이드 기능을 추가합니다.

```typescript
// frontend/src/hooks/useEquipment.ts

import { useState, useEffect, useCallback } from 'react'
import {
  fetchEquipment,
  fetchFactoryEquipment,
  fetchStats,
  updateEquipment,
  fetchLayoutDetail,  // 추가
  Equipment,
  EquipmentUpdate,
  SiteStats,
  LayoutEquipmentPosition  // 추가
} from '@/lib/api'

// 로컬 목 데이터 (API 연결 전 개발용)
const MOCK: Equipment[] = [
  { id:1, equipment_id:'JM_PCB_001_EQ_0001', site_id:'JM_PCB_001', line_code:'JM_PCB_001', equipment_type:'SMT_LINE',       zone:'A라인',  scan_date:'2026-04-01', centroid_x:2.1,  centroid_y:0.6, centroid_z:1.8, size_w:3.2, size_d:0.8, size_h:1.2, point_count:12480, ply_url:null, verified:true,  note:'1호기 SMT' },
  { id:2, equipment_id:'JM_PCB_001_EQ_0002', site_id:'JM_PCB_001', line_code:'JM_PCB_001', equipment_type:'SMT_LINE',       zone:'A라인',  scan_date:'2026-04-01', centroid_x:6.4,  centroid_y:0.6, centroid_z:1.8, size_w:3.2, size_d:0.8, size_h:1.2, point_count:11920, ply_url:null, verified:true,  note:'2호기 SMT' },
  { id:3, equipment_id:'JM_PCB_001_EQ_0003', site_id:'JM_PCB_001', line_code:'JM_PCB_001', equipment_type:'REFLOW_OVEN',    zone:'A라인',  scan_date:'2026-04-01', centroid_x:10.5, centroid_y:0.7, centroid_z:2.0, size_w:2.2, size_d:0.9, size_h:1.4, point_count:9340,  ply_url:null, verified:true,  note:'' },
  { id:4, equipment_id:'JM_PCB_001_EQ_0004', site_id:'JM_PCB_001', line_code:'JM_PCB_001', equipment_type:'AOI_MACHINE',    zone:'A라인',  scan_date:'2026-04-01', centroid_x:13.8, centroid_y:0.5, centroid_z:1.2, size_w:1.4, size_d:1.0, size_h:1.0, point_count:6820,  ply_url:null, verified:true,  note:'X-ray AOI' },
  { id:5, equipment_id:'JM_PCB_001_EQ_0005', site_id:'JM_PCB_001', line_code:'JM_PCB_001', equipment_type:'SCREEN_PRINTER', zone:'B라인',  scan_date:'2026-04-01', centroid_x:2.1,  centroid_y:0.5, centroid_z:6.5, size_w:1.6, size_d:1.2, size_h:1.0, point_count:7410,  ply_url:null, verified:true,  note:'' },
  { id:6, equipment_id:'JM_PCB_001_EQ_0006', site_id:'JM_PCB_001', line_code:'JM_PCB_002', equipment_type:'PICK_AND_PLACE', zone:'B라인',  scan_date:'2026-04-01', centroid_x:5.0,  centroid_y:0.6, centroid_z:6.5, size_w:2.8, size_d:1.0, size_h:1.2, point_count:10240, ply_url:null, verified:true,  note:'고속기' },
  { id:7, equipment_id:'JM_PCB_001_EQ_0007', site_id:'JM_PCB_001', line_code:'JM_PCB_002', equipment_type:'PICK_AND_PLACE', zone:'B라인',  scan_date:'2026-04-01', centroid_x:8.5,  centroid_y:0.6, centroid_z:6.5, size_w:2.8, size_d:1.0, size_h:1.2, point_count:10180, ply_url:null, verified:false, note:'' },
  { id:8, equipment_id:'JM_PCB_001_EQ_0008', site_id:'JM_PCB_001', line_code:'JM_PCB_002', equipment_type:'REFLOW_OVEN',    zone:'B라인',  scan_date:'2026-04-01', centroid_x:12.4, centroid_y:0.7, centroid_z:7.0, size_w:2.2, size_d:0.9, size_h:1.4, point_count:9100,  ply_url:null, verified:false, note:'' },
  { id:9, equipment_id:'JM_PCB_001_EQ_0009', site_id:'JM_PCB_001', line_code:'JM_PCB_002', equipment_type:'CONVEYOR',       zone:'연결부', scan_date:'2026-04-01', centroid_x:8.0,  centroid_y:0.4, centroid_z:4.0, size_w:4.0, size_d:0.4, size_h:0.8, point_count:4200,  ply_url:null, verified:false, note:'' },
  { id:10,equipment_id:'JM_PCB_001_EQ_0010', site_id:'JM_PCB_001', line_code:'JM_PCB_002', equipment_type:'CONTROL_PANEL',  zone:'',       scan_date:'2026-04-01', centroid_x:0.5,  centroid_y:0.9, centroid_z:4.0, size_w:0.6, size_d:0.3, size_h:1.8, point_count:2100,  ply_url:null, verified:false, note:'' },
  { id:11,equipment_id:'JM_PCB_001_EQ_0011', site_id:'JM_PCB_001', line_code:'JM_PCB_002', equipment_type:'STORAGE_RACK',   zone:'자재창고',scan_date:'2026-04-01', centroid_x:16.0, centroid_y:1.0, centroid_z:2.0, size_w:1.2, size_d:0.5, size_h:2.0, point_count:3800,  ply_url:null, verified:false, note:'' },
  { id:12,equipment_id:'JM_PCB_001_EQ_0012', site_id:'JM_PCB_001', line_code:'JM_PCB_002', equipment_type:'UNKNOWN',        zone:'',       scan_date:'2026-04-01', centroid_x:14.5, centroid_y:0.4, centroid_z:5.5, size_w:0.8, size_d:0.6, size_h:0.8, point_count:1540,  ply_url:null, verified:false, note:'분류 필요' },
]

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL

// 설비 데이터에 레이아웃 위치를 적용하는 헬퍼 함수
function applyLayoutPositions(
  equipment: Equipment[],
  layoutPositions: LayoutEquipmentPosition[]
): Equipment[] {
  if (!layoutPositions || layoutPositions.length === 0) {
    return equipment
  }

  const positionMap = new Map(
    layoutPositions.map(p => [p.equipment_id, p])
  )

  return equipment.map(eq => {
    const layoutPos = positionMap.get(eq.equipment_id)
    if (layoutPos) {
      return {
        ...eq,
        centroid_x: layoutPos.centroid_x,
        centroid_y: layoutPos.centroid_y,
        centroid_z: layoutPos.centroid_z,
        size_w: layoutPos.size_w,
        size_h: layoutPos.size_h,
        size_d: layoutPos.size_d,
      }
    }
    return eq
  })
}

export function useEquipment(siteId: string) {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [stats, setStats]         = useState<SiteStats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Equipment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (USE_MOCK) {
        setEquipment(MOCK.filter(e => e.site_id === siteId))
        const v = MOCK.filter(e => e.verified && e.site_id === siteId).length
        setStats({ total: MOCK.length, verified: v, pending: MOCK.length - v, by_type: {} })
      } else {
        const [eq, st] = await Promise.all([fetchEquipment(siteId), fetchStats(siteId)])
        setEquipment(eq)
        setStats(st)
      }
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (id: string, body: EquipmentUpdate) => {
    if (USE_MOCK) {
      setEquipment(prev =>
        prev.map(e => e.equipment_id === id ? { ...e, ...body } : e)
      )
      return
    }
    await updateEquipment(id, body)
    await load()
  }, [load])

  return { equipment, stats, loading, selected, setSelected, save, reload: load }
}

/**
 * 공장 전체 설비를 로드하고, 선택적으로 레이아웃 위치를 적용합니다.
 *
 * @param factoryCode - 공장 코드
 * @param layoutId - (선택) 적용할 레이아웃 ID. null이면 원본 위치 사용
 */
export function useFactoryEquipment(factoryCode: string, layoutId?: string | null) {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [originalEquipment, setOriginalEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Equipment | null>(null)
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!factoryCode) {
      setEquipment([])
      setOriginalEquipment([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let eq: Equipment[]

      if (USE_MOCK) {
        eq = MOCK
      } else {
        eq = await fetchFactoryEquipment(factoryCode)
      }

      setOriginalEquipment(eq)

      // 레이아웃이 지정된 경우 해당 위치로 오버라이드
      if (layoutId && !USE_MOCK) {
        try {
          const layoutDetail = await fetchLayoutDetail(layoutId)
          const appliedEquipment = applyLayoutPositions(eq, layoutDetail.equipment_positions)
          setEquipment(appliedEquipment)
          setCurrentLayoutId(layoutId)
        } catch (error) {
          // 레이아웃 로드 실패 시 원본 사용
          console.warn('Failed to load layout, using original positions:', error)
          setEquipment(eq)
          setCurrentLayoutId(null)
        }
      } else {
        setEquipment(eq)
        setCurrentLayoutId(null)
      }
    } finally {
      setLoading(false)
    }
  }, [factoryCode, layoutId])

  useEffect(() => { load() }, [load])

  // Compute stats from equipment
  const stats: SiteStats | null = equipment.length > 0 ? {
    total: equipment.length,
    verified: equipment.filter(e => e.verified).length,
    pending: equipment.filter(e => !e.verified).length,
    by_type: {}
  } : null

  const save = useCallback(async (id: string, body: EquipmentUpdate) => {
    if (USE_MOCK) {
      setEquipment(prev =>
        prev.map(e => e.equipment_id === id ? { ...e, ...body } : e)
      )
      return
    }
    await updateEquipment(id, body)
    await load()
  }, [load])

  // 원본과 현재 위치의 차이 계산 (레이아웃 비교용)
  const positionChanges = useMemo(() => {
    if (!currentLayoutId || originalEquipment.length === 0) return []

    return equipment.map(eq => {
      const original = originalEquipment.find(o => o.equipment_id === eq.equipment_id)
      if (!original) return null

      const dx = eq.centroid_x - original.centroid_x
      const dy = eq.centroid_y - original.centroid_y
      const dz = eq.centroid_z - original.centroid_z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (distance < 0.01) return null // 변경 없음

      return {
        equipment_id: eq.equipment_id,
        original: { x: original.centroid_x, y: original.centroid_y, z: original.centroid_z },
        current: { x: eq.centroid_x, y: eq.centroid_y, z: eq.centroid_z },
        distance,
      }
    }).filter(Boolean)
  }, [equipment, originalEquipment, currentLayoutId])

  return {
    equipment,
    originalEquipment,
    stats,
    loading,
    selected,
    setSelected,
    save,
    reload: load,
    currentLayoutId,
    positionChanges,
  }
}

// 레이아웃 위치를 직접 적용하는 함수 (외부에서 사용)
export { applyLayoutPositions }
```

---

### 2. FactoryLinePage.tsx 수정

활성 레이아웃을 자동으로 적용하고, 레이아웃 정보를 표시합니다.

```typescript
// frontend/src/pages/FactoryLinePage.tsx

import { useState, Suspense, useMemo } from 'react'
import { useCompanies, useCompanyFactories, useFactoryLines } from '@/hooks/useFactories'
import { useFactoryEquipment } from '@/hooks/useEquipment'
import { useActiveLayout } from '@/hooks/useLayouts'  // 추가
import { Company, Factory, ProductionLine } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, RefreshCw, ChevronRight, ChevronDown, Layers } from 'lucide-react'  // Layers 추가
import { cn } from '@/lib/utils'
import Scene3D from '@/components/Scene3D'
import EquipmentList from '@/components/EquipmentList'
import RegPanel from '@/components/RegPanel'
import ViewModeToggle from '@/components/ViewModeToggle'
import EditingToolbar from '@/components/EditingToolbar'
import { useEditingKeyboard } from '@/hooks/useEditingKeyboard'
import { SelectionState } from '@/App'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Props {
  selection: SelectionState
  onSelectCompany: (company: Company | null) => void
  onSelectFactory: (factory: Factory | null) => void
  onSelectLine: (line: ProductionLine | null) => void
}

export default function FactoryLinePage({ selection, onSelectCompany, onSelectFactory, onSelectLine }: Props) {
  const { companies, loading: companiesLoading, reload: reloadCompanies } = useCompanies()
  const { factories, loading: factoriesLoading } = useCompanyFactories(selection.company?.code ?? null)
  const { lines, loading: linesLoading } = useFactoryLines(selection.factory?.code ?? null)

  // Aliases for easier access
  const selectedCompany = selection.company
  const selectedFactory = selection.factory
  const selectedLine = selection.line

  // 활성 레이아웃 조회 (공장 선택 시)
  const { layout: activeLayout, loading: layoutLoading } = useActiveLayout(
    selectedFactory?.id ?? null
  )

  // 3D Viewer state - 공장 전체 설비 로드 (활성 레이아웃 적용)
  const [viewMode, setViewMode] = useState<'box' | 'cloud'>('box')
  const {
    equipment,
    stats,
    loading: equipmentLoading,
    selected,
    setSelected,
    save,
    currentLayoutId,
    positionChanges,
  } = useFactoryEquipment(
    selectedFactory?.code ?? '',
    activeLayout?.id ?? null  // 활성 레이아웃 ID 전달
  )

  // 선택된 라인의 설비만 필터링 (설비 리스트용)
  const filteredEquipment = useMemo(() => {
    if (!selectedLine) return equipment
    return equipment.filter(e => e.line_code === selectedLine.code)
  }, [equipment, selectedLine])

  // 선택된 라인 설비의 통계
  const filteredStats = useMemo(() => {
    if (!selectedLine) return stats
    const filtered = equipment.filter(e => e.line_code === selectedLine.code)
    return {
      total: filtered.length,
      verified: filtered.filter(e => e.verified).length,
      pending: filtered.filter(e => !e.verified).length,
      by_type: {}
    }
  }, [equipment, selectedLine, stats])

  // 라인 코드 -> 라인 이름 매핑
  const lineMap = useMemo(() => {
    const map: Record<string, string> = {}
    lines.forEach(line => {
      map[line.code] = line.name
    })
    return map
  }, [lines])

  // 선택된 라인의 카메라 포커스 위치 계산
  const focusTarget = useMemo(() => {
    if (!selectedLine) return null
    const lineEquipment = equipment.filter(e => e.line_code === selectedLine.code)
    if (lineEquipment.length === 0) return null

    // 라인 설비들의 중심점 계산
    const sumX = lineEquipment.reduce((sum, e) => sum + e.centroid_x, 0)
    const sumY = lineEquipment.reduce((sum, e) => sum + e.centroid_y, 0)
    const sumZ = lineEquipment.reduce((sum, e) => sum + e.centroid_z, 0)
    const count = lineEquipment.length

    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
      lineCode: selectedLine.code
    }
  }, [equipment, selectedLine])

  useEditingKeyboard()

  const handleSelectCompany = (company: Company) => {
    onSelectCompany(company)
  }

  const handleSelectFactory = (factory: Factory) => {
    onSelectFactory(factory)
  }

  // 위치 변경된 설비 수
  const changedCount = positionChanges?.length ?? 0

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
                  {/* 공장 버튼 */}
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

                  {/* 라인 목록 (공장 선택 시 표시) */}
                  {selectedFactory?.id === factory.id && (
                    <div className="ml-4 border-l border-border">
                      {/* 전체 보기 옵션 */}
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

      {/* 3D 뷰어 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {!selectedFactory ? (
          <div className="flex-1 flex items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">
              {!selectedCompany ? '회사를 선택하세요' : '공장을 선택하세요'}
            </p>
          </div>
        ) : (equipmentLoading || layoutLoading) ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Equipment List - 선택된 라인 또는 전체 */}
            <EquipmentList
              equipment={filteredEquipment}
              selectedId={selected?.equipment_id ?? null}
              onSelect={eq => setSelected(eq)}
              lineMap={lineMap}
            />

            {/* 3D View - 전체 설비 표시, 선택된 라인 하이라이트 */}
            <div className="flex-1 relative overflow-hidden">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
                <Scene3D
                  equipment={equipment}
                  selectedId={selected?.equipment_id ?? null}
                  onSelect={eq => setSelected(eq)}
                  viewMode={viewMode}
                  focusLineCode={selectedLine?.code}
                  focusTarget={focusTarget}
                />
              </Suspense>

              {/* Toolbar */}
              <div className="absolute top-4 left-4 flex items-center gap-3">
                <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
                <EditingToolbar selectedEquipmentId={selected?.equipment_id} />
              </div>

              {/* Current Location Info */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <Badge variant="secondary" className="font-mono text-xs">
                  {selectedFactory.name}{selectedLine ? ` / ${selectedLine.name}` : ' (전체)'}
                </Badge>
              </div>

              {/* Layout Info Badge - 활성 레이아웃 표시 */}
              {activeLayout && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs bg-card/90 backdrop-blur-sm cursor-help flex items-center gap-1.5"
                        >
                          <Layers className="h-3 w-3" />
                          {activeLayout.name}
                          {changedCount > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              ({changedCount}개 변경)
                            </span>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          활성 레이아웃: {activeLayout.name}
                          {activeLayout.description && (
                            <span className="block text-muted-foreground mt-1">
                              {activeLayout.description}
                            </span>
                          )}
                          {changedCount > 0 && (
                            <span className="block text-muted-foreground mt-1">
                              원본 대비 {changedCount}개 설비 위치 변경됨
                            </span>
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {/* Stats */}
              {(selectedLine ? filteredStats : stats) && (
                <div className="absolute top-4 right-4 flex gap-1.5 pointer-events-none">
                  {[
                    { label: '전체', val: (selectedLine ? filteredStats : stats)?.total ?? 0, color: 'text-foreground' },
                    { label: '완료', val: (selectedLine ? filteredStats : stats)?.verified ?? 0, color: 'text-success' },
                    { label: '대기', val: (selectedLine ? filteredStats : stats)?.pending ?? 0, color: 'text-warning' },
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

              {/* Hint */}
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-xs text-muted-foreground pointer-events-none">
                드래그: 회전 | 스크롤: 줌 | 클릭: 선택
              </p>
            </div>

            {/* Registration Panel */}
            {selected && (
              <RegPanel
                equipment={selected}
                onSave={async (id, body) => {
                  await save(id, body)
                  setSelected(prev => prev ? { ...prev, ...body } : null)
                }}
                onClose={() => setSelected(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

---

### 3. LayoutEditorPage.tsx 수정 (Section 04 이후 추가 수정)

레이아웃 선택 시 위치를 로드하고, 저장 기능을 레이아웃 API와 연동합니다.

```typescript
// frontend/src/pages/LayoutEditorPage.tsx
// Section 04에서 LayoutSelector와 SaveLayoutDialog가 이미 통합됨
// 이 섹션에서는 useFactoryEquipment에 layoutId를 전달하도록 수정

// 기존 import에 추가
import { useActiveLayout, useLayoutDetail } from '@/hooks/useLayouts'

// ... 기존 코드 ...

export default function LayoutEditorPage({ selection, onSelectCompany, onSelectFactory, onSelectLine }: Props) {
  // ... 기존 상태 ...

  // 현재 선택된 레이아웃 ID (LayoutSelector에서 관리)
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null)

  // 활성 레이아웃 조회 (초기 선택용)
  const { layout: activeLayout, loading: activeLayoutLoading } = useActiveLayout(
    selectedFactory?.id ?? null
  )

  // 공장 선택 시 활성 레이아웃을 기본 선택
  useEffect(() => {
    if (activeLayout && !selectedLayoutId) {
      setSelectedLayoutId(activeLayout.id)
    }
  }, [activeLayout])

  // 공장 변경 시 레이아웃 선택 초기화
  useEffect(() => {
    setSelectedLayoutId(null)
  }, [selectedFactory?.id])

  // 설비 데이터 (선택된 레이아웃 위치 적용)
  const {
    equipment,
    originalEquipment,
    stats,
    loading: equipmentLoading,
    selected,
    setSelected,
    save,
    currentLayoutId,
    reload: reloadEquipment,
  } = useFactoryEquipment(
    selectedFactory?.code ?? '',
    selectedLayoutId  // 선택된 레이아웃 ID 전달
  )

  // 레이아웃 변경 핸들러
  const handleLayoutChange = useCallback((layoutId: string | null) => {
    setSelectedLayoutId(layoutId)
    // 로컬 변경사항 초기화
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
  }, [])

  // 저장 성공 후 새 레이아웃 선택
  const handleLayoutSaved = useCallback((newLayoutId: string) => {
    setSelectedLayoutId(newLayoutId)
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    reloadEquipment()
  }, [reloadEquipment])

  // ... JSX에서 LayoutSelector 사용 (Section 04에서 이미 구현) ...

  // 상단 툴바에 추가:
  // <LayoutSelector
  //   factoryId={selectedFactory?.id}
  //   selectedLayoutId={selectedLayoutId}
  //   onSelect={handleLayoutChange}
  // />

  // 저장 버튼에 연결:
  // <SaveLayoutDialog
  //   factoryId={selectedFactory?.id}
  //   currentLayoutId={selectedLayoutId}
  //   positions={localPositions}
  //   sizes={localSizes}
  //   equipment={equipmentWithLocalPositions}
  //   onSaved={handleLayoutSaved}
  // />
}
```

---

### 4. useLayouts Hook 확인/생성 (Section 03에서 생성되어야 함)

Section 03에서 이미 생성된 훅을 확인합니다. 없다면 다음 코드를 사용합니다.

```typescript
// frontend/src/hooks/useLayouts.ts

import { useState, useEffect, useCallback } from 'react'
import {
  Layout,
  LayoutDetail,
  fetchLayouts,
  fetchActiveLayout,
  fetchLayoutDetail
} from '@/lib/api'

/**
 * 공장의 레이아웃 목록을 조회합니다.
 */
export function useLayouts(factoryId: string | null) {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryId) {
      setLayouts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchLayouts(factoryId)
      setLayouts(data)
    } catch (e) {
      setError(e as Error)
      setLayouts([])
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  useEffect(() => {
    load()
  }, [load])

  return { layouts, loading, error, reload: load }
}

/**
 * 공장의 활성 레이아웃을 조회합니다.
 */
export function useActiveLayout(factoryId: string | null) {
  const [layout, setLayout] = useState<LayoutDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryId) {
      setLayout(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchActiveLayout(factoryId)
      setLayout(data)
    } catch (e) {
      setError(e as Error)
      setLayout(null)
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  useEffect(() => {
    load()
  }, [load])

  return { layout, loading, error, reload: load }
}

/**
 * 특정 레이아웃의 상세 정보를 조회합니다.
 */
export function useLayoutDetail(layoutId: string | null) {
  const [layout, setLayout] = useState<LayoutDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!layoutId) {
      setLayout(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchLayoutDetail(layoutId)
      setLayout(data)
    } catch (e) {
      setError(e as Error)
      setLayout(null)
    } finally {
      setLoading(false)
    }
  }, [layoutId])

  useEffect(() => {
    load()
  }, [load])

  return { layout, loading, error, reload: load }
}
```

---

### 5. lib/api.ts에 Layout API 추가 확인 (Section 02에서 추가되어야 함)

```typescript
// frontend/src/lib/api.ts - Section 02에서 추가된 내용 확인

// Layout Types
export interface LayoutEquipmentPosition {
  equipment_id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
}

export interface Layout {
  id: string
  factory_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LayoutDetail extends Layout {
  equipment_positions: LayoutEquipmentPosition[]
}

export interface LayoutCreate {
  name: string
  description?: string
  is_active?: boolean
  equipment_positions: LayoutEquipmentPosition[]
}

export interface LayoutUpdate {
  name?: string
  description?: string
  is_active?: boolean
  equipment_positions?: LayoutEquipmentPosition[]
}

// Layout API
export const fetchLayouts = (factoryId: string) =>
  api.get<Layout[]>(`/layouts/?factory_id=${factoryId}`).then(r => r.data)

export const fetchActiveLayout = (factoryId: string) =>
  api.get<LayoutDetail | null>(`/layouts/active?factory_id=${factoryId}`).then(r => r.data)

export const fetchLayoutDetail = (layoutId: string) =>
  api.get<LayoutDetail>(`/layouts/${layoutId}`).then(r => r.data)

export const createLayout = (factoryId: string, layout: LayoutCreate) =>
  api.post<LayoutDetail>(`/layouts/?factory_id=${factoryId}`, layout).then(r => r.data)

export const updateLayout = (layoutId: string, layout: LayoutUpdate) =>
  api.patch<LayoutDetail>(`/layouts/${layoutId}`, layout).then(r => r.data)

export const deleteLayout = (layoutId: string) =>
  api.delete(`/layouts/${layoutId}`)

export const activateLayout = (layoutId: string) =>
  api.post<LayoutDetail>(`/layouts/${layoutId}/activate`).then(r => r.data)

export const cloneLayout = (layoutId: string, newName: string) =>
  api.post<LayoutDetail>(`/layouts/${layoutId}/clone`, { name: newName }).then(r => r.data)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FactoryLinePage (3D Viewer)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. 공장 선택                                                                │
│       ↓                                                                      │
│  2. useActiveLayout(factoryId) → 활성 레이아웃 조회                           │
│       ↓                                                                      │
│  3. useFactoryEquipment(factoryCode, activeLayout.id)                       │
│       ↓                                                                      │
│  4. 설비 데이터 로드 + 레이아웃 위치 오버라이드                                 │
│       ↓                                                                      │
│  5. Scene3D에 equipment 전달 → 3D 렌더링                                     │
│       ↓                                                                      │
│  6. 활성 레이아웃 배지 표시 (이름, 변경 수)                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        LayoutEditorPage (2D Editor)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. 공장 선택                                                                │
│       ↓                                                                      │
│  2. LayoutSelector로 레이아웃 선택 (또는 새로 생성)                           │
│       ↓                                                                      │
│  3. useFactoryEquipment(factoryCode, selectedLayoutId)                      │
│       ↓                                                                      │
│  4. 설비 데이터 로드 + 레이아웃 위치 오버라이드                                 │
│       ↓                                                                      │
│  5. LayoutCanvas에 equipment 전달 → 2D 렌더링                               │
│       ↓                                                                      │
│  6. 드래그로 위치 변경 → localPositions 업데이트                              │
│       ↓                                                                      │
│  7. SaveLayoutDialog로 레이아웃 저장                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Edge Cases

### 1. 활성 레이아웃이 없는 경우
- `useActiveLayout`이 `null` 반환
- `useFactoryEquipment`에 `layoutId: null` 전달
- 원본 equipment_scans 테이블의 위치 사용

### 2. 레이아웃에 없는 설비
- 새로 추가된 설비는 레이아웃에 포함되지 않음
- `applyLayoutPositions`에서 매핑되지 않는 설비는 원본 위치 유지

### 3. 레이아웃 로드 실패
- 에러 로깅 후 원본 위치 사용
- 사용자에게 토스트 알림 표시 고려

### 4. 레이아웃 전환 중 로딩
- `layoutLoading` 상태 표시
- 스피너 또는 스켈레톤 UI

---

## Acceptance Criteria

- [ ] 3D 뷰어(FactoryLinePage)에서 활성 레이아웃 위치 자동 적용
- [ ] 활성 레이아웃 이름이 배지로 표시됨
- [ ] 활성 레이아웃이 없으면 원본(equipment_scans) 위치 사용
- [ ] 2D 편집기(LayoutEditorPage)에서 레이아웃 선택 시 해당 위치 로드
- [ ] 레이아웃 전환 시 로컬 변경사항 초기화
- [ ] 원본 대비 위치 변경된 설비 수 표시
- [ ] 레이아웃 로드 실패 시 원본 위치로 폴백
- [ ] useFactoryEquipment 훅이 layoutId 파라미터 지원

---

## Testing Checklist

```
[ ] 활성 레이아웃 없는 공장 선택 → 원본 위치 표시
[ ] 활성 레이아웃 있는 공장 선택 → 레이아웃 위치 표시
[ ] 레이아웃 배지에 이름 표시
[ ] 레이아웃 배지 툴팁에 설명 표시
[ ] 2D 편집기에서 레이아웃 전환 → 위치 변경됨
[ ] 2D 편집기에서 레이아웃 전환 → 로컬 변경사항 초기화
[ ] 새 설비 추가 후 레이아웃 로드 → 새 설비는 원본 위치
[ ] 네트워크 오류 시 → 원본 위치 폴백
[ ] positionChanges 배열에 변경된 설비만 포함
```

---

## Notes

- Section 02-04에서 생성된 Layout API, hooks, UI 컴포넌트가 필요합니다.
- 이 섹션은 주로 기존 코드를 수정하여 레이아웃 시스템과 연결하는 작업입니다.
- Tooltip 컴포넌트는 shadcn/ui에서 제공됩니다 (`npx shadcn-ui@latest add tooltip`).

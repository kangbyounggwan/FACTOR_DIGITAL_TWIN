import { useState, Suspense, useMemo } from 'react'
import { useCompanies, useCompanyFactories, useFactoryLines } from '@/hooks/useFactories'
import { useFactoryEquipment } from '@/hooks/useEquipment'
import { Company, Factory, ProductionLine } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Scene3D from '@/components/Scene3D'
import EquipmentList from '@/components/EquipmentList'
import RegPanel from '@/components/RegPanel'
import ViewModeToggle from '@/components/ViewModeToggle'
import EditingToolbar from '@/components/EditingToolbar'
import { useEditingKeyboard } from '@/hooks/useEditingKeyboard'
import { SelectionState } from '@/App'

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

  // 3D Viewer state - 공장 전체 설비 로드
  const [viewMode, setViewMode] = useState<'box' | 'cloud'>('box')
  const { equipment, stats, loading: equipmentLoading, selected, setSelected, save } = useFactoryEquipment(
    selectedFactory?.code ?? ''
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
        ) : equipmentLoading ? (
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

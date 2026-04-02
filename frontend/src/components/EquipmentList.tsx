import { useState, useMemo, useEffect, useRef } from 'react'
import { Equipment, EquipmentGroup } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEquipmentTailwind, getGroupTailwind } from '@/lib/colors'

interface Props {
  equipment: Equipment[]
  selectedId: string | null
  onSelect: (eq: Equipment) => void
  lineMap?: Record<string, string>  // line_code -> line_name 매핑
  groups?: EquipmentGroup[]
  selectedGroupId?: string | null
  onSelectGroup?: (group: EquipmentGroup | null) => void
}

export default function EquipmentList({ equipment, selectedId, onSelect, lineMap, groups = [], selectedGroupId, onSelectGroup }: Props) {
  const [query, setQuery] = useState('')

  // 설비 ID -> 그룹 매핑
  const equipmentToGroup = useMemo(() => {
    const map = new Map<string, EquipmentGroup>()
    groups.forEach(group => {
      group.member_ids.forEach(id => map.set(id, group))
    })
    return map
  }, [groups])
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // 초기 확장 상태 설정 (모든 구역 펼침)
  useMemo(() => {
    const zones = new Set(equipment.map(eq => eq.zone || '미지정'))
    setExpandedZones(zones)
  }, [equipment.length])

  // 선택된 설비로 스크롤
  useEffect(() => {
    if (!selectedId) return

    // 선택된 설비의 구역을 찾아서 펼치기
    const selectedEquipment = equipment.find(eq => eq.equipment_id === selectedId)
    if (selectedEquipment) {
      const zone = selectedEquipment.zone || '미지정'
      setExpandedZones(prev => {
        if (prev.has(zone)) return prev
        const next = new Set(prev)
        next.add(zone)
        return next
      })
    }

    // 약간의 딜레이 후 스크롤 (구역 펼침 애니메이션 대기)
    const timer = setTimeout(() => {
      const element = itemRefs.current.get(selectedId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [selectedId, equipment])

  const filtered = equipment.filter(e => {
    const q = query.toLowerCase()
    const lineName = lineMap && e.line_code ? lineMap[e.line_code]?.toLowerCase() : ''
    return !q || e.equipment_id.toLowerCase().includes(q)
      || e.equipment_type.toLowerCase().includes(q)
      || e.zone?.toLowerCase().includes(q)
      || e.line_code?.toLowerCase().includes(q)
      || lineName?.includes(q)
  })

  // 구역별 그룹화
  const grouped = useMemo(() => {
    return filtered.reduce((acc, eq) => {
      const zone = eq.zone || '미지정'
      if (!acc[zone]) acc[zone] = []
      acc[zone].push(eq)
      return acc
    }, {} as Record<string, Equipment[]>)
  }, [filtered])

  const zones = Object.keys(grouped).sort((a, b) => {
    if (a === '미지정') return 1
    if (b === '미지정') return -1
    return a.localeCompare(b)
  })

  const toggleZone = (zone: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev)
      if (next.has(zone)) {
        next.delete(zone)
      } else {
        next.add(zone)
      }
      return next
    })
  }

  const verified = equipment.filter(e => e.verified).length
  const progress = equipment.length ? (verified / equipment.length) * 100 : 0

  return (
    <aside className="w-72 flex-shrink-0 border-r bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b bg-card flex-shrink-0">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          설비 목록
        </span>
      </div>

      {/* Progress & Search */}
      <div className="px-4 py-4 border-b flex-shrink-0 space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-mono text-muted-foreground">
            <span>검수 완료</span>
            <span>{verified} / {equipment.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Input
          type="text"
          placeholder="ID / 타입 / 구역"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-9 text-sm font-mono"
        />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div>
          {/* 그룹 섹션 */}
          {groups.length > 0 && (
            <div className="border-b">
              <div className="sticky top-0 bg-cyan-600 text-white px-3 py-2 flex items-center gap-2 z-10">
                <span className="text-xs font-semibold">설비 그룹</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-cyan-700 text-white">
                  {groups.length}
                </Badge>
              </div>
              {groups.map(group => {
                const isSelected = group.id === selectedGroupId
                const typeColor = getGroupTailwind(group.group_type)
                const memberEquipment = equipment.filter(eq => group.member_ids.includes(eq.equipment_id))

                return (
                  <div key={group.id}>
                    <button
                      onClick={() => onSelectGroup?.(isSelected ? null : group)}
                      className={cn(
                        'w-full text-left px-4 py-3 transition-colors flex flex-col gap-1.5',
                        isSelected
                          ? 'bg-cyan-500/20 border-l-2 border-l-cyan-500'
                          : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium text-foreground">{group.name}</span>
                        <Badge className={cn('text-[10px] h-4 px-1.5 text-white', typeColor)}>
                          {group.group_type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {group.member_count}개 설비 연결
                      </span>
                    </button>

                    {/* 선택된 그룹의 멤버 표시 */}
                    {isSelected && (
                      <div className="bg-cyan-500/10 border-l-2 border-l-cyan-500 px-4 py-2">
                        <div className="text-xs text-muted-foreground mb-2">연결된 설비:</div>
                        <div className="space-y-1">
                          {memberEquipment.map(eq => (
                            <div
                              key={eq.equipment_id}
                              className="flex items-center gap-2 text-xs font-mono"
                            >
                              <span className="text-cyan-400">•</span>
                              <span>{eq.equipment_id.split('_').pop()}</span>
                              <span className="text-muted-foreground">{eq.zone}</span>
                            </div>
                          ))}
                          {group.member_ids.filter(id => !memberEquipment.find(eq => eq.equipment_id === id)).map(id => (
                            <div
                              key={id}
                              className="flex items-center gap-2 text-xs font-mono text-muted-foreground"
                            >
                              <span className="text-cyan-400/50">•</span>
                              <span>{id}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {zones.map(zone => {
            const isExpanded = expandedZones.has(zone)
            const zoneEquipment = grouped[zone]
            const zoneVerified = zoneEquipment.filter(e => e.verified).length

            return (
              <div key={zone}>
                {/* Zone Header */}
                <button
                  className="w-full sticky top-0 bg-primary/90 hover:bg-primary text-primary-foreground px-3 py-2 flex items-center gap-2 transition-colors z-10"
                  onClick={() => toggleZone(zone)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="text-xs font-semibold flex-1 text-left truncate">{zone}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex-shrink-0">
                    {zoneVerified}/{zoneEquipment.length}
                  </Badge>
                </button>

                {/* Zone Equipment */}
                {isExpanded && (
                  <div className="border-b">
                    {zoneEquipment.map(eq => {
                      const isSelected = eq.equipment_id === selectedId
                      const shortNum = eq.equipment_id.split('_').pop()
                      const typeColor = getEquipmentTailwind(eq.equipment_type)
                      const belongsToGroup = equipmentToGroup.get(eq.equipment_id)
                      const isGroupSelected = belongsToGroup?.id === selectedGroupId

                      const handleClick = () => {
                        onSelect(eq)
                        // 그룹에 속한 설비 클릭 시 그룹도 선택
                        if (belongsToGroup && onSelectGroup) {
                          onSelectGroup(belongsToGroup)
                        }
                      }

                      return (
                        <button
                          key={eq.equipment_id}
                          ref={(el) => {
                            if (el) itemRefs.current.set(eq.equipment_id, el)
                            else itemRefs.current.delete(eq.equipment_id)
                          }}
                          onClick={handleClick}
                          className={cn(
                            'w-full text-left px-4 py-3 transition-colors flex items-center gap-2',
                            isSelected
                              ? 'bg-primary/10 border-l-2 border-l-primary'
                              : isGroupSelected
                                ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
                                : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                          )}
                        >
                          {/* 연결 표시 - 카드 좌측 중앙 */}
                          {belongsToGroup && (
                            <span className="text-sm flex-shrink-0" title={belongsToGroup.name}>🔗</span>
                          )}
                          {/* 메인 콘텐츠 */}
                          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm font-medium text-foreground">EQ {shortNum}</span>
                              <span
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full flex-shrink-0',
                                  eq.verified ? 'bg-success' : 'bg-warning'
                                )}
                              />
                            </div>
                            <span className={cn(
                              'text-xs font-mono font-medium px-2 py-0.5 rounded w-fit text-white',
                              typeColor
                            )}>
                              {eq.equipment_type}
                            </span>
                            {eq.name && (
                              <span className="text-sm text-foreground/80 truncate">
                                {eq.name}
                              </span>
                            )}
                            {eq.line_code && (
                              <span className="font-mono text-xs text-muted-foreground/70">
                                {lineMap && eq.line_code ? lineMap[eq.line_code] : eq.line_code}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}

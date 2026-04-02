import { useState, useMemo } from 'react'
import { Equipment } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// 설비 타입별 색상
const TYPE_COLORS: Record<string, string> = {
  SMT_LINE:       'bg-emerald-600',
  REFLOW_OVEN:    'bg-orange-600',
  AOI_MACHINE:    'bg-indigo-500',
  SCREEN_PRINTER: 'bg-amber-600',
  PICK_AND_PLACE: 'bg-emerald-600',
  CONVEYOR:       'bg-lime-700',
  CONTROL_PANEL:  'bg-zinc-600',
  STORAGE_RACK:   'bg-zinc-600',
  CNC:            'bg-blue-600',
  MCT:            'bg-sky-600',
  ROBOT:          'bg-purple-600',
  INSP:           'bg-teal-600',
  WELD:           'bg-red-600',
  PRESS:          'bg-rose-600',
  INJECT:         'bg-fuchsia-600',
  PACK:           'bg-cyan-600',
  ASSY:           'bg-violet-600',
  AGV:            'bg-green-600',
  CONV:           'bg-lime-700',
  OTHER:          'bg-gray-600',
  UNKNOWN:        'bg-zinc-700',
}

interface Props {
  equipment: Equipment[]
  selectedId: string | null
  onSelect: (eq: Equipment) => void
  lineMap?: Record<string, string>  // line_code -> line_name 매핑
}

export default function EquipmentList({ equipment, selectedId, onSelect, lineMap }: Props) {
  const [query, setQuery] = useState('')
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())

  // 초기 확장 상태 설정 (모든 구역 펼침)
  useMemo(() => {
    const zones = new Set(equipment.map(eq => eq.zone || '미지정'))
    setExpandedZones(zones)
  }, [equipment.length])

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
                      const typeColor = TYPE_COLORS[eq.equipment_type] ?? TYPE_COLORS.UNKNOWN
                      return (
                        <button
                          key={eq.equipment_id}
                          onClick={() => onSelect(eq)}
                          className={cn(
                            'w-full text-left px-4 py-3 transition-colors flex flex-col gap-1.5',
                            isSelected
                              ? 'bg-primary/10 border-l-2 border-l-primary'
                              : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                          )}
                        >
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

import { Suspense, useState } from 'react'
import { useEquipment } from '@/hooks/useEquipment'
import EquipmentList from '@/components/EquipmentList'
import Scene3D from '@/components/Scene3D'
import RegPanel from '@/components/RegPanel'
import ViewModeToggle from '@/components/ViewModeToggle'
import EditingToolbar from '@/components/EditingToolbar'
import { useEditingKeyboard } from '@/hooks/useEditingKeyboard'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  lineCode: string
  factoryName?: string
  lineName?: string
  onBack: () => void
}

export default function RegistryPage({ lineCode, factoryName, lineName, onBack }: Props) {
  const { equipment, stats, loading, selected, setSelected, save } = useEquipment(lineCode)
  const [viewMode, setViewMode] = useState<'box' | 'cloud'>('box')

  // Enable keyboard shortcuts for editing
  useEditingKeyboard()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-mono text-sm text-muted-foreground animate-pulse">데이터 로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Equipment List */}
      <EquipmentList
        equipment={equipment}
        selectedId={selected?.equipment_id ?? null}
        onSelect={eq => setSelected(eq)}
      />

      {/* 3D View */}
      <div className="flex-1 relative overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-sm text-muted-foreground">씬 로딩 중...</span>
          </div>
        }>
          <Scene3D
            equipment={equipment}
            selectedId={selected?.equipment_id ?? null}
            onSelect={eq => setSelected(eq)}
            viewMode={viewMode}
          />
        </Suspense>

        {/* Toolbar Area */}
        <div className="absolute top-4 left-4 flex items-center gap-3">
          <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
          <EditingToolbar selectedEquipmentId={selected?.equipment_id} />
        </div>

        {/* Stats Overlay */}
        {stats && (
          <div className="absolute top-4 right-4 flex gap-3 pointer-events-none">
            {[
              { label: '전체', val: stats.total, color: 'text-foreground' },
              { label: '완료', val: stats.verified, color: 'text-success' },
              { label: '대기', val: stats.pending, color: 'text-warning' },
            ].map(s => (
              <Card key={s.label} className="px-4 py-3 bg-card/90 backdrop-blur-sm">
                <p className={cn('font-mono text-2xl font-semibold tabular-nums', s.color)}>
                  {s.val}
                </p>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
              </Card>
            ))}
          </div>
        )}

        {/* Control Hint */}
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-sm text-muted-foreground pointer-events-none whitespace-nowrap">
          드래그: 회전 | 스크롤: 줌 | 박스 클릭: 선택
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
    </div>
  )
}

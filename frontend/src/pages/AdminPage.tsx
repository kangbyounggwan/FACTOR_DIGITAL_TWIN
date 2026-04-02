import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Building2, Factory as FactoryIcon, GitBranch, Box, Layers, Check, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { useCompanies, useCompanyFactories, useFactoryLines } from '@/hooks/useFactories'
import {
  useCompanyMutations,
  useFactoryMutations,
  useLineMutations,
  useDeleteConfirmation,
  useLineEquipment,
  useEquipmentMutations,
} from '@/hooks/useCrud'
import { useLayouts, useLayoutMutations } from '@/hooks/useLayouts'
import { EntityDialog } from '@/components/EntityDialog'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { Company, Factory, LineFull, CompanyCreate, FactoryCreate, LineCreate, Equipment, Layout, EquipmentType, fetchEquipmentTypes, ensureEquipmentType } from '@/lib/api'
import { toast } from 'sonner'

type EntityType = 'company' | 'factory' | 'line' | 'equipment'

export default function AdminPage() {
  // Selection state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)

  // Data hooks
  const { companies, loading: loadingCompanies, reload: reloadCompanies } = useCompanies()
  const { factories, loading: loadingFactories, reload: reloadFactories } = useCompanyFactories(
    companies.find(c => c.id === selectedCompanyId)?.code || null
  )
  const { lines, loading: loadingLines, reload: reloadLines } = useFactoryLines(
    factories.find(f => f.id === selectedFactoryId)?.code || null
  )
  const selectedLine = lines.find(l => l.id === selectedLineId)
  const { equipment, loading: loadingEquipment, reload: reloadEquipment } = useLineEquipment(
    selectedLine?.code || null
  )

  // Layout hooks
  const { layouts, loading: loadingLayouts, reload: reloadLayouts } = useLayouts(selectedFactoryId)
  const { activate: activateLayout, clone: cloneLayout, remove: removeLayout, saving: savingLayout } = useLayoutMutations()

  // Mutation hooks
  const companyMutations = useCompanyMutations()
  const factoryMutations = useFactoryMutations()
  const lineMutations = useLineMutations()
  const equipmentMutations = useEquipmentMutations()

  // Delete confirmation
  const deleteConfirm = useDeleteConfirmation()

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<EntityType>('company')
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingEntity, setEditingEntity] = useState<Company | Factory | LineFull | null>(null)

  // Equipment dialog state
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false)
  const [equipmentDialogMode, setEquipmentDialogMode] = useState<'create' | 'edit'>('create')
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [newEquipmentCode, setNewEquipmentCode] = useState('')
  const [newEquipmentName, setNewEquipmentName] = useState('')
  const [newEquipmentType, setNewEquipmentType] = useState('')
  const [newEquipmentZone, setNewEquipmentZone] = useState('')
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [isAddingNewType, setIsAddingNewType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')

  // Zone accordion state
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())

  // Layout dialog state
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false)
  const [layoutDialogMode, setLayoutDialogMode] = useState<'clone'>('clone')
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null)
  const [newLayoutName, setNewLayoutName] = useState('')

  // Reset selections when parent changes
  useEffect(() => {
    setSelectedFactoryId(null)
    setSelectedLineId(null)
  }, [selectedCompanyId])

  useEffect(() => {
    setSelectedLineId(null)
  }, [selectedFactoryId])

  // Reset expanded zones when line changes, expand all by default
  useEffect(() => {
    if (equipment.length > 0) {
      const zones = new Set(equipment.map(eq => eq.zone || '미지정'))
      setExpandedZones(zones)
    }
  }, [selectedLineId, equipment.length])

  // Load equipment types when dialog opens
  useEffect(() => {
    if (equipmentDialogOpen) {
      fetchEquipmentTypes().then(setEquipmentTypes).catch(console.error)
      setIsAddingNewType(false)
      setNewTypeName('')
    }
  }, [equipmentDialogOpen])

  // Handlers
  // Generate next equipment code based on existing equipment
  const generateNextEquipmentCode = () => {
    if (equipment.length === 0) {
      return 'EQ_001'
    }

    // Find codes that match pattern PREFIX_NNN
    const codePattern = /^(.+_)(\d+)$/
    const matches = equipment.map(eq => {
      const match = eq.equipment_id.match(codePattern)
      return match ? { prefix: match[1], num: parseInt(match[2], 10) } : null
    }).filter(Boolean) as { prefix: string; num: number }[]

    if (matches.length === 0) {
      return 'EQ_001'
    }

    // Find the most common prefix and the highest number
    const prefixCounts: Record<string, number> = {}
    let maxNum = 0
    let commonPrefix = matches[0].prefix

    for (const m of matches) {
      prefixCounts[m.prefix] = (prefixCounts[m.prefix] || 0) + 1
      if (prefixCounts[m.prefix] > (prefixCounts[commonPrefix] || 0)) {
        commonPrefix = m.prefix
      }
      if (m.prefix === commonPrefix && m.num > maxNum) {
        maxNum = m.num
      }
    }

    // Generate next code
    const nextNum = (maxNum + 1).toString().padStart(3, '0')
    return `${commonPrefix}${nextNum}`
  }

  const handleOpenCreateDialog = (type: EntityType) => {
    if (type === 'equipment') {
      setEquipmentDialogMode('create')
      setEditingEquipment(null)
      setNewEquipmentCode(generateNextEquipmentCode())
      setNewEquipmentName('')
      setNewEquipmentType('')
      setNewEquipmentZone('')
      setEquipmentDialogOpen(true)
      return
    }
    setDialogType(type)
    setDialogMode('create')
    setEditingEntity(null)
    setDialogOpen(true)
  }

  const handleOpenEditDialog = (type: EntityType, entity: Company | Factory | LineFull) => {
    setDialogType(type)
    setDialogMode('edit')
    setEditingEntity(entity)
    setDialogOpen(true)
  }

  const handleSaveEntity = async (data: CompanyCreate | FactoryCreate | LineCreate) => {
    if (dialogType === 'company') {
      if (dialogMode === 'create') {
        await companyMutations.create(data as CompanyCreate)
      } else if (editingEntity) {
        await companyMutations.update(editingEntity.id, data)
      }
      reloadCompanies()
    } else if (dialogType === 'factory') {
      if (dialogMode === 'create') {
        await factoryMutations.create(data as FactoryCreate)
      } else if (editingEntity) {
        await factoryMutations.update(editingEntity.id, data)
      }
      reloadFactories()
    } else if (dialogType === 'line') {
      if (dialogMode === 'create') {
        await lineMutations.create(data as LineCreate)
      } else if (editingEntity) {
        await lineMutations.update(editingEntity.id, data)
      }
      reloadLines()
    }
  }

  const handleDeleteEntity = async (type: EntityType, id: string) => {
    if (type === 'equipment') {
      if (!confirm('이 설비를 삭제하시겠습니까?')) return
      try {
        await equipmentMutations.remove(id)
        reloadEquipment()
        reloadLines() // Update equipment count
        toast.success('설비 삭제 완료')
      } catch (e) {
        toast.error('설비 삭제 실패')
      }
      return
    }
    await deleteConfirm.prepareDelete(type, id)
  }

  const handleConfirmDelete = async () => {
    await deleteConfirm.confirmDelete()

    // Reload appropriate list
    if (deleteConfirm.deleteInfo?.entityType === 'company') {
      reloadCompanies()
      if (selectedCompanyId === deleteConfirm.deleteInfo.entityId) {
        setSelectedCompanyId(null)
      }
    } else if (deleteConfirm.deleteInfo?.entityType === 'factory') {
      reloadFactories()
      if (selectedFactoryId === deleteConfirm.deleteInfo.entityId) {
        setSelectedFactoryId(null)
      }
    } else if (deleteConfirm.deleteInfo?.entityType === 'line') {
      reloadLines()
      if (selectedLineId === deleteConfirm.deleteInfo.entityId) {
        setSelectedLineId(null)
      }
    }
  }

  // Equipment handlers
  const handleOpenEditEquipment = (eq: Equipment) => {
    setEquipmentDialogMode('edit')
    setEditingEquipment(eq)
    setNewEquipmentCode(eq.equipment_id)
    setNewEquipmentName(eq.name || '')
    setNewEquipmentType(eq.equipment_type || '')
    setNewEquipmentZone(eq.zone || '')
    setEquipmentDialogOpen(true)
  }

  const handleSaveEquipment = async () => {
    // Determine the type code to use
    let typeCode = newEquipmentType.trim() || 'UNKNOWN'

    // If adding a new type, ensure it exists first
    if (isAddingNewType && newTypeName.trim()) {
      try {
        const newType = await ensureEquipmentType(newTypeName.trim().toUpperCase().replace(/\s+/g, '_'))
        typeCode = newType.code
        // Refresh the equipment types list
        fetchEquipmentTypes().then(setEquipmentTypes).catch(console.error)
      } catch (e) {
        toast.error('설비 타입 생성 실패')
        return
      }
    }

    if (equipmentDialogMode === 'create') {
      if (!selectedLineId) {
        toast.error('라인을 선택해주세요')
        return
      }
      if (!newEquipmentCode.trim()) {
        toast.error('설비 코드를 입력해주세요')
        return
      }

      try {
        await equipmentMutations.create({
          line_id: selectedLineId,
          scan_code: newEquipmentCode.trim(),
          name: newEquipmentName.trim() || undefined,
          equipment_type: typeCode,
          zone: newEquipmentZone.trim() || undefined,
        })
        reloadEquipment()
        reloadLines() // Update equipment count
        setEquipmentDialogOpen(false)
        toast.success('설비 추가 완료')
      } catch (e) {
        toast.error('설비 추가 실패')
      }
    } else if (editingEquipment) {
      try {
        await equipmentMutations.update(editingEquipment.equipment_id, {
          name: newEquipmentName.trim() || undefined,
          equipment_type: typeCode,
          zone: newEquipmentZone.trim() || undefined,
        })
        reloadEquipment()
        setEquipmentDialogOpen(false)
        toast.success('설비 수정 완료')
      } catch (e) {
        toast.error('설비 수정 실패')
      }
    }
  }

  // Layout handlers
  const handleActivateLayout = async (layout: Layout) => {
    try {
      await activateLayout(layout.id)
      reloadLayouts()
      toast.success(`"${layout.name}" 레이아웃 활성화됨`)
    } catch (e) {
      toast.error('레이아웃 활성화 실패')
    }
  }

  const handleOpenCloneDialog = (layout: Layout) => {
    setSelectedLayout(layout)
    setNewLayoutName(`${layout.name} 복사본`)
    setLayoutDialogMode('clone')
    setLayoutDialogOpen(true)
  }

  const handleCloneLayout = async () => {
    if (!selectedLayout || !newLayoutName.trim()) return

    try {
      await cloneLayout(selectedLayout.id, newLayoutName.trim())
      reloadLayouts()
      setLayoutDialogOpen(false)
      toast.success('레이아웃 복제 완료')
    } catch (e) {
      toast.error('레이아웃 복제 실패')
    }
  }

  const handleDeleteLayout = async (layout: Layout) => {
    if (!confirm(`"${layout.name}" 레이아웃을 삭제하시겠습니까?`)) return

    try {
      await removeLayout(layout.id)
      reloadLayouts()
      toast.success('레이아웃 삭제 완료')
    } catch (e) {
      toast.error('레이아웃 삭제 실패')
    }
  }

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)
  const selectedFactory = factories.find(f => f.id === selectedFactoryId)

  return (
    <div className="h-full p-6 overflow-hidden flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold">관리</h1>
        <p className="text-muted-foreground">회사, 공장, 생산라인, 설비, 레이아웃을 관리합니다.</p>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4" style={{ minHeight: 0 }}>
        {/* Companies Column */}
        <Card className="flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <CardHeader className="flex-shrink-0 py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <CardTitle className="text-base">회사</CardTitle>
              </div>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleOpenCreateDialog('company')}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CardDescription className="text-xs">{companies.length}개</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0" style={{ minHeight: 0 }}>
            <Table>
              <TableBody>
                {companies.map((company) => (
                  <TableRow
                    key={company.id}
                    className={`cursor-pointer ${selectedCompanyId === company.id ? 'bg-accent' : ''}`}
                    onClick={() => setSelectedCompanyId(company.id)}
                  >
                    <TableCell className="py-2">
                      <div className="font-medium text-sm">{company.name}</div>
                      <div className={`text-xs ${selectedCompanyId === company.id ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>{company.code}</div>
                    </TableCell>
                    <TableCell className="py-2 w-16">
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditDialog('company', company)
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteEntity('company', company.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {companies.length === 0 && !loadingCompanies && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-8">
                      등록된 회사가 없습니다
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Factories Column */}
        <Card className="flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <CardHeader className="flex-shrink-0 py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FactoryIcon className="h-4 w-4" />
                <CardTitle className="text-base">공장</CardTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => handleOpenCreateDialog('factory')}
                disabled={!selectedCompanyId}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              {selectedCompany ? `${factories.length}개` : '회사 선택'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0" style={{ minHeight: 0 }}>
            {selectedCompanyId ? (
              <>
                <Table>
                  <TableBody>
                    {factories.map((factory) => (
                      <TableRow
                        key={factory.id}
                        className={`cursor-pointer ${selectedFactoryId === factory.id ? 'bg-accent' : ''}`}
                        onClick={() => setSelectedFactoryId(factory.id)}
                      >
                        <TableCell className="py-2">
                          <div className="font-medium text-sm">{factory.name}</div>
                          <div className={`text-xs ${selectedFactoryId === factory.id ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>{factory.code}</div>
                        </TableCell>
                        <TableCell className="py-2 w-16">
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEditDialog('factory', factory)
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteEntity('factory', factory.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {factories.length === 0 && !loadingFactories && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-8">
                          등록된 공장이 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Layout Section */}
                {selectedFactoryId && (
                  <div className="border-t mt-2 pt-2 px-2">
                    <div className="flex items-center gap-1 mb-2 px-1">
                      <Layers className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">레이아웃</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-auto">
                        {layouts.length}
                      </Badge>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {layouts.map((layout) => (
                        <div
                          key={layout.id}
                          className="flex items-center gap-1 px-2 py-1.5 rounded bg-muted/50 text-xs"
                        >
                          <span className="flex-1 truncate">{layout.name}</span>
                          {layout.is_active && (
                            <Badge variant="default" className="text-[10px] h-4 px-1">활성</Badge>
                          )}
                          <div className="flex gap-0.5">
                            {!layout.is_active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => handleActivateLayout(layout)}
                                disabled={savingLayout}
                                title="활성화"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleOpenCloneDialog(layout)}
                              disabled={savingLayout}
                              title="복제"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteLayout(layout)}
                              disabled={savingLayout}
                              title="삭제"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {layouts.length === 0 && !loadingLayouts && (
                        <p className="text-xs text-muted-foreground text-center py-2">레이아웃 없음</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                회사를 선택하세요
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lines Column */}
        <Card className="flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <CardHeader className="flex-shrink-0 py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                <CardTitle className="text-base">생산라인</CardTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => handleOpenCreateDialog('line')}
                disabled={!selectedFactoryId}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              {selectedFactory ? `${lines.length}개` : '공장 선택'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0" style={{ minHeight: 0 }}>
            {selectedFactoryId ? (
              <Table>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow
                      key={line.id}
                      className={`cursor-pointer ${selectedLineId === line.id ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedLineId(line.id)}
                    >
                      <TableCell className="py-2">
                        <div className="font-medium text-sm">{line.name}</div>
                        <div className={`text-xs ${selectedLineId === line.id ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>{line.code}</div>
                      </TableCell>
                      <TableCell className="py-2 w-10">
                        <Badge variant="secondary" className="text-[10px]">{line.equipment_count}</Badge>
                      </TableCell>
                      <TableCell className="py-2 w-16">
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEditDialog('line', line as unknown as LineFull)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteEntity('line', line.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lines.length === 0 && !loadingLines && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">
                        등록된 라인이 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                공장을 선택하세요
              </div>
            )}
          </CardContent>
        </Card>

        {/* Equipment Column */}
        <Card className="flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <CardHeader className="flex-shrink-0 py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                <CardTitle className="text-base">설비</CardTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => handleOpenCreateDialog('equipment')}
                disabled={!selectedLineId}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              {selectedLine ? `${equipment.length}개` : '라인 선택'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0" style={{ minHeight: 0 }}>
            {selectedLineId ? (
              <div className="divide-y">
                {(() => {
                  // Group equipment by zone
                  const grouped = equipment.reduce((acc, eq) => {
                    const zone = eq.zone || '미지정'
                    if (!acc[zone]) acc[zone] = []
                    acc[zone].push(eq)
                    return acc
                  }, {} as Record<string, Equipment[]>)

                  const zones = Object.keys(grouped).sort((a, b) => {
                    if (a === '미지정') return 1
                    if (b === '미지정') return -1
                    return a.localeCompare(b)
                  })

                  if (equipment.length === 0 && !loadingEquipment) {
                    return (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        등록된 설비가 없습니다
                      </div>
                    )
                  }

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

                  return zones.map((zone) => {
                    const isExpanded = expandedZones.has(zone)
                    return (
                      <div key={zone}>
                        <button
                          className="w-full sticky top-0 bg-primary/90 hover:bg-primary text-primary-foreground px-3 py-2 border-b flex items-center gap-2 transition-colors"
                          onClick={() => toggleZone(zone)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="text-xs font-semibold flex-1 text-left">{zone}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {grouped[zone].length}
                          </Badge>
                        </button>
                        {isExpanded && (
                          <Table>
                            <TableBody>
                              {grouped[zone].map((eq) => (
                                <TableRow key={eq.equipment_id}>
                                  <TableCell className="py-2">
                                    <div className="font-medium text-sm">{eq.name || eq.equipment_id}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{eq.equipment_id}</div>
                                  </TableCell>
                                  <TableCell className="py-2 w-12">
                                    {eq.verified ? (
                                      <Badge variant="default" className="text-[10px] whitespace-nowrap">완료</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px] whitespace-nowrap">대기</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2 w-16">
                                    <div className="flex gap-0.5">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleOpenEditEquipment(eq)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteEntity('equipment', eq.equipment_id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                라인을 선택하세요
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entity Dialog */}
      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={dialogType === 'equipment' ? 'line' : dialogType}
        mode={dialogMode}
        entity={editingEntity || undefined}
        companies={companies}
        factories={factories}
        defaultParentId={
          dialogType === 'factory'
            ? selectedCompanyId || undefined
            : dialogType === 'line'
            ? selectedFactoryId || undefined
            : undefined
        }
        onSave={handleSaveEntity}
        saving={
          companyMutations.saving ||
          factoryMutations.saving ||
          lineMutations.saving
        }
      />

      {/* Equipment Create/Edit Dialog */}
      <Dialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{equipmentDialogMode === 'create' ? '설비 추가' : '설비 수정'}</DialogTitle>
            <DialogDescription>
              {equipmentDialogMode === 'create'
                ? `${selectedLine?.name}에 새 설비를 추가합니다.`
                : `${editingEquipment?.equipment_id} 설비를 수정합니다.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scan_code">설비 코드</Label>
              <Input
                id="scan_code"
                value={newEquipmentCode}
                onChange={(e) => setNewEquipmentCode(e.target.value)}
                placeholder="예: EQ_001"
                className="font-mono"
                disabled={equipmentDialogMode === 'edit'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment_name">설비 이름</Label>
              <Input
                id="equipment_name"
                value={newEquipmentName}
                onChange={(e) => setNewEquipmentName(e.target.value)}
                placeholder="예: SMT 라인 1호기"
              />
            </div>
            <div className="space-y-2">
              <Label>설비 타입</Label>
              {isAddingNewType ? (
                <div className="flex gap-2">
                  <Input
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="새 타입 이름 입력"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddingNewType(false)
                      setNewTypeName('')
                    }}
                  >
                    취소
                  </Button>
                </div>
              ) : (
                <Select
                  value={newEquipmentType}
                  onValueChange={(value) => {
                    if (value === '__NEW__') {
                      setIsAddingNewType(true)
                      setNewEquipmentType('')
                    } else {
                      setNewEquipmentType(value)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="타입 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.code}>
                        {type.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__NEW__" className="text-primary font-medium">
                      + 새 타입 추가...
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment_zone">구역</Label>
              <Input
                id="equipment_zone"
                value={newEquipmentZone}
                onChange={(e) => setNewEquipmentZone(e.target.value)}
                placeholder="예: A동 1층, 북측"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipmentDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSaveEquipment}
              disabled={
                !newEquipmentCode.trim() ||
                equipmentMutations.saving ||
                (isAddingNewType && !newTypeName.trim())
              }
            >
              {equipmentDialogMode === 'create' ? '추가' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layout Clone Dialog */}
      <Dialog open={layoutDialogOpen} onOpenChange={setLayoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>레이아웃 복제</DialogTitle>
            <DialogDescription>
              "{selectedLayout?.name}" 레이아웃을 복제합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="layout_name">새 이름</Label>
              <Input
                id="layout_name"
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                placeholder="레이아웃 이름"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLayoutDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCloneLayout} disabled={!newLayoutName.trim() || savingLayout}>
              복제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={deleteConfirm.deleteInfo !== null}
        onOpenChange={() => deleteConfirm.cancelDelete()}
        deleteInfo={deleteConfirm.deleteInfo}
        loading={deleteConfirm.loading}
        onConfirm={handleConfirmDelete}
        onCancel={deleteConfirm.cancelDelete}
      />
    </div>
  )
}

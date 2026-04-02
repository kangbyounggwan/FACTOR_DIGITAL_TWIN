import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Company,
  CompanyCreate,
  Factory,
  FactoryCreate,
  LineFull,
  LineCreate,
} from '@/lib/api'

type EntityType = 'company' | 'factory' | 'line'

interface EntityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: EntityType
  mode: 'create' | 'edit'
  /** Existing entity for edit mode */
  entity?: Company | Factory | LineFull
  /** Parent options */
  companies?: Company[]
  factories?: Factory[]
  /** Selected parent ID (for create mode) */
  defaultParentId?: string
  /** Callback after save */
  onSave: (data: CompanyCreate | FactoryCreate | LineCreate) => Promise<void>
  saving?: boolean
}

const entityTypeLabels: Record<EntityType, { singular: string; title: string }> = {
  company: { singular: '회사', title: '회사' },
  factory: { singular: '공장', title: '공장' },
  line: { singular: '생산라인', title: '생산라인' },
}

export function EntityDialog({
  open,
  onOpenChange,
  entityType,
  mode,
  entity,
  companies,
  factories,
  defaultParentId,
  onSave,
  saving = false,
}: EntityDialogProps) {
  // Form state
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [address, setAddress] = useState('')
  const [building, setBuilding] = useState('')
  const [floor, setFloor] = useState('')
  const [area, setArea] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [parentId, setParentId] = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && entity) {
        setCode((entity as any).code || '')
        setName(entity.name || '')

        if (entityType === 'company') {
          const c = entity as Company
          setDescription(c.description || '')
          setLogoUrl(c.logo_url || '')
        } else if (entityType === 'factory') {
          const f = entity as Factory
          setAddress((f as any).address || '')
          // company_id가 없으면 defaultParentId 사용 (Factory 타입은 company_id가 없음)
          setParentId((f as any).company_id || defaultParentId || '')
        } else if (entityType === 'line') {
          const l = entity as LineFull
          setDescription(l.description || '')
          setBuilding(l.building || '')
          setFloor(l.floor || '')
          setArea(l.area || '')
          setSortOrder(l.sort_order || 0)
          // factory_id가 없으면 defaultParentId 사용 (ProductionLine 타입은 factory_id가 없음)
          setParentId(l.factory_id || defaultParentId || '')
        }
      } else {
        // Create mode - reset all fields
        setCode('')
        setName('')
        setDescription('')
        setLogoUrl('')
        setAddress('')
        setBuilding('')
        setFloor('')
        setArea('')
        setSortOrder(0)
        setParentId(defaultParentId || '')
      }
    }
  }, [open, mode, entity, entityType, defaultParentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!code.trim() || !name.trim()) return

    try {
      if (entityType === 'company') {
        const data: CompanyCreate = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
        }
        await onSave(data)
      } else if (entityType === 'factory') {
        if (!parentId) return
        const data: FactoryCreate = {
          company_id: parentId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          address: address.trim() || null,
        }
        await onSave(data)
      } else if (entityType === 'line') {
        if (!parentId) return
        const data: LineCreate = {
          factory_id: parentId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || null,
          building: building.trim() || null,
          floor: floor.trim() || null,
          area: area.trim() || null,
          sort_order: sortOrder,
        }
        await onSave(data)
      }

      onOpenChange(false)
    } catch (e) {
      console.error('Failed to save entity:', e)
    }
  }

  const labels = entityTypeLabels[entityType]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? `${labels.title} 추가` : `${labels.title} 수정`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? `새 ${labels.singular}의 정보를 입력하세요.`
              : `${labels.singular} 정보를 수정합니다.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Parent Selector (for factory and line) */}
            {entityType === 'factory' && companies && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">회사</Label>
                <Select
                  value={parentId}
                  onValueChange={setParentId}
                  disabled={mode === 'edit'}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="회사 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {entityType === 'line' && factories && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">공장</Label>
                <Select
                  value={parentId}
                  onValueChange={setParentId}
                  disabled={mode === 'edit'}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="공장 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {factories.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Code Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">
                코드
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: FACTORY-01"
                className="col-span-3"
                required
                disabled={mode === 'edit'}
                autoFocus={mode === 'create'}
              />
            </div>

            {/* Name Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                이름
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="표시 이름"
                className="col-span-3"
                required
                autoFocus={mode === 'edit'}
              />
            </div>

            {/* Company-specific fields */}
            {entityType === 'company' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    설명
                  </Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="선택 사항"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="logoUrl" className="text-right">
                    로고 URL
                  </Label>
                  <Input
                    id="logoUrl"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="col-span-3"
                  />
                </div>
              </>
            )}

            {/* Factory-specific fields */}
            {entityType === 'factory' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address" className="text-right">
                  주소
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="공장 주소"
                  className="col-span-3"
                />
              </div>
            )}

            {/* Line-specific fields */}
            {entityType === 'line' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    설명
                  </Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="선택 사항"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="building" className="text-right">
                    건물
                  </Label>
                  <Input
                    id="building"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    placeholder="A동"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="floor" className="text-right">
                    층
                  </Label>
                  <Input
                    id="floor"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="1층"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="area" className="text-right">
                    구역
                  </Label>
                  <Input
                    id="area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="북측"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="sortOrder" className="text-right">
                    정렬순서
                  </Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                    min={0}
                    className="col-span-3"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                !code.trim() ||
                !name.trim() ||
                ((entityType === 'factory' || entityType === 'line') && !parentId)
              }
            >
              {saving ? '저장 중...' : mode === 'create' ? '추가' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

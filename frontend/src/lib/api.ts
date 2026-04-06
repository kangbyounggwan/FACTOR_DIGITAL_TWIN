import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export interface Equipment {
  id: number
  equipment_id: string
  name?: string
  site_id: string
  line_code?: string
  equipment_type: string
  zone: string
  scan_date: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_d: number
  size_h: number
  point_count: number
  ply_url: string | null
  verified: boolean
  note: string
  group_id?: string | null
  sub_type?: string | null
}

export interface SiteStats {
  total: number
  verified: number
  pending: number
  by_type: Record<string, number>
}

export interface EquipmentUpdate {
  name?: string
  equipment_type?: string
  zone?: string
  verified?: boolean
  note?: string
  sub_type?: string | null
  // Position and size
  centroid_x?: number
  centroid_y?: number
  centroid_z?: number
  size_w?: number
  size_d?: number
  size_h?: number
}


// 설비 목록 (라인별)
export const fetchEquipment = (siteId: string) =>
  api.get<Equipment[]>(`/equipment/${siteId}`).then(r => r.data)

// 설비 목록 (공장 전체)
export const fetchFactoryEquipment = (factoryCode: string) =>
  api.get<Equipment[]>(`/equipment/factories/${factoryCode}`).then(r => r.data)

// 설비 업데이트 (단일)
export const updateEquipment = (equipmentId: string, body: EquipmentUpdate) =>
  api.patch<Equipment>(`/equipment/${equipmentId}`, body).then(r => r.data)

// 설비 배치 업데이트 (다중) - 한 번의 API 호출로 여러 설비 업데이트
export interface EquipmentBatchUpdate {
  equipment_id: string
  centroid_x?: number
  centroid_y?: number
  centroid_z?: number
  size_w?: number
  size_h?: number
  size_d?: number
}

export const updateEquipmentBatch = (updates: EquipmentBatchUpdate[]) =>
  api.patch<Equipment[]>('/equipment/batch', updates).then(r => r.data)

// 통계
export const fetchStats = (siteId: string) =>
  api.get<SiteStats>(`/equipment/${siteId}/stats/summary`).then(r => r.data)


// Point Cloud Data
export interface PointCloudData {
  positions: number[][]
  colors: number[][]
  point_count: number
}

export const fetchEquipmentPoints = (equipmentId: string, lod: 'high' | 'medium' | 'low' = 'high') =>
  api.get<PointCloudData>(`/equipment/${equipmentId}/points?lod=${lod}`).then(r => r.data)


// Company, Factory & Production Line
export interface Company {
  id: string
  code: string
  name: string
  description: string | null
  logo_url: string | null
}

export interface Factory {
  id: string
  code: string
  name: string
  address: string | null
}

export interface ProductionLine {
  id: string
  code: string
  name: string
  description: string | null
  location: string | null
  equipment_count: number
}

export const fetchCompanies = () =>
  api.get<Company[]>('/companies/').then(r => r.data)

export const fetchCompanyFactories = (companyCode: string) =>
  api.get<Factory[]>(`/companies/${companyCode}/factories`).then(r => r.data)

export const fetchFactories = () =>
  api.get<Factory[]>('/factories/').then(r => r.data)

export const fetchFactoryLines = (factoryCode: string) =>
  api.get<ProductionLine[]>(`/factories/${factoryCode}/lines`).then(r => r.data)

// Equipment Types
export interface EquipmentType {
  id: string
  code: string
  name: string
  color_hex: string | null
}

export const fetchEquipmentTypes = () =>
  api.get<EquipmentType[]>('/equipment-types/').then(r => r.data)

export const ensureEquipmentType = (code: string) =>
  api.get<EquipmentType>(`/equipment-types/ensure/${code}`).then(r => r.data)

// =============================================================================
// LAYOUT VERSIONING
// =============================================================================

export interface LayoutEquipment {
  id: string
  equipment_id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
  rotation_x: number
  rotation_y: number
  rotation_z: number
}

export interface Layout {
  id: string
  factory_id: string
  name: string
  description: string | null
  is_active: boolean
  equipment_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  // 공장 바닥 설정
  floor_x: number | null
  floor_y: number | null
  floor_width: number | null
  floor_height: number | null
  // 배경 이미지 설정
  background_image: string | null
  background_opacity: number | null
}

export interface LayoutDetail extends Layout {
  equipment: LayoutEquipment[]
}

export interface LayoutCreate {
  factory_id: string
  name: string
  description?: string | null
  equipment?: LayoutEquipmentCreate[]
  is_active?: boolean
  // 공장 바닥 설정
  floor_x?: number | null
  floor_y?: number | null
  floor_width?: number | null
  floor_height?: number | null
  // 배경 이미지 설정
  background_image?: string | null
  background_opacity?: number | null
}

export interface LayoutEquipmentCreate {
  equipment_id: string
  centroid_x: number
  centroid_y: number
  centroid_z: number
  size_w: number
  size_h: number
  size_d: number
  rotation_x?: number
  rotation_y?: number
  rotation_z?: number
}

export interface LayoutActivateResponse {
  activated_id: string
  deactivated_ids: string[]
}

export interface LayoutCompareResponse {
  added: string[]
  removed: string[]
  moved: string[]
}

// Layout API functions
export const fetchLayouts = (factoryId?: string) =>
  api.get<Layout[]>('/layouts/', { params: factoryId ? { factory_id: factoryId } : {} }).then(r => r.data)

export const fetchLayout = (layoutId: string) =>
  api.get<LayoutDetail>(`/layouts/${layoutId}`).then(r => r.data)

export const fetchActiveLayout = (factoryId: string) =>
  api.get<LayoutDetail | null>(`/layouts/factory/${factoryId}/active`).then(r => r.data)

export const createLayout = (data: LayoutCreate) =>
  api.post<LayoutDetail>('/layouts/', data).then(r => r.data)

export const updateLayout = (layoutId: string, data: {
  name?: string
  description?: string
  floor_x?: number | null
  floor_y?: number | null
  floor_width?: number | null
  floor_height?: number | null
  background_image?: string | null
  background_opacity?: number | null
}) =>
  api.patch<Layout>(`/layouts/${layoutId}`, data).then(r => r.data)

export const deleteLayout = (layoutId: string) =>
  api.delete(`/layouts/${layoutId}`)

export const activateLayout = (layoutId: string) =>
  api.post<LayoutActivateResponse>(`/layouts/${layoutId}/activate`).then(r => r.data)

export const cloneLayout = (layoutId: string, newName: string, newDescription?: string) =>
  api.post<LayoutDetail>(`/layouts/${layoutId}/clone`, {
    new_name: newName,
    new_description: newDescription,
  }).then(r => r.data)

export const compareLayouts = (layoutAId: string, layoutBId: string) =>
  api.get<LayoutCompareResponse>(`/layouts/compare/${layoutAId}/${layoutBId}`).then(r => r.data)

export const saveLayoutFromViewer = (
  factoryId: string,
  name: string,
  equipment: LayoutEquipmentCreate[],
  description?: string,
  setActive?: boolean,
  floorBounds?: { x: number; y: number; width: number; height: number } | null,
  backgroundImage?: string | null,
  backgroundOpacity?: number | null
) =>
  api.post<LayoutDetail>('/layouts/save-from-viewer', {
    factory_id: factoryId,
    name,
    description,
    equipment,
    set_active: setActive ?? false,
    floor_x: floorBounds?.x ?? null,
    floor_y: floorBounds?.y ?? null,
    floor_width: floorBounds?.width ?? null,
    floor_height: floorBounds?.height ?? null,
    background_image: backgroundImage ?? null,
    background_opacity: backgroundOpacity ?? 0.5,
  }).then(r => r.data)

export const updateLayoutEquipment = (layoutId: string, equipment: LayoutEquipmentCreate[]) =>
  api.put<LayoutDetail>(`/layouts/${layoutId}/equipment`, equipment).then(r => r.data)

// =============================================================================
// CRUD OPERATIONS (Companies, Factories, Lines)
// =============================================================================

export interface CompanyCreate {
  code: string
  name: string
  description?: string | null
  logo_url?: string | null
}

export interface CompanyUpdate {
  name?: string
  description?: string | null
  logo_url?: string | null
  is_active?: boolean
}

export interface CompanyDeleteInfo {
  company_id: string
  company_name: string
  factory_count: number
  line_count: number
  equipment_count: number
}

export interface FactoryFull {
  id: string
  company_id: string
  code: string
  name: string
  address: string | null
  is_active: boolean
  company_name: string | null
}

export interface FactoryCreate {
  company_id: string
  code: string
  name: string
  address?: string | null
}

export interface FactoryUpdate {
  name?: string
  address?: string | null
  is_active?: boolean
}

export interface FactoryDeleteInfo {
  factory_id: string
  factory_name: string
  line_count: number
  equipment_count: number
  layout_count: number
}

export interface LineFull {
  id: string
  factory_id: string
  code: string
  name: string
  description: string | null
  building: string | null
  floor: string | null
  area: string | null
  sort_order: number
  is_active: boolean
  factory_name: string | null
  factory_code: string | null
}

export interface LineCreate {
  factory_id: string
  code: string
  name: string
  description?: string | null
  building?: string | null
  floor?: string | null
  area?: string | null
  sort_order?: number
}

export interface LineUpdate {
  name?: string
  description?: string | null
  building?: string | null
  floor?: string | null
  area?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface LineDeleteInfo {
  line_id: string
  line_name: string
  equipment_count: number
}

// Company CRUD
export const createCompany = (data: CompanyCreate) =>
  api.post<Company>('/companies/', data).then(r => r.data)

export const getCompanyById = (companyId: string) =>
  api.get<Company>(`/companies/${companyId}/detail`).then(r => r.data)

export const updateCompany = (companyId: string, data: CompanyUpdate) =>
  api.put<Company>(`/companies/${companyId}`, data).then(r => r.data)

export const deleteCompany = (companyId: string) =>
  api.delete(`/companies/${companyId}`)

export const getCompanyDeleteInfo = (companyId: string) =>
  api.get<CompanyDeleteInfo>(`/companies/${companyId}/delete-info`).then(r => r.data)

// Factory CRUD
export const createFactory = (data: FactoryCreate) =>
  api.post<FactoryFull>('/factories/', data).then(r => r.data)

export const getFactoryById = (factoryId: string) =>
  api.get<FactoryFull>(`/factories/${factoryId}/detail`).then(r => r.data)

export const updateFactory = (factoryId: string, data: FactoryUpdate) =>
  api.put<FactoryFull>(`/factories/${factoryId}`, data).then(r => r.data)

export const deleteFactory = (factoryId: string) =>
  api.delete(`/factories/${factoryId}`)

export const getFactoryDeleteInfo = (factoryId: string) =>
  api.get<FactoryDeleteInfo>(`/factories/${factoryId}/delete-info`).then(r => r.data)

// Line CRUD
export const fetchLines = (factoryId?: string) =>
  api.get<LineFull[]>('/lines/', { params: factoryId ? { factory_id: factoryId } : {} }).then(r => r.data)

export const getLineById = (lineId: string) =>
  api.get<LineFull>(`/lines/${lineId}`).then(r => r.data)

export const createLine = (data: LineCreate) =>
  api.post<LineFull>('/lines/', data).then(r => r.data)

export const updateLine = (lineId: string, data: LineUpdate) =>
  api.put<LineFull>(`/lines/${lineId}`, data).then(r => r.data)

export const deleteLine = (lineId: string) =>
  api.delete(`/lines/${lineId}`)

export const getLineDeleteInfo = (lineId: string) =>
  api.get<LineDeleteInfo>(`/lines/${lineId}/delete-info`).then(r => r.data)

// =============================================================================
// EQUIPMENT CRUD
// =============================================================================

export interface EquipmentCreate {
  line_id: string
  scan_code: string
  name?: string
  equipment_type?: string
  zone?: string
  centroid_x?: number
  centroid_y?: number
  centroid_z?: number
  size_w?: number
  size_h?: number
  size_d?: number
  note?: string
}

export const createEquipment = (data: EquipmentCreate) =>
  api.post<Equipment>('/equipment/', data).then(r => r.data)

export const deleteEquipment = (equipmentId: string) =>
  api.delete(`/equipment/${equipmentId}`)

export const fetchLineEquipment = (lineCode: string) =>
  api.get<Equipment[]>(`/equipment/lines/${lineCode}`).then(r => r.data)

// =============================================================================
// EQUIPMENT GROUPS (설비 그룹 - 존 간 연결, 컨베이어 브릿지 등)
// =============================================================================

export interface EquipmentGroup {
  id: string
  line_id: string
  name: string
  group_type: string  // BRIDGE, CLUSTER, FLOW 등
  description: string | null
  centroid_x: number | null
  centroid_y: number | null
  centroid_z: number | null
  size_w: number | null
  size_h: number | null
  size_d: number | null
  member_count: number
  member_ids: string[]
  created_at: string
  updated_at: string
}

export interface EquipmentGroupCreate {
  line_id: string  // line code
  name: string
  group_type?: string
  description?: string
  equipment_ids?: string[]
}

// Equipment Group API functions
export const fetchEquipmentGroups = (lineCode: string) =>
  api.get<EquipmentGroup[]>(`/equipment-groups/line/${lineCode}`).then(r => r.data)

export const fetchFactoryEquipmentGroups = (factoryCode: string) =>
  api.get<EquipmentGroup[]>(`/equipment-groups/factory/${factoryCode}`).then(r => r.data)

export const createEquipmentGroup = (data: EquipmentGroupCreate) =>
  api.post<EquipmentGroup>('/equipment-groups/', data).then(r => r.data)

// =============================================================================
// FLOW CONNECTIONS (설비 간 흐름 화살표)
// =============================================================================

export interface FlowConnection {
  id: string
  factory_id: string
  name: string
  description: string | null
  source_equipment_id: string
  target_equipment_id: string
  color: string
  line_style: string
  created_at: string
  updated_at: string
}

export const fetchFlowConnections = (factoryCode: string) =>
  api.get<FlowConnection[]>(`/flow-connections/factory/${factoryCode}`).then(r => r.data)

export const createFlowConnection = (data: {
  factory_id: string
  name: string
  description?: string
  source_equipment_id: string
  target_equipment_id: string
  color?: string
  line_style?: string
}) =>
  api.post<FlowConnection>('/flow-connections/', data).then(r => r.data)

export const deleteFlowConnection = (id: string) =>
  api.delete(`/flow-connections/${id}`)

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchFactoryEquipment, updateEquipment, fetchEquipmentGroups, fetchFactoryEquipmentGroups, fetchFlowConnections, Equipment, EquipmentUpdate, SiteStats, EquipmentGroup, FlowConnection } from '@/lib/api'

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

export function useFactoryEquipment(factoryCode: string) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Equipment | null>(null)

  // React Query로 데이터 캐싱 - 동일 factoryCode면 3D/2D 페이지 간 공유
  const { data: equipment = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['factory-equipment', factoryCode],
    queryFn: async () => {
      if (!factoryCode) return []
      if (USE_MOCK) return MOCK
      return fetchFactoryEquipment(factoryCode)
    },
    enabled: !!factoryCode,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
  })

  // Compute stats from equipment
  const stats: SiteStats | null = useMemo(() => {
    if (equipment.length === 0) return null
    return {
      total: equipment.length,
      verified: equipment.filter(e => e.verified).length,
      pending: equipment.filter(e => !e.verified).length,
      by_type: {}
    }
  }, [equipment])

  const save = useCallback(async (id: string, body: EquipmentUpdate) => {
    if (USE_MOCK) {
      // Mock 모드: 캐시 직접 업데이트
      queryClient.setQueryData(['factory-equipment', factoryCode], (prev: Equipment[] | undefined) =>
        prev?.map(e => e.equipment_id === id ? { ...e, ...body } : e) ?? []
      )
      return
    }
    await updateEquipment(id, body)
    // 캐시 무효화 후 refetch
    await queryClient.invalidateQueries({ queryKey: ['factory-equipment', factoryCode] })
  }, [factoryCode, queryClient])

  const reload = useCallback(() => refetch(), [refetch])

  return { equipment, stats, loading, selected, setSelected, save, reload }
}

// Equipment Groups hook
// lineCode가 있으면 라인별, 없으면 factoryCode로 공장 전체 그룹 조회
// React Query로 캐싱하여 3D/2D 페이지 간 데이터 공유
export function useEquipmentGroups(lineCode: string | null, factoryCode?: string | null) {
  const { data: groups = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['equipment-groups', lineCode, factoryCode],
    queryFn: async () => {
      // 라인 코드가 있으면 라인별 조회
      if (lineCode) {
        return fetchEquipmentGroups(lineCode)
      }
      // 라인 코드가 없고 공장 코드가 있으면 공장 전체 조회
      if (factoryCode) {
        return fetchFactoryEquipmentGroups(factoryCode)
      }
      return []
    },
    enabled: !!(lineCode || factoryCode),
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
  })

  const reload = useCallback(() => refetch(), [refetch])

  return { groups, loading, reload }
}

// Flow Connections hook
export function useFlowConnections(factoryCode: string | null) {
  const { data: connections = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['flow-connections', factoryCode],
    queryFn: async () => {
      if (!factoryCode) return []
      return fetchFlowConnections(factoryCode)
    },
    enabled: !!factoryCode,
    staleTime: 5 * 60 * 1000,
  })

  const reload = useCallback(() => refetch(), [refetch])
  return { connections, loading, reload }
}

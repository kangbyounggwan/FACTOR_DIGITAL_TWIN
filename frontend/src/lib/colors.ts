/**
 * 설비 및 그룹 색상 중앙 관리
 * - Tailwind: EquipmentList.tsx (bg-* 클래스)
 * - HEX: LayoutCanvas.tsx (SVG fill/stroke)
 * - ThreeHex: Scene3D.tsx (Three.js 색상)
 */

// 설비 타입별 색상 정의
export const EQUIPMENT_TYPE_COLORS: Record<string, {
  tailwind: string
  hex: string
  threeHex: number
}> = {
  SMT_LINE: {
    tailwind: 'bg-emerald-600',
    hex: '#059669',
    threeHex: 0x059669,
  },
  REFLOW_OVEN: {
    tailwind: 'bg-orange-600',
    hex: '#ea580c',
    threeHex: 0xea580c,
  },
  AOI_MACHINE: {
    tailwind: 'bg-indigo-500',
    hex: '#6366f1',
    threeHex: 0x6366f1,
  },
  SCREEN_PRINTER: {
    tailwind: 'bg-amber-600',
    hex: '#d97706',
    threeHex: 0xd97706,
  },
  PICK_AND_PLACE: {
    tailwind: 'bg-emerald-600',
    hex: '#059669',
    threeHex: 0x059669,
  },
  CONVEYOR: {
    tailwind: 'bg-lime-700',
    hex: '#65a30d',
    threeHex: 0x65a30d,
  },
  CONTROL_PANEL: {
    tailwind: 'bg-zinc-600',
    hex: '#52525b',
    threeHex: 0x52525b,
  },
  STORAGE_RACK: {
    tailwind: 'bg-zinc-600',
    hex: '#52525b',
    threeHex: 0x52525b,
  },
  CNC: {
    tailwind: 'bg-blue-600',
    hex: '#2563eb',
    threeHex: 0x2563eb,
  },
  MCT: {
    tailwind: 'bg-sky-600',
    hex: '#0284c7',
    threeHex: 0x0284c7,
  },
  ROBOT: {
    tailwind: 'bg-purple-600',
    hex: '#9333ea',
    threeHex: 0x9333ea,
  },
  INSP: {
    tailwind: 'bg-teal-600',
    hex: '#0d9488',
    threeHex: 0x0d9488,
  },
  WELD: {
    tailwind: 'bg-red-600',
    hex: '#dc2626',
    threeHex: 0xdc2626,
  },
  PRESS: {
    tailwind: 'bg-rose-600',
    hex: '#e11d48',
    threeHex: 0xe11d48,
  },
  INJECT: {
    tailwind: 'bg-fuchsia-600',
    hex: '#c026d3',
    threeHex: 0xc026d3,
  },
  PACK: {
    tailwind: 'bg-cyan-600',
    hex: '#06b6d4',
    threeHex: 0x06b6d4,
  },
  ASSY: {
    tailwind: 'bg-violet-600',
    hex: '#7c3aed',
    threeHex: 0x7c3aed,
  },
  AGV: {
    tailwind: 'bg-green-600',
    hex: '#16a34a',
    threeHex: 0x16a34a,
  },
  CONV: {
    tailwind: 'bg-lime-700',
    hex: '#65a30d',
    threeHex: 0x65a30d,
  },
  // 측정라인
  CMM: {
    tailwind: 'bg-sky-500',
    hex: '#0ea5e9',
    threeHex: 0x0ea5e9,
  },
  // 실크라인 (PCB 후공정)
  SILK: {
    tailwind: 'bg-amber-700',
    hex: '#b45309',
    threeHex: 0xb45309,
  },
  EXPOSURE: {
    tailwind: 'bg-yellow-700',
    hex: '#a16207',
    threeHex: 0xa16207,
  },
  PRE_DRY: {
    tailwind: 'bg-zinc-700',
    hex: '#3f3f46',
    threeHex: 0x3f3f46,
  },
  DRY: {
    tailwind: 'bg-zinc-700',
    hex: '#3f3f46',
    threeHex: 0x3f3f46,
  },
  DEVELOP: {
    tailwind: 'bg-sky-700',
    hex: '#0369a1',
    threeHex: 0x0369a1,
  },
  ETCH: {
    tailwind: 'bg-red-700',
    hex: '#b91c1c',
    threeHex: 0xb91c1c,
  },
  STRIP: {
    tailwind: 'bg-pink-600',
    hex: '#db2777',
    threeHex: 0xdb2777,
  },
  RINSE: {
    tailwind: 'bg-zinc-700',
    hex: '#3f3f46',
    threeHex: 0x3f3f46,
  },
  CHEMICAL: {
    tailwind: 'bg-emerald-500',
    hex: '#10b981',
    threeHex: 0x10b981,
  },
  PRINT: {
    tailwind: 'bg-amber-600',
    hex: '#d97706',
    threeHex: 0xd97706,
  },
  OTHER: {
    tailwind: 'bg-gray-600',
    hex: '#6b7280',
    threeHex: 0x6b7280,
  },
  UNKNOWN: {
    tailwind: 'bg-zinc-700',
    hex: '#3f3f46',
    threeHex: 0x3f3f46,
  },
}

// 그룹 타입별 색상 정의
export const GROUP_TYPE_COLORS: Record<string, {
  tailwind: string
  hex: string
  threeHex: number
}> = {
  BRIDGE: {
    tailwind: 'bg-cyan-500',
    hex: '#00ffff',
    threeHex: 0x00ffff,
  },
  CLUSTER: {
    tailwind: 'bg-fuchsia-500',
    hex: '#ff00ff',
    threeHex: 0xff00ff,
  },
  FLOW: {
    tailwind: 'bg-yellow-500',
    hex: '#ffff00',
    threeHex: 0xffff00,
  },
  OTHER: {
    tailwind: 'bg-orange-500',
    hex: '#ff8800',
    threeHex: 0xff8800,
  },
}

// 컨베이어 역할(서브 타입) 색상 정의
export const CONV_ROLE_COLORS: Record<string, {
  tailwind: string
  hex: string
  threeHex: number
  label: string
}> = {
  INPUT: {
    tailwind: 'bg-blue-500',
    hex: '#3b82f6',
    threeHex: 0x3b82f6,
    label: '투입',
  },
  OUTPUT: {
    tailwind: 'bg-rose-500',
    hex: '#f43f5e',
    threeHex: 0xf43f5e,
    label: '수취',
  },
}

// 공용 라인 색상
export const COMMON_LINE_COLOR = {
  tailwind: 'bg-amber-500',
  hex: '#f59e0b',
  threeHex: 0xf59e0b,
}

// 유틸리티 함수 - 설비 타입
export function getEquipmentTailwind(type: string): string {
  return EQUIPMENT_TYPE_COLORS[type]?.tailwind ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.tailwind
}

export function getEquipmentHex(type: string): string {
  return EQUIPMENT_TYPE_COLORS[type]?.hex ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.hex
}

export function getEquipmentThreeHex(type: string): number {
  return EQUIPMENT_TYPE_COLORS[type]?.threeHex ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.threeHex
}

// 유틸리티 함수 - 설비 타입 (서브 타입 고려: CONV + INPUT/OUTPUT)
export function getEffectiveEquipmentHex(type: string, subType?: string | null): string {
  if ((type === 'CONV' || type === 'CONVEYOR') && subType && CONV_ROLE_COLORS[subType]) {
    return CONV_ROLE_COLORS[subType].hex
  }
  return getEquipmentHex(type)
}

export function getEffectiveEquipmentThreeHex(type: string, subType?: string | null): number {
  if ((type === 'CONV' || type === 'CONVEYOR') && subType && CONV_ROLE_COLORS[subType]) {
    return CONV_ROLE_COLORS[subType].threeHex
  }
  return getEquipmentThreeHex(type)
}

// 유틸리티 함수 - 그룹 타입
export function getGroupTailwind(type: string): string {
  return GROUP_TYPE_COLORS[type]?.tailwind ?? GROUP_TYPE_COLORS.OTHER.tailwind
}

export function getGroupHex(type: string): string {
  return GROUP_TYPE_COLORS[type]?.hex ?? GROUP_TYPE_COLORS.OTHER.hex
}

export function getGroupThreeHex(type: string): number {
  return GROUP_TYPE_COLORS[type]?.threeHex ?? GROUP_TYPE_COLORS.OTHER.threeHex
}

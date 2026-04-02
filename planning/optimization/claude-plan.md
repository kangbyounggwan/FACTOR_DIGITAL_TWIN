# Frontend Code Optimization - Implementation Plan

## Executive Summary

이 문서는 Factory Digital Twin 프론트엔드 코드 최적화를 위한 상세 구현 계획입니다. 주요 목표는 색상 정의 중앙화, useCrud.ts 리팩토링, Knip 도입을 통한 코드 품질 향상입니다.

**예상 작업량:** 4개 섹션, 약 2-3시간
**영향 범위:** frontend/src 디렉토리

---

## Section 1: 색상 정의 중앙화

### 1.1 배경
현재 설비/그룹 색상이 3개 파일에 각각 다른 포맷으로 중복 정의되어 있음:
- EquipmentList.tsx (Tailwind class)
- LayoutCanvas.tsx (HEX string)
- Scene3D.tsx (HEX integer)

**주의:** 일부 색상 값이 파일마다 다름 (예: SMT_LINE이 Scene3D에서는 0x00FF88, LayoutCanvas에서는 #059669). 통합 시 LayoutCanvas.tsx 기준으로 통일 (Tailwind 호환 색상).

### 1.2 구현 상세

#### Step 1: lib/colors.ts 생성

```typescript
// src/lib/colors.ts

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
  // ... 나머지 타입들
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

// 유틸리티 함수
export function getEquipmentTailwind(type: string): string {
  return EQUIPMENT_TYPE_COLORS[type]?.tailwind ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.tailwind
}

export function getEquipmentHex(type: string): string {
  return EQUIPMENT_TYPE_COLORS[type]?.hex ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.hex
}

export function getEquipmentThreeHex(type: string): number {
  return EQUIPMENT_TYPE_COLORS[type]?.threeHex ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.threeHex
}

export function getGroupTailwind(type: string): string {
  return GROUP_TYPE_COLORS[type]?.tailwind ?? GROUP_TYPE_COLORS.OTHER.tailwind
}

export function getGroupHex(type: string): string {
  return GROUP_TYPE_COLORS[type]?.hex ?? GROUP_TYPE_COLORS.OTHER.hex
}

export function getGroupThreeHex(type: string): number {
  return GROUP_TYPE_COLORS[type]?.threeHex ?? GROUP_TYPE_COLORS.OTHER.threeHex
}
```

#### Step 2: EquipmentList.tsx 수정

**Before:**
```typescript
const TYPE_COLORS: Record<string, string> = {
  SMT_LINE: 'bg-emerald-600',
  // ...
}
```

**After:**
```typescript
import { getEquipmentTailwind, getGroupTailwind } from '@/lib/colors'

// 기존 TYPE_COLORS, GROUP_TYPE_COLORS 삭제
// 사용처: typeColor = getEquipmentTailwind(eq.equipment_type)
```

#### Step 3: LayoutCanvas.tsx 수정

**Before:**
```typescript
const GROUP_COLORS: Record<string, string> = { BRIDGE: '#00ffff', ... }
const TYPE_COLORS: Record<string, string> = { SMT_LINE: '#059669', ... }
```

**After:**
```typescript
import { getEquipmentHex, getGroupHex } from '@/lib/colors'

// 사용처: color = getGroupHex(group.group_type)
// 사용처: color = getEquipmentHex(eq.equipment_type)
```

#### Step 4: Scene3D.tsx 수정

**Before:**
```typescript
const GROUP_COLORS: Record<string, number> = { BRIDGE: 0x00ffff, ... }
const EQ_HEX: Record<string, number> = { SMT_LINE: 0x00FF88, ... }
```

**After:**
```typescript
import { getEquipmentThreeHex, getGroupThreeHex } from '@/lib/colors'

// 사용처: color = getGroupThreeHex(group.group_type)
// 사용처: color = getEquipmentThreeHex(eq.equipment_type)
```

### 1.3 검증
- 앱 실행 후 3D/2D 뷰어에서 색상 동일한지 확인
- 모든 설비 타입 색상 표시 정상 확인

---

## Section 2: useCrud.ts 리팩토링

### 2.1 배경
현재 useCrud.ts는 555줄로, 동일한 try-catch 패턴이 22개 함수에서 반복됨.

### 2.2 구현 상세

#### Step 1: useCrudMutation.ts 생성

```typescript
// src/hooks/useCrudMutation.ts
import { useState, useCallback } from 'react'

interface CrudConfig<T, C, U> {
  create?: (data: C) => Promise<T>
  update?: (id: string, data: U) => Promise<T>
  remove?: (id: string) => Promise<void>
  getById?: (id: string) => Promise<T>
  getDeleteInfo?: (id: string) => Promise<any>
}

export function useCrudMutation<T, C = any, U = any>(config: CrudConfig<T, C, U>) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const withErrorHandling = useCallback(<F extends (...args: any[]) => Promise<any>>(
    fn: F | undefined
  ) => {
    if (!fn) return undefined

    return async (...args: Parameters<F>): Promise<ReturnType<F>> => {
      try {
        setSaving(true)
        setError(null)
        const result = await fn(...args)
        return result
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setSaving(false)
      }
    }
  }, [])

  return {
    saving,
    error,
    create: withErrorHandling(config.create),
    update: withErrorHandling(config.update),
    remove: withErrorHandling(config.remove),
    getById: withErrorHandling(config.getById),
    getDeleteInfo: withErrorHandling(config.getDeleteInfo),
  }
}
```

#### Step 2: useCrud.ts 리팩토링

**Before (useCompanyMutations 예시):**
```typescript
export function useCompanyMutations() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (data: CompanyCreate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await createCompany(data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const update = useCallback(async (id: string, data: CompanyUpdate) => {
    // 동일한 패턴 반복...
  }, [])

  // ... 5개 이상의 함수가 동일 패턴

  return { saving, error, create, update, remove, getById, getDeleteInfo }
}
```

**After:**
```typescript
export function useCompanyMutations() {
  return useCrudMutation<Company, CompanyCreate, CompanyUpdate>({
    create: createCompany,
    update: (id, data) => updateCompany(id, data),
    remove: deleteCompany,
    getById: fetchCompany,
    getDeleteInfo: fetchCompanyDeleteInfo,
  })
}
```

#### Step 3: 모든 mutation 훅 리팩토링

동일한 패턴으로 다음 훅들 리팩토링:
- useCompanyMutations
- useFactoryMutations
- useLineMutations
- useEquipmentTypeMutations
- useZoneMutations

### 2.3 예상 결과
- 555줄 → ~200줄 (약 65% 감소)
- 중복 코드 제거
- 타입 안전성 유지

---

## Section 3: Knip 도입

### 3.1 배경
미사용 코드를 자동으로 감지하는 체계가 없어 레거시 코드가 축적됨.

### 3.2 구현 상세

#### Step 1: Knip 설치

```bash
cd frontend
npm install --save-dev knip
```

#### Step 2: knip.json 생성

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/main.tsx"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "**/*.d.ts",
    "src/vite-env.d.ts"
  ],
  "ignoreDependencies": [
    "@types/*"
  ]
}
```

#### Step 3: package.json scripts 추가

```json
{
  "scripts": {
    "lint:dead": "knip",
    "lint:dead:fix": "knip --fix"
  }
}
```

#### Step 4: 초기 검사 실행

```bash
npm run lint:dead
```

예상 결과:
- 미사용 export 목록 출력
- 미사용 의존성 목록 출력

### 3.3 발견된 미사용 코드 정리

분석 결과 발견된 항목:
- `EquipmentFull` 타입 (api.ts) - 삭제 대상
- `useEquipment` 훅의 MOCK 데이터 - 검토 필요

---

## Section 4: 레거시 코드 정리

### 4.1 배경
React Query 마이그레이션 후 레거시 코드가 남아있음.

### 4.2 구현 상세

#### Step 1: api.ts 미사용 타입 제거

```typescript
// 삭제 대상 (Line 515-516)
// export interface EquipmentFull extends Equipment { ... }
```

#### Step 2: useEquipment.ts 검토

현재 상태:
- `useEquipment`: useState/useEffect 패턴 (MOCK 포함)
- `useFactoryEquipment`: React Query 패턴

결정:
- `useEquipment`가 다른 곳에서 사용되는지 확인
- 미사용 시 삭제 또는 deprecated 마킹

#### Step 3: Knip 결과 기반 추가 정리

Knip 실행 결과에 따라 추가 미사용 코드 정리

---

## Implementation Order

```
Section 1: 색상 중앙화
    ↓
Section 2: useCrud.ts 리팩토링
    ↓
Section 3: Knip 도입
    ↓
Section 4: 레거시 코드 정리
```

각 섹션은 독립적으로 완료 및 테스트 가능

---

## Validation Checklist

### Section 1 완료 조건
- [ ] lib/colors.ts 생성됨
- [ ] EquipmentList.tsx에서 로컬 색상 정의 제거
- [ ] LayoutCanvas.tsx에서 로컬 색상 정의 제거
- [ ] Scene3D.tsx에서 로컬 색상 정의 제거
- [ ] 앱 빌드 성공
- [ ] 3D/2D 뷰어 색상 정상

### Section 2 완료 조건
- [ ] useCrudMutation.ts 생성됨
- [ ] useCrud.ts 라인 수 280줄 이하
- [ ] 모든 CRUD 기능 정상 동작
- [ ] Admin 페이지 회사/공장/라인 CRUD 테스트 통과

### Section 3 완료 조건
- [ ] knip 패키지 설치됨
- [ ] knip.json 설정 파일 존재
- [ ] npm run lint:dead 실행 가능
- [ ] 미사용 코드 목록 확인됨

### Section 4 완료 조건
- [ ] Knip 결과 기반 미사용 코드 정리됨
- [ ] npm run build 성공
- [ ] 번들 크기 증가 없음

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| 색상 변환 오류 | 기존 HEX 값 정확히 복사, 시각적 테스트 |
| CRUD 기능 오류 | 각 mutation별 수동 테스트 |
| Knip false positive | ignore 패턴 조정 |
| 빌드 실패 | 각 섹션별 즉시 빌드 테스트 |

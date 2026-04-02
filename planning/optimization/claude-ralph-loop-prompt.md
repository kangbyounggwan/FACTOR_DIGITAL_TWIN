# Frontend Code Optimization - Ralph Loop Execution Prompt

## Mission Statement

Factory Digital Twin 프론트엔드 코드의 품질과 유지보수성을 향상시키기 위한 최적화 작업을 자율적으로 수행합니다.

**목표:**
- 색상 정의 중앙화
- CRUD 훅 리팩토링으로 코드 중복 제거
- Knip 도입으로 미사용 코드 감지 체계 구축
- 레거시 코드 정리

---

# Section Index

```
SECTION_MANIFEST:
- section-01-colors-centralization.md
- section-02-usecrud-refactoring.md
- section-03-knip-setup.md
- section-04-legacy-cleanup.md
```

---

## Overview

이 프로젝트는 Factory Digital Twin 프론트엔드 코드의 품질과 유지보수성을 향상시키기 위한 최적화 작업입니다.

**총 섹션:** 4개
**예상 작업 시간:** 2-3시간
**의존성:** 순차적 실행 권장 (Section 1 → 2 → 3 → 4)

---

## Section Dependencies

```
Section 1: Colors Centralization
    ↓ (독립적)
Section 2: useCrud Refactoring
    ↓ (독립적)
Section 3: Knip Setup
    ↓
Section 4: Legacy Cleanup (Knip 결과 활용)
```

---

## Section Summary

### Section 01: Colors Centralization
**목표:** 3개 파일에 분산된 색상 정의를 lib/colors.ts로 중앙화
**영향 파일:**
- 신규: `src/lib/colors.ts`
- 수정: `EquipmentList.tsx`, `LayoutCanvas.tsx`, `Scene3D.tsx`

### Section 02: useCrud Refactoring
**목표:** 555줄의 useCrud.ts를 제너릭 훅으로 리팩토링하여 ~200줄로 감소
**영향 파일:**
- 신규: `src/hooks/useCrudMutation.ts`
- 수정: `src/hooks/useCrud.ts`

### Section 03: Knip Setup
**목표:** 미사용 코드 자동 감지 도구 Knip 도입
**영향 파일:**
- 신규: `knip.json`
- 수정: `package.json`

### Section 04: Legacy Cleanup
**목표:** Knip으로 발견된 미사용 코드 및 레거시 훅 정리
**영향 파일:**
- 검토: `src/hooks/useEquipment.ts`
- 검토: `src/lib/api.ts`

---

## Execution Order

1. **Section 01** - 색상 중앙화 (독립적으로 완료 가능)
2. **Section 02** - useCrud 리팩토링 (독립적으로 완료 가능)
3. **Section 03** - Knip 설정 (Section 04 전에 완료 필요)
4. **Section 04** - 레거시 정리 (Knip 결과 기반)

각 섹션 완료 후 `npm run build`로 검증 권장.

---

# Section 01: 색상 정의 중앙화 (Colors Centralization)

## 메타데이터

| 항목 | 내용 |
|------|------|
| **섹션 ID** | section-01 |
| **예상 작업 시간** | 30분 |
| **난이도** | 낮음 |
| **requires** | 없음 (독립적으로 시작 가능) |
| **blocks** | 없음 |

---

## 1. 배경 (Background)

### 1.1 현재 문제점

현재 설비(Equipment) 및 그룹(Group) 타입별 색상이 **3개 파일에 각각 다른 포맷으로 중복 정의**되어 있습니다:

| 파일 | 포맷 | 용도 |
|------|------|------|
| `EquipmentList.tsx` | Tailwind class (예: `'bg-emerald-600'`) | 좌측 사이드바 설비 목록 |
| `LayoutCanvas.tsx` | HEX string (예: `'#059669'`) | 2D 레이아웃 캔버스 |
| `Scene3D.tsx` | HEX integer (예: `0x00FF88`) | 3D 뷰어 |

### 1.2 색상 불일치 문제

**주의:** 일부 색상 값이 파일마다 다릅니다!

| 설비 타입 | EquipmentList (Tailwind) | LayoutCanvas (HEX) | Scene3D (HEX int) |
|-----------|--------------------------|--------------------|--------------------|
| SMT_LINE | `bg-emerald-600` | `#059669` | `0x00FF88` |
| REFLOW_OVEN | `bg-orange-600` | `#ea580c` | `0xFF6633` |
| AOI_MACHINE | `bg-indigo-500` | `#6366f1` | `0x66AAFF` |

이러한 불일치는 사용자 경험에 혼란을 주고, 유지보수를 어렵게 만듭니다.

### 1.3 해결 방향

- **단일 색상 정의 파일** (`lib/colors.ts`) 생성
- **LayoutCanvas.tsx 기준으로 색상 통일** (Tailwind 호환 색상)
- 각 컴포넌트에서 유틸리티 함수를 통해 색상 사용

---

## 2. 요구사항 (Requirements)

### 2.1 기능 요구사항

- [ ] 모든 설비 타입 색상이 하나의 파일에서 관리되어야 함
- [ ] 모든 그룹 타입 색상이 하나의 파일에서 관리되어야 함
- [ ] Tailwind class, HEX string, HEX integer 세 가지 포맷 모두 지원
- [ ] 정의되지 않은 타입에 대한 기본값(fallback) 제공

### 2.2 비기능 요구사항

- [ ] 기존 UI 색상과 동일하게 유지 (LayoutCanvas.tsx 기준)
- [ ] 타입 안전성 유지 (TypeScript)
- [ ] 빌드 에러 없음

---

## 3. 의존성 (Dependencies)

### 3.1 requires (선행 작업)

- 없음 - 독립적으로 시작 가능

### 3.2 blocks (후행 작업에 영향)

- 없음 - 다른 섹션과 독립적

### 3.3 관련 파일

**수정 대상:**
- `frontend/src/components/EquipmentList.tsx`
- `frontend/src/components/LayoutCanvas.tsx`
- `frontend/src/components/Scene3D.tsx`

**신규 생성:**
- `frontend/src/lib/colors.ts`

---

## 4. 구현 상세 (Implementation Details)

### 4.1 Step 1: `lib/colors.ts` 생성

**파일 경로:** `frontend/src/lib/colors.ts`

```typescript
// src/lib/colors.ts

/**
 * 설비 타입별 색상 정의
 *
 * 각 설비 타입에 대해 세 가지 포맷의 색상을 제공합니다:
 * - tailwind: Tailwind CSS 클래스 (예: 'bg-emerald-600')
 * - hex: HEX 문자열 (예: '#059669')
 * - threeHex: Three.js용 HEX 정수 (예: 0x059669)
 */
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

/**
 * 그룹 타입별 색상 정의
 */
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

// ============================================
// 설비 타입용 유틸리티 함수
// ============================================

/**
 * 설비 타입에 해당하는 Tailwind 클래스 반환
 * @param type 설비 타입 (예: 'SMT_LINE')
 * @returns Tailwind CSS 클래스 (예: 'bg-emerald-600')
 */
export function getEquipmentTailwind(type: string): string {
  return EQUIPMENT_TYPE_COLORS[type]?.tailwind ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.tailwind
}

/**
 * 설비 타입에 해당하는 HEX 문자열 반환
 * @param type 설비 타입 (예: 'SMT_LINE')
 * @returns HEX 문자열 (예: '#059669')
 */
export function getEquipmentHex(type: string): string {
  return EQUIPMENT_TYPE_COLORS[type]?.hex ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.hex
}

/**
 * 설비 타입에 해당하는 Three.js용 HEX 정수 반환
 * @param type 설비 타입 (예: 'SMT_LINE')
 * @returns HEX 정수 (예: 0x059669)
 */
export function getEquipmentThreeHex(type: string): number {
  return EQUIPMENT_TYPE_COLORS[type]?.threeHex ?? EQUIPMENT_TYPE_COLORS.UNKNOWN.threeHex
}

// ============================================
// 그룹 타입용 유틸리티 함수
// ============================================

/**
 * 그룹 타입에 해당하는 Tailwind 클래스 반환
 * @param type 그룹 타입 (예: 'BRIDGE')
 * @returns Tailwind CSS 클래스 (예: 'bg-cyan-500')
 */
export function getGroupTailwind(type: string): string {
  return GROUP_TYPE_COLORS[type]?.tailwind ?? GROUP_TYPE_COLORS.OTHER.tailwind
}

/**
 * 그룹 타입에 해당하는 HEX 문자열 반환
 * @param type 그룹 타입 (예: 'BRIDGE')
 * @returns HEX 문자열 (예: '#00ffff')
 */
export function getGroupHex(type: string): string {
  return GROUP_TYPE_COLORS[type]?.hex ?? GROUP_TYPE_COLORS.OTHER.hex
}

/**
 * 그룹 타입에 해당하는 Three.js용 HEX 정수 반환
 * @param type 그룹 타입 (예: 'BRIDGE')
 * @returns HEX 정수 (예: 0x00ffff)
 */
export function getGroupThreeHex(type: string): number {
  return GROUP_TYPE_COLORS[type]?.threeHex ?? GROUP_TYPE_COLORS.OTHER.threeHex
}
```

---

### 4.2 Step 2: `EquipmentList.tsx` 수정

**파일 경로:** `frontend/src/components/EquipmentList.tsx`

#### 변경 전 (Before)

```typescript
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

// 그룹 타입별 색상
const GROUP_TYPE_COLORS: Record<string, string> = {
  BRIDGE: 'bg-cyan-500',
  CLUSTER: 'bg-fuchsia-500',
  FLOW: 'bg-yellow-500',
  OTHER: 'bg-orange-500',
}
```

#### 변경 후 (After)

**1. import 추가** (파일 상단):

```typescript
import { getEquipmentTailwind, getGroupTailwind } from '@/lib/colors'
```

**2. 기존 색상 정의 삭제**:

`TYPE_COLORS` 객체와 `GROUP_TYPE_COLORS` 객체를 **완전히 삭제**합니다 (Line 11-41).

**3. 사용처 수정**:

| 변경 전 | 변경 후 |
|---------|---------|
| `TYPE_COLORS[eq.equipment_type] ?? TYPE_COLORS.UNKNOWN` | `getEquipmentTailwind(eq.equipment_type)` |
| `GROUP_TYPE_COLORS[group.group_type] ?? GROUP_TYPE_COLORS.OTHER` | `getGroupTailwind(group.group_type)` |

**구체적인 변경 위치:**

1. **Line 183** (그룹 목록에서):
   ```typescript
   // Before
   const typeColor = GROUP_TYPE_COLORS[group.group_type] ?? GROUP_TYPE_COLORS.OTHER

   // After
   const typeColor = getGroupTailwind(group.group_type)
   ```

2. **Line 270** (설비 목록에서):
   ```typescript
   // Before
   const typeColor = TYPE_COLORS[eq.equipment_type] ?? TYPE_COLORS.UNKNOWN

   // After
   const typeColor = getEquipmentTailwind(eq.equipment_type)
   ```

---

### 4.3 Step 3: `LayoutCanvas.tsx` 수정

**파일 경로:** `frontend/src/components/LayoutCanvas.tsx`

#### 변경 전 (Before)

```typescript
// 그룹 타입별 색상
const GROUP_COLORS: Record<string, string> = {
  BRIDGE: '#00ffff',   // 시안 (존 연결)
  CLUSTER: '#ff00ff',  // 마젠타 (동일 기능)
  FLOW: '#ffff00',     // 노랑 (공정 흐름)
  OTHER: '#ff8800',    // 주황 (기타)
}

// 설비 타입별 색상
const TYPE_COLORS: Record<string, string> = {
  SMT_LINE: '#059669',
  REFLOW_OVEN: '#ea580c',
  AOI_MACHINE: '#6366f1',
  SCREEN_PRINTER: '#d97706',
  PICK_AND_PLACE: '#059669',
  CONVEYOR: '#65a30d',
  CONTROL_PANEL: '#52525b',
  STORAGE_RACK: '#52525b',
  CNC: '#2563eb',
  MCT: '#0284c7',
  ROBOT: '#9333ea',
  INSP: '#0d9488',
  WELD: '#dc2626',
  PRESS: '#e11d48',
  INJECT: '#c026d3',
  PACK: '#06b6d4',
  ASSY: '#7c3aed',
  AGV: '#16a34a',
  CONV: '#65a30d',
  OTHER: '#6b7280',
  UNKNOWN: '#3f3f46',
}
```

#### 변경 후 (After)

**1. import 추가** (파일 상단):

```typescript
import { getEquipmentHex, getGroupHex } from '@/lib/colors'
```

**2. 기존 색상 정의 삭제**:

`GROUP_COLORS` 객체와 `TYPE_COLORS` 객체를 **완전히 삭제**합니다 (Line 4-35).

**3. 사용처 수정**:

| 변경 전 | 변경 후 |
|---------|---------|
| `GROUP_COLORS[group.group_type] ?? GROUP_COLORS.OTHER` | `getGroupHex(group.group_type)` |
| `TYPE_COLORS[eq.equipment_type] ?? TYPE_COLORS.UNKNOWN` | `getEquipmentHex(eq.equipment_type)` |

**구체적인 변경 위치:**

1. **Line 695** (그룹 렌더링에서):
   ```typescript
   // Before
   const color = GROUP_COLORS[group.group_type] ?? GROUP_COLORS.OTHER

   // After
   const color = getGroupHex(group.group_type)
   ```

2. **Line 778** (설비 렌더링에서):
   ```typescript
   // Before
   const color = TYPE_COLORS[eq.equipment_type] ?? TYPE_COLORS.UNKNOWN

   // After
   const color = getEquipmentHex(eq.equipment_type)
   ```

---

### 4.4 Step 4: `Scene3D.tsx` 수정

**파일 경로:** `frontend/src/components/Scene3D.tsx`

#### 변경 전 (Before)

```typescript
// 그룹 타입별 색상
const GROUP_COLORS: Record<string, number> = {
  BRIDGE: 0x00ffff,   // 시안 (존 연결)
  CLUSTER: 0xff00ff,  // 마젠타 (동일 기능)
  FLOW: 0xffff00,     // 노랑 (공정 흐름)
  OTHER: 0xff8800,    // 주황 (기타)
}

const EQ_HEX: Record<string, number> = {
  SMT_LINE:       0x00FF88,
  REFLOW_OVEN:    0xFF6633,
  AOI_MACHINE:    0x66AAFF,
  SCREEN_PRINTER: 0xFFCC00,
  PICK_AND_PLACE: 0x00FF88,
  CONVEYOR:       0x99FF33,
  CONTROL_PANEL:  0xCCCCCC,
  STORAGE_RACK:   0xCCCCCC,
  UNKNOWN:        0xAAAAAA,
}
```

#### 변경 후 (After)

**1. import 추가** (파일 상단):

```typescript
import { getEquipmentThreeHex, getGroupThreeHex } from '@/lib/colors'
```

**2. 기존 색상 정의 삭제**:

`GROUP_COLORS` 객체와 `EQ_HEX` 객체를 **완전히 삭제**합니다 (Line 8-26).

**3. 사용처 수정**:

| 변경 전 | 변경 후 |
|---------|---------|
| `EQ_HEX[eq.equipment_type] ?? 0x3a3f3a` | `getEquipmentThreeHex(eq.equipment_type)` |
| `GROUP_COLORS[group.group_type] ?? GROUP_COLORS.OTHER` | `getGroupThreeHex(group.group_type)` |

**구체적인 변경 위치:**

1. **Line 50** (EquipmentBox 컴포넌트에서):
   ```typescript
   // Before
   const color = EQ_HEX[eq.equipment_type] ?? 0x3a3f3a

   // After
   const color = getEquipmentThreeHex(eq.equipment_type)
   ```

2. **Line 162** (GroupBoundingBox 컴포넌트에서):
   ```typescript
   // Before
   const color = GROUP_COLORS[group.group_type] ?? GROUP_COLORS.OTHER

   // After
   const color = getGroupThreeHex(group.group_type)
   ```

---

## 5. 수용 기준 (Acceptance Criteria)

### 5.1 코드 변경 완료

- [ ] `frontend/src/lib/colors.ts` 파일이 생성됨
- [ ] `EquipmentList.tsx`에서 로컬 색상 정의(`TYPE_COLORS`, `GROUP_TYPE_COLORS`)가 삭제됨
- [ ] `LayoutCanvas.tsx`에서 로컬 색상 정의(`TYPE_COLORS`, `GROUP_COLORS`)가 삭제됨
- [ ] `Scene3D.tsx`에서 로컬 색상 정의(`EQ_HEX`, `GROUP_COLORS`)가 삭제됨
- [ ] 각 파일에서 `@/lib/colors` import가 추가됨

### 5.2 빌드 성공

- [ ] `npm run build` 명령이 에러 없이 완료됨
- [ ] TypeScript 타입 에러 없음
- [ ] ESLint 경고/에러 없음

### 5.3 시각적 검증

- [ ] 2D 레이아웃 캔버스에서 설비 색상이 정상 표시됨
- [ ] 3D 뷰어에서 설비 색상이 정상 표시됨 (LayoutCanvas와 동일 색상)
- [ ] 좌측 사이드바 설비 목록에서 타입 배지 색상이 정상 표시됨
- [ ] 그룹 바운딩 박스 색상이 2D/3D 모두에서 동일하게 표시됨

### 5.4 기능 검증

- [ ] 정의되지 않은 설비 타입에 대해 UNKNOWN 색상이 표시됨
- [ ] 정의되지 않은 그룹 타입에 대해 OTHER 색상이 표시됨

---

## 6. 생성/수정 파일 목록

### 6.1 신규 생성

| 파일 경로 | 설명 |
|-----------|------|
| `frontend/src/lib/colors.ts` | 중앙화된 색상 정의 및 유틸리티 함수 |

### 6.2 수정

| 파일 경로 | 변경 내용 |
|-----------|-----------|
| `frontend/src/components/EquipmentList.tsx` | 로컬 색상 정의 제거, import 추가, 유틸리티 함수 사용 |
| `frontend/src/components/LayoutCanvas.tsx` | 로컬 색상 정의 제거, import 추가, 유틸리티 함수 사용 |
| `frontend/src/components/Scene3D.tsx` | 로컬 색상 정의 제거, import 추가, 유틸리티 함수 사용 |

---

## 7. 검증 단계

### 7.1 빌드 테스트

```bash
cd frontend
npm run build
```

예상 결과: 에러 없이 빌드 완료

### 7.2 시각적 테스트

1. 앱 실행: `npm run dev`
2. 공장 데이터가 있는 페이지로 이동
3. 다음 항목 확인:
   - 2D 캔버스: 각 설비 타입별 색상 확인
   - 3D 뷰어: 동일한 색상으로 표시되는지 확인
   - 설비 목록: 타입 배지 색상 확인
   - 그룹 선택: 그룹 박스 색상이 2D/3D에서 동일한지 확인

---

## 8. 롤백 계획

문제 발생 시 다음 순서로 롤백:

1. `lib/colors.ts` 파일 삭제
2. 각 컴포넌트 파일을 git에서 복원:
   ```bash
   git checkout -- frontend/src/components/EquipmentList.tsx
   git checkout -- frontend/src/components/LayoutCanvas.tsx
   git checkout -- frontend/src/components/Scene3D.tsx
   ```

---

## 9. 참고 사항

### 9.1 색상 매핑 기준

이 작업에서는 **LayoutCanvas.tsx의 색상을 기준**으로 통일합니다. 이유:
- Tailwind CSS 색상 팔레트와 호환되는 HEX 값 사용
- 가장 완전한 설비 타입 목록 보유

### 9.2 Scene3D.tsx 색상 변경 영향

Scene3D.tsx에서 기존에 사용하던 일부 색상(예: `0x00FF88`)이 `0x059669`로 변경됩니다. 이는 의도된 변경이며, 2D/3D 뷰어 간 색상 일관성을 위한 것입니다.

---

# Section 02: useCrud.ts 리팩토링

## Overview

| 항목 | 내용 |
|------|------|
| **목표** | 555줄의 useCrud.ts를 제너릭 훅으로 리팩토링하여 ~200줄로 감소 |
| **예상 시간** | 30-45분 |
| **난이도** | 중간 |
| **영향 범위** | `src/hooks/useCrud.ts`, `src/hooks/useCrudMutation.ts` (신규) |

---

## 1. Background (배경)

### 1.1 현재 문제점

현재 `useCrud.ts` 파일은 **555줄**로, 동일한 try-catch 에러 핸들링 패턴이 여러 mutation 훅에서 반복됩니다.

**반복되는 패턴 분석:**

```typescript
// 이 패턴이 22개 함수에서 반복됨
const someAction = useCallback(async (data: SomeType) => {
  try {
    setSaving(true)
    setError(null)
    const result = await apiCall(data)
    return result
  } catch (e) {
    setError(e as Error)
    throw e
  } finally {
    setSaving(false)
  }
}, [])
```

**중복 발생 위치:**

| 훅 이름 | 중복 함수 수 | 라인 범위 |
|--------|------------|----------|
| `useCompanyMutations` | 5개 (create, update, remove, getDeleteInfo, getById) | 47-123 |
| `useFactoryMutations` | 5개 (create, update, remove, getDeleteInfo, getById) | 132-208 |
| `useLineMutations` | 5개 (create, update, remove, getDeleteInfo, getById) | 253-329 |
| `useEquipmentMutations` | 3개 (create, update, remove) | 503-555 |
| `useDeleteConfirmation` | 2개 (prepareDelete, confirmDelete) | 350-459 |

**총 22개 함수에서 동일 패턴 반복**

### 1.2 리팩토링 필요성

- **코드 중복**: 동일한 에러 핸들링 로직이 22회 반복
- **유지보수성**: 에러 핸들링 방식 변경 시 22곳 수정 필요
- **일관성 부재**: 일부 함수는 `setSaving` 사용, 일부는 미사용 (불일치)
- **테스트 부담**: 각 함수마다 동일한 에러 케이스 테스트 필요

---

## 2. Requirements (완료 조건)

### 2.1 기능 요구사항

- [ ] 제너릭 `useCrudMutation` 훅 생성
- [ ] 기존 4개 mutation 훅을 새 패턴으로 리팩토링
- [ ] 기존 API 인터페이스 100% 호환 유지
- [ ] 타입 안전성 유지 (TypeScript 에러 없음)

### 2.2 비기능 요구사항

- [ ] `useCrud.ts` 라인 수 280줄 이하 (현재 555줄 대비 ~50% 감소)
- [ ] 빌드 성공 (`npm run build`)
- [ ] 기존 테스트 통과 (있는 경우)

---

## 3. Dependencies (의존성)

### 3.1 선행 작업

```
requires: 없음 (독립적으로 실행 가능)
```

### 3.2 후행 작업

```
blocks: 없음 (다른 섹션에 영향 없음)
```

### 3.3 관련 파일

| 파일 | 역할 |
|-----|------|
| `src/hooks/useCrud.ts` | 리팩토링 대상 |
| `src/hooks/useCrudMutation.ts` | 신규 생성 |
| `src/lib/api.ts` | API 함수 (변경 없음) |
| `src/pages/AdminPage.tsx` | 주요 사용처 (변경 없음) |

---

## 4. Implementation Details (구현 상세)

### 4.1 Step 1: useCrudMutation.ts 생성

**파일 경로:** `src/hooks/useCrudMutation.ts`

```typescript
// src/hooks/useCrudMutation.ts
import { useState, useCallback, useMemo } from 'react'

/**
 * CRUD 작업 설정 인터페이스
 * @template T - 엔티티 타입 (예: Company, Factory)
 * @template C - Create DTO 타입 (예: CompanyCreate)
 * @template U - Update DTO 타입 (예: CompanyUpdate)
 * @template D - DeleteInfo 타입 (예: CompanyDeleteInfo)
 */
export interface CrudConfig<T, C = unknown, U = unknown, D = unknown> {
  /** 엔티티 생성 API 함수 */
  create?: (data: C) => Promise<T>
  /** 엔티티 수정 API 함수 */
  update?: (id: string, data: U) => Promise<T>
  /** 엔티티 삭제 API 함수 */
  remove?: (id: string) => Promise<void>
  /** ID로 엔티티 조회 API 함수 */
  getById?: (id: string) => Promise<T>
  /** 삭제 전 정보 조회 API 함수 */
  getDeleteInfo?: (id: string) => Promise<D>
}

/**
 * useCrudMutation 반환 타입
 */
export interface CrudMutationResult<T, C, U, D> {
  /** 저장 중 여부 */
  saving: boolean
  /** 마지막 에러 */
  error: Error | null
  /** 생성 함수 (설정된 경우) */
  create?: (data: C) => Promise<T>
  /** 수정 함수 (설정된 경우) */
  update?: (id: string, data: U) => Promise<T>
  /** 삭제 함수 (설정된 경우) */
  remove?: (id: string) => Promise<void>
  /** ID로 조회 함수 (설정된 경우) */
  getById?: (id: string) => Promise<T>
  /** 삭제 정보 조회 함수 (설정된 경우) */
  getDeleteInfo?: (id: string) => Promise<D>
}

/**
 * 에러 핸들링이 포함된 비동기 함수를 생성하는 고차 함수
 */
function createWrappedFunction<F extends (...args: any[]) => Promise<any>>(
  fn: F | undefined,
  setSaving: (saving: boolean) => void,
  setError: (error: Error | null) => void,
  useSavingState: boolean = true
): F | undefined {
  if (!fn) return undefined

  return (async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    try {
      if (useSavingState) setSaving(true)
      setError(null)
      const result = await fn(...args)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      if (useSavingState) setSaving(false)
    }
  }) as F
}

/**
 * 제너릭 CRUD mutation 훅
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const { saving, error, create, update, remove } = useCrudMutation<Company, CompanyCreate, CompanyUpdate>({
 *   create: createCompany,
 *   update: (id, data) => updateCompany(id, data),
 *   remove: deleteCompany,
 * })
 * ```
 *
 * @template T - 엔티티 타입
 * @template C - Create DTO 타입
 * @template U - Update DTO 타입
 * @template D - DeleteInfo 타입
 */
export function useCrudMutation<T, C = unknown, U = unknown, D = unknown>(
  config: CrudConfig<T, C, U, D>
): CrudMutationResult<T, C, U, D> {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // config 객체의 함수들을 메모이제이션
  const { create, update, remove, getById, getDeleteInfo } = config

  // 래핑된 함수들 생성 (useMemo로 안정적인 참조 유지)
  const wrappedCreate = useMemo(
    () => createWrappedFunction(create, setSaving, setError, true),
    [create]
  )

  const wrappedUpdate = useMemo(
    () => createWrappedFunction(update, setSaving, setError, true),
    [update]
  )

  const wrappedRemove = useMemo(
    () => createWrappedFunction(remove, setSaving, setError, true),
    [remove]
  )

  // getById와 getDeleteInfo는 saving 상태를 변경하지 않음 (읽기 전용)
  const wrappedGetById = useMemo(
    () => createWrappedFunction(getById, setSaving, setError, false),
    [getById]
  )

  const wrappedGetDeleteInfo = useMemo(
    () => createWrappedFunction(getDeleteInfo, setSaving, setError, false),
    [getDeleteInfo]
  )

  return {
    saving,
    error,
    create: wrappedCreate,
    update: wrappedUpdate,
    remove: wrappedRemove,
    getById: wrappedGetById,
    getDeleteInfo: wrappedGetDeleteInfo,
  }
}

/**
 * 에러 핸들링만 적용하는 간단한 래퍼 (saving 상태 없음)
 * useDeleteConfirmation 등 복잡한 훅에서 부분적으로 사용
 */
export function withErrorHandling<F extends (...args: any[]) => Promise<any>>(
  fn: F,
  setError: (error: Error | null) => void
): F {
  return (async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    try {
      setError(null)
      return await fn(...args)
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }) as F
}
```

### 4.2 Step 2: useCrud.ts 리팩토링

#### 4.2.1 useCompanyMutations 리팩토링

**Before (77줄):**

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

  const update = useCallback(async (companyId: string, data: CompanyUpdate) => {
    try {
      setSaving(true)
      setError(null)
      const result = await updateCompany(companyId, data)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (companyId: string) => {
    try {
      setSaving(true)
      setError(null)
      await deleteCompany(companyId)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const getDeleteInfo = useCallback(async (companyId: string): Promise<CompanyDeleteInfo> => {
    try {
      setError(null)
      const result = await getCompanyDeleteInfo(companyId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  const getById = useCallback(async (companyId: string): Promise<Company> => {
    try {
      setError(null)
      const result = await getCompanyById(companyId)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    }
  }, [])

  return {
    saving,
    error,
    create,
    update,
    remove,
    getDeleteInfo,
    getById,
  }
}
```

**After (12줄):**

```typescript
export function useCompanyMutations() {
  return useCrudMutation<Company, CompanyCreate, CompanyUpdate, CompanyDeleteInfo>({
    create: createCompany,
    update: updateCompany,
    remove: deleteCompany,
    getById: getCompanyById,
    getDeleteInfo: getCompanyDeleteInfo,
  })
}
```

#### 4.2.2 useFactoryMutations 리팩토링

**After:**

```typescript
export function useFactoryMutations() {
  return useCrudMutation<FactoryFull, FactoryCreate, FactoryUpdate, FactoryDeleteInfo>({
    create: createFactory,
    update: updateFactory,
    remove: deleteFactory,
    getById: getFactoryById,
    getDeleteInfo: getFactoryDeleteInfo,
  })
}
```

#### 4.2.3 useLineMutations 리팩토링

**After:**

```typescript
export function useLineMutations() {
  return useCrudMutation<LineFull, LineCreate, LineUpdate, LineDeleteInfo>({
    create: createLine,
    update: updateLine,
    remove: deleteLine,
    getById: getLineById,
    getDeleteInfo: getLineDeleteInfo,
  })
}
```

#### 4.2.4 useEquipmentMutations 리팩토링

**After:**

```typescript
export function useEquipmentMutations() {
  return useCrudMutation<Equipment, EquipmentCreate, EquipmentUpdate>({
    create: createEquipment,
    update: updateEquipment,
    remove: deleteEquipment,
  })
}
```

### 4.3 Step 3: 전체 useCrud.ts 리팩토링 결과

**리팩토링 후 전체 파일:**

```typescript
// src/hooks/useCrud.ts
import { useState, useCallback, useEffect } from 'react'
import {
  Company,
  CompanyCreate,
  CompanyUpdate,
  CompanyDeleteInfo,
  FactoryFull,
  FactoryCreate,
  FactoryUpdate,
  FactoryDeleteInfo,
  LineFull,
  LineCreate,
  LineUpdate,
  LineDeleteInfo,
  Equipment,
  EquipmentCreate,
  EquipmentUpdate,
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyDeleteInfo,
  createFactory,
  getFactoryById,
  updateFactory,
  deleteFactory,
  getFactoryDeleteInfo,
  fetchLines,
  getLineById,
  createLine,
  updateLine,
  deleteLine,
  getLineDeleteInfo,
  createEquipment,
  deleteEquipment,
  fetchLineEquipment,
  updateEquipment,
} from '@/lib/api'
import { useCrudMutation } from './useCrudMutation'

// =============================================================================
// COMPANY CRUD HOOKS
// =============================================================================

/**
 * Hook for company CRUD mutations
 */
export function useCompanyMutations() {
  return useCrudMutation<Company, CompanyCreate, CompanyUpdate, CompanyDeleteInfo>({
    create: createCompany,
    update: updateCompany,
    remove: deleteCompany,
    getById: getCompanyById,
    getDeleteInfo: getCompanyDeleteInfo,
  })
}

// =============================================================================
// FACTORY CRUD HOOKS
// =============================================================================

/**
 * Hook for factory CRUD mutations
 */
export function useFactoryMutations() {
  return useCrudMutation<FactoryFull, FactoryCreate, FactoryUpdate, FactoryDeleteInfo>({
    create: createFactory,
    update: updateFactory,
    remove: deleteFactory,
    getById: getFactoryById,
    getDeleteInfo: getFactoryDeleteInfo,
  })
}

// =============================================================================
// LINE CRUD HOOKS
// =============================================================================

/**
 * Hook for fetching lines list
 */
export function useLines(factoryId: string | null) {
  const [lines, setLines] = useState<LineFull[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryId) {
      setLines([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchLines(factoryId)
      setLines(data)
    } catch (e) {
      setError(e as Error)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  useEffect(() => {
    load()
  }, [load])

  return { lines, loading, error, reload: load }
}

/**
 * Hook for line CRUD mutations
 */
export function useLineMutations() {
  return useCrudMutation<LineFull, LineCreate, LineUpdate, LineDeleteInfo>({
    create: createLine,
    update: updateLine,
    remove: deleteLine,
    getById: getLineById,
    getDeleteInfo: getLineDeleteInfo,
  })
}

// =============================================================================
// GENERIC DELETE CONFIRMATION HOOK
// =============================================================================

export interface DeleteInfo {
  entityType: 'company' | 'factory' | 'line'
  entityId: string
  entityName: string
  childCounts: {
    factories?: number
    lines?: number
    equipment?: number
    layouts?: number
  }
}

/**
 * Hook for managing delete confirmation flow
 * Note: 이 훅은 복잡한 상태 관리가 필요하여 useCrudMutation으로 대체하지 않음
 */
export function useDeleteConfirmation() {
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const prepareDelete = useCallback(async (
    entityType: 'company' | 'factory' | 'line',
    entityId: string
  ) => {
    try {
      setLoading(true)
      setError(null)

      let info: DeleteInfo

      switch (entityType) {
        case 'company': {
          const result = await getCompanyDeleteInfo(entityId)
          info = {
            entityType,
            entityId,
            entityName: result.company_name,
            childCounts: {
              factories: result.factory_count,
              lines: result.line_count,
              equipment: result.equipment_count,
            },
          }
          break
        }
        case 'factory': {
          const result = await getFactoryDeleteInfo(entityId)
          info = {
            entityType,
            entityId,
            entityName: result.factory_name,
            childCounts: {
              lines: result.line_count,
              equipment: result.equipment_count,
              layouts: result.layout_count,
            },
          }
          break
        }
        case 'line': {
          const result = await getLineDeleteInfo(entityId)
          info = {
            entityType,
            entityId,
            entityName: result.line_name,
            childCounts: {
              equipment: result.equipment_count,
            },
          }
          break
        }
      }

      setDeleteInfo(info)
      return info
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteInfo) return

    try {
      setLoading(true)
      setError(null)

      switch (deleteInfo.entityType) {
        case 'company':
          await deleteCompany(deleteInfo.entityId)
          break
        case 'factory':
          await deleteFactory(deleteInfo.entityId)
          break
        case 'line':
          await deleteLine(deleteInfo.entityId)
          break
      }

      setDeleteInfo(null)
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setLoading(false)
    }
  }, [deleteInfo])

  const cancelDelete = useCallback(() => {
    setDeleteInfo(null)
    setError(null)
  }, [])

  return {
    deleteInfo,
    loading,
    error,
    prepareDelete,
    confirmDelete,
    cancelDelete,
  }
}

// =============================================================================
// EQUIPMENT CRUD HOOKS
// =============================================================================

/**
 * Hook for fetching equipment by line
 */
export function useLineEquipment(lineId: string | null) {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!lineId) {
      setEquipment([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchLineEquipment(lineId)
      setEquipment(data)
    } catch (e) {
      setError(e as Error)
      setEquipment([])
    } finally {
      setLoading(false)
    }
  }, [lineId])

  useEffect(() => {
    load()
  }, [load])

  return { equipment, loading, error, reload: load }
}

/**
 * Hook for equipment CRUD mutations
 */
export function useEquipmentMutations() {
  return useCrudMutation<Equipment, EquipmentCreate, EquipmentUpdate>({
    create: createEquipment,
    update: updateEquipment,
    remove: deleteEquipment,
  })
}
```

---

## 5. Acceptance Criteria (검증 체크리스트)

### 5.1 코드 품질

- [ ] `useCrudMutation.ts` 파일이 `src/hooks/` 디렉토리에 생성됨
- [ ] `useCrud.ts` 라인 수가 280줄 이하로 감소
- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 경고/에러 없음

### 5.2 기능 검증

- [ ] `npm run build` 성공
- [ ] Admin 페이지에서 회사 CRUD 정상 동작
  - [ ] 회사 생성
  - [ ] 회사 수정
  - [ ] 회사 삭제 (삭제 확인 모달 포함)
- [ ] Admin 페이지에서 공장 CRUD 정상 동작
  - [ ] 공장 생성
  - [ ] 공장 수정
  - [ ] 공장 삭제
- [ ] Admin 페이지에서 라인 CRUD 정상 동작
  - [ ] 라인 생성
  - [ ] 라인 수정
  - [ ] 라인 삭제
- [ ] 설비 관련 기능 정상 동작
  - [ ] 설비 추가
  - [ ] 설비 수정
  - [ ] 설비 삭제

### 5.3 API 호환성

- [ ] 모든 기존 훅의 반환 타입이 동일하게 유지됨
- [ ] `saving`, `error` 상태가 기존과 동일하게 동작
- [ ] 에러 발생 시 기존과 동일하게 throw됨

---

## 6. Files to Create/Modify (파일 목록)

### 6.1 신규 생성 파일

| 파일 경로 | 설명 |
|----------|------|
| `src/hooks/useCrudMutation.ts` | 제너릭 CRUD mutation 훅 |

### 6.2 수정 파일

| 파일 경로 | 수정 내용 |
|----------|----------|
| `src/hooks/useCrud.ts` | useCrudMutation 사용하도록 리팩토링 |

### 6.3 변경 없는 관련 파일 (참고용)

| 파일 경로 | 역할 |
|----------|------|
| `src/lib/api.ts` | API 함수 정의 |
| `src/pages/AdminPage.tsx` | CRUD 훅 사용처 |

---

## 7. Rollback Plan (롤백 계획)

문제 발생 시:

```bash
# Git으로 변경 사항 되돌리기
git checkout -- src/hooks/useCrud.ts
git rm src/hooks/useCrudMutation.ts
```

---

## 8. Expected Results (예상 결과)

| 지표 | Before | After | 개선율 |
|-----|--------|-------|--------|
| useCrud.ts 라인 수 | 555줄 | ~250줄 | ~55% 감소 |
| 중복 try-catch 패턴 | 22개 | 0개 | 100% 제거 |
| 새 엔티티 추가 시 코드량 | ~70줄 | ~10줄 | ~85% 감소 |

---

# Section 03: Knip 도입

## 개요

| 항목 | 내용 |
|------|------|
| **섹션 ID** | section-03-knip-setup |
| **목표** | 미사용 코드 자동 감지 도구 Knip 도입 |
| **예상 소요 시간** | 15-20분 |
| **난이도** | 낮음 |

---

## 1. Background (배경)

### 1.1 현재 문제점

현재 프로젝트에는 미사용 코드를 자동으로 감지하는 체계가 없어 다음과 같은 문제가 발생합니다:

- **레거시 코드 축적**: 더 이상 사용되지 않는 함수, 타입, 컴포넌트가 코드베이스에 남아있음
- **번들 크기 증가**: 미사용 코드가 최종 빌드에 포함될 가능성
- **코드 이해도 저하**: 실제로 사용되는 코드와 사용되지 않는 코드 구분이 어려움
- **의존성 관리 어려움**: 미사용 npm 패키지가 package.json에 남아있음

### 1.2 Knip이란?

Knip은 JavaScript/TypeScript 프로젝트에서 미사용 코드를 찾아주는 도구입니다:

- **미사용 파일 감지**: 프로젝트 어디에서도 import되지 않는 파일
- **미사용 export 감지**: export되었지만 사용되지 않는 함수, 타입, 변수
- **미사용 의존성 감지**: package.json에 있지만 코드에서 사용되지 않는 패키지
- **미사용 devDependencies 감지**: 개발 의존성 중 미사용 패키지

### 1.3 왜 Knip인가?

| 도구 | 특징 |
|------|------|
| ESLint (no-unused-vars) | 로컬 변수만 감지, export 미감지 |
| TypeScript (noUnusedLocals) | 로컬 변수만 감지, export 미감지 |
| **Knip** | export, 의존성, 파일 단위 전체 감지 |

---

## 2. Requirements (완료 조건)

이 섹션이 완료되면 다음 조건을 만족해야 합니다:

- [ ] knip 패키지가 devDependencies에 설치됨
- [ ] knip.json 설정 파일이 frontend 디렉토리에 존재함
- [ ] package.json에 lint:dead 스크립트가 추가됨
- [ ] `npm run lint:dead` 명령어가 오류 없이 실행됨
- [ ] 미사용 코드 목록이 출력됨 (있는 경우)

---

## 3. Dependencies (의존 관계)

### 3.1 Requires (선행 조건)

| 선행 섹션 | 이유 |
|-----------|------|
| 없음 | 독립적으로 수행 가능 |

### 3.2 Blocks (후속 작업)

| 후속 섹션 | 이유 |
|-----------|------|
| Section 04: Legacy Cleanup | Knip 결과를 기반으로 미사용 코드 정리 |

```
Section 01 ─┐
Section 02 ─┼─→ Section 03: Knip Setup ───→ Section 04: Legacy Cleanup
            │
(독립적)    │
```

---

## 4. Implementation Details (구현 상세)

### 4.1 Step 1: Knip 설치

frontend 디렉토리에서 Knip을 devDependency로 설치합니다.

```bash
cd frontend
npm install --save-dev knip
```

**설치 확인:**
```bash
npx knip --version
```

### 4.2 Step 2: knip.json 설정 파일 생성

`frontend/knip.json` 파일을 생성합니다:

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

**설정 상세 설명:**

| 설정 | 값 | 설명 |
|------|-----|------|
| `$schema` | unpkg.com/knip@5/schema.json | IDE 자동완성 지원 |
| `entry` | `["src/main.tsx"]` | 애플리케이션 진입점 파일 |
| `project` | `["src/**/*.{ts,tsx}"]` | 분석 대상 파일 패턴 |
| `ignore` | `["**/*.d.ts", ...]` | 분석에서 제외할 파일 |
| `ignoreDependencies` | `["@types/*"]` | 무시할 의존성 패턴 (타입 패키지) |

### 4.3 Step 3: package.json scripts 추가

`frontend/package.json`의 scripts 섹션에 다음 스크립트를 추가합니다:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:dead": "knip",
    "lint:dead:fix": "knip --fix",
    "preview": "vite preview"
  }
}
```

**스크립트 설명:**

| 스크립트 | 명령어 | 설명 |
|----------|--------|------|
| `lint:dead` | `knip` | 미사용 코드 검사 (보고만) |
| `lint:dead:fix` | `knip --fix` | 자동 수정 가능한 항목 수정 |

### 4.4 Step 4: 초기 검사 실행

설치 및 설정이 완료되면 검사를 실행합니다:

```bash
cd frontend
npm run lint:dead
```

**예상 출력 형식:**

```
Unused files (2)
src/components/OldComponent.tsx
src/utils/deprecated.ts

Unused exports (3)
EquipmentFull  src/lib/api.ts:515:1
oldFunction    src/utils/helpers.ts:42:1

Unused dependencies (1)
some-unused-package

Unused devDependencies (0)
```

### 4.5 Step 5: 결과 분석 및 대응

Knip 실행 결과에 따라 다음과 같이 대응합니다:

#### 4.5.1 미사용 export 발견 시

```bash
# 상세 정보 확인
npx knip --reporter compact
```

발견된 미사용 export 목록을 Section 04에서 정리합니다.

#### 4.5.2 False Positive 발생 시

특정 항목이 실제로는 사용되지만 Knip이 감지하지 못하는 경우:

**방법 1: knip.json에 ignore 패턴 추가**
```json
{
  "ignore": [
    "**/*.d.ts",
    "src/vite-env.d.ts",
    "src/special-file.ts"
  ]
}
```

**방법 2: 특정 export 무시**
```json
{
  "ignoreExportsUsedInFile": true
}
```

**방법 3: 코드에 주석으로 무시**
```typescript
// knip-ignore
export function specialFunction() { ... }
```

---

## 5. Acceptance Criteria (검수 기준)

### 5.1 필수 체크리스트

- [ ] `frontend/node_modules/knip` 디렉토리 존재
- [ ] `frontend/knip.json` 파일 존재
- [ ] `frontend/package.json`에 `lint:dead` 스크립트 존재
- [ ] `npm run lint:dead` 실행 시 오류 없음
- [ ] 실행 결과가 콘솔에 출력됨 (미사용 항목이 없어도 정상)

### 5.2 검증 명령어

```bash
cd frontend

# 1. 패키지 설치 확인
npm list knip

# 2. 설정 파일 확인
cat knip.json

# 3. 스크립트 확인
npm run lint:dead --dry-run 2>/dev/null || echo "Script exists"

# 4. 실행 테스트
npm run lint:dead
```

### 5.3 성공 기준

| 항목 | 성공 조건 |
|------|-----------|
| 패키지 설치 | `npm list knip` 결과에 버전 표시 |
| 설정 파일 | knip.json이 유효한 JSON이고 entry 포함 |
| 스크립트 | `npm run lint:dead` 실행 가능 |
| 출력 | 미사용 코드 목록 또는 "No issues found" 메시지 |

---

## 6. Files to Create/Modify (파일 목록)

### 6.1 생성 파일

| 파일 경로 | 설명 |
|-----------|------|
| `frontend/knip.json` | Knip 설정 파일 |

### 6.2 수정 파일

| 파일 경로 | 수정 내용 |
|-----------|-----------|
| `frontend/package.json` | scripts에 lint:dead, lint:dead:fix 추가 |

### 6.3 파일 전체 내용

#### frontend/knip.json (신규 생성)

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

#### frontend/package.json (수정 - scripts 섹션만)

기존 scripts에 다음 2줄 추가:

```json
"lint:dead": "knip",
"lint:dead:fix": "knip --fix"
```

---

## 7. Troubleshooting (문제 해결)

### 7.1 일반적인 오류

#### 오류: "Cannot find module 'knip'"

```bash
# 해결: 패키지 재설치
cd frontend
npm install --save-dev knip
```

#### 오류: "Entry file not found"

```bash
# 해결: knip.json의 entry 경로 확인
# src/main.tsx가 실제로 존재하는지 확인
ls src/main.tsx
```

#### 오류: "Parse error in knip.json"

```bash
# 해결: JSON 유효성 검사
npx jsonlint knip.json
```

### 7.2 False Positive 처리

특정 파일이나 export가 실제로는 사용되지만 Knip이 감지하지 못하는 경우:

```json
// knip.json에 추가
{
  "ignore": [
    "src/dynamically-imported/**/*"
  ],
  "ignoreDependencies": [
    "postcss",
    "autoprefixer"
  ]
}
```

---

## 8. 다음 단계

이 섹션 완료 후:

1. Knip 실행 결과를 기록
2. 발견된 미사용 코드 목록을 Section 04에 전달
3. Section 04: Legacy Cleanup 진행

**예상 발견 항목:**
- `EquipmentFull` 타입 (api.ts) - 삭제 대상
- `useEquipment` 훅의 MOCK 데이터 - 검토 필요

---

# Section 04: 레거시 코드 정리

## Background (배경)

React Query 마이그레이션과 API 구조 변경 과정에서 더 이상 사용되지 않는 레거시 코드가 남아있습니다. 이러한 미사용 코드는 번들 크기를 증가시키고, 코드베이스의 복잡도를 높이며, 새로운 개발자가 코드를 이해하는 데 혼란을 줍니다.

**문제 영역:**
1. **미사용 타입 정의** - `EquipmentFull` 인터페이스가 api.ts에 정의되어 있지만 어디에서도 사용되지 않음
2. **레거시 훅** - `useEquipment` 훅이 useState/useEffect 패턴으로 구현되어 있으며, React Query 기반의 `useFactoryEquipment`와 중복됨
3. **MOCK 데이터 처리** - 개발용 MOCK 데이터가 프로덕션 코드에 포함되어 번들 크기 증가

이 섹션은 Section 03에서 설정한 Knip을 활용하여 미사용 코드를 체계적으로 식별하고 정리합니다.

---

## Dependencies (의존성)

- **Section 03 (Knip Setup) 완료 필수**
  - `npm run lint:dead` 명령어가 동작해야 함
  - knip.json 설정이 완료되어 있어야 함

---

## Requirements (완료 조건)

1. Knip 실행 결과에서 미사용 export가 0개 (또는 의도적으로 무시한 항목만 남음)
2. `EquipmentFull` 타입이 api.ts에서 제거됨
3. `useEquipment` 훅의 사용처를 확인하고 적절히 처리됨
4. `npm run build` 성공
5. 기존 기능이 모두 정상 동작

---

## Implementation Details (구현 상세)

### Step 1: Knip 결과 분석

**작업 내용:**
```bash
cd frontend
npm run lint:dead
```

**예상 출력 분석:**
- `Unused exports` 섹션에서 미사용 export 목록 확인
- `Unused dependencies` 섹션에서 미사용 패키지 확인
- 각 항목별로 삭제/유지 결정

**검토 절차:**
1. Knip 결과를 파일로 저장: `npm run lint:dead > knip-result.txt 2>&1`
2. 각 미사용 항목에 대해:
   - 실제로 사용되지 않는지 수동 확인 (grep으로 검색)
   - False positive인지 판단 (동적 import, 외부 참조 등)
   - 삭제 또는 knip.json의 ignore에 추가

---

### Step 2: api.ts 미사용 타입 제거 (EquipmentFull)

**현재 상태:**
```typescript
// src/lib/api.ts (Line 515-517)
export interface EquipmentFull extends Equipment {
  line_code: string
}
```

**사용처 확인:**
```bash
# 이미 확인됨 - 사용처 없음
grep -r "EquipmentFull" frontend/src/
# 결과: api.ts의 정의만 존재
```

**작업:**
api.ts에서 다음 코드 삭제:
```typescript
export interface EquipmentFull extends Equipment {
  line_code: string
}
```

**위치:** `frontend/src/lib/api.ts` Line 515-517 (빈 줄 포함 시 514-518)

---

### Step 3: useEquipment 훅 검토

**현재 상태:**
- `useEquipment(siteId: string)` - useState/useEffect 패턴, MOCK 데이터 포함
- `useFactoryEquipment(factoryCode: string)` - React Query 패턴, 캐싱 지원

**사용처 확인 결과:**
| 훅 | 사용처 파일 | 용도 |
|---|---|---|
| `useEquipment` | `RegistryPage.tsx` | 설비 등록 페이지 |
| `useFactoryEquipment` | `LayoutEditorPage.tsx`, `FactoryLinePage.tsx` | 레이아웃/3D 뷰어 |
| `useEquipmentGroups` | `LayoutEditorPage.tsx`, `FactoryLinePage.tsx` | 설비 그룹 조회 |

**결정:**
`useEquipment`는 `RegistryPage.tsx`에서 사용 중이므로 삭제 불가.

**선택지:**
1. **유지 (권장)** - RegistryPage가 siteId 기반으로 동작하므로 유지
2. **리팩토링** - React Query 패턴으로 마이그레이션 (별도 작업으로 분리)

이 섹션에서는 **유지**를 권장합니다. 리팩토링은 별도 이슈로 관리.

---

### Step 4: MOCK 데이터 처리 방안

**현재 상태:**
`useEquipment.ts` Line 6-19에 12개 항목의 MOCK 데이터가 하드코딩되어 있음.

```typescript
const MOCK: Equipment[] = [
  { id:1, equipment_id:'JM_PCB_001_EQ_0001', ... },
  // ... 12개 항목
]

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL
```

**문제점:**
- 프로덕션 빌드에도 MOCK 데이터가 포함됨
- 번들 크기 증가 (약 2-3KB)

**처리 방안:**

**옵션 A: 조건부 import (권장)**
```typescript
// useEquipment.ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL

const getMockData = async () => {
  if (USE_MOCK) {
    const { MOCK } = await import('@/lib/mock-data')
    return MOCK
  }
  return []
}
```

별도 파일로 분리:
```typescript
// src/lib/mock-data.ts
export const MOCK: Equipment[] = [...]
```

**옵션 B: 현재 상태 유지 (이 섹션에서 권장)**
- MOCK 데이터 크기가 작음 (2-3KB)
- 개발 환경에서 필요
- 리팩토링은 별도 최적화 작업으로 분리

**이 섹션에서는 옵션 B(현재 상태 유지)를 권장합니다.** MOCK 데이터 분리는 번들 최적화 작업 시 진행.

---

### Step 5: Knip 결과 기반 추가 정리

Knip 실행 후 추가로 발견되는 미사용 코드에 대해:

**검토 절차:**
1. 각 미사용 export에 대해 grep으로 사용처 재확인
2. 실제 미사용 확인 시 삭제
3. 의도적 미사용(향후 사용 예정)인 경우:
   - 주석으로 표시: `// @knip-ignore: 향후 사용 예정`
   - 또는 knip.json의 ignore에 추가

**knip.json 업데이트 예시:**
```json
{
  "ignore": [
    "**/*.d.ts",
    "src/vite-env.d.ts"
  ],
  "ignoreDependencies": [
    "@types/*"
  ],
  "ignoreExportsUsedInFile": true
}
```

---

## Acceptance Criteria (검증 체크리스트)

### 필수 항목
- [ ] Knip 실행 (`npm run lint:dead`) 완료
- [ ] Knip 결과 분석 및 문서화 완료
- [ ] `EquipmentFull` 타입이 api.ts에서 삭제됨
- [ ] `useEquipment` 훅 사용처 확인 완료 (삭제 또는 유지 결정)
- [ ] `npm run build` 성공
- [ ] 빌드된 번들 크기가 이전과 동일하거나 감소

### 기능 테스트
- [ ] RegistryPage (`/registry`) 정상 동작
- [ ] LayoutEditorPage 정상 동작
- [ ] FactoryLinePage (3D 뷰어) 정상 동작
- [ ] Admin 페이지 CRUD 기능 정상 동작

### 선택 항목
- [ ] 추가 미사용 코드 정리 완료 (Knip 결과 기반)
- [ ] knip.json에 필요한 ignore 규칙 추가됨

---

## Files to Create/Modify (파일 목록)

### 수정 대상
| 파일 | 작업 | 상세 |
|---|---|---|
| `frontend/src/lib/api.ts` | 수정 | `EquipmentFull` 인터페이스 삭제 (Line 515-517) |
| `frontend/knip.json` | 수정 (필요시) | ignore 규칙 추가 |

### 검토만 (수정 불필요)
| 파일 | 상태 | 사유 |
|---|---|---|
| `frontend/src/hooks/useEquipment.ts` | 유지 | RegistryPage에서 사용 중 |
| `frontend/src/pages/RegistryPage.tsx` | 유지 | useEquipment 훅 사용 중 |

### 생성 대상
- 없음 (이 섹션에서는 파일 생성 없음)

---

## Rollback Plan (롤백 계획)

변경 사항이 적어 롤백이 간단합니다:

```bash
# api.ts 변경 롤백
git checkout frontend/src/lib/api.ts

# 전체 롤백
git checkout .
```

---

## Notes (참고 사항)

1. **EquipmentFull 타입의 원래 용도**: Equipment와 line_code를 결합한 타입으로, 이전에 설비 목록 조회 시 라인 정보를 포함하기 위해 사용되었을 가능성. 현재는 Equipment 타입에 line_code가 포함되어 있어 불필요.

2. **useEquipment vs useFactoryEquipment 차이**:
   - `useEquipment`: siteId(=lineCode) 기반, 단일 라인 조회
   - `useFactoryEquipment`: factoryCode 기반, 공장 전체 조회, React Query 캐싱

3. **향후 개선 방향**:
   - `useEquipment`를 React Query 패턴으로 마이그레이션
   - MOCK 데이터를 별도 파일로 분리하여 tree-shaking 가능하게
   - 개발/프로덕션 환경별 빌드 분리

---

# Execution Rules (실행 규칙)

## 1. 섹션 순서대로 실행

```
Section 01 → Section 02 → Section 03 → Section 04
```

**주의:** Section 03과 04는 순서 의존성이 있습니다. Section 03(Knip Setup)이 완료되어야 Section 04(Legacy Cleanup)를 진행할 수 있습니다.

## 2. 각 섹션 완료 후 빌드 검증

각 섹션의 모든 작업을 완료한 후, 반드시 다음 명령어로 빌드를 검증합니다:

```bash
cd frontend
npm run build
```

**빌드 실패 시:**
- 해당 섹션의 변경사항을 검토
- TypeScript 에러 수정
- ESLint 에러 수정
- 빌드 성공할 때까지 수정 반복

## 3. Acceptance Criteria 충족 확인

각 섹션의 Acceptance Criteria를 모두 만족해야 다음 섹션으로 이동합니다:

- [ ] 코드 변경 완료
- [ ] `npm run build` 성공
- [ ] 기능 테스트 통과

## 4. 섹션 간 이동

현재 섹션의 모든 Acceptance Criteria가 만족되면:
1. 해당 섹션 완료 표시
2. 다음 섹션으로 이동
3. 다음 섹션의 요구사항 분석부터 시작

---

# Completion Signal

모든 섹션(01, 02, 03, 04)이 완료되고 각 섹션의 Acceptance Criteria가 모두 만족되면:

<promise>ALL-SECTIONS-COMPLETE</promise>

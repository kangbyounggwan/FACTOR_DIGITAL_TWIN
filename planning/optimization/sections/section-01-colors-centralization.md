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

파일 내에서 색상을 사용하는 곳을 찾아 수정합니다:

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

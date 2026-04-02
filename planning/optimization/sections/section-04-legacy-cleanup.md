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

# Frontend Code Optimization Research

## Part 1: Codebase Analysis

### 1. 중복 코드 발견

#### 1.1 색상 정의 중복 (Critical)
세 개의 파일에서 설비/그룹 색상이 각각 다른 포맷으로 중복 정의:

| 파일 | 라인 | 포맷 | 예시 |
|------|------|------|------|
| EquipmentList.tsx | 11-41 | Tailwind class | `'bg-emerald-600'` |
| LayoutCanvas.tsx | 5-35 | HEX string | `'#059669'` |
| Scene3D.tsx | 9-26 | HEX integer | `0x059669` |

**문제점:** 색상 변경 시 3곳 모두 수정 필요, 값 불일치 가능성

#### 1.2 useCrud.ts 중복 패턴 (High)
- 파일 크기: 555줄
- 동일한 try-catch 패턴이 22개 함수에서 반복
- 모든 CRUD mutation이 동일한 에러 핸들링 구조

#### 1.3 save 함수 중복
- useEquipment.ts Line 48-57
- useFactoryEquipment (useEquipment.ts Line 89-100)
- 동일 로직, 다른 상태 관리 방식

### 2. 미사용/레거시 코드

#### 2.1 MOCK 데이터
- useEquipment.ts Line 6-19
- 조건부 사용 (`VITE_USE_MOCK` 환경변수 기반)
- 프로덕션에서는 미사용

#### 2.2 미사용 타입
- lib/api.ts Line 515-516: `EquipmentFull` 타입 정의만 있고 미사용

### 3. React Query 마이그레이션 상태

#### 완료된 훅 (useQuery 사용)
- useFactoryEquipment (useEquipment.ts)
- useEquipmentGroups (useEquipment.ts)
- useEquipmentPoints (useEquipmentPoints.ts)
- useCompanies, useFactories, useFactoryLines (useFactories.ts)
- useLayouts, useLayout, useActiveLayout (useLayouts.ts)

#### 미완료 훅 (useState/useEffect)
- useEquipment (useEquipment.ts Line 23-60) - 레거시 훅

#### staleTime 설정 현황
| 훅 | staleTime | gcTime |
|----|-----------|--------|
| useFactoryEquipment | 5분 | 기본값 |
| useEquipmentGroups | 5분 | 기본값 |
| useEquipmentPoints | 5분 | 30분 |
| useCompanies | 10분 | 기본값 |
| useFactories | 10분 | 기본값 |
| useLayoutComparison | 2분 | 기본값 |

### 4. 파일 크기 분석

| 파일 | 라인 수 | 비고 |
|------|---------|------|
| LayoutEditorPage.tsx | 1,047 | 분리 검토 |
| AdminPage.tsx | 988 | 분리 검토 |
| api.ts | 609 | 타입 정리 |
| useCrud.ts | 555 | 리팩토링 필요 |

---

## Part 2: Web Research - Best Practices

### 1. React Query 모범 사례

#### staleTime vs gcTime
- **staleTime**: 데이터가 fresh로 간주되는 기간 (기본: 0)
- **gcTime**: 캐시 유지 기간 (기본: 5분)
- 원칙: `staleTime <= gcTime`

#### 권장 설정
```typescript
// 정적 데이터
{ staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 }

// 자주 변경되는 데이터
{ staleTime: 1 * 60 * 1000, gcTime: 5 * 60 * 1000 }

// 실시간 데이터
{ staleTime: 0, gcTime: 30 * 1000 }
```

#### Query Key 구조화
```typescript
['users']                    // 전체
['users', userId]            // 특정 항목
['users', userId, 'posts']   // 관계형 데이터
```

### 2. 코드 최적화 도구

#### eslint-plugin-unused-imports
```bash
npm install --save-dev eslint-plugin-unused-imports
```

```javascript
// .eslintrc.js
{
  "plugins": ["unused-imports"],
  "rules": {
    "unused-imports/no-unused-imports": "error"
  }
}
```

#### Knip (권장 - Dead Code Detector)
```bash
npm install --save-dev knip
npx knip
```
- 미사용 export + 미사용 파일 + 미사용 의존성 감지
- ts-prune 대체 권장

### 3. Vite 번들 최적화

#### rollup-plugin-visualizer
```typescript
import { visualizer } from 'rollup-plugin-visualizer'

export default {
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      filename: 'dist/stats.html'
    })
  ]
}
```

#### manualChunks 설정
```typescript
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-ui': ['@radix-ui/react-*'],
          'vendor-query': ['@tanstack/react-query']
        }
      }
    }
  }
}
```

---

## 개선 우선순위

| 순위 | 항목 | 효과 | 난이도 |
|------|------|------|--------|
| 1 | 색상 정의 중앙화 | 유지보수성 향상 | 낮음 |
| 2 | useCrud.ts 제너릭화 | 코드 50% 감소 | 중간 |
| 3 | Query Key 중앙화 | 캐시 관리 개선 | 낮음 |
| 4 | 레거시 useEquipment 제거 | 코드 정리 | 낮음 |
| 5 | 번들 최적화 (manualChunks) | 로딩 속도 개선 | 중간 |
| 6 | Knip으로 미사용 코드 정리 | 번들 크기 감소 | 낮음 |

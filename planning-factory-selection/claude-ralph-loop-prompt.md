# Factory Selection Feature - Implementation Prompt

## Mission
FACTOR Digital Twin 시스템에 공장/라인 선택 기능을 구현합니다.

## Sections

### Section 01: API Layer
**파일**: `frontend/src/lib/api.ts`

```typescript
// 타입 추가
export interface Factory {
  id: string
  code: string
  name: string
  address: string | null
  company_name: string | null
}

export interface ProductionLine {
  id: string
  code: string
  name: string
  description: string | null
  location: string | null
  equipment_count: number
}

// API 함수 추가
export const fetchFactories = () =>
  api.get<Factory[]>('/factories').then(r => r.data)

export const fetchFactoryLines = (factoryCode: string) =>
  api.get<ProductionLine[]>(`/factories/${factoryCode}/lines`).then(r => r.data)
```

### Section 02: Data Hooks
**파일**: `frontend/src/hooks/useFactories.ts` (새 파일)

useFactories()와 useFactoryLines(factoryCode) 훅 생성

### Section 03: Factory Line Page
**필수**: `npx shadcn@latest add table`
**파일**: `frontend/src/pages/FactoryLinePage.tsx` (새 파일)

공장/라인 테이블 UI 구현

### Section 04: App Routing
**파일**: `frontend/src/App.tsx`

- type Page = 'factory-line' | 'registry' | 'pipeline'
- selectedFactory, selectedLine 상태 추가
- 헤더 수정 (뒤로가기, 빵부스러기)

### Section 05: Registry Page Update
**파일**: `frontend/src/pages/RegistryPage.tsx`

- Props: siteId → lineCode

### Section 06: Pipeline Page Update
**파일**: `frontend/src/pages/PipelinePage.tsx`

- Props: siteId → lineCode
- onComplete 콜백 추가

## Execution Rules
1. 순서대로 진행 (01 → 02 → 03 → 04 → 05/06)
2. 각 섹션 완료 후 acceptance criteria 확인
3. 05와 06은 병렬 진행 가능

## Completion Signal
<promise>ALL-SECTIONS-COMPLETE</promise>

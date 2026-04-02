# Implementation Plan: Factory Selection Feature

## Overview

FACTOR Digital Twin 시스템에 공장/라인 선택 기능을 추가합니다. 현재 하드코딩된 siteId 대신 DB에서 공장과 라인을 선택하여 3D 뷰어로 진입하는 플로우를 구현합니다.

### Goals
1. 공장/라인 선택 페이지 추가
2. 기존 페이지들이 선택된 라인 코드를 사용하도록 수정
3. 페이지 간 네비게이션 개선

### Constraints
- 기존 useState 기반 라우팅 유지
- MES DB 공유: factories, production_lines 테이블 구조 변경 금지
- equipment_scans는 Digital Twin 전용

---

## Section 1: API Layer (lib/api.ts)

### 목표
공장/라인 데이터 조회 API 함수 추가

### 변경 사항

```typescript
// lib/api.ts에 추가

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

export const fetchFactories = () =>
  api.get<Factory[]>('/factories').then(r => r.data)

export const fetchFactoryLines = (factoryCode: string) =>
  api.get<ProductionLine[]>(`/factories/${factoryCode}/lines`).then(r => r.data)
```

### 테스트
- `GET /api/factories` 응답 확인
- `GET /api/factories/JM_MAIN/lines` 응답 확인

---

## Section 2: Data Hooks (hooks/useFactories.ts)

### 목표
공장/라인 데이터 로딩을 위한 커스텀 훅 생성

### 새 파일: `src/hooks/useFactories.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Factory, ProductionLine, fetchFactories, fetchFactoryLines } from '@/lib/api'

export function useFactories() {
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchFactories()
      setFactories(data)
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { factories, loading, error, reload: load }
}

export function useFactoryLines(factoryCode: string | null) {
  const [lines, setLines] = useState<ProductionLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryCode) {
      setLines([])
      return
    }
    try {
      setLoading(true)
      const data = await fetchFactoryLines(factoryCode)
      setLines(data)
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [factoryCode])

  useEffect(() => { load() }, [load])

  return { lines, loading, error, reload: load }
}
```

---

## Section 3: FactoryLinePage 컴포넌트

### 목표
공장/라인 선택 UI 구현

### 새 파일: `src/pages/FactoryLinePage.tsx`

### UI 구조
```
┌─────────────────────────────────────────────────────────┐
│ 공장 및 라인 선택                                        │
├─────────────────────────────────────────────────────────┤
│ 공장 목록                                               │
│ ┌────────┬──────────┬──────────┬────────┬────────────┐ │
│ │ 코드   │ 공장명   │ 주소     │ 라인   │            │ │
│ ├────────┼──────────┼──────────┼────────┼────────────┤ │
│ │JM_MAIN │ JM 본사  │ 화성시   │ 2      │ [선택]     │ │
│ └────────┴──────────┴──────────┴────────┴────────────┘ │
├─────────────────────────────────────────────────────────┤
│ JM_MAIN 라인 목록                            (공장선택후)│
│ ┌──────────┬──────────┬────────┬───────────────────┐   │
│ │ 라인코드 │ 라인명   │ 설비   │ 액션              │   │
│ ├──────────┼──────────┼────────┼───────────────────┤   │
│ │JM_PCB_001│ PCB 1라인│ 5      │ [3D보기] [업로드] │   │
│ │JM_PCB_002│ PCB 2라인│ 0      │ [3D보기] [업로드] │   │
│ └──────────┴──────────┴────────┴───────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 주요 기능
1. 공장 목록 테이블
2. 공장 선택 시 라인 목록 표시
3. "3D 보기" 버튼 → RegistryPage로 이동
4. "업로드" 버튼 → PipelinePage로 이동

### Props
```typescript
interface Props {
  onSelectLine: (factory: Factory, line: ProductionLine) => void
  onUpload: (factory: Factory, line: ProductionLine) => void
}
```

### 사용 컴포넌트
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- `Button`
- `Badge` (설비 수 표시)
- `Loader2` (로딩 스피너)

---

## Section 4: App.tsx 수정

### 목표
페이지 타입 확장 및 라우팅 로직 수정

### 변경 사항

```typescript
// 타입 확장
type Page = 'factory-line' | 'registry' | 'pipeline'

// 상태 추가
const [page, setPage] = useState<Page>('factory-line')
const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null)
const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null)

// 핸들러
const handleSelectLine = (factory: Factory, line: ProductionLine) => {
  setSelectedFactory(factory)
  setSelectedLine(line)
  setPage('registry')
}

const handleUpload = (factory: Factory, line: ProductionLine) => {
  setSelectedFactory(factory)
  setSelectedLine(line)
  setPage('pipeline')
}

const handleBack = () => {
  setPage('factory-line')
}

// 렌더링
{page === 'factory-line' && (
  <FactoryLinePage
    onSelectLine={handleSelectLine}
    onUpload={handleUpload}
  />
)}
{page === 'registry' && selectedLine && (
  <RegistryPage
    lineCode={selectedLine.code}
    factoryName={selectedFactory?.name}
    lineName={selectedLine.name}
    onBack={handleBack}
  />
)}
{page === 'pipeline' && selectedLine && (
  <PipelinePage
    lineCode={selectedLine.code}
    onComplete={() => setPage('registry')}
    onBack={handleBack}
  />
)}
```

### 헤더 수정
- 공장 선택 드롭다운 제거 (FactoryLinePage에서 선택)
- 현재 선택된 공장/라인 표시 (선택 시)
- 뒤로가기 버튼 추가 (registry/pipeline 페이지)

---

## Section 5: RegistryPage 수정

### 목표
lineCode props 사용 및 네비게이션 개선

### 변경 사항

```typescript
// Props 변경
interface Props {
  lineCode: string
  factoryName?: string
  lineName?: string
  onBack: () => void
}

// siteId → lineCode 변경
const { equipment, stats, loading, selected, setSelected, save } = useEquipment(lineCode)
```

### 헤더에 빵부스러기 추가
```tsx
<div className="flex items-center gap-2">
  <Button variant="ghost" size="icon" onClick={onBack}>
    <ArrowLeft className="h-4 w-4" />
  </Button>
  <span className="text-muted-foreground">{factoryName}</span>
  <span className="text-muted-foreground">/</span>
  <span>{lineName}</span>
</div>
```

---

## Section 6: PipelinePage 수정

### 목표
lineCode props 사용 및 완료 콜백

### 변경 사항

```typescript
// Props 변경
interface Props {
  lineCode: string
  onComplete: () => void
  onBack: () => void
}

// 완료 시 콜백 호출
useEffect(() => {
  if (status === 'done') {
    onComplete()
  }
}, [status, onComplete])
```

---

## Implementation Order

| 순서 | 섹션 | 의존성 | 예상 시간 |
|------|------|--------|----------|
| 1 | API Layer | 없음 | 10분 |
| 2 | Data Hooks | Section 1 | 15분 |
| 3 | FactoryLinePage | Section 1, 2 | 30분 |
| 4 | App.tsx 수정 | Section 3 | 20분 |
| 5 | RegistryPage 수정 | Section 4 | 15분 |
| 6 | PipelinePage 수정 | Section 4 | 10분 |

**총 예상 시간**: 약 1.5시간

---

## Acceptance Criteria

### 기능 검증
- [ ] 공장 목록이 테이블로 표시됨
- [ ] 공장 선택 시 라인 목록이 표시됨
- [ ] "3D 보기" 클릭 시 RegistryPage로 이동
- [ ] "업로드" 클릭 시 PipelinePage로 이동
- [ ] RegistryPage에서 해당 라인의 설비만 표시
- [ ] 뒤로가기 버튼으로 공장/라인 선택 화면 복귀
- [ ] PipelinePage 완료 후 자동으로 RegistryPage 이동

### UI 검증
- [ ] 다크 테마 일관성 유지
- [ ] 테이블 스타일링 (shadcn/ui)
- [ ] 로딩 상태 표시
- [ ] 에러 상태 표시

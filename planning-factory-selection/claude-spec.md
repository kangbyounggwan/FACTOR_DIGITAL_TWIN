# Factory Selection Feature - Complete Specification

## 1. System Context

### Architecture Overview
```
factor-digital-twin (관리자)          factor-MES (모니터링)
┌─────────────────────────┐          ┌─────────────────────────┐
│ • Point Cloud 스캔 처리  │          │ • 설비 상태 모니터링     │
│ • 설비 등록/분류         │          │ • OEE/생산 데이터 시각화 │
│ • Zone/라인 설정         │          │ • 알림 관리             │
│ • 3D 공간 데이터         │          │ • Digital Twin 뷰어     │
└───────────┬─────────────┘          └───────────┬─────────────┘
            │                                    │
            ▼                                    ▼
      ┌─────────────────────────────────────────────┐
      │              Supabase (공유 DB)              │
      │  • equipments (MES 설비 마스터)              │
      │  • equipment_scans (DT 3D 스캔 데이터)       │
      │  • factories/production_lines (공유)         │
      └─────────────────────────────────────────────┘
```

### Key Constraint
- **MES DB 공유**: factories, production_lines 테이블은 MES와 공유
- **DT 전용 테이블**: equipment_scans는 Digital Twin 전용
- 기존 MES 스키마 변경 금지

## 2. Current State

### Frontend
- App.tsx: useState 기반 페이지 전환 (`'registry' | 'pipeline'`)
- 하드코딩된 siteId: `JM_PCB_001`
- 컴포넌트: EquipmentList, Scene3D, RegPanel, ViewModeToggle

### Backend API (완성됨)
- `GET /api/factories` - 공장 목록
- `GET /api/factories/{code}/lines` - 공장 내 라인 목록
- `GET /api/equipment/{lineCode}` - 라인별 설비 스캔

### Database (완성됨)
- companies, factories, production_lines
- equipment_scans (line_id FK)
- 테스트 데이터: JM_MAIN 공장, JM_PCB_001/002 라인

## 3. Requirements

### 3.1 Page Flow (2단계)
```
┌─────────────────────────┐
│  FactoryLinePage (NEW)  │
│  • 공장 테이블          │
│  • 라인 테이블          │
│  • 공장→라인 드릴다운   │
└───────────┬─────────────┘
            │ 라인 선택
            ▼
┌─────────────────────────┐
│  RegistryPage (기존)    │
│  • 3D 뷰어              │
│  • 설비 등록/편집       │
└─────────────────────────┘
            │ 업로드 버튼
            ▼
┌─────────────────────────┐
│  PipelinePage (기존)    │
│  • PLY 파일 업로드      │
│  • 처리 진행률          │
└─────────────────────────┘
```

### 3.2 Page Types
```typescript
type Page = 'factory-line' | 'registry' | 'pipeline'
```

### 3.3 State Management
```typescript
// App.tsx state
const [page, setPage] = useState<Page>('factory-line')
const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null)
const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null)
```

### 3.4 FactoryLinePage Requirements

#### 공장 테이블
| 컬럼 | 설명 |
|------|------|
| 공장 코드 | factory.code |
| 공장명 | factory.name |
| 주소 | factory.address |
| 라인 수 | lines.length |
| 액션 | 선택 버튼 |

#### 라인 테이블 (공장 선택 후 표시)
| 컬럼 | 설명 |
|------|------|
| 라인 코드 | line.code |
| 라인명 | line.name |
| 설명 | line.description |
| 설비 수 | equipment_count |
| 액션 | 3D 보기, 업로드 |

#### UI 요구사항
- 테이블 형태 (shadcn/ui Table 컴포넌트)
- 공장 선택 시 하단에 라인 테이블 표시
- 라인 "3D 보기" 클릭 → RegistryPage로 이동
- 라인 "업로드" 클릭 → PipelinePage로 이동

### 3.5 RegistryPage 수정
- Props 변경: `siteId: string` → `lineCode: string`
- 헤더에 뒤로가기 버튼 추가
- 빵부스러기: `공장명 > 라인명`

### 3.6 PipelinePage 수정
- Props 변경: `siteId: string` → `lineCode: string`
- 업로드 완료 후 RegistryPage로 자동 이동

## 4. UI Design

### 색상 & 스타일 (기존 유지)
- 다크 테마
- Primary: Teal (#1D9E75)
- 폰트: IBM Plex Sans KR + JetBrains Mono

### 레이아웃
```
┌────────────────────────────────────────────────────┐
│ FACTOR  [공장 선택 ▼]   [설비 등록] [파이프라인]  │  ← 헤더
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ 공장 목록                                    │ │
│  ├──────────┬──────────┬──────────┬────────────┤ │
│  │ 코드     │ 공장명   │ 주소     │ 라인 수    │ │
│  ├──────────┼──────────┼──────────┼────────────┤ │
│  │ JM_MAIN  │ JM 본사  │ 화성시   │ 2          │ │  ← 클릭하면 확장
│  └──────────┴──────────┴──────────┴────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ JM_MAIN 라인 목록                            │ │  ← 공장 선택 후 표시
│  ├────────────┬──────────┬────────┬────────────┤ │
│  │ 라인 코드  │ 라인명   │ 설비   │ 액션       │ │
│  ├────────────┼──────────┼────────┼────────────┤ │
│  │ JM_PCB_001 │ PCB 1라인│ 5      │ [보기][+]  │ │
│  │ JM_PCB_002 │ PCB 2라인│ 0      │ [보기][+]  │ │
│  └────────────┴──────────┴────────┴────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

## 5. API Integration

### 새 API 함수 (lib/api.ts)
```typescript
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

### 새 훅 (hooks/useFactories.ts)
```typescript
export function useFactories() {
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  // ...
}

export function useFactoryLines(factoryCode: string | null) {
  const [lines, setLines] = useState<ProductionLine[]>([])
  // ...
}
```

## 6. File Changes

### 새 파일
- `src/pages/FactoryLinePage.tsx` - 공장/라인 선택 페이지
- `src/hooks/useFactories.ts` - 공장/라인 데이터 훅

### 수정 파일
- `src/App.tsx` - 페이지 타입 및 라우팅 로직
- `src/lib/api.ts` - API 함수 추가
- `src/pages/RegistryPage.tsx` - props 변경
- `src/pages/PipelinePage.tsx` - props 변경

## 7. Out of Scope
- 사용자 인증/권한 (추후 구현)
- 공장/라인 CRUD (관리자 기능)
- React Router DOM 마이그레이션

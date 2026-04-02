# Codebase Research Summary

## Current Frontend Architecture

### Routing
- **현재**: useState 기반 수동 라우팅 (`type Page = 'registry' | 'pipeline'`)
- **구조**: App.tsx에서 page 상태로 페이지 전환
- **문제점**: 확장성 부족, URL 기반 딥링크 불가

### Page Patterns
1. **RegistryPage** - 3열 레이아웃 (리스트 | 3D뷰어 | 패널)
2. **PipelinePage** - 단일 컬럼, 폼 기반 UI

### Data Fetching
- `useEquipment` 커스텀 훅 + React Query
- axios 인스턴스 (`/api` baseURL)
- staleTime: 5분

### UI Framework
- shadcn/ui 컴포넌트 (Button, Card, Select, Input, Badge 등)
- lucide-react 아이콘
- Tailwind CSS 스타일링
- 다크 테마 (Teal 기본색)

### Component Structure
```
components/
├── ui/              # shadcn/ui 컴포넌트
├── EquipmentList    # 사이드바 리스트
├── Scene3D          # 3D 뷰포트
├── RegPanel         # 우측 편집 패널
└── ...
```

## Recommendations

### 라우팅 전략
React Router DOM 도입 권장:
```
/                                    → FactorySelectPage
/factory/{factoryCode}               → LineSelectPage
/factory/{factoryCode}/line/{lineCode}  → RegistryPage
/factory/{factoryCode}/line/{lineCode}/upload → UploadPage
```

### 새 파일 구조
```
pages/
├── FactorySelectPage.tsx   (NEW)
├── LineSelectPage.tsx      (NEW)
├── UploadPage.tsx          (NEW)
├── RegistryPage.tsx        (수정)
└── PipelinePage.tsx

hooks/
├── useFactories.ts         (NEW)
├── useLines.ts             (NEW)
└── useEquipment.ts         (수정)
```

### 기존 패턴 재사용
- Card 기반 레이아웃
- 좌측 리스트 + 우측 상세 패턴
- useQuery 데이터 페칭
- cn() 조건부 스타일링

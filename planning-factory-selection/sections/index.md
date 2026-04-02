# Factory Selection Feature - Section Index

## SECTION_MANIFEST
```
section-01-api-layer
section-02-data-hooks
section-03-factory-line-page
section-04-app-routing
section-05-registry-update
section-06-pipeline-update
```

## Overview

공장/라인 선택 기능을 6개 섹션으로 나누어 구현합니다.

## Dependency Graph

```
[01-api-layer]
      │
      ▼
[02-data-hooks]
      │
      ▼
[03-factory-line-page]
      │
      ▼
[04-app-routing]
      │
      ├─────────────────┐
      ▼                 ▼
[05-registry-update] [06-pipeline-update]
```

## Sections

### Section 01: API Layer
- **파일**: `lib/api.ts`
- **내용**: Factory, ProductionLine 타입 및 API 함수 추가
- **의존성**: 없음

### Section 02: Data Hooks
- **파일**: `hooks/useFactories.ts`
- **내용**: useFactories, useFactoryLines 훅 생성
- **의존성**: Section 01

### Section 03: Factory Line Page
- **파일**: `pages/FactoryLinePage.tsx`
- **내용**: 공장/라인 선택 테이블 UI
- **의존성**: Section 01, 02
- **필수 작업**: `npx shadcn@latest add table`

### Section 04: App Routing
- **파일**: `App.tsx`
- **내용**: 페이지 타입 확장, 라우팅 로직, 헤더 수정
- **의존성**: Section 03

### Section 05: Registry Page Update
- **파일**: `pages/RegistryPage.tsx`
- **내용**: lineCode props, 뒤로가기, 빵부스러기
- **의존성**: Section 04

### Section 06: Pipeline Page Update
- **파일**: `pages/PipelinePage.tsx`
- **내용**: lineCode props, 완료 콜백
- **의존성**: Section 04

## Completion Checklist

- [ ] Section 01: API Layer
- [ ] Section 02: Data Hooks
- [ ] Section 03: Factory Line Page
- [ ] Section 04: App Routing
- [ ] Section 05: Registry Page Update
- [ ] Section 06: Pipeline Page Update

# Factory Selection Feature PRD

## How to Use
```bash
ralphy --prd planning-factory-selection/claude-ralphy-prd.md
# Or copy to PRD.md and run: ralphy
```

## Context
FACTOR Digital Twin 시스템에 공장/라인 선택 기능을 추가합니다.
기존 하드코딩된 siteId 대신 DB에서 공장/라인을 선택하는 플로우를 구현합니다.

## Section Files
각 섹션의 상세 내용은 다음 파일 참조:
- `planning-factory-selection/sections/section-01-api-layer.md`
- `planning-factory-selection/sections/section-02-data-hooks.md`
- `planning-factory-selection/sections/section-03-factory-line-page.md`
- `planning-factory-selection/sections/section-04-app-routing.md`
- `planning-factory-selection/sections/section-05-registry-update.md`
- `planning-factory-selection/sections/section-06-pipeline-update.md`

## Task List

- [ ] Section 01: API Layer - lib/api.ts에 Factory, ProductionLine 타입 및 API 함수 추가
- [ ] Section 02: Data Hooks - hooks/useFactories.ts 생성
- [ ] Section 03: Factory Line Page - pages/FactoryLinePage.tsx 생성 (shadcn table 설치 필요)
- [ ] Section 04: App Routing - App.tsx 페이지 타입 확장 및 라우팅 로직 수정
- [ ] Section 05: Registry Page Update - RegistryPage props 변경 (lineCode)
- [ ] Section 06: Pipeline Page Update - PipelinePage props 변경 (lineCode, onComplete)

## Dependencies
```
01 → 02 → 03 → 04 → 05
                 ↘ 06
```

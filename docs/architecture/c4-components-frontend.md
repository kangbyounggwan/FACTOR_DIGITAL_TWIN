# C4 Level 3 - Component Diagram: Frontend SPA

Frontend SPA 컨테이너의 내부 컴포넌트 구성입니다.

```mermaid
C4Component
  title Component Diagram - Frontend SPA (React)

  Container(api, "Backend API", "FastAPI", "REST API 엔드포인트")

  Container_Boundary(spa, "Frontend SPA") {
    Component(app, "App Router", "React", "페이지 라우팅: 3D / 2D / Admin")
    Component(page3d, "FactoryLinePage", "React Page", "3D 포인트 클라우드 뷰어")
    Component(page2d, "LayoutEditorPage", "React Page", "2D 레이아웃 편집기")
    Component(pageAdmin, "AdminPage", "React Page", "회사/공장/라인/설비 관리")
    Component(scene3d, "Scene3D", "React Three Fiber", "3D 씬: 설비 메쉬, 포인트 클라우드, 카메라 제어")
    Component(canvas2d, "LayoutCanvas", "SVG", "2D 캔버스: 드래그/리사이즈/멀티셀렉트/배경이미지")
    Component(regPanel, "RegPanel", "React", "설비 속성 편집 패널 (타입, 존, 위치, 크기, 역할)")
    Component(equipList, "EquipmentList", "React", "설비 목록 사이드바 (검색, 필터, 그룹)")
    Component(layoutSelector, "LayoutSelector", "React", "레이아웃 버전 선택/활성화/삭제")
    Component(multiToolbar, "MultiSelectToolbar", "React", "다중 선택 도구: 정렬, 그룹화, 플로우 연결")
    Component(apiClient, "API Client", "Axios", "HTTP 요청 및 타입 정의")
    Component(hooks, "Custom Hooks", "TanStack Query", "데이터 페칭: useEquipment, useLayouts, useCompanies 등")
    Component(colors, "Color System", "TypeScript", "설비/그룹/역할별 색상 중앙 관리")
  }

  Rel(app, page3d, "라우팅")
  Rel(app, page2d, "라우팅")
  Rel(app, pageAdmin, "라우팅")

  Rel(page3d, scene3d, "3D 렌더링")
  Rel(page3d, equipList, "설비 목록")
  Rel(page3d, regPanel, "속성 편집")

  Rel(page2d, canvas2d, "2D 렌더링")
  Rel(page2d, equipList, "설비 목록")
  Rel(page2d, regPanel, "속성 편집")
  Rel(page2d, layoutSelector, "레이아웃 선택")
  Rel(page2d, multiToolbar, "다중 선택 도구")

  Rel(scene3d, hooks, "포인트 클라우드 조회")
  Rel(canvas2d, colors, "색상 조회")
  Rel(regPanel, hooks, "설비 업데이트")
  Rel(pageAdmin, hooks, "CRUD 뮤테이션")
  Rel(hooks, apiClient, "HTTP 요청")
  Rel(apiClient, api, "API 호출", "JSON/HTTP")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

## 페이지별 구성

### 3D 뷰어 (FactoryLinePage)
```
┌───────────┬────────────┬────────────────────────────────────┐
│ Companies │ Factories  │          Scene3D (Three.js)        │
│  Sidebar  │  & Lines   │  ┌──────────┐    ┌────────────┐   │
│           │  Sidebar   │  │Equipment │    │  RegPanel  │   │
│           │            │  │  List    │    │  (우측)     │   │
│           │            │  └──────────┘    └────────────┘   │
└───────────┴────────────┴────────────────────────────────────┘
```

- 박스 모드: 설비를 3D 박스로 렌더링
- 클라우드 모드: 실제 포인트 클라우드 데이터 렌더링 (LOD 지원)
- 설비 그룹: 반투명 바운딩박스로 시각화

### 2D 레이아웃 편집기 (LayoutEditorPage)
```
┌───────────┬────────────┬────────────────────────────────────┐
│ Companies │ Factories  │       LayoutCanvas (SVG)           │
│  Sidebar  │  & Lines   │  ┌──────────┐    ┌────────────┐   │
│           │  Sidebar   │  │Equipment │    │  RegPanel  │   │
│           │            │  │  List    │    │  (우측)     │   │
│           │            │  │          │    └────────────┘   │
│           │            │  └──────────┘                      │
│           │            │  [MultiSelectToolbar]              │
│           │            │  [LayoutSelector]                  │
└───────────┴────────────┴────────────────────────────────────┘
```

- 드래그로 설비 이동, 핸들로 리사이즈
- Shift+Click / 박스 선택으로 다중 선택
- 정렬 도구: 좌측/중앙/우측 정렬, 균등 배치, 그리드
- 플로우 화살표: 설비 간 자재 흐름 표시
- 레이아웃 버전: 저장/복제/비교/활성화
- 바닥 범위 설정 + 배경 이미지 오버레이

### 관리 페이지 (AdminPage)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Companies   │  Factories   │    Lines     │  Equipment   │
│   + Layouts  │              │              │  (zone별)    │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

- 4열 계층 CRUD 인터페이스
- 캐스케이드 삭제 미리보기
- 설비 타입 동적 추가
- Zone 아코디언 그룹화

## Custom Hooks 목록

| Hook | 역할 |
|------|------|
| `useCompanies()` | 전체 회사 목록 |
| `useCompanyFactories(code)` | 회사별 공장 목록 |
| `useFactoryLines(code)` | 공장별 라인 목록 |
| `useFactoryEquipment(code)` | 공장 전체 설비 |
| `useLineEquipment(code)` | 라인별 설비 |
| `useEquipmentGroups(line, factory)` | 설비 그룹 |
| `useFlowConnections(factory)` | 플로우 화살표 |
| `useLayouts(factoryId)` | 레이아웃 목록 |
| `useActiveLayout(factoryId)` | 활성 레이아웃 |
| `useLayoutMutations()` | 레이아웃 CRUD 뮤테이션 |
| `useCompanyMutations()` | 회사 CRUD 뮤테이션 |
| `useFactoryMutations()` | 공장 CRUD 뮤테이션 |
| `useLineMutations()` | 라인 CRUD 뮤테이션 |
| `useEquipmentMutations()` | 설비 CRUD 뮤테이션 |

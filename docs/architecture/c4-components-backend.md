# C4 Level 3 - Component Diagram: Backend API

Backend API 컨테이너의 내부 컴포넌트 구성입니다.

```mermaid
C4Component
  title Component Diagram - Backend API (FastAPI)

  Container(spa, "Frontend SPA", "React", "3D/2D 시각화 및 관리 UI")
  ContainerDb(db, "PostgreSQL", "Supabase", "설비·레이아웃 데이터")
  Container(storage, "Object Storage", "Supabase Storage", "PLY 파일")

  Container_Boundary(api, "Backend API") {
    Component(companyRouter, "Companies Router", "FastAPI Router", "회사 CRUD (/api/companies)")
    Component(factoryRouter, "Factories Router", "FastAPI Router", "공장 CRUD, 라인 목록 (/api/factories)")
    Component(lineRouter, "Lines Router", "FastAPI Router", "생산라인 CRUD (/api/lines)")
    Component(equipRouter, "Equipment Router", "FastAPI Router", "설비 CRUD, 분할, 포인트 편집, 배치 업데이트 (/api/equipment)")
    Component(typeRouter, "Equipment Types Router", "FastAPI Router", "설비 타입 마스터 관리 (/api/equipment-types)")
    Component(groupRouter, "Groups Router", "FastAPI Router", "설비 그룹 생성/해제/수정 (/api/equipment-groups)")
    Component(flowRouter, "Flow Connections Router", "FastAPI Router", "설비 간 흐름 화살표 (/api/flow-connections)")
    Component(layoutRouter, "Layouts Router", "FastAPI Router", "레이아웃 버전 관리: 저장/활성화/복제/비교 (/api/layouts)")
    Component(pipelineRouter, "Pipeline Router", "FastAPI Router", "LiDAR 파이프라인 실행/상태 조회 (/api/pipeline)")
    Component(supaClient, "Supabase Client", "supabase-py", "DB 연결 싱글턴 (service_role key)")
    Component(pipelineService, "Pipeline Service", "Open3D, NumPy", "7단계 포인트 클라우드 처리")
    Component(pointcloudService, "Pointcloud Service", "Open3D", "PLY 로딩 및 LOD 다운샘플링")
  }

  Rel(spa, companyRouter, "회사 관리", "JSON/HTTP")
  Rel(spa, factoryRouter, "공장 관리", "JSON/HTTP")
  Rel(spa, lineRouter, "라인 관리", "JSON/HTTP")
  Rel(spa, equipRouter, "설비 관리", "JSON/HTTP")
  Rel(spa, typeRouter, "설비 타입 관리", "JSON/HTTP")
  Rel(spa, groupRouter, "그룹 관리", "JSON/HTTP")
  Rel(spa, flowRouter, "플로우 관리", "JSON/HTTP")
  Rel(spa, layoutRouter, "레이아웃 관리", "JSON/HTTP")
  Rel(spa, pipelineRouter, "파이프라인 실행", "JSON/HTTP")

  Rel(companyRouter, supaClient, "사용")
  Rel(factoryRouter, supaClient, "사용")
  Rel(lineRouter, supaClient, "사용")
  Rel(equipRouter, supaClient, "사용")
  Rel(equipRouter, pointcloudService, "포인트 데이터 조회")
  Rel(typeRouter, supaClient, "사용")
  Rel(groupRouter, supaClient, "사용")
  Rel(flowRouter, supaClient, "사용")
  Rel(layoutRouter, supaClient, "사용")
  Rel(pipelineRouter, pipelineService, "파이프라인 실행")
  Rel(pipelineService, supaClient, "결과 저장")
  Rel(pipelineService, storage, "PLY 업로드", "HTTPS")
  Rel(pointcloudService, storage, "PLY 다운로드", "HTTPS")
  Rel(supaClient, db, "CRUD", "HTTPS/PostgREST")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

## API 라우터 상세

| 라우터 | 주요 엔드포인트 | 설명 |
|--------|----------------|------|
| **Companies** | `GET/POST/PUT/DELETE /api/companies` | 회사 CRUD, 삭제 영향도 미리보기 |
| **Factories** | `GET/POST/PUT/DELETE /api/factories` | 공장 CRUD, 라인 목록 조회 |
| **Lines** | `GET/POST/PUT/DELETE /api/lines` | 생산라인 CRUD |
| **Equipment** | `GET/PATCH/POST/DELETE /api/equipment` | 설비 CRUD, 분할(split), 포인트 편집, 배치 업데이트 |
| **Equipment Types** | `GET/POST /api/equipment-types` | 설비 타입 마스터 데이터 관리 |
| **Groups** | `GET/POST/DELETE /api/equipment-groups` | 설비 그룹(BRIDGE/CLUSTER/FLOW) 생성·해제 |
| **Flow Connections** | `GET/POST/DELETE /api/flow-connections` | 설비 간 흐름 화살표 관리 |
| **Layouts** | `GET/POST/PUT/PATCH/DELETE /api/layouts` | 레이아웃 버전: 저장, 활성화, 복제, 비교 |
| **Pipeline** | `POST/GET /api/pipeline` | LiDAR 파이프라인 실행 및 진행률 폴링 |

## 서비스 컴포넌트

### Pipeline Service
```
pipeline.py (7-step orchestrator)
├── loaders.py      → E57/LAS/PLY 파일 로딩
├── filters.py      → 복셀 다운샘플링, 통계적 노이즈 제거
├── normalize.py    → 좌표 정규화 (원점 중심)
├── segment.py      → RANSAC 바닥 분리, DBSCAN 클러스터링
├── tagger.py       → 메타데이터 자동 생성 (ID, 바운딩박스)
├── exporter.py     → JSON 변환
└── upload_to_supabase.py → DB 삽입 + PLY 스토리지 업로드
```

### Pointcloud Service
- PLY 파일을 Supabase Storage에서 다운로드
- LOD(Level of Detail) 지원: high / medium / low
- 다운샘플링 후 [x, y, z, r, g, b] 배열로 반환

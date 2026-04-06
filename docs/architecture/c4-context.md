# C4 Level 1 - System Context Diagram

Factory Digital Twin 시스템의 최상위 컨텍스트 다이어그램입니다.

```mermaid
C4Context
  title System Context - Factory Digital Twin (v0.2.3)

  Person(operator, "공장 관리자", "설비 배치 및 레이아웃 관리를 수행하는 사용자")
  Person(scanner, "스캔 담당자", "LiDAR로 공장 현장을 스캔하여 포인트 클라우드 생성")

  System(fdt, "Factory Digital Twin", "공장 설비의 3D 포인트 클라우드 스캔 데이터를 기반으로 디지털 트윈을 구축하고, 2D/3D 레이아웃 편집 및 버전 관리를 제공하는 웹 애플리케이션")

  System_Ext(supabase, "Supabase", "PostgreSQL 데이터베이스, REST API, 파일 스토리지 (PLY 포인트 클라우드) 제공")
  System_Ext(lidar, "LiDAR 스캐너", "공장 현장의 3D 포인트 클라우드 데이터를 E57/LAS/PLY 형식으로 생성")

  Rel(scanner, lidar, "스캔 수행")
  Rel(scanner, fdt, "스캔 파일 업로드 및 파이프라인 실행", "Web Browser")
  Rel(operator, fdt, "설비 등록, 레이아웃 편집, 관리 작업 수행", "Web Browser")
  Rel(fdt, supabase, "설비 메타데이터 CRUD, PLY 파일 저장/조회", "HTTPS/REST")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## 설명

| 요소 | 역할 |
|------|------|
| **공장 관리자** | 3D/2D 뷰어에서 설비 확인, 타입 지정, 레이아웃 편집, 그룹/플로우 관리 |
| **스캔 담당자** | LiDAR 장비로 공장을 스캔하고, 결과 파일을 시스템에 업로드 |
| **Factory Digital Twin** | 포인트 클라우드 처리 파이프라인 + 3D/2D 시각화 + 관리 기능 통합 시스템 |
| **Supabase** | 클라우드 호스팅 PostgreSQL + REST API + Object Storage (PLY 파일) |
| **LiDAR 스캐너** | Trimble, Leica 등 3D 스캔 장비 (E57/LAS/PLY 출력) |

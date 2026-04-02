# Factory Selection & Layout Registration Flow

## System Architecture

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
      │  • equipments (설비 마스터)                   │
      │  • equipment_scans (3D 스캔 데이터)          │
      │  • factories/production_lines (공장/라인)    │
      │  • production_data (생산 데이터)             │
      │  • alert_logs (알림 이력)                    │
      └─────────────────────────────────────────────┘
```

## Critical Constraint: Shared Database
- **factor-MES 프로젝트와 DB 공유**: 기존 MES 스키마 유지 필수
- 테이블 구조 변경 시 MES 영향도 검토 필요
- equipment_scans 테이블은 Digital Twin 전용 (MES에서 읽기만 함)
- factories, production_lines, equipments는 MES와 공유

## Overview
FACTOR Digital Twin 시스템에 공장 선택 및 레이아웃 등록 플로우를 추가합니다.

## Current State
- Backend: 공장/라인 API 완성 (`/api/factories`, `/api/factories/{code}/lines`)
- Database: companies, factories, production_lines, equipment_scans 테이블 존재
- Frontend: 현재 하드코딩된 site_id (JM_PCB_001) 사용 중

## Required Flow

### 1. Factory Selection Page (`/`)
- DB에 등록된 공장 목록 표시
- 공장 카드 클릭 시 해당 공장의 라인 목록으로 이동
- 권한 기반 필터링 (추후)

### 2. Line Selection Page (`/factory/{factoryCode}`)
- 선택한 공장의 생산라인 목록 표시
- 각 라인의 설비 스캔 현황 표시 (n개 설비)
- 라인 선택 시 3D 뷰어 페이지로 이동
- "새 스캔 업로드" 버튼

### 3. 3D Viewer/Registry Page (`/factory/{factoryCode}/line/{lineCode}`)
- 기존 RegistryPage 활용
- URL에서 factoryCode, lineCode 파라미터 사용
- 해당 라인의 설비 스캔 데이터 로드

### 4. Scan Upload Page (`/factory/{factoryCode}/line/{lineCode}/upload`)
- PLY 파일 드래그&드롭 업로드
- 업로드 진행 상태 표시
- 업로드 완료 후 자동 설비 분리 파이프라인 실행
- 처리 완료 시 3D 뷰어로 리다이렉트

## Technical Requirements
- React Router DOM for routing
- 기존 컴포넌트 재사용 (EquipmentList, Scene3D, RegPanel 등)
- shadcn/ui 컴포넌트 스타일 일관성 유지
- API 호출: /api/factories, /api/factories/{code}/lines

## UI/UX Guidelines
- 다크 테마 유지
- 공장 카드: 공장명, 주소, 라인 수 표시
- 라인 카드: 라인명, 설명, 설비 수 표시
- 빵부스러기(Breadcrumb) 네비게이션

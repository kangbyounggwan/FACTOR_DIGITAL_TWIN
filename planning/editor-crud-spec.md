# FACTOR Digital Twin - 에디터 CRUD 및 레이아웃 버전 관리 기능

## 개요
FACTOR Digital Twin 시스템에 완전한 에디터 기능을 추가하여 회사, 공장, 라인, 설비의 CRUD 작업과 레이아웃 버전 관리를 구현한다.

## 현재 상태
- 기존 시스템: 3D LiDAR 뷰어, 2D 레이아웃 뷰어
- 설비 위치/크기 수정 기능 (로컬 변경, 저장 미구현)
- 회사 → 공장 → 라인 계층 구조 조회 기능
- Supabase 백엔드 (companies, factories, production_lines, equipment_scans 테이블)

## 요구사항

### 1. CRUD 기능

#### 1.1 회사 관리
- 회사 추가: 이름, 코드, 설명
- 회사 수정: 이름, 설명 변경
- 회사 삭제: 하위 공장/라인/설비 연쇄 삭제 또는 방지

#### 1.2 공장 관리
- 공장 추가: 회사 소속, 이름, 코드, 위치 정보
- 공장 수정
- 공장 삭제

#### 1.3 라인 관리
- 라인 추가: 공장 소속, 이름, 코드
- 라인 수정
- 라인 삭제

#### 1.4 설비 관리
- 설비 추가: 라인 소속, 설비 타입, 위치(x,y,z), 크기(w,h,d)
- 설비 수정: 타입, 위치, 크기, 구역, 메모
- 설비 삭제
- 설비 복제

### 2. 레이아웃 버전 관리

#### 2.1 레이아웃 저장
- 현재 레이아웃을 스냅샷으로 저장
- 레이아웃 이름, 설명, 생성일시
- 설비 위치/크기 정보 포함

#### 2.2 레이아웃 불러오기
- 저장된 레이아웃 목록 조회
- 특정 레이아웃 선택하여 로드
- 활성 레이아웃 설정 (뷰어에 표시되는 레이아웃)

#### 2.3 레이아웃 관리
- 레이아웃 이름/설명 수정
- 레이아웃 삭제
- 레이아웃 복제

### 3. UI 요구사항

#### 3.1 관리자 패널
- 회사/공장/라인 추가/수정/삭제 UI
- 트리 구조 또는 탭 기반 네비게이션

#### 3.2 설비 에디터
- 2D 캔버스에서 설비 추가 (클릭하여 위치 지정)
- 속성 패널에서 상세 정보 수정
- 드래그 앤 드롭으로 위치 이동
- 리사이즈 핸들로 크기 조정

#### 3.3 레이아웃 관리 UI
- 레이아웃 목록 사이드바 또는 드롭다운
- 저장/불러오기/활성화 버튼
- 현재 활성 레이아웃 표시

### 4. 데이터베이스 스키마 변경

#### 4.1 layouts 테이블 (신규)
- id, factory_id, name, description, is_active, created_at, updated_at

#### 4.2 layout_equipment 테이블 (신규)
- id, layout_id, equipment_id, centroid_x, centroid_y, centroid_z, size_w, size_h, size_d

### 5. API 엔드포인트

#### 5.1 회사 API
- POST /api/companies
- PUT /api/companies/{id}
- DELETE /api/companies/{id}

#### 5.2 공장 API
- POST /api/factories
- PUT /api/factories/{id}
- DELETE /api/factories/{id}

#### 5.3 라인 API
- POST /api/lines
- PUT /api/lines/{id}
- DELETE /api/lines/{id}

#### 5.4 설비 API
- POST /api/equipment
- DELETE /api/equipment/{id}

#### 5.5 레이아웃 API
- GET /api/factories/{factory_id}/layouts
- POST /api/factories/{factory_id}/layouts
- PUT /api/layouts/{id}
- DELETE /api/layouts/{id}
- POST /api/layouts/{id}/activate

## 기술 스택
- Frontend: React, TypeScript, TailwindCSS, shadcn/ui
- Backend: FastAPI, Python
- Database: Supabase (PostgreSQL)
- 3D: Three.js

## 우선순위
1. 레이아웃 버전 관리 (핵심 기능)
2. 설비 CRUD
3. 라인 CRUD
4. 공장 CRUD
5. 회사 CRUD

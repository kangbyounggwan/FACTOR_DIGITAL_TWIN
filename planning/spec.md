# FACTOR Digital Twin - 설비 등록 시스템 Spec

## 프로젝트 개요

제조 현장의 LiDAR 스캔 데이터를 기반으로 설비를 자동 인식하고 등록하는 디지털 트윈 관리 시스템.
향후 `anomaly-eye-monitor` (실시간 모니터링 시스템)와 통합 예정.

## 현재 구현 상태

### Frontend (React + Vite + TypeScript)
- **설비 등록 페이지**: 3D 뷰어로 설비 시각화, 선택, 메타데이터 편집
- **파이프라인 페이지**: LiDAR 스캔 파일 업로드 및 처리 실행
- **UI**: shadcn/ui (Radix) 기반 컴포넌트

### Backend (FastAPI + Python)
- **파이프라인 처리**: E57/LAS/PLY 파일 로드 → 다운샘플링 → 노이즈 제거 → 바닥 분리 → 설비 클러스터링
- **API**: 설비 CRUD, 파이프라인 실행/상태 조회
- **DB**: Supabase (PostgreSQL + Storage)

## 핵심 워크플로우

```
LiDAR 스캔 파일 업로드
        ↓
자동 처리 (파이프라인)
  - 포인트클라우드 전처리
  - RANSAC 바닥면 분리
  - DBSCAN 설비 클러스터링
        ↓
설비 등록 (Web)
  - 3D 뷰에서 설비 확인/선택
  - 타입, 구역, 메모 입력
  - 검수 완료 처리
        ↓
DB 저장 (Supabase)
```

## 데이터 모델

### equipment_scans 테이블
| 필드 | 타입 | 설명 |
|------|------|------|
| id | serial | PK |
| equipment_id | text | 설비 고유 ID (예: JM_PCB_001_EQ_0001) |
| site_id | text | 현장 ID |
| equipment_type | text | SMT_LINE, REFLOW_OVEN, AOI_MACHINE 등 |
| zone | text | 구역/라인 |
| scan_date | date | 스캔 일자 |
| centroid_x/y/z | float | 무게중심 좌표 (m) |
| size_w/d/h | float | 바운딩박스 크기 (m) |
| point_count | int | 포인트 수 |
| ply_url | text | Storage URL |
| verified | boolean | 검수 완료 여부 |
| note | text | 메모 |

## 기술 스택

### Frontend
- React 18 + TypeScript
- Vite 5
- @react-three/fiber + drei (3D)
- shadcn/ui (Radix primitives)
- TailwindCSS
- Zustand (상태관리)
- Axios

### Backend
- FastAPI
- Open3D (포인트클라우드 처리)
- pye57, laspy (파일 로더)
- Supabase Python SDK

### 인프라
- Supabase (DB + Storage)
- 향후: Docker 컨테이너화

## 향후 개선 사항

### Phase 1: 기본 기능 완성
- [ ] 실제 Supabase 연동 테스트
- [ ] 파이프라인 비동기 처리 (Background Tasks)
- [ ] 에러 핸들링 강화

### Phase 2: UX 개선
- [ ] 파이프라인 진행률 실시간 표시
- [ ] 포인트클라우드 직접 렌더링 (현재는 박스만)
- [ ] 설비 병합/분할 기능
- [ ] Undo/Redo

### Phase 3: anomaly-eye-monitor 통합
- [ ] 공통 컴포넌트 라이브러리 추출
- [ ] 설비 데이터 연동
- [ ] 실시간 모니터링 뷰에서 등록된 설비 표시

## 연관 프로젝트

- `anomaly-eye-monitor`: 실시간 공장 모니터링 대시보드 (동일 라이브러리 스택)

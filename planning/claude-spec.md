# Layout Save/Load Bug Fix - Synthesized Specification

Generated: 2026-04-01

---

## 1. Problem Statement

### 1.1 핵심 버그

**현상**: 2D 레이아웃 에디터에서 레이아웃 선택 시 저장된 설비 위치가 캔버스에 적용되지 않음

**재현 단계**:
1. 설비 위치를 변경하고 레이아웃 저장
2. 페이지 새로고침 또는 다른 레이아웃 선택 후 원래 레이아웃 다시 선택
3. **결과**: 위치가 원래 equipment_scans 값으로 표시됨

### 1.2 기대 동작

- 레이아웃 선택 시 해당 레이아웃의 설비 위치가 캔버스에 즉시 반영
- 저장 시 equipment_scans와 layout_equipment 모두 업데이트
- 새로고침 시 초기 상태(equipment_scans 위치)로 리셋

---

## 2. Technical Analysis

### 2.1 Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  equipment_scans │     │     layouts     │     │ layout_equipment│
│   (원본 위치)    │     │  (메타데이터)   │     │  (스냅샷 위치)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend State                           │
│  filteredEquipment ─── merge ──▶ equipmentWithLocalPositions    │
│         (base)        localPositions/Sizes       (rendered)     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 ID Mapping

| 컴포넌트 | 필드명 | 실제 값 | 타입 |
|---------|--------|--------|-----|
| equipment_scans | id | UUID | UUID |
| equipment_scans | scan_code | "EQ_0001" | VARCHAR |
| layout_equipment | equipment_id | UUID (FK) | UUID |
| Frontend Equipment | equipment_id | scan_code | string |

### 2.3 검증된 정상 로직

1. **Save**: scan_code → UUID 변환 후 DB 저장 ✓
2. **Load**: UUID → scan_code 변환 후 반환 ✓
3. **State Merge**: localPositions[scan_code]로 병합 ✓

### 2.4 의심 원인

코드 분석상 로직은 정상이나, 실제 동작하지 않는 원인:

1. **API 응답 검증 필요**: fetchLayout 반환값 확인
2. **상태 업데이트 검증**: localPositions 설정 후 실제 값 확인
3. **리렌더링 검증**: equipmentWithLocalPositions 갱신 확인
4. **비동기 타이밍**: handleLayoutSelect의 async 처리 확인

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | 레이아웃 선택 시 설비 위치 즉시 적용 | Critical |
| FR-02 | 저장 시 equipment_scans + layout_equipment 모두 업데이트 | High |
| FR-03 | 새로고침 시 equipment_scans 위치로 리셋 | Medium |
| FR-04 | 콘솔에 디버그 로그 추가 (개발용) | Low |

### 3.2 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-01 | 레이아웃 로드 시 500ms 이내 UI 반영 |
| NFR-02 | API 오류 시 사용자에게 토스트 알림 |

---

## 4. Acceptance Criteria

### AC-01: 레이아웃 선택 시 위치 적용

**Given**: 설비가 (10, 20) 위치로 저장된 레이아웃이 존재
**When**: 사용자가 해당 레이아웃을 셀렉터에서 선택
**Then**: 설비가 캔버스에서 (10, 20) 위치에 표시됨

### AC-02: 저장 후 재선택

**Given**: 설비를 (30, 40) 위치로 이동 후 레이아웃 저장
**When**: 다른 레이아웃 선택 후 원래 레이아웃 다시 선택
**Then**: 설비가 (30, 40) 위치에 표시됨

### AC-03: 새로고침 동작

**Given**: 레이아웃이 선택된 상태
**When**: 페이지 새로고침
**Then**: equipment_scans의 원본 위치로 표시됨 (레이아웃 선택 해제)

---

## 5. Files to Modify

### Backend
- `backend/app/api/layouts.py` - 응답 데이터 검증/수정

### Frontend
- `frontend/src/pages/LayoutEditorPage.tsx` - handleLayoutSelect 디버깅/수정
- `frontend/src/hooks/useLayouts.ts` - fetchLayout 훅 검증
- `frontend/src/lib/api.ts` - API 호출 검증

---

## 6. Test Plan

### 6.1 단위 테스트

1. Backend: get_layout 엔드포인트가 scan_code 반환 확인
2. Frontend: handleLayoutSelect 호출 후 localPositions 검증

### 6.2 통합 테스트

1. 레이아웃 저장 → 새로고침 → 레이아웃 선택 → 위치 확인
2. 레이아웃 A 선택 → 레이아웃 B 선택 → 레이아웃 A 재선택 → 위치 확인

### 6.3 수동 검증

1. 브라우저 DevTools Network 탭에서 API 응답 확인
2. React DevTools에서 localPositions 상태 확인

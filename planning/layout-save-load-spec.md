# Layout Save/Load Bug Fix Specification

## Problem Statement

레이아웃 저장/로드 기능에 버그가 있습니다. 2D 레이아웃 에디터에서:

1. 설비 위치를 변경하고 레이아웃을 저장
2. 페이지를 새로고침하거나 레이아웃을 다시 선택
3. **문제**: 저장된 위치/크기가 로드되지 않고 원래 위치로 리셋됨

## Current Architecture

### Backend (FastAPI + Supabase)
- `equipment_scans` 테이블: 설비 원본 데이터 (scan_code, centroid_x/y/z, size_w/h/d)
- `layouts` 테이블: 레이아웃 메타데이터 (factory_id, name, is_active)
- `layout_equipment` 테이블: 레이아웃별 설비 위치 스냅샷 (equipment_id=UUID, centroid_x/y/z, size_w/h/d)

### Frontend (React + TypeScript)
- `LayoutEditorPage.tsx`: 2D 에디터 메인 페이지
- `LayoutCanvas.tsx`: SVG 기반 캔버스 컴포넌트
- `useLayouts.ts`: 레이아웃 관련 훅
- `api.ts`: API 호출 함수

### Data Flow (Current)
1. **Load Equipment**: `useFactoryEquipment` → `equipment_scans` 테이블에서 로드
2. **Local Edits**: `localPositions`, `localSizes` state에 변경사항 저장
3. **Save Layout**: `saveLayoutFromViewer` → `layout_equipment`에 저장
4. **Load Layout**: `handleLayoutSelect` → `fetchLayout` → 위치 적용 시도

## Known Issues

1. **UUID vs scan_code 불일치**:
   - Frontend는 `scan_code` (EQ_0001) 사용
   - Backend `layout_equipment.equipment_id`는 UUID 저장
   - 로드 시 UUID→scan_code 변환 필요

2. **위치 적용 로직 미완성**:
   - `handleLayoutSelect`에서 레이아웃 로드 후 `localPositions` 설정
   - 하지만 실제로 적용되지 않는 것으로 보임

3. **저장 데이터 검증 필요**:
   - 실제로 DB에 올바른 값이 저장되는지 확인 필요

## Expected Behavior

1. 레이아웃 저장 시: 현재 설비 위치/크기가 `layout_equipment`에 저장
2. 레이아웃 선택 시: 해당 레이아웃의 위치/크기가 캔버스에 반영
3. 활성 레이아웃: 페이지 로드 시 자동으로 활성 레이아웃 적용

## Files to Analyze

- `backend/app/api/layouts.py`
- `backend/app/schemas/layout.py`
- `frontend/src/pages/LayoutEditorPage.tsx`
- `frontend/src/hooks/useLayouts.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/components/LayoutCanvas.tsx`

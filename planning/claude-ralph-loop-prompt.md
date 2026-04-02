# Claude Ralph Loop Prompt: Layout Save/Load Bug Fix

## Mission Statement

Autonomously implement the Layout Save/Load bug fix for the FACTOR Digital Twin project. Execute all sections in dependency order, verify each section's acceptance criteria before proceeding, and signal completion when all sections are done.

**Core Bug:** When a user selects a saved layout from the dropdown, the stored equipment positions are NOT applied to the canvas. Equipment remains at default positions instead of layout-specific positions.

**Goal:** Fix this bug through systematic debugging (Sections 1-2) and implementation (Section 3), then verify with testing (Section 4).

---

## Section Index

<!-- SECTION_MANIFEST
section-01-backend-debug
section-02-frontend-debug
section-03-bug-fix
section-04-testing
END_MANIFEST -->

# Implementation Sections Index

Layout Save/Load Bug Fix

Generated: 2026-04-01

---

## Dependency Graph

| Section | Depends On | Blocks | Priority |
|---------|------------|--------|----------|
| section-01-backend-debug | - | 03 | Critical |
| section-02-frontend-debug | - | 03 | Critical |
| section-03-bug-fix | 01, 02 | 04 | Critical |
| section-04-testing | 03 | - | High |

---

## Execution Order

```
01-backend-debug  ──┐
                    ├──▶ 03-bug-fix ──▶ 04-testing
02-frontend-debug ──┘
```

**Section 1, 2는 병렬 실행 가능**

---

## Section Summaries

### Section 1: Backend API Debug

Backend `/layouts/{layout_id}` 엔드포인트 검증:
- UUID → scan_code 변환 확인
- 응답 데이터 로깅 추가
- 테스트 엔드포인트 생성

**파일**: `backend/app/api/layouts.py`

### Section 2: Frontend State Debug

Frontend `handleLayoutSelect` 함수 디버깅:
- 상태 변경 로깅 추가
- localPositions/localSizes 추적
- equipmentWithLocalPositions 갱신 확인

**파일**: `frontend/src/pages/LayoutEditorPage.tsx`

### Section 3: Bug Fix

디버깅 결과 기반 버그 수정:
- 가설 A: API 응답 형식 수정
- 가설 B: 상태 업데이트 강제
- 가설 C: 키 매칭 로직 수정
- 가설 D: 비동기 타이밍 수정

**파일**: 원인에 따라 결정

### Section 4: Testing

수정 검증:
- 수동 테스트 시나리오 실행
- Network 탭 API 응답 확인
- React DevTools 상태 확인

**파일**: 없음 (수동 검증)

---

## Acceptance Criteria (전체)

- [ ] 레이아웃 선택 시 캔버스에 위치 즉시 반영
- [ ] 저장 후 재선택 시 위치 유지
- [ ] 새로고침 시 초기 상태로 리셋
- [ ] 콘솔에 오류 없음

---

# Section 01: Backend API Debug

**Status**: Not Started
**Priority**: Critical
**Estimated Time**: 1-2 hours

---

## Background

레이아웃 저장/로드 버그를 진단하기 위해 Backend `GET /layouts/{layout_id}` 엔드포인트의 동작을 검증해야 합니다.

**핵심 문제**: 레이아웃 선택 시 저장된 설비 위치가 캔버스에 적용되지 않음

Backend에서 데이터가 올바르게 변환되어 반환되는지 확인하는 것이 디버깅의 첫 번째 단계입니다. 특히 UUID와 scan_code 간의 변환이 정확히 이루어지는지 검증해야 합니다.

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| Requires | - | 없음 (첫 번째 섹션) |
| Blocks | section-03-bug-fix | 디버깅 결과가 버그 수정에 필요 |

**Note**: Section 1과 Section 2는 병렬 실행 가능

---

## Requirements

이 섹션 완료 시 다음이 충족되어야 합니다:

1. `GET /layouts/{layout_id}` API 응답이 올바른 형식인지 확인 가능
2. UUID → scan_code 변환 과정이 로그로 추적 가능
3. 디버그 엔드포인트를 통해 raw 데이터와 변환된 데이터 비교 가능

---

## Implementation Details

### 1. 대상 파일

```
backend/app/api/layouts.py
```

### 2. 현재 `get_layout` 함수 분석

현재 `get_layout` 함수 (라인 316-366)의 데이터 흐름:

```
1. layouts 테이블에서 layout 조회
2. layout_equipment 테이블에서 equipment positions 조회
3. equipment_scans 테이블에서 UUID → scan_code 매핑 조회
4. equipment_id를 scan_code로 교체하여 응답
```

**핵심 변환 로직** (라인 341-366):
```python
# Convert UUIDs back to scan_codes for frontend
equipment_out = []
if eq_resp.data:
    # Get all equipment UUIDs
    eq_uuids = [eq["equipment_id"] for eq in eq_resp.data]
    # Look up scan_codes
    scan_lookup_resp = (
        db.table("equipment_scans")
        .select("id, scan_code")
        .in_("id", eq_uuids)
        .execute()
    )
    uuid_to_scan = {e["id"]: e["scan_code"] for e in scan_lookup_resp.data}

    for eq in eq_resp.data:
        scan_code = uuid_to_scan.get(eq["equipment_id"])
        if scan_code:
            equipment_out.append({
                **eq,
                "equipment_id": scan_code,  # Replace UUID with scan_code
            })
```

### 3. 작업 항목

#### 3.1 로깅 추가

`get_layout` 함수에 상세 로깅을 추가하여 데이터 변환 과정을 추적합니다.

**추가할 로깅 포인트**:

```python
import logging

logger = logging.getLogger(__name__)

@router.get("/{layout_id}", response_model=LayoutDetailOut)
def get_layout(
    layout_id: UUID,
    db: Client = Depends(get_supabase),
):
    """Get layout details with all equipment positions."""
    logger.info(f"[get_layout] Fetching layout: {layout_id}")

    layout_resp = (
        db.table("layouts")
        .select("*")
        .eq("id", str(layout_id))
        .single()
        .execute()
    )

    if not layout_resp.data:
        logger.warning(f"[get_layout] Layout not found: {layout_id}")
        raise HTTPException(status_code=404, detail="Layout not found")

    logger.info(f"[get_layout] Layout found: {layout_resp.data.get('name')}")

    # Get equipment positions
    eq_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", str(layout_id))
        .execute()
    )

    logger.info(f"[get_layout] Raw equipment count: {len(eq_resp.data)}")

    # Log first few equipment items for debugging
    for i, eq in enumerate(eq_resp.data[:3]):
        logger.debug(f"[get_layout] Raw eq[{i}]: equipment_id={eq['equipment_id']}, "
                     f"centroid_x={eq.get('centroid_x')}, centroid_y={eq.get('centroid_y')}")

    # Convert UUIDs back to scan_codes for frontend
    equipment_out = []
    if eq_resp.data:
        eq_uuids = [eq["equipment_id"] for eq in eq_resp.data]
        logger.debug(f"[get_layout] Looking up scan_codes for {len(eq_uuids)} UUIDs")

        scan_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("id", eq_uuids)
            .execute()
        )

        logger.info(f"[get_layout] Found {len(scan_lookup_resp.data)} scan_code mappings")
        uuid_to_scan = {e["id"]: e["scan_code"] for e in scan_lookup_resp.data}

        for eq in eq_resp.data:
            scan_code = uuid_to_scan.get(eq["equipment_id"])
            if scan_code:
                equipment_out.append({
                    **eq,
                    "equipment_id": scan_code,
                })
            else:
                logger.warning(f"[get_layout] No scan_code found for UUID: {eq['equipment_id']}")

    logger.info(f"[get_layout] Final equipment_out count: {len(equipment_out)}")

    # Log sample of converted data
    for i, eq in enumerate(equipment_out[:3]):
        logger.debug(f"[get_layout] Converted eq[{i}]: equipment_id={eq['equipment_id']}, "
                     f"centroid_x={eq.get('centroid_x')}, centroid_y={eq.get('centroid_y')}")

    return {
        **layout_resp.data,
        "equipment": equipment_out,
    }
```

#### 3.2 디버그 엔드포인트 추가 (선택사항)

raw 데이터와 변환된 데이터를 비교할 수 있는 디버그 엔드포인트를 추가합니다.

**위치**: `get_layout` 함수 바로 위 (static paths section에 추가)

```python
@router.get("/{layout_id}/debug")
def debug_layout(
    layout_id: UUID,
    db: Client = Depends(get_supabase),
):
    """
    Debug endpoint to inspect raw layout data and UUID conversion.
    Returns both raw data and converted data for comparison.

    WARNING: This endpoint is for debugging only. Remove in production.
    """
    # Get layout
    layout_resp = (
        db.table("layouts")
        .select("*")
        .eq("id", str(layout_id))
        .single()
        .execute()
    )

    if not layout_resp.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Get raw equipment data
    eq_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", str(layout_id))
        .execute()
    )

    raw_equipment = eq_resp.data

    # Get UUID to scan_code mapping
    uuid_to_scan = {}
    scan_to_uuid = {}
    if raw_equipment:
        eq_uuids = [eq["equipment_id"] for eq in raw_equipment]
        scan_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("id", eq_uuids)
            .execute()
        )
        uuid_to_scan = {e["id"]: e["scan_code"] for e in scan_lookup_resp.data}
        scan_to_uuid = {e["scan_code"]: e["id"] for e in scan_lookup_resp.data}

    # Build converted equipment
    converted_equipment = []
    missing_mappings = []
    for eq in raw_equipment:
        scan_code = uuid_to_scan.get(eq["equipment_id"])
        if scan_code:
            converted_equipment.append({
                **eq,
                "equipment_id": scan_code,
                "_original_uuid": eq["equipment_id"],
            })
        else:
            missing_mappings.append(eq["equipment_id"])

    return {
        "layout_id": str(layout_id),
        "layout_name": layout_resp.data.get("name"),
        "raw_equipment_count": len(raw_equipment),
        "converted_equipment_count": len(converted_equipment),
        "missing_mappings_count": len(missing_mappings),
        "missing_mappings": missing_mappings,
        "uuid_to_scan_map": uuid_to_scan,
        "raw_equipment": raw_equipment,
        "converted_equipment": converted_equipment,
        "sample_comparison": [
            {
                "raw": raw_equipment[i] if i < len(raw_equipment) else None,
                "converted": converted_equipment[i] if i < len(converted_equipment) else None,
            }
            for i in range(min(3, len(raw_equipment)))
        ],
    }
```

### 4. 검증 항목

API 응답 검증 시 확인해야 할 사항:

| 항목 | 기대값 | 확인 방법 |
|-----|-------|---------|
| `equipment[].equipment_id` | scan_code 형식 (예: `EQ-001`) | UUID 형식이 아닌지 확인 |
| `equipment[].centroid_x` | 숫자 (float) | null이 아니고 합리적인 범위인지 |
| `equipment[].centroid_y` | 숫자 (float) | null이 아니고 합리적인 범위인지 |
| `equipment[].size_w` | 숫자 (float) | 양수인지 확인 |
| `equipment[].size_d` | 숫자 (float) | 양수인지 확인 |
| `equipment` 배열 길이 | > 0 | 저장된 데이터가 있는 레이아웃 선택 시 |

### 5. 테스트 방법

#### 5.1 서버 로그 확인

```bash
# Backend 서버 실행 (로그 레벨 DEBUG)
cd backend
LOG_LEVEL=DEBUG uvicorn app.main:app --reload
```

#### 5.2 API 직접 호출

```bash
# 특정 레이아웃 조회
curl http://localhost:8000/api/v1/layouts/{layout_id}

# 디버그 엔드포인트 (추가한 경우)
curl http://localhost:8000/api/v1/layouts/{layout_id}/debug
```

#### 5.3 확인 사항

1. **equipment 배열이 비어있는 경우**:
   - `layout_equipment` 테이블에 데이터가 있는지 확인
   - `equipment_scans` 테이블에 매핑이 있는지 확인

2. **equipment_id가 UUID 형식인 경우**:
   - 변환 로직이 실행되지 않았음
   - `scan_lookup_resp`가 비어있을 수 있음

3. **위치 값이 이상한 경우**:
   - 저장 시 값이 올바르게 저장되었는지 확인
   - `centroid_x`, `centroid_y` 필드명 일치 확인

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/app/api/layouts.py` | Modify | 로깅 추가 및 디버그 엔드포인트 추가 |

---

## Acceptance Criteria

- [ ] `get_layout` 함수에 로깅 추가 완료
- [ ] 서버 로그에서 UUID → scan_code 변환 과정 확인 가능
- [ ] API 응답의 `equipment[].equipment_id`가 scan_code 형식인지 확인
- [ ] API 응답의 `equipment[].centroid_x`, `centroid_y` 값이 올바른지 확인
- [ ] (선택) 디버그 엔드포인트 `/layouts/{layout_id}/debug` 추가 완료
- [ ] 디버깅 결과를 Section 3 (Bug Fix)에 전달할 준비 완료

---

## Debugging Checklist

디버깅 중 발견할 수 있는 문제와 다음 단계:

### 문제 A: `equipment` 배열이 비어있음
- **원인**: `layout_equipment` 테이블에 데이터 없음
- **다음 단계**: 저장 로직 (POST, PUT) 확인 필요

### 문제 B: `equipment_id`가 여전히 UUID 형식
- **원인**: `equipment_scans` 테이블에서 매핑을 찾지 못함
- **다음 단계**: 저장 시 사용된 scan_code가 테이블에 존재하는지 확인

### 문제 C: 위치 값이 0 또는 null
- **원인**: 저장 시 위치 값이 누락됨
- **다음 단계**: 저장 API 요청 데이터 확인

### 문제 D: API 응답은 정상
- **원인**: Backend는 정상, Frontend 문제
- **다음 단계**: Section 2 (Frontend Debug) 진행

---

## Notes

- 디버그 엔드포인트는 개발 완료 후 제거하거나 환경 변수로 비활성화할 것
- 로깅은 INFO 레벨은 유지, DEBUG 레벨은 필요시에만 활성화
- 이 섹션의 결과물은 Section 3에서 버그 원인을 판단하는 데 사용됨

---

# Section 02: Frontend State Debug

**Status**: Not Started
**Priority**: Critical
**Estimated Time**: 1-2 hours

---

## Background

### Why This Section Exists

The layout save/load feature has a bug where selecting a saved layout does not apply the stored equipment positions to the canvas. When a user selects a layout from the dropdown, the `handleLayoutSelect` function is called, which fetches layout data from the backend API and should update the local state (`localPositions`, `localSizes`) to reflect the saved positions.

However, despite the API returning valid data, the canvas does not update to show the saved positions. This section focuses on adding comprehensive debug logging to trace the state flow and identify exactly where the state update fails.

### Current State

The `handleLayoutSelect` function in `LayoutEditorPage.tsx` (lines 199-238):
1. Calls `setSelectedLayoutId(layoutId)` to store the selected layout
2. Calls `fetchLayout(layoutId)` to get layout details from backend
3. Iterates over `layoutDetail.equipment` and builds `newPositions` and `newSizes` objects
4. Calls `setLocalPositions(newPositions)` and `setLocalSizes(newSizes)`

The state flow continues:
- `localPositions` and `localSizes` are used in `equipmentWithLocalPositions` (useMemo, lines 58-71)
- `equipmentWithLocalPositions` is passed to `LayoutCanvas` component (line 428)

The bug could be in any of these steps.

---

## Dependencies

### Requires
- None (can run in parallel with Section 01)

### Blocks
- **Section 03: Bug Fix** - Cannot proceed without identifying root cause

---

## Requirements

When this section is complete:
1. Console logs show complete execution flow of `handleLayoutSelect`
2. Console logs show values before and after each state change
3. Console logs show when `equipmentWithLocalPositions` is recalculated
4. Root cause of the bug can be identified from logs

---

## Implementation Details

### Target File

**Full Path**: `c:/Users/USER/factor-digital-twin/factor-digital-twin/frontend/src/pages/LayoutEditorPage.tsx`

### Task 1: Add Debug Logging to handleLayoutSelect

Modify the `handleLayoutSelect` function (lines 199-238) to add comprehensive logging:

**Current Code** (lines 199-238):
```typescript
const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
  setSelectedLayoutId(layoutId)

  if (!layoutId) {
    // 레이아웃 선택 해제 시 로컬 변경사항 초기화
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    return
  }

  try {
    // 선택한 레이아웃의 설비 위치 데이터 로드
    const layoutDetail = await fetchLayout(layoutId)

    if (layoutDetail?.equipment) {
      const newPositions: Record<string, { x: number; y: number }> = {}
      const newSizes: Record<string, { w: number; d: number }> = {}

      for (const eq of layoutDetail.equipment) {
        // equipment_id는 scan_code (EQ_001 등)
        newPositions[eq.equipment_id] = {
          x: eq.centroid_x,
          y: eq.centroid_y,
        }
        newSizes[eq.equipment_id] = {
          w: eq.size_w,
          d: eq.size_d,
        }
      }

      setLocalPositions(newPositions)
      setLocalSizes(newSizes)
      setHasChanges(false) // 로드한 상태는 변경된 것이 아님
    }
  } catch (error) {
    console.error('Failed to load layout:', error)
    toast.error('레이아웃 로드 실패')
  }
}, [])
```

**Modified Code** (replace lines 199-238):
```typescript
const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
  console.log('[Layout] handleLayoutSelect called with layoutId:', layoutId)
  setSelectedLayoutId(layoutId)

  if (!layoutId) {
    console.log('[Layout] Clearing positions - layoutId is null')
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    return
  }

  try {
    console.log('[Layout] Fetching layout data for:', layoutId)
    const layoutDetail = await fetchLayout(layoutId)
    console.log('[Layout] Received layoutDetail:', layoutDetail)
    console.log('[Layout] Equipment array:', layoutDetail?.equipment)

    if (layoutDetail?.equipment) {
      console.log('[Layout] Equipment count:', layoutDetail.equipment.length)

      const newPositions: Record<string, { x: number; y: number }> = {}
      const newSizes: Record<string, { w: number; d: number }> = {}

      for (const eq of layoutDetail.equipment) {
        console.log('[Layout] Processing equipment:', {
          equipment_id: eq.equipment_id,
          centroid_x: eq.centroid_x,
          centroid_y: eq.centroid_y,
          size_w: eq.size_w,
          size_d: eq.size_d,
        })
        newPositions[eq.equipment_id] = {
          x: eq.centroid_x,
          y: eq.centroid_y,
        }
        newSizes[eq.equipment_id] = {
          w: eq.size_w,
          d: eq.size_d,
        }
      }

      console.log('[Layout] newPositions object:', newPositions)
      console.log('[Layout] newPositions keys:', Object.keys(newPositions))
      console.log('[Layout] newSizes object:', newSizes)

      console.log('[Layout] Calling setLocalPositions...')
      setLocalPositions(newPositions)
      console.log('[Layout] Calling setLocalSizes...')
      setLocalSizes(newSizes)
      setHasChanges(false)
      console.log('[Layout] State updates completed')
    } else {
      console.warn('[Layout] No equipment data in layoutDetail')
    }
  } catch (error) {
    console.error('[Layout] Error loading layout:', error)
    toast.error('레이아웃 로드 실패')
  }
}, [])
```

### Task 2: Add useEffect Watchers for State Changes

Add these useEffect hooks after the existing state declarations (after line 49, before line 52).

**Add these new hooks:**
```typescript
// DEBUG: Watch localPositions changes
useEffect(() => {
  console.log('[State] localPositions changed:')
  console.log('[State] - Keys count:', Object.keys(localPositions).length)
  console.log('[State] - Keys:', Object.keys(localPositions))
  if (Object.keys(localPositions).length > 0) {
    const firstKey = Object.keys(localPositions)[0]
    console.log('[State] - First entry:', firstKey, localPositions[firstKey])
  }
}, [localPositions])

// DEBUG: Watch localSizes changes
useEffect(() => {
  console.log('[State] localSizes changed:')
  console.log('[State] - Keys count:', Object.keys(localSizes).length)
}, [localSizes])
```

### Task 3: Add Debug Logging to equipmentWithLocalPositions

Modify the `equipmentWithLocalPositions` useMemo (lines 58-71) to add logging:

**Current Code** (lines 58-71):
```typescript
const equipmentWithLocalPositions = useMemo(() => {
  return filteredEquipment.map(eq => {
    const localPos = localPositions[eq.equipment_id]
    const localSize = localSizes[eq.equipment_id]
    let result = eq
    if (localPos) {
      result = { ...result, centroid_x: localPos.x, centroid_y: localPos.y }
    }
    if (localSize) {
      result = { ...result, size_w: localSize.w, size_d: localSize.d }
    }
    return result
  })
}, [filteredEquipment, localPositions, localSizes])
```

**Modified Code** (replace lines 58-71):
```typescript
const equipmentWithLocalPositions = useMemo(() => {
  console.log('[Memo] equipmentWithLocalPositions recalculating...')
  console.log('[Memo] - filteredEquipment count:', filteredEquipment.length)
  console.log('[Memo] - localPositions keys:', Object.keys(localPositions))
  console.log('[Memo] - filteredEquipment IDs:', filteredEquipment.map(eq => eq.equipment_id))

  const result = filteredEquipment.map(eq => {
    const localPos = localPositions[eq.equipment_id]
    const localSize = localSizes[eq.equipment_id]
    let updated = eq

    if (localPos) {
      console.log('[Memo] Applying localPos to', eq.equipment_id, ':', localPos)
      updated = { ...updated, centroid_x: localPos.x, centroid_y: localPos.y }
    } else {
      console.log('[Memo] No localPos for', eq.equipment_id)
    }

    if (localSize) {
      updated = { ...updated, size_w: localSize.w, size_d: localSize.d }
    }

    return updated
  })

  console.log('[Memo] Result count:', result.length)
  if (result.length > 0) {
    console.log('[Memo] First result position:', {
      id: result[0].equipment_id,
      x: result[0].centroid_x,
      y: result[0].centroid_y,
    })
  }

  return result
}, [filteredEquipment, localPositions, localSizes])
```

### Task 4: Add Watch for filteredEquipment

Add this useEffect after the filteredEquipment useMemo (after line 55):

**Add this new hook:**
```typescript
// DEBUG: Watch filteredEquipment changes
useEffect(() => {
  console.log('[State] filteredEquipment changed:')
  console.log('[State] - Count:', filteredEquipment.length)
  console.log('[State] - IDs:', filteredEquipment.map(eq => eq.equipment_id))
}, [filteredEquipment])
```

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/LayoutEditorPage.tsx` | Modify | Add debug console.log statements |

---

## Expected Console Output

When the debug code is added, selecting a layout should produce logs like:

```
[Layout] handleLayoutSelect called with layoutId: abc-123-uuid
[Layout] Fetching layout data for: abc-123-uuid
[Layout] Received layoutDetail: {id: 'abc-123', name: 'Layout 1', equipment: [...]}
[Layout] Equipment array: [{equipment_id: 'EQ_001', ...}, ...]
[Layout] Equipment count: 5
[Layout] Processing equipment: {equipment_id: 'EQ_001', centroid_x: 100, ...}
...
[Layout] newPositions object: {EQ_001: {x: 100, y: 200}, ...}
[Layout] newPositions keys: ['EQ_001', 'EQ_002', ...]
[Layout] Calling setLocalPositions...
[Layout] Calling setLocalSizes...
[Layout] State updates completed
[State] localPositions changed:
[State] - Keys count: 5
[State] - Keys: ['EQ_001', 'EQ_002', ...]
[State] - First entry: EQ_001 {x: 100, y: 200}
[Memo] equipmentWithLocalPositions recalculating...
[Memo] - filteredEquipment count: 5
[Memo] - localPositions keys: ['EQ_001', 'EQ_002', ...]
[Memo] - filteredEquipment IDs: ['EQ_001', 'EQ_002', ...]
[Memo] Applying localPos to EQ_001 : {x: 100, y: 200}
...
[Memo] Result count: 5
[Memo] First result position: {id: 'EQ_001', x: 100, y: 200}
```

### What to Look For in Logs

1. **If `[Layout] Equipment array: undefined`** - Backend not returning equipment data properly
2. **If `[Layout] newPositions keys` is empty** - Loop not executing
3. **If `[State] localPositions changed` never fires** - React state not updating
4. **If `[Memo] localPositions keys` is empty but `[State]` shows keys** - Timing issue
5. **If `[Memo] No localPos for X`** - Key mismatch between equipment_id formats

---

## Acceptance Criteria

- [ ] Debug logs added to `handleLayoutSelect` function
- [ ] useEffect watchers added for `localPositions` and `localSizes`
- [ ] Debug logs added to `equipmentWithLocalPositions` useMemo
- [ ] useEffect watcher added for `filteredEquipment`
- [ ] Console shows complete execution flow when selecting a layout
- [ ] State change values are visible before and after updates
- [ ] Key mismatch can be identified if present (compare `localPositions keys` vs `filteredEquipment IDs`)
- [ ] Root cause hypothesis documented based on log analysis

---

## Testing Instructions

1. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open browser DevTools (F12) and go to Console tab

3. Navigate to Layout Editor page

4. Select a company and factory

5. Ensure at least one layout exists (create one if needed by moving equipment and saving)

6. Select a layout from the dropdown

7. Observe console output

8. Document which logs appear and what values they show

9. Compare:
   - `newPositions keys` from handleLayoutSelect
   - `filteredEquipment IDs` from the memo
   - If they don't match, this is the bug root cause

---

## Root Cause Hypotheses

Based on the debug output, determine which hypothesis is correct:

### Hypothesis A: API Response Format Issue
**Symptom**: `[Layout] Equipment array: undefined` or empty
**Cause**: Backend `GET /layouts/{layout_id}` not returning equipment data
**Next Step**: Proceed to Section 01 (Backend Debug)

### Hypothesis B: State Update Not Triggering Re-render
**Symptom**: `[State] localPositions changed` never fires after `setLocalPositions`
**Cause**: React state batching or stale closure issue
**Next Step**: Add force update mechanism in Section 03

### Hypothesis C: Key Mismatch
**Symptom**: `[Memo] No localPos for X` for all equipment
**Cause**: `localPositions` uses different key format than `filteredEquipment[].equipment_id`
**Next Step**: Normalize key format in Section 03

### Hypothesis D: Timing/Race Condition
**Symptom**: Logs appear out of order or memo runs before state updates
**Cause**: Async timing issues
**Next Step**: Add loading state guard in Section 03

---

## Notes

- These debug logs are temporary and should be removed after the bug is fixed
- Keep the browser console open while testing
- Clear console before each test for cleaner output
- Take screenshots of console output for documentation

---

# Section 03: Layout Load Bug Fix

**Section ID:** 03
**Status:** Pending
**Estimated Effort:** 2-4 hours
**Priority:** Critical

---

## Background

The FACTOR Digital Twin layout editor allows users to save and load equipment positions as named layouts. When a user selects a saved layout from the dropdown, the system should immediately apply the stored equipment positions to the canvas.

**Core Bug:** When a layout is selected, the saved equipment positions are NOT applied to the canvas. The equipment remains in their original database positions instead of the layout-specific positions.

**User Impact:**
- Layout versioning feature is effectively non-functional
- Users cannot compare different factory floor configurations
- Saved layout work is lost when reloading

This section implements the fix based on findings from Sections 01 (Backend Debug) and 02 (Frontend Debug).

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| **Requires** | Section 01 (Backend Debug) | Must verify API returns correct data format before fixing |
| **Requires** | Section 02 (Frontend Debug) | Must identify exact failure point in state flow |
| **Blocks** | Section 04 (Testing) | Testing validates the fix works correctly |

**Important:** Run Sections 01 and 02 first to identify which hypothesis (A, B, C, or D) is the actual cause. The fix implementation depends on the diagnosis results.

---

## Requirements

When this section is complete, the following must be true:

1. Selecting a layout immediately applies saved positions to all equipment on canvas
2. Equipment positions visually update without requiring manual refresh
3. Subsequent position edits are tracked correctly against the loaded layout
4. Saving after edits persists the new positions correctly
5. Re-selecting the same layout reloads positions from database (not cached)
6. No console errors during layout load/save cycle

---

## Hypothesis Fixes

Based on debugging from Sections 01 and 02, implement the appropriate fix:

### Hypothesis A: API Response Format Mismatch

**Symptoms detected in Section 01:**
- `equipment_id` in API response is UUID instead of scan_code
- Frontend expects scan_code (e.g., "EQ_001") but receives UUID

**Root Cause:**
The backend `get_layout()` function may not be converting UUIDs back to scan_codes correctly, or the conversion is failing silently.

**Fix Location:** `backend/app/api/layouts.py`

**Implementation:**

```python
# In get_layout() function (lines 316-366)

@router.get("/{layout_id}", response_model=LayoutDetailOut)
def get_layout(
    layout_id: UUID,
    db: Client = Depends(get_supabase),
):
    """Get layout details with all equipment positions."""
    layout_resp = (
        db.table("layouts")
        .select("*")
        .eq("id", str(layout_id))
        .single()
        .execute()
    )

    if not layout_resp.data:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Get equipment positions
    eq_resp = (
        db.table("layout_equipment")
        .select("*")
        .eq("layout_id", str(layout_id))
        .execute()
    )

    # Convert UUIDs back to scan_codes for frontend
    equipment_out = []
    if eq_resp.data:
        # Get all equipment UUIDs
        eq_uuids = [eq["equipment_id"] for eq in eq_resp.data]

        # ADD LOGGING HERE for debugging
        print(f"[DEBUG] Layout {layout_id} has {len(eq_uuids)} equipment entries")
        print(f"[DEBUG] Equipment UUIDs: {eq_uuids}")

        # Look up scan_codes
        scan_lookup_resp = (
            db.table("equipment_scans")
            .select("id, scan_code")
            .in_("id", eq_uuids)
            .execute()
        )

        # ADD LOGGING for lookup results
        print(f"[DEBUG] Scan lookup returned: {scan_lookup_resp.data}")

        uuid_to_scan = {e["id"]: e["scan_code"] for e in scan_lookup_resp.data}

        for eq in eq_resp.data:
            scan_code = uuid_to_scan.get(eq["equipment_id"])
            if scan_code:
                equipment_out.append({
                    **eq,
                    "equipment_id": scan_code,  # Replace UUID with scan_code
                })
            else:
                # FIX: Log missing mappings instead of silently skipping
                print(f"[WARN] No scan_code found for equipment_id: {eq['equipment_id']}")

    print(f"[DEBUG] Returning {len(equipment_out)} equipment with scan_codes")

    return {
        **layout_resp.data,
        "equipment": equipment_out,
    }
```

**Verification:**
- Check DevTools Network tab: API response `equipment[].equipment_id` should be scan_codes like "EQ_001"
- All equipment in the layout should appear in the response (no silent drops)

---

### Hypothesis B: State Update Not Triggering Re-render

**Symptoms detected in Section 02:**
- `setLocalPositions` is called with correct data
- `localPositions` state updates
- But `equipmentWithLocalPositions` memo doesn't recalculate
- Canvas doesn't re-render with new positions

**Root Cause:**
React's memoization may be preventing re-render due to stale closure or dependency array issues.

**Fix Location:** `frontend/src/pages/LayoutEditorPage.tsx`

**Implementation Option 1 - Force Update Key:**

```typescript
// Add a layout version counter to force re-renders
const [layoutVersion, setLayoutVersion] = useState(0)

// Update handleLayoutSelect (around line 199)
const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
  setSelectedLayoutId(layoutId)

  if (!layoutId) {
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    return
  }

  try {
    const layoutDetail = await fetchLayout(layoutId)

    if (layoutDetail?.equipment) {
      const newPositions: Record<string, { x: number; y: number }> = {}
      const newSizes: Record<string, { w: number; d: number }> = {}

      for (const eq of layoutDetail.equipment) {
        newPositions[eq.equipment_id] = {
          x: eq.centroid_x,
          y: eq.centroid_y,
        }
        newSizes[eq.equipment_id] = {
          w: eq.size_w,
          d: eq.size_d,
        }
      }

      // Use functional updates to ensure fresh state
      setLocalPositions(newPositions)
      setLocalSizes(newSizes)
      setHasChanges(false)

      // Force re-render by incrementing version
      setLayoutVersion(v => v + 1)
    }
  } catch (error) {
    console.error('Failed to load layout:', error)
    toast.error('레이아웃 로드 실패')
  }
}, [])

// Pass layoutVersion to LayoutCanvas as key (in JSX around line 400+)
<LayoutCanvas
  key={layoutVersion}  // Forces remount when layout changes
  equipment={equipmentWithLocalPositions}
  // ... other props
/>
```

**Implementation Option 2 - Fix useMemo Dependencies:**

```typescript
// Check that equipmentWithLocalPositions has correct dependencies
const equipmentWithLocalPositions = useMemo(() => {
  console.log('[Memo] Recalculating equipmentWithLocalPositions')
  console.log('[Memo] filteredEquipment count:', filteredEquipment.length)
  console.log('[Memo] localPositions keys:', Object.keys(localPositions))

  return filteredEquipment.map(eq => {
    const localPos = localPositions[eq.equipment_id]
    const localSize = localSizes[eq.equipment_id]

    // Log when position is applied
    if (localPos) {
      console.log(`[Memo] Applying position to ${eq.equipment_id}:`, localPos)
    }

    let result = eq
    if (localPos) {
      result = { ...result, centroid_x: localPos.x, centroid_y: localPos.y }
    }
    if (localSize) {
      result = { ...result, size_w: localSize.w, size_d: localSize.d }
    }
    return result
  })
}, [filteredEquipment, localPositions, localSizes])  // Verify all dependencies listed
```

**Verification:**
- Console should show "[Memo] Recalculating..." after layout selection
- Canvas equipment should move to new positions immediately

---

### Hypothesis C: Key Mismatch Between filteredEquipment and localPositions

**Symptoms detected in Section 02:**
- API returns equipment_id as scan_code (e.g., "EQ_001")
- But `filteredEquipment[].equipment_id` uses a different format
- Keys don't match, so positions aren't applied

**Root Cause:**
The `equipment_id` format differs between:
- Backend API response: Uses `scan_code` (e.g., "EQ_001")
- Frontend equipment list: May use UUID or different format

**Fix Location:** `frontend/src/pages/LayoutEditorPage.tsx`

**Implementation - Normalize Keys:**

```typescript
// Add debugging to identify the key mismatch
const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
  setSelectedLayoutId(layoutId)

  if (!layoutId) {
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    return
  }

  try {
    const layoutDetail = await fetchLayout(layoutId)

    // DEBUG: Log API response keys
    console.log('[Layout] API equipment_ids:',
      layoutDetail?.equipment?.map(e => e.equipment_id))

    // DEBUG: Log current filteredEquipment keys
    console.log('[Layout] filteredEquipment equipment_ids:',
      filteredEquipment.map(e => e.equipment_id))

    if (layoutDetail?.equipment) {
      const newPositions: Record<string, { x: number; y: number }> = {}
      const newSizes: Record<string, { w: number; d: number }> = {}

      // Build a map from API data
      const apiEquipmentMap = new Map(
        layoutDetail.equipment.map(eq => [eq.equipment_id, eq])
      )

      // Match against filteredEquipment keys
      for (const eq of filteredEquipment) {
        const apiEquipment = apiEquipmentMap.get(eq.equipment_id)
        if (apiEquipment) {
          newPositions[eq.equipment_id] = {
            x: apiEquipment.centroid_x,
            y: apiEquipment.centroid_y,
          }
          newSizes[eq.equipment_id] = {
            w: apiEquipment.size_w,
            d: apiEquipment.size_d,
          }
        } else {
          console.warn(`[Layout] No layout data for equipment: ${eq.equipment_id}`)
        }
      }

      console.log('[Layout] Matched positions:', Object.keys(newPositions).length)

      setLocalPositions(newPositions)
      setLocalSizes(newSizes)
      setHasChanges(false)
    }
  } catch (error) {
    console.error('Failed to load layout:', error)
    toast.error('레이아웃 로드 실패')
  }
}, [filteredEquipment])  // Add filteredEquipment to dependencies
```

**Alternative Fix - Use Consistent Key Format:**

If the API returns UUIDs but frontend uses scan_codes (or vice versa), add a normalization step:

```typescript
// In frontend/src/lib/api.ts - fetchLayout function
export const fetchLayout = async (layoutId: string): Promise<LayoutDetail> => {
  const response = await api.get<LayoutDetail>(`/layouts/${layoutId}`)
  const data = response.data

  // Ensure equipment_id format matches frontend expectations
  // The backend SHOULD already convert UUID to scan_code
  // This is a safety check
  if (data.equipment) {
    data.equipment = data.equipment.map(eq => ({
      ...eq,
      // If equipment_id looks like UUID, log warning
      equipment_id: eq.equipment_id.includes('-')
        ? (console.warn('UUID in equipment_id, expected scan_code'), eq.equipment_id)
        : eq.equipment_id
    }))
  }

  return data
}
```

**Verification:**
- Console should show matching keys between API response and filteredEquipment
- Matched positions count should equal equipment count in layout

---

### Hypothesis D: Async Timing Issue

**Symptoms detected in Section 02:**
- Layout data fetches correctly
- But `filteredEquipment` is stale or empty when `setLocalPositions` is called
- Positions are set but equipment list updates afterwards, overwriting positions

**Root Cause:**
Race condition between:
1. Layout fetch completing and setting positions
2. Equipment fetch completing and resetting `filteredEquipment`
3. `useMemo` recalculating with stale data

**Fix Location:** `frontend/src/pages/LayoutEditorPage.tsx`

**Implementation - Add Loading State and Sequence Control:**

```typescript
// Add layout loading state
const [layoutLoading, setLayoutLoading] = useState(false)

// Update handleLayoutSelect with proper async handling
const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
  console.log('[Layout] handleLayoutSelect called:', layoutId)

  setSelectedLayoutId(layoutId)

  if (!layoutId) {
    console.log('[Layout] Clearing positions')
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    return
  }

  // Prevent concurrent layout loads
  setLayoutLoading(true)

  try {
    console.log('[Layout] Fetching layout data...')
    const layoutDetail = await fetchLayout(layoutId)
    console.log('[Layout] Received:', layoutDetail)

    if (layoutDetail?.equipment) {
      console.log('[Layout] Equipment count:', layoutDetail.equipment.length)

      const newPositions: Record<string, { x: number; y: number }> = {}
      const newSizes: Record<string, { w: number; d: number }> = {}

      for (const eq of layoutDetail.equipment) {
        console.log('[Layout] Processing:', eq.equipment_id, eq.centroid_x, eq.centroid_y)
        newPositions[eq.equipment_id] = {
          x: eq.centroid_x,
          y: eq.centroid_y,
        }
        newSizes[eq.equipment_id] = {
          w: eq.size_w,
          d: eq.size_d,
        }
      }

      console.log('[Layout] Setting positions:', Object.keys(newPositions).length)

      // Use callback form to ensure we're updating with latest state
      setLocalPositions(prev => {
        console.log('[Layout] Previous positions:', Object.keys(prev).length)
        return newPositions
      })
      setLocalSizes(newSizes)
      setHasChanges(false)
    }
  } catch (error) {
    console.error('[Layout] Error:', error)
    toast.error('레이아웃 로드 실패')
  } finally {
    setLayoutLoading(false)
  }
}, [])

// Add effect to re-apply positions when equipment changes
useEffect(() => {
  // If we have a selected layout and equipment just loaded, re-fetch layout
  if (selectedLayoutId && !equipmentLoading && equipment.length > 0) {
    console.log('[Effect] Equipment loaded, re-applying layout positions')
    handleLayoutSelect(selectedLayoutId)
  }
}, [equipment.length, equipmentLoading]) // Note: careful with dependencies to avoid loops

// Show loading indicator during layout load
{layoutLoading && (
  <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-50">
    <Loader2 className="h-8 w-8 animate-spin" />
    <span className="ml-2">레이아웃 로딩중...</span>
  </div>
)}
```

**Alternative - Wait for Equipment Before Loading Layout:**

```typescript
// Modify handleLayoutSelect to wait for equipment
const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
  setSelectedLayoutId(layoutId)

  if (!layoutId) {
    setLocalPositions({})
    setLocalSizes({})
    setHasChanges(false)
    return
  }

  // Wait for equipment to be loaded first
  if (equipmentLoading || equipment.length === 0) {
    console.log('[Layout] Waiting for equipment to load first...')
    return  // The useEffect below will re-trigger when equipment loads
  }

  setLayoutLoading(true)
  try {
    const layoutDetail = await fetchLayout(layoutId)
    // ... rest of implementation
  } finally {
    setLayoutLoading(false)
  }
}, [equipmentLoading, equipment.length])

// Re-apply layout when equipment finishes loading
useEffect(() => {
  if (selectedLayoutId && !equipmentLoading && equipment.length > 0) {
    handleLayoutSelect(selectedLayoutId)
  }
}, [selectedLayoutId, equipmentLoading, equipment.length, handleLayoutSelect])
```

**Verification:**
- Console shows proper sequence: equipment loads, then layout positions applied
- No race conditions between equipment and layout loading
- Positions persist after all data is loaded

---

## Files to Create/Modify

| File | Action | Hypothesis | Description |
|------|--------|------------|-------------|
| `backend/app/api/layouts.py` | Modify | A | Add logging, fix UUID→scan_code conversion |
| `frontend/src/pages/LayoutEditorPage.tsx` | Modify | B, C, D | Fix state updates, key matching, async timing |
| `frontend/src/lib/api.ts` | Modify | C | Add key normalization (if needed) |

---

## Implementation Workflow

Based on Section 01/02 debugging results, follow this workflow:

```
1. Review Section 01 & 02 Debug Logs
           ↓
2. Identify Primary Hypothesis (A, B, C, or D)
           ↓
3. Implement Primary Fix
           ↓
4. Test: Select layout, verify positions apply
           ↓
   ├─→ If fixed: Done, proceed to Section 04
   │
   └─→ If not fixed: Implement next hypothesis fix
```

### Recommended Order if Multiple Issues:

1. **Fix Hypothesis A first** - Backend data format is foundational
2. **Fix Hypothesis C second** - Key matching depends on correct data
3. **Fix Hypothesis D third** - Timing issues can mask other bugs
4. **Fix Hypothesis B last** - Re-render issues are usually symptoms

---

## Acceptance Criteria

Complete all checkboxes before marking this section as done:

### Core Functionality
- [ ] Layout selection applies saved positions to canvas immediately
- [ ] All equipment in the layout receives correct position
- [ ] Equipment not in the layout maintains original position
- [ ] Position changes are visible without page refresh

### Data Integrity
- [ ] API response contains scan_code format for equipment_id (not UUID)
- [ ] Position values (centroid_x, centroid_y) match database values
- [ ] Size values (size_w, size_d) match database values

### State Management
- [ ] `localPositions` state contains correct key-value pairs after load
- [ ] `equipmentWithLocalPositions` memo recalculates after position update
- [ ] Console shows no state management warnings

### User Experience
- [ ] No visible flicker during layout load
- [ ] Loading indicator shows during layout fetch
- [ ] Error toast appears on load failure
- [ ] Success indication (positions update) is immediate

### Edge Cases
- [ ] Selecting same layout twice reloads fresh data
- [ ] Switching between layouts updates positions correctly
- [ ] Clearing layout selection resets to original positions
- [ ] Works with empty layouts (no equipment positions)

---

## Testing Instructions

### Manual Testing Sequence

1. **Setup:**
   - Open LayoutEditorPage
   - Select a company and factory with saved layouts
   - Open DevTools Console (F12)

2. **Test Layout Load:**
   - Select a layout from the dropdown
   - Verify console shows layout fetch and position setting logs
   - Verify equipment positions change on canvas
   - Compare visual positions with database values

3. **Test Position Persistence:**
   - Drag an equipment to new position
   - Save the layout
   - Select a different layout
   - Re-select the original layout
   - Verify equipment returns to saved position

4. **Test Multiple Layouts:**
   - Create Layout A with equipment at position (100, 100)
   - Create Layout B with same equipment at position (200, 200)
   - Switch between Layout A and B
   - Verify equipment moves between positions

5. **Test Edge Cases:**
   - Select layout with no equipment data
   - Select layout while equipment is still loading
   - Rapidly switch between layouts
   - Clear layout selection

### Debug Console Commands

Add these to browser console for debugging:

```javascript
// Check current localPositions state (React DevTools)
// In Components tab, find LayoutEditorPage, check state

// Log all equipment IDs for comparison
console.log('Equipment IDs:',
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__
    ?.renderers.get(1)
    ?.getCurrentFiber()
    ?.memoizedState
    ?.equipment?.map(e => e.equipment_id)
)
```

### Network Verification

1. Open DevTools Network tab
2. Select a layout
3. Find request: `GET /api/layouts/{layout_id}`
4. Verify response:
   ```json
   {
     "equipment": [
       {
         "equipment_id": "EQ_001",  // Should be scan_code, not UUID
         "centroid_x": 150.5,
         "centroid_y": 200.3,
         ...
       }
     ]
   }
   ```

---

## Rollback Plan

If the fix causes regressions:

1. **Revert code changes** via git
2. **Clear browser cache** to remove any cached API responses
3. **Document the failure mode** in Section 02 debug notes
4. **Re-analyze** with additional logging

---

## Notes

- Debug logging added during fix should be removed before production
- Consider adding unit tests for the position mapping logic
- The fix should not affect layout save functionality
- Performance: Position updates should complete in < 100ms for typical layouts (< 100 equipment)

---

## Related Files Reference

**Backend:**
- `backend/app/api/layouts.py` - Layout CRUD endpoints
- `backend/app/schemas/layout.py` - Pydantic schemas for layout data

**Frontend:**
- `frontend/src/pages/LayoutEditorPage.tsx` - Main editor component
- `frontend/src/lib/api.ts` - API client with `fetchLayout` function
- `frontend/src/hooks/useLayouts.ts` - Layout data hooks
- `frontend/src/components/LayoutCanvas.tsx` - Canvas rendering component

---

# Section 04: Testing and Verification

**Status**: Not Started
**Priority**: High
**Estimated Time**: 30-45 minutes

---

## Background

This section provides the final verification step for the Layout Save/Load bug fix. After implementing debugging (Sections 1-2) and the bug fix (Section 3), this section ensures the fix works correctly through systematic manual testing.

**The Bug Context**:
- Users select a layout from the dropdown
- The layout's saved equipment positions should appear on the canvas
- Currently, positions are NOT being applied (equipment stays at default positions)
- This section verifies that the fix resolves this behavior

---

## Dependencies

### Requires (must be completed first)
| Section | Description |
|---------|-------------|
| section-03-bug-fix | Bug must be fixed before testing can validate the fix |

### Blocks
- None (this is the final section)

---

## Requirements

When this section is complete, the following must be true:

1. Layout selection displays saved equipment positions immediately
2. Saving a layout and reloading it preserves all positions
3. Page refresh resets to initial state (no layout selected)
4. No console errors during any workflow
5. API responses contain correctly formatted data

---

## Manual Test Scenarios

### Test 1: Basic Load Test

**Purpose**: Verify layout selection applies positions to canvas

**Steps**:
1. Open Layout Editor page in browser
2. Open browser DevTools (F12) - keep Console tab visible
3. From the layout dropdown, select an existing layout
4. Observe the canvas

**Expected Results**:
- [ ] Console shows: `[Layout] handleLayoutSelect called: <layoutId>`
- [ ] Console shows: `[Layout] Fetching layout data...`
- [ ] Console shows: `[Layout] Received: {...}` with equipment array
- [ ] Console shows: `[Layout] Equipment count: <number>`
- [ ] Console shows: `[Layout] Setting positions: <number>`
- [ ] Canvas updates to show equipment at saved positions
- [ ] No error messages in console

**If Test Fails**:
- Check console for error messages
- Verify API response in Network tab
- Return to Section 3 to fix remaining issues

---

### Test 2: Save/Load Cycle Test

**Purpose**: Verify positions persist through save and reload cycles

**Steps**:
1. Select a layout from the dropdown
2. Drag one or more equipment items to new positions
3. Click the Save button
4. Select a DIFFERENT layout from the dropdown
5. Re-select the original layout

**Expected Results**:
- [ ] Step 2: Equipment items can be dragged to new positions
- [ ] Step 3: Save operation completes (check for success indicator)
- [ ] Step 4: Canvas updates to show different layout's positions
- [ ] Step 5: Original layout reloads with the NEW positions you saved
- [ ] All position changes are preserved

**If Test Fails**:
- Verify save API call succeeds (Network tab)
- Check if saved positions appear in API response when reloading
- May indicate save functionality issue vs. load issue

---

### Test 3: Page Refresh Test

**Purpose**: Verify clean state on page reload

**Steps**:
1. Select any layout from the dropdown
2. Confirm equipment is positioned according to layout
3. Press F5 or click browser refresh
4. Observe the page state

**Expected Results**:
- [ ] Page loads with no layout selected
- [ ] Equipment is at default/initial positions (not layout positions)
- [ ] Selecting a layout again applies positions correctly
- [ ] No errors in console

**If Test Fails**:
- Check if layout selection state is incorrectly persisted
- Verify URL does not contain layout ID parameter

---

### Test 4: Rapid Selection Test

**Purpose**: Verify no race conditions with quick selections

**Steps**:
1. Quickly click through 3-4 different layouts in succession
2. Wait for final layout to load completely
3. Observe canvas positions

**Expected Results**:
- [ ] Final selected layout's positions are displayed
- [ ] No flickering or position jumps after settling
- [ ] Console shows sequential selection logs
- [ ] No "stale" data from intermediate selections

---

### Test 5: Stress Test (10 Cycles)

**Purpose**: Verify stability over repeated operations

**Steps**:
1. Perform the following cycle 10 times:
   - Select a layout
   - Move at least one equipment
   - Save the layout
   - Select a different layout
   - Return to original layout
   - Verify positions

**Expected Results**:
- [ ] All 10 cycles complete without errors
- [ ] Positions are always correct after each reload
- [ ] No memory leaks (page remains responsive)
- [ ] Console shows clean logs for each cycle

---

## Network Verification

### API Response Check

**Location**: Browser DevTools > Network tab

**Steps**:
1. Open Network tab, filter by "Fetch/XHR"
2. Select a layout from the dropdown
3. Find the `GET /layouts/{layout_id}` request
4. Click on the request, view Response tab

**Verification Checklist**:

```
Response Structure:
{
  "id": "uuid-string",
  "name": "layout name",
  "equipment": [
    {
      "equipment_id": "SCAN_CODE_FORMAT",  ← Must be scan_code, NOT UUID
      "centroid_x": 150.5,                 ← Must be numeric
      "centroid_y": 200.0,                 ← Must be numeric
      "size_w": 50,                        ← Must be numeric
      "size_d": 30                         ← Must be numeric
    }
  ]
}
```

**Expected**:
- [ ] `equipment_id` is in scan_code format (e.g., "EQ-001", "PRESS-A1")
- [ ] `equipment_id` is NOT a UUID format
- [ ] `centroid_x` and `centroid_y` are numbers (not strings, not null)
- [ ] `size_w` and `size_d` are numbers
- [ ] HTTP status is 200
- [ ] Response time is under 500ms

---

## State Verification

### React DevTools Check

**Prerequisites**: React DevTools browser extension installed

**Steps**:
1. Open React DevTools (Components tab)
2. Search for "LayoutEditorPage" component
3. Select the component in the tree
4. Locate `localPositions` in the hooks/state section

**After Layout Selection, Verify**:

```
localPositions should contain:
{
  "SCAN_CODE_1": { x: 150.5, y: 200.0 },
  "SCAN_CODE_2": { x: 300.0, y: 150.0 },
  ...
}
```

**Verification Checklist**:
- [ ] `localPositions` object has entries after layout selection
- [ ] Keys match equipment scan_codes (not UUIDs)
- [ ] Each value has `x` and `y` numeric properties
- [ ] Number of entries matches equipment count in API response

### localSizes Verification

- [ ] `localSizes` object has same keys as `localPositions`
- [ ] Each value has `w` and `d` numeric properties

### equipmentWithLocalPositions Verification

**Steps**:
1. Find the `equipmentWithLocalPositions` computed value
2. Verify equipment items have updated positions

**Expected**:
- [ ] Array length matches filtered equipment count
- [ ] Each item's `centroid_x` and `centroid_y` match `localPositions`
- [ ] Position values are from layout, not default

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Position Application Rate | 100% | All equipment positions match layout data after selection |
| Layout Load Time | < 500ms | Network tab shows response time |
| Stability | 10/10 cycles | Stress test passes all cycles |
| Error Rate | 0 | No console errors during testing |

---

## Files to Create/Modify

This section is manual testing only. No code changes required.

**Reference Files** (for understanding, not modification):
- `frontend/src/pages/LayoutEditorPage.tsx` - Contains `handleLayoutSelect` and state
- `backend/app/api/layouts.py` - Contains layout fetch endpoint

---

## Acceptance Criteria

### Core Functionality
- [ ] Layout selection immediately shows saved equipment positions on canvas
- [ ] Save operation persists positions correctly
- [ ] Re-selecting a layout loads the saved positions
- [ ] Page refresh returns to clean initial state

### API Verification
- [ ] API response contains `equipment_id` in scan_code format
- [ ] API response contains valid numeric position values
- [ ] API response time is under 500ms

### State Verification
- [ ] `localPositions` state updates correctly after layout selection
- [ ] `equipmentWithLocalPositions` reflects loaded positions
- [ ] State keys match equipment identifiers

### Stability
- [ ] All 5 manual test scenarios pass
- [ ] Stress test (10 cycles) completes without errors
- [ ] No console errors during any operation
- [ ] No visual glitches or position flickering

---

## Troubleshooting Guide

### Issue: Positions not updating after layout selection

**Check**:
1. Console for `[Layout]` logs - is `handleLayoutSelect` being called?
2. Network tab - is API returning equipment data?
3. API response - are `equipment_id` values matching canvas equipment?

**Likely Cause**: Key mismatch between API response and frontend equipment list

---

### Issue: API returns empty equipment array

**Check**:
1. Backend logs for errors
2. Database has layout_equipment records for this layout

**Likely Cause**: Layout has no saved equipment positions yet

---

### Issue: Positions apply then reset

**Check**:
1. Console for multiple `handleLayoutSelect` calls
2. Check for useEffect loops triggering state resets

**Likely Cause**: Race condition or effect dependency issue

---

### Issue: Console shows errors

**Common Errors**:
- `TypeError: Cannot read property 'x' of undefined` → Missing position data
- `Network Error` → API server not running
- `404 Not Found` → Layout ID doesn't exist

---

## Completion Checklist

Before marking this section complete:

- [ ] All 5 test scenarios executed and passed
- [ ] Network verification completed
- [ ] State verification completed
- [ ] All acceptance criteria checked
- [ ] Success metrics met
- [ ] No outstanding console errors
- [ ] Screenshots/recordings captured (optional but recommended)

---

## Post-Completion

After all tests pass:

1. Remove debug logging added in Section 2 (optional for production)
2. Document any edge cases discovered during testing
3. Consider adding automated tests for critical paths
4. Update project documentation if behavior changed

---

**Section Owner**: Implementer
**Reviewer**: Tech Lead
**Last Updated**: 2026-04-01

---

# Execution Rules

## Dependency Order

Execute sections respecting the dependency graph:

1. **Sections 01 and 02** can run in parallel (no dependencies)
2. **Section 03** requires completion of both 01 and 02
3. **Section 04** requires completion of 03

## Execution Protocol

For each section:

1. Read and understand the section requirements
2. Implement all tasks described in Implementation Details
3. Verify ALL acceptance criteria are met before proceeding
4. Document any findings or issues discovered
5. Only mark section complete when ALL criteria pass

## Verification Before Proceeding

Before moving to the next section:

- [ ] All acceptance criteria checkboxes are checked
- [ ] No blocking errors remain
- [ ] Required outputs/artifacts are ready for dependent sections

## Error Handling

If a section fails:

1. Document the specific failure
2. Attempt to fix within the section scope
3. If unfixable, document blockers and continue to next parallel section if available
4. Do not proceed to dependent sections until blockers are resolved

---

# Completion Signal

When ALL sections (01, 02, 03, 04) are complete and verified:

<promise>ALL-SECTIONS-COMPLETE</promise>

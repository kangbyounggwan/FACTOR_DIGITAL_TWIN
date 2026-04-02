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

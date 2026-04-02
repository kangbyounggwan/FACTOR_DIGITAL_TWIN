# Layout Save/Load Research Findings

Generated: 2026-04-01 (Layout Save/Load Bug Fix)

---

## Executive Summary

코드 분석 결과, **UUID ↔ scan_code 변환 로직은 정상 작동**합니다. 그러나 **레이아웃 자동 로드 로직이 누락**되어 있습니다.

---

## 1. Save Flow (정상)

### Frontend → Backend
```
handleSaveAll()
  → getCurrentEquipmentForLayout() // equipment_id = scan_code
  → updateLayoutEquipment(layoutId, equipmentData)
  → API: PUT /layouts/{layoutId}/equipment
```

### Backend Processing
```python
# layouts.py:273-281
scan_codes = [eq.equipment_id for eq in request.equipment]
eq_lookup_resp = db.table("equipment_scans").select("id, scan_code").in_("scan_code", scan_codes).execute()
scan_to_uuid = {e["scan_code"]: e["id"] for e in eq_lookup_resp.data}
# → scan_code를 UUID로 변환하여 layout_equipment에 저장 ✓
```

---

## 2. Load Flow (정상)

### Backend Processing
```python
# layouts.py:341-361
eq_uuids = [eq["equipment_id"] for eq in eq_resp.data]
scan_lookup_resp = db.table("equipment_scans").select("id, scan_code").in_("id", eq_uuids).execute()
uuid_to_scan = {e["id"]: e["scan_code"] for e in scan_lookup_resp.data}
# → UUID를 scan_code로 변환하여 반환 ✓
```

### Frontend Processing
```typescript
// LayoutEditorPage.tsx:199-238
const handleLayoutSelect = async (layoutId: string | null) => {
  const layoutDetail = await fetchLayout(layoutId)
  for (const eq of layoutDetail.equipment) {
    newPositions[eq.equipment_id] = { x: eq.centroid_x, y: eq.centroid_y }
    newSizes[eq.equipment_id] = { w: eq.size_w, d: eq.size_d }
  }
  setLocalPositions(newPositions)  // ✓ 설정됨
  setLocalSizes(newSizes)          // ✓ 설정됨
}
```

---

## 3. State Merge (정상)

```typescript
// LayoutEditorPage.tsx:57-71
const equipmentWithLocalPositions = useMemo(() => {
  return filteredEquipment.map(eq => {
    const localPos = localPositions[eq.equipment_id]  // scan_code로 키잉
    const localSize = localSizes[eq.equipment_id]
    if (localPos) result = { ...result, centroid_x: localPos.x, centroid_y: localPos.y }
    if (localSize) result = { ...result, size_w: localSize.w, size_d: localSize.d }
    return result
  })
}, [filteredEquipment, localPositions, localSizes])
```

---

## 4. 발견된 문제점

### 문제 1: 페이지 로드 시 활성 레이아웃 자동 적용 누락

```typescript
// 현재 코드: selectedLayoutId는 null로 시작
const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null)

// useActiveLayout 훅은 있지만 자동 적용하지 않음
const { layout: activeLayout, reload: reloadActiveLayout } = useActiveLayout(selectedFactory?.id ?? null)
```

**필요한 로직:**
```typescript
// 활성 레이아웃이 로드되면 자동 선택 및 위치 적용
useEffect(() => {
  if (activeLayout && !selectedLayoutId) {
    handleLayoutSelect(activeLayout.id)
  }
}, [activeLayout])
```

### 문제 2: 레이아웃 선택 상태 비영속

- `selectedLayoutId`는 React 상태로만 관리됨
- 페이지 새로고침 시 null로 리셋됨
- 활성 레이아웃 자동 로드 필요

---

## 5. Data Flow Summary

| Step | Component | Field | Value Type | Status |
|------|-----------|-------|------------|--------|
| Save Request | Frontend | equipment_id | scan_code | ✓ |
| Save DB | Backend | equipment_id | UUID | ✓ |
| Load DB | Backend | equipment_id | UUID | ✓ |
| Load Response | Backend | equipment_id | scan_code | ✓ |
| State Merge | Frontend | localPositions[scan_code] | Position | ✓ |
| **Auto Load** | Frontend | **활성 레이아웃 자동 적용** | **누락** | **X** |

---

## 6. Recommendations

1. **Critical Fix**: 페이지 로드 시 활성 레이아웃 자동 적용
2. **Enhancement**: 레이아웃 선택 시 명시적 로딩 상태 표시
3. **Code Quality**: equipment_id → scan_code 이름 변경 권장 (혼동 방지)

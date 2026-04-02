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

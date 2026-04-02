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

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

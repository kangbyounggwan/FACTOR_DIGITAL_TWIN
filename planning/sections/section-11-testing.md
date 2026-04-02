# Section 11: Testing and Finalization

**Status:** Pending
**Section ID:** 11
**Name:** testing

---

## Background

This section is the final phase of the FACTOR Digital Twin Editor CRUD and Layout Versioning implementation project. After completing two parallel implementation tracks (Track A: Layout Versioning, Track B: Entity CRUD) and their convergence through equipment CRUD and viewer integration, comprehensive end-to-end testing ensures all features work correctly individually and together.

### Project Context

The FACTOR Digital Twin system manages:
- **Companies** - Top-level organizational units
- **Factories** - Manufacturing facilities belonging to companies
- **Production Lines** - Manufacturing lines within factories
- **Equipment** - Machinery and devices on production lines
- **Layouts** - Versioned snapshots of equipment positions within factories

### Technology Stack
- **Frontend:** React, TypeScript, TailwindCSS, shadcn/ui, React Three Fiber (3D), React Query
- **Backend:** FastAPI (Python), Supabase (PostgreSQL)
- **Database:** PostgreSQL with UUID primary keys, CASCADE delete constraints

### Implementation Tracks Completed

**Track A - Layout Versioning (Sections 1-4):**
- Section 1: Database schema (`layouts`, `layout_equipment` tables)
- Section 2: Layout API endpoints (CRUD, activate, clone, compare)
- Section 3: React hooks for layout data
- Section 4: Layout UI components (selector, save dialog)

**Track B - Entity CRUD (Sections 5-8):**
- Section 5: CASCADE foreign key constraints
- Section 6: Company/Factory/Line CRUD APIs
- Section 7: React CRUD hooks
- Section 8: Admin page with entity dialogs

**Convergence (Sections 9-10):**
- Section 9: Equipment CRUD and clone functionality
- Section 10: Viewer integration with layout system

---

## Dependencies

| Dependency Type | Section | Description |
|-----------------|---------|-------------|
| **Requires** | Section 10 (Viewer Integration) | All features must be implemented before testing |
| **Requires** | Section 09 (Equipment CRUD) | Equipment add/clone/delete must be functional |
| **Requires** | Sections 01-08 | All foundation work must be complete |
| **Blocks** | None | This is the final section |

### Pre-requisites that MUST be complete before starting

**Database (verify via Supabase dashboard or SQL client):**
- [ ] `layouts` table exists with columns: id, factory_id, name, description, is_active, created_at, updated_at
- [ ] `layout_equipment` table exists with columns: id, layout_id, equipment_id, centroid_x/y/z, size_w/h/d
- [ ] `ensure_single_active_layout()` trigger is installed
- [ ] CASCADE delete constraints on: companies -> factories -> production_lines -> equipment_scans
- [ ] Helper functions exist: `count_company_children()`, `count_factory_children()`, `count_line_children()`

**Backend APIs (verify endpoints exist and return 200):**
- [ ] `GET /api/factories/{factory_id}/layouts` - List layouts
- [ ] `POST /api/factories/{factory_id}/layouts` - Create layout
- [ ] `GET /api/layouts/{layout_id}` - Get layout detail with equipment positions
- [ ] `PUT /api/layouts/{layout_id}` - Update layout name/description
- [ ] `DELETE /api/layouts/{layout_id}` - Delete layout
- [ ] `POST /api/layouts/{layout_id}/activate` - Activate layout
- [ ] `POST /api/layouts/{layout_id}/clone` - Clone layout
- [ ] `GET /api/layouts/{layout_id}/compare/{other_id}` - Compare layouts
- [ ] `POST /api/companies` - Create company
- [ ] `PUT /api/companies/{id}` - Update company
- [ ] `DELETE /api/companies/{id}` - Delete company (CASCADE)
- [ ] `GET /api/companies/{id}/delete-info` - Get delete impact
- [ ] `POST /api/factories` - Create factory
- [ ] `PUT /api/factories/{id}` - Update factory
- [ ] `DELETE /api/factories/{id}` - Delete factory (CASCADE)
- [ ] `GET /api/factories/{id}/delete-info` - Get delete impact
- [ ] `POST /api/lines` - Create line
- [ ] `PUT /api/lines/{id}` - Update line
- [ ] `DELETE /api/lines/{id}` - Delete line (CASCADE)
- [ ] `GET /api/lines/{id}/delete-info` - Get delete impact
- [ ] `POST /api/equipment` - Create equipment
- [ ] `DELETE /api/equipment/{id}` - Delete equipment
- [ ] `PATCH /api/equipment/{id}/position` - Update equipment position
- [ ] `POST /api/equipment/{id}/clone` - Clone equipment

**Frontend Pages (verify routes accessible):**
- [ ] `/admin` - Admin page with 3-column layout (Companies | Factories | Lines)
- [ ] `/editor` or `/layout-editor` - Layout editor page with layout selector
- [ ] `/factory/{code}` or `/view` - 3D/2D viewer page

**Frontend Components (verify components render):**
- [ ] `LayoutSelector` - Dropdown/list of layouts with activate/clone/delete actions
- [ ] `SaveLayoutDialog` - Dialog for saving new or updating existing layouts
- [ ] `EntityDialog` - Dialog for creating/editing companies, factories, lines
- [ ] `DeleteConfirmDialog` - Confirmation dialog showing cascade delete impact
- [ ] `LayoutCanvas` - 2D canvas with add-equipment mode support

---

## Requirements

When this section is complete, the following must be true:

1. **All layout features work end-to-end** - Create, read, update, delete, activate, clone layouts
2. **All CRUD features work end-to-end** - Full lifecycle for companies, factories, lines, equipment
3. **Viewer integration is functional** - Active layout positions load in both 3D and 2D views
4. **Error handling is robust** - API errors show user-friendly toast notifications
5. **Data integrity is maintained** - CASCADE deletes work correctly without orphaned records
6. **UI state is consistent** - Lists refresh after mutations, loading states show correctly
7. **No critical bugs remain** - All identified bugs have been fixed and verified

---

## Test Checklist

### A. Layout Versioning Tests

#### A1. Create New Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Layout Editor page | Page loads with 2D canvas showing equipment |
| 2 | Move some equipment to new positions | Equipment positions update visually |
| 3 | Click "Save Layout" or equivalent button | Save dialog appears |
| 4 | Enter name "Test Layout v1" and optional description | Form accepts input |
| 5 | Click Save/Create button | Toast shows "Layout saved", dialog closes |
| 6 | Open layout selector dropdown | "Test Layout v1" appears in list |

**Verification:**
- [ ] Layout appears in database `layouts` table
- [ ] Equipment positions saved in `layout_equipment` table
- [ ] Equipment count matches actual saved positions

#### A2. Update Existing Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select existing layout from dropdown | Layout loads, equipment snaps to saved positions |
| 2 | Move equipment to different positions | Visual update on canvas |
| 3 | Click "Update Layout" or "Save Changes" | Confirmation or direct save |
| 4 | Verify layout updated | Toast notification, same layout name retained |

**Verification:**
- [ ] `updated_at` timestamp changes in database
- [ ] Old equipment positions replaced with new ones

#### A3. Activate Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have at least 2 layouts for same factory | Both visible in selector |
| 2 | Layout A is currently active (check mark or indicator) | Visual indicator shows |
| 3 | Click "Activate" on Layout B | Layout B becomes active |
| 4 | Verify Layout A is no longer active | Only one active per factory |

**Verification:**
- [ ] Database trigger `ensure_single_active_layout` deactivates others
- [ ] Query: `SELECT * FROM layouts WHERE factory_id = ? AND is_active = true` returns 1 row

#### A4. Clone Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a layout with equipment | Layout loaded |
| 2 | Click "Clone" or "Duplicate" action | New layout created |
| 3 | New layout named "{original} (copy)" or similar | Name indicates copy |
| 4 | New layout is NOT active by default | `is_active = false` |

**Verification:**
- [ ] New layout has different ID
- [ ] Equipment positions copied exactly
- [ ] Equipment count matches original

#### A5. Delete Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a non-active layout | Layout highlighted |
| 2 | Click "Delete" action | Confirmation dialog appears |
| 3 | Confirm deletion | Layout removed, toast notification |
| 4 | Layout no longer in selector | List refreshes |

**Verification:**
- [ ] Layout removed from `layouts` table
- [ ] Associated `layout_equipment` records deleted (CASCADE)
- [ ] Cannot delete active layout (if enforced) or deleting active layout clears active state

#### A6. Layout Comparison
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch from Layout A to Layout B | Comparison info shown |
| 2 | Info shows: changed, added, removed counts | Numbers are accurate |

**Verification:**
- [ ] Compare API returns correct counts
- [ ] UI displays comparison summary

---

### B. Entity CRUD Tests

#### B1. Company CRUD
| Operation | Steps | Expected Result | Verify |
|-----------|-------|-----------------|--------|
| **Create** | Admin page > "Add Company" > Enter code "NEWCO", name "New Company" > Save | Company appears in list | [ ] Record in `companies` table |
| **Read** | View company list | All companies displayed with codes and names | [ ] List matches database |
| **Update** | Click edit on company > Change name to "Updated Company" > Save | Name updates in list | [ ] `name` column updated |
| **Delete** | Click delete on company with no children > Confirm | Company removed | [ ] Record deleted |
| **Delete with children** | Click delete on company with factories > See impact warning | Shows: "Will delete X factories, Y lines, Z equipment" | [ ] Counts from `count_company_children()` |
| **Cascade delete** | Confirm delete with children | All child records deleted | [ ] No orphan factories/lines/equipment |

#### B2. Factory CRUD
| Operation | Steps | Expected Result | Verify |
|-----------|-------|-----------------|--------|
| **Create** | Select company > "Add Factory" > Enter code, name, address > Save | Factory appears under company | [ ] Record in `factories` table |
| **Read** | Select company in admin page | Factories listed in middle column | [ ] Correct company_id filter |
| **Update** | Edit factory > Change address > Save | Address updates | [ ] `address` column updated |
| **Delete** | Delete factory with no lines > Confirm | Factory removed | [ ] Record deleted |
| **Delete with children** | Delete factory with lines > See impact | Shows line and equipment counts | [ ] Accurate counts |
| **Cascade delete** | Confirm delete with children | Lines and equipment deleted | [ ] No orphan records |

#### B3. Line CRUD
| Operation | Steps | Expected Result | Verify |
|-----------|-------|-----------------|--------|
| **Create** | Select factory > "Add Line" > Enter code, name, building, floor, area > Save | Line appears | [ ] Record in `production_lines` table |
| **Read** | Select factory in admin page | Lines listed in right column | [ ] Correct factory_id filter |
| **Update** | Edit line > Change floor > Save | Floor updates | [ ] `floor` column updated |
| **Delete** | Delete line with no equipment > Confirm | Line removed | [ ] Record deleted |
| **Delete with children** | Delete line with equipment > See impact | Shows equipment count | [ ] Accurate count |
| **Cascade delete** | Confirm delete with equipment | Equipment deleted | [ ] No orphan equipment |

---

### C. Equipment CRUD Tests

#### C1. Add Equipment via Canvas Click
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Layout Editor | 2D canvas visible |
| 2 | Enable "Add Equipment" mode (toolbar button) | Cursor changes or mode indicator shows |
| 3 | Click on canvas at desired position | Equipment appears at click location |
| 4 | Equipment has default size (1m x 1m x 1m) | Size reasonable for visualization |

**Verification:**
- [ ] Record created in `equipment_scans` table
- [ ] `scan_code` starts with "MANUAL_"
- [ ] `verified = true` (manual creation is pre-verified)
- [ ] Position matches click coordinates

#### C2. Add Equipment via Form
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Equipment" button (form mode) | Dialog appears |
| 2 | Fill in: position X, Y, Z, size W, H, D, optional note | Form accepts values |
| 3 | Click Create | Equipment added, dialog closes |

**Verification:**
- [ ] Record created with form values
- [ ] Equipment visible on canvas at specified position

#### C3. Delete Equipment
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select equipment on canvas | Equipment highlighted/selected |
| 2 | Click "Delete" button | Confirmation if implemented, or direct delete |
| 3 | Confirm (if applicable) | Equipment removed from canvas |

**Verification:**
- [ ] Record deleted from `equipment_scans` table
- [ ] If equipment was in saved layouts, `layout_equipment` entries also deleted (CASCADE)

#### C4. Clone Equipment
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select equipment | Equipment selected |
| 2 | Click "Clone" or "Duplicate" button | New equipment created |
| 3 | New equipment positioned at X + 1 meter offset | Offset prevents overlap |

**Verification:**
- [ ] New record in database
- [ ] `scan_code` starts with "CLONE_"
- [ ] Position: `centroid_x = original + 1.0`
- [ ] Size matches original
- [ ] Other properties (zone, note) copied

#### C5. Update Equipment Position/Size
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select equipment | Equipment selected |
| 2 | Drag to new position | Visual update |
| 3 | Release/confirm | Position saved |
| 4 | Resize handles (if available) | Size updates |

**Verification:**
- [ ] `PATCH /equipment/{id}/position` called
- [ ] Database values updated

---

### D. Viewer Integration Tests

#### D1. 3D Viewer with Active Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure a layout is active for a factory | Layout has `is_active = true` |
| 2 | Navigate to 3D viewer for that factory | Viewer loads |
| 3 | Equipment displayed at layout positions | Positions match saved layout |

**Verification:**
- [ ] Equipment coordinates match `layout_equipment` table
- [ ] Not using original `equipment_scans` positions

#### D2. 3D Viewer without Active Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Deactivate all layouts for a factory (or use factory with no layouts) | No active layout |
| 2 | Navigate to 3D viewer | Viewer loads |
| 3 | Equipment displayed at original positions | Uses `equipment_scans` positions |

**Verification:**
- [ ] Fallback to original positions works correctly

#### D3. 2D Editor Layout Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Layout Editor | Editor loads with layout selector |
| 2 | Select "Layout A" from dropdown | Equipment positions update to Layout A |
| 3 | Select "Layout B" from dropdown | Equipment positions update to Layout B |
| 4 | Select "No Layout" or "Original" | Equipment at original positions |

**Verification:**
- [ ] Switching layouts does not save changes
- [ ] "Unsaved changes" warning if positions modified before switch

#### D4. Navigation Integration
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Main navigation visible | Shows standard tabs |
| 2 | "Admin" or "Management" tab exists | Tab clickable |
| 3 | Click Admin tab | Navigates to `/admin` |
| 4 | Admin page loads correctly | 3-column layout visible |

**Verification:**
- [ ] Route defined in `App.tsx`
- [ ] Navigation component updated

---

### E. Error Handling Tests

#### E1. API Error Responses
| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| Network error | Disconnect network, try save | Toast: "Failed to save" or similar |
| 404 Not Found | Try to load deleted layout | Toast: "Layout not found" |
| 400 Bad Request | Submit invalid form data | Validation error shown |
| 500 Server Error | Backend throws exception | Toast: generic error message |

**Verification:**
- [ ] All API calls have try/catch
- [ ] Toast notifications appear for errors
- [ ] UI does not crash on errors

#### E2. Validation Tests
| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| Empty required field | Leave company name empty, submit | Form validation error |
| Duplicate code | Create company with existing code | Backend error, toast shown |
| Invalid numeric value | Enter "abc" for position X | Form validation prevents submit |

---

### F. Data Integrity Tests

#### F1. CASCADE Delete Verification
```sql
-- Run these queries before and after each cascade delete test

-- Before: Count child records
SELECT
  (SELECT COUNT(*) FROM factories WHERE company_id = '{id}') as factories,
  (SELECT COUNT(*) FROM production_lines WHERE factory_id IN
    (SELECT id FROM factories WHERE company_id = '{id}')) as lines,
  (SELECT COUNT(*) FROM equipment_scans WHERE line_id IN
    (SELECT id FROM production_lines WHERE factory_id IN
      (SELECT id FROM factories WHERE company_id = '{id}'))) as equipment;

-- After: All should be 0 for deleted company's children
```

#### F2. Single Active Layout Verification
```sql
-- This should always return 0 or 1 per factory
SELECT factory_id, COUNT(*) as active_count
FROM layouts
WHERE is_active = true
GROUP BY factory_id
HAVING COUNT(*) > 1;
-- Expected: No rows returned
```

#### F3. Orphan Record Check
```sql
-- Check for orphaned equipment positions
SELECT le.* FROM layout_equipment le
LEFT JOIN layouts l ON le.layout_id = l.id
WHERE l.id IS NULL;
-- Expected: No rows

-- Check for orphaned equipment
SELECT es.* FROM equipment_scans es
LEFT JOIN production_lines pl ON es.line_id = pl.id
WHERE pl.id IS NULL;
-- Expected: No rows
```

---

## Acceptance Criteria

Complete ALL items before marking this section done:

### Layout Features
- [ ] Create new layout with equipment positions
- [ ] Load existing layout and see equipment at saved positions
- [ ] Update layout name and description
- [ ] Update layout equipment positions (save changes)
- [ ] Activate layout (only one active per factory)
- [ ] Clone layout (creates copy with "(copy)" suffix)
- [ ] Delete layout (removes layout_equipment entries)
- [ ] Compare layouts shows changed/added/removed counts

### Entity CRUD Features
- [ ] Create company with code and name
- [ ] Update company name
- [ ] Delete company (CASCADE deletes children)
- [ ] Delete confirmation shows impacted record counts
- [ ] Create factory under company
- [ ] Update factory name/address
- [ ] Delete factory (CASCADE deletes lines/equipment)
- [ ] Create line under factory
- [ ] Update line properties
- [ ] Delete line (CASCADE deletes equipment)

### Equipment Features
- [ ] Add equipment via canvas click (add mode)
- [ ] Add equipment via form dialog
- [ ] Delete selected equipment
- [ ] Clone equipment (X + 1m offset)
- [ ] Update equipment position via drag (if implemented)
- [ ] Update equipment size (if implemented)

### Viewer Integration
- [ ] 3D viewer uses active layout positions
- [ ] 3D viewer falls back to original positions if no active layout
- [ ] 2D editor loads selected layout positions
- [ ] Switching layouts in editor updates canvas
- [ ] Navigation includes Admin tab
- [ ] Admin route (/admin) works

### Error Handling
- [ ] API errors show toast notifications
- [ ] Form validation prevents invalid submissions
- [ ] Network errors handled gracefully
- [ ] UI does not crash on errors

### Data Integrity
- [ ] CASCADE deletes remove all child records
- [ ] Only one active layout per factory (trigger works)
- [ ] No orphaned records after deletions
- [ ] Layout equipment positions saved correctly

---

## Bug Fix Procedures

### How to Report a Bug

Create an entry in this format:

```
### Bug #[number]: [Short description]

**Status:** Open / In Progress / Fixed / Verified
**Severity:** Critical / High / Medium / Low
**Found in:** Section [X] / Test [Y]

**Steps to Reproduce:**
1. Step one
2. Step two
3. ...

**Expected Result:**
What should happen

**Actual Result:**
What actually happens

**Root Cause:** (fill after investigation)
Brief explanation of why bug occurred

**Fix Applied:** (fill after fixing)
Brief description of code change

**Files Modified:**
- path/to/file.ts
- ...

**Verified By:** [Name/Date]
```

### Bug Severity Definitions

| Severity | Definition | Response |
|----------|------------|----------|
| **Critical** | System unusable, data loss, security issue | Fix immediately, block release |
| **High** | Major feature broken, no workaround | Fix before testing completion |
| **Medium** | Feature partially broken, workaround exists | Fix if time permits |
| **Low** | Minor issue, cosmetic, edge case | Document, fix in future |

### Bug Tracking Section

#### Bug #1: [Template - Delete this when adding real bugs]

**Status:** Open
**Severity:** Medium
**Found in:** Test A1

**Steps to Reproduce:**
1. Navigate to Layout Editor
2. ...

**Expected Result:**
Layout saves successfully

**Actual Result:**
Error message appears

**Root Cause:** TBD

**Fix Applied:** TBD

**Files Modified:**
- TBD

**Verified By:** TBD

---

## Common Issues and Solutions

### Issue: Layout not saving
**Possible causes:**
- API endpoint not registered in router
- Missing required fields in request body
- Database constraint violation

**Debug steps:**
1. Check browser Network tab for API response
2. Check backend logs for errors
3. Verify request payload matches schema

### Issue: CASCADE delete not working
**Possible causes:**
- Foreign key constraint not set to CASCADE
- Migration not applied

**Debug steps:**
1. Check FK constraints: `\d+ table_name` in psql
2. Verify migration was run
3. Re-run migration if needed

### Issue: Single active layout trigger not firing
**Possible causes:**
- Trigger not created
- Function syntax error
- Trigger dropped during migration

**Debug steps:**
1. List triggers: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_single_active_layout';`
2. Test function manually
3. Re-create trigger if missing

### Issue: Equipment positions not loading from layout
**Possible causes:**
- Active layout query incorrect
- Layout ID not passed to equipment hook
- Position merge logic error

**Debug steps:**
1. Verify active layout query returns correct layout
2. Check useFactoryEquipment hook receives layoutId
3. Console.log position merge logic

### Issue: Admin page not routing
**Possible causes:**
- Route not added to App.tsx
- Path typo
- Component import error

**Debug steps:**
1. Check React Router configuration
2. Verify import path
3. Check for console errors

---

## Testing Environment Setup

### Required Test Data

Before testing, ensure the database has:

1. **At least 2 companies** - For testing company CRUD
2. **At least 2 factories per company** - For testing factory CRUD and cross-factory isolation
3. **At least 2 lines per factory** - For testing line CRUD
4. **At least 5 equipment per line** - For meaningful layout testing
5. **At least 2 layouts per factory** - For testing activate/compare/switch

### Sample Test Data SQL

```sql
-- Insert test company if not exists
INSERT INTO companies (code, name)
VALUES ('TEST01', 'Test Company 1')
ON CONFLICT (code) DO NOTHING;

-- Insert test factory
INSERT INTO factories (company_id, code, name, address)
SELECT id, 'FACT01', 'Test Factory 1', '123 Test Street'
FROM companies WHERE code = 'TEST01'
ON CONFLICT (code) DO NOTHING;

-- Insert test line
INSERT INTO production_lines (factory_id, code, name, building, floor, area)
SELECT id, 'LINE01', 'Test Line 1', 'Building A', 1, 'Assembly'
FROM factories WHERE code = 'FACT01'
ON CONFLICT (code) DO NOTHING;

-- Insert test equipment
INSERT INTO equipment_scans (line_id, scan_code, centroid_x, centroid_y, centroid_z, size_w, size_h, size_d, verified)
SELECT pl.id, 'EQ' || generate_series(1,5)::text,
       random() * 10, random() * 10, 0,
       1, 1, 1, true
FROM production_lines pl WHERE pl.code = 'LINE01';
```

### Browser DevTools Checklist

During testing, keep these DevTools tabs ready:

1. **Console** - Watch for JavaScript errors
2. **Network** - Monitor API calls and responses
3. **Application > Local Storage** - Check cached data if applicable
4. **React DevTools** - Inspect component state (install extension)

---

## Sign-off

### Pre-Testing Checklist
- [ ] All Section 1-10 marked complete
- [ ] Backend server running without errors
- [ ] Frontend dev server running without errors
- [ ] Database migrations applied
- [ ] Test data populated
- [ ] Browser DevTools ready

### Post-Testing Checklist
- [ ] All acceptance criteria checked
- [ ] All critical and high bugs fixed
- [ ] Bug fixes verified
- [ ] No regressions introduced
- [ ] Documentation updated if needed

### Final Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA/Tester | | | |
| Project Lead | | | |

---

## Related Files

**Backend:**
- `backend/migrations/003_layouts.sql` - Layout schema
- `backend/migrations/004_cascade_fk.sql` - CASCADE constraints
- `backend/app/api/endpoints/layouts.py` - Layout API
- `backend/app/api/endpoints/companies.py` - Company CRUD
- `backend/app/api/endpoints/factories.py` - Factory CRUD
- `backend/app/api/endpoints/lines.py` - Line CRUD
- `backend/app/api/endpoints/equipment.py` - Equipment CRUD

**Frontend:**
- `frontend/src/pages/AdminPage.tsx` - Admin page
- `frontend/src/pages/LayoutEditorPage.tsx` - Layout editor
- `frontend/src/pages/FactoryLinePage.tsx` - 3D viewer
- `frontend/src/components/LayoutSelector.tsx` - Layout dropdown
- `frontend/src/components/SaveLayoutDialog.tsx` - Save dialog
- `frontend/src/components/EntityDialog.tsx` - Entity create/edit
- `frontend/src/components/DeleteConfirmDialog.tsx` - Delete confirmation
- `frontend/src/components/LayoutCanvas.tsx` - 2D canvas
- `frontend/src/hooks/useLayouts.ts` - Layout hooks
- `frontend/src/hooks/useCrud.ts` - CRUD hooks
- `frontend/src/hooks/useEquipmentCrud.ts` - Equipment hooks
- `frontend/src/hooks/useFactoryEquipment.ts` - Equipment with layout integration
- `frontend/src/lib/api.ts` - API functions
- `frontend/src/App.tsx` - Routes
- `frontend/src/components/Navigation.tsx` - Navigation tabs

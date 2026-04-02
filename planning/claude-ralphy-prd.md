# PRD: Layout Save/Load Bug Fix

## Overview

**Project**: FACTOR Digital Twin
**Issue**: Layout Save/Load Bug
**Created**: 2026-04-01
**Status**: Ready for Implementation

---

## How to Use

Execute this PRD with the Ralphy CLI:

```bash
ralphy --prd planning/claude-ralphy-prd.md
```

Ralphy will process each section in dependency order and track completion status.

---

## Context

### Problem Statement

The FACTOR Digital Twin layout editor has a critical bug: when a user selects a saved layout from the dropdown, the stored equipment positions are NOT applied to the canvas. Equipment remains at default positions instead of the layout-specific positions.

### Impact

- Layout versioning feature is non-functional
- Users cannot compare different factory floor configurations
- Saved layout work is lost when reloading

### Solution Approach

1. **Debug Backend** (Section 01): Verify API returns correct data format
2. **Debug Frontend** (Section 02): Trace state flow to identify failure point
3. **Implement Fix** (Section 03): Apply fix based on diagnosis
4. **Verify Fix** (Section 04): Manual testing to confirm resolution

### Dependency Graph

```
01-backend-debug  ──┐
                    ├──▶ 03-bug-fix ──▶ 04-testing
02-frontend-debug ──┘
```

Sections 01 and 02 can execute in parallel.

---

## Section Files

All section details are located in:

```
planning/sections/
```

### Section Index

Reference: `planning/sections/index.md`

Contains:
- SECTION_MANIFEST
- Dependency graph
- Execution order
- Section summaries
- Overall acceptance criteria

---

## Task Checklist

Complete each section in dependency order. Check off when ALL acceptance criteria in the section file are met.

- [ ] Section 01: Backend API Debug
  - File: `planning/sections/section-01-backend-debug.md`
  - Priority: Critical
  - Depends on: None
  - Blocks: Section 03

- [ ] Section 02: Frontend State Debug
  - File: `planning/sections/section-02-frontend-debug.md`
  - Priority: Critical
  - Depends on: None
  - Blocks: Section 03

- [ ] Section 03: Bug Fix Implementation
  - File: `planning/sections/section-03-bug-fix.md`
  - Priority: Critical
  - Depends on: Sections 01, 02
  - Blocks: Section 04

- [ ] Section 04: Testing and Verification
  - File: `planning/sections/section-04-testing.md`
  - Priority: High
  - Depends on: Section 03
  - Blocks: None

---

## Completion Criteria

All sections are complete when:

1. All 4 section checkboxes above are checked
2. Each section's internal acceptance criteria are fully met
3. Layout selection immediately applies saved positions to canvas
4. Save/reload cycle preserves all positions correctly
5. No console errors during layout operations

---

## Key Files Reference

### Backend
- `backend/app/api/layouts.py` - Layout CRUD endpoints

### Frontend
- `frontend/src/pages/LayoutEditorPage.tsx` - Main editor component
- `frontend/src/lib/api.ts` - API client
- `frontend/src/components/LayoutCanvas.tsx` - Canvas rendering

---

## Notes

- Sections 01 and 02 add debug logging (temporary, remove after fix)
- Section 03 implementation depends on diagnosis from 01 and 02
- Section 04 is manual testing only (no code changes)

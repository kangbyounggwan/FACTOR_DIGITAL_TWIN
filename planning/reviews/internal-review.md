# Internal Plan Review

Generated: 2026-04-01

---

## Review Context

External LLM review tools (Gemini CLI, Codex CLI) were not available in this environment. This internal review provides an objective analysis of the implementation plan.

---

## Strengths

### 1. Clear Section Dependencies
The plan explicitly maps dependencies between sections, enabling parallel work streams:
- Progress tracking (1-2) independent of point cloud (3-4)
- Editing infrastructure (5-6) provides foundation for features (7-8-9)

### 2. Appropriate Technology Choices
- Zustand for editing state: lightweight, integrates well with R3F
- FastAPI BackgroundTasks: matches user's complexity preference
- React Query for data fetching: standard approach for mutations

### 3. Realistic Scope
Plan correctly excludes:
- Equipment merge (not requested)
- Celery migration
- Docker/Cloud deployment
- anomaly-eye-monitor integration

### 4. Performance Awareness
- LOD implementation for point clouds
- Instanced rendering for equipment boxes
- On-demand rendering frame loop
- Resource disposal patterns

---

## Concerns & Recommendations

### 1. In-Memory Progress Store
**Issue:** `_job_progress` dict is process-local. If FastAPI runs with multiple workers, progress may be lost.

**Recommendation:** For single-worker dev environment this is fine. Document this limitation. Consider SQLite/Redis for multi-worker.

### 2. Point Cloud JSON Serialization
**Issue:** Sending 500K points as JSON arrays could be slow and memory-intensive.

**Recommendation:** Consider:
- Binary format (ArrayBuffer) for positions/colors
- WebSocket streaming for large point clouds
- Progressive loading (first 100K, then rest)

### 3. Split Operation Atomicity
**Issue:** Split creates new equipment entries and marks original as superseded. Partial failure could leave inconsistent state.

**Recommendation:** Wrap in database transaction. Return both new IDs or rollback entirely.

### 4. Undo/Redo Backend Sync
**Issue:** Frontend tracks undo/redo but backend changes are permanent. True undo would require backend support.

**Recommendation:** Clarify that undo/redo is UI-only until changes are "applied". Add explicit "Apply Changes" and "Discard Changes" buttons.

### 5. Box Selection in 3D
**Issue:** 2D box selection on 3D scene is ambiguous. Which points are "inside" depends on camera angle.

**Recommendation:** Consider:
- Camera-aligned frustum selection
- 3D box widget (wie Blender)
- Lasso selection on screen-space projected points

---

## Missing Elements

### 1. Error Handling Details
Plan mentions error handling but lacks specifics:
- What happens if split fails mid-operation?
- How to handle PLY download failures?
- Progress endpoint when job not found?

### 2. Loading States
UI should show loading states:
- Point cloud loading (can be seconds)
- Split operation in progress
- Selection applying

### 3. Mobile/Touch Consideration
If future tablet use is expected, touch interactions differ from mouse. Current plan is mouse-focused.

---

## Priority Adjustments

### High Value, Lower Risk (Do First)
1. Section 1-2: Progress tracking - high visibility, low complexity
2. Section 3-4: Point cloud toggle - major UX improvement
3. Section 10: Performance - foundational

### Higher Risk (More Careful)
1. Section 7: Split feature - complex 3D interaction
2. Section 8-9: Selection - state management complexity

---

## Conclusion

The plan is well-structured and appropriate for the scope. Key risks are around point cloud data transfer efficiency and undo/redo semantics. Recommend addressing the JSON serialization concern in Section 3 before implementation.

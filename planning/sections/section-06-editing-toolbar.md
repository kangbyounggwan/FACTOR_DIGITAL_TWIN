# Section 06: Editing Toolbar UI

**Status:** Pending
**Estimated Effort:** 3-4 hours

---

## Background

The FACTOR Digital Twin equipment registration system is being enhanced with editing capabilities (Phase 2). Users need the ability to split equipment, select points, and undo/redo their changes. This section implements the toolbar UI that provides access to these editing tools.

The toolbar serves as the primary interface for equipment editing operations. It displays tool buttons (split, select), undo/redo controls, and pending changes indicators. The toolbar integrates with the Zustand editing store (Section 05) and enables the split and selection features (Sections 07, 08).

**Key Design Decision:** Undo/redo operates on *pending changes* only. Changes are not persisted to the backend until the user explicitly clicks "Apply Changes". This prevents accidental data modification and allows true undo/redo behavior.

---

## Dependencies

### Requires (must be completed first)
- **Section 05: Equipment Editing State (Zustand)** - The toolbar depends on the editing store for:
  - `activeTool` state and `setActiveTool()` action
  - `undo()` and `redo()` actions
  - `canUndo()` and `canRedo()` computed values
  - `history` and `historyIndex` for pending changes detection

### Blocks (cannot start until this section is complete)
- **Section 07: Equipment Split Feature** - Needs toolbar to activate split tool
- **Section 08: Box Selection Feature** - Needs toolbar to activate box_select tool

---

## Requirements

When this section is complete, the following must be true:

1. An editing toolbar is visible on the Registry page
2. Split tool button toggles the `activeTool` state to/from 'split'
3. Selection tool button toggles the `activeTool` state to/from 'box_select'
4. Active tool is visually highlighted (different button variant)
5. Undo button is disabled when `canUndo()` returns false
6. Redo button is disabled when `canRedo()` returns false
7. Undo/Redo buttons trigger respective store actions
8. Ctrl+Z keyboard shortcut triggers undo
9. Ctrl+Y keyboard shortcut triggers redo
10. Pending changes indicator appears when `historyIndex >= 0`
11. "Cancel" button discards pending changes
12. "Apply" button commits pending changes (placeholder for Section 09)

---

## Implementation Details

### File 1: EditingToolbar.tsx (NEW)

**Path:** `frontend/src/components/EditingToolbar.tsx`

```tsx
// components/EditingToolbar.tsx
import { useEditingStore } from '@/stores/useEditingStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Scissors, Square, Undo, Redo } from 'lucide-react'

export default function EditingToolbar() {
  const {
    activeTool, setActiveTool,
    undo, redo, canUndo, canRedo,
    history, historyIndex,
    clearHistory
  } = useEditingStore()

  const hasPendingChanges = historyIndex >= 0

  const discardChanges = () => {
    // Reset history and clear all pending operations
    clearHistory()
  }

  const applyChanges = () => {
    // Placeholder: Will be implemented in Section 09
    // This will call the backend to persist changes
    console.log('Apply changes - to be implemented in Section 09')
  }

  return (
    <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
      {/* Split Tool */}
      <Button
        variant={activeTool === 'split' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setActiveTool(activeTool === 'split' ? null : 'split')}
        title="분할 도구 (Split Tool)"
      >
        <Scissors className="h-4 w-4 mr-1" /> 분할
      </Button>

      {/* Box Selection Tool */}
      <Button
        variant={activeTool === 'box_select' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setActiveTool(activeTool === 'box_select' ? null : 'box_select')}
        title="선택 도구 (Selection Tool)"
      >
        <Square className="h-4 w-4 mr-1" /> 선택
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Undo */}
      <Button
        variant="ghost"
        size="icon"
        disabled={!canUndo()}
        onClick={undo}
        title="실행 취소 (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Button>

      {/* Redo */}
      <Button
        variant="ghost"
        size="icon"
        disabled={!canRedo()}
        onClick={redo}
        title="다시 실행 (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Pending changes indicator + actions */}
      {hasPendingChanges && (
        <>
          <Badge variant="outline" className="text-warning border-warning">
            변경사항 대기 중
          </Badge>
          <Button variant="outline" size="sm" onClick={discardChanges}>
            취소
          </Button>
          <Button size="sm" onClick={applyChanges}>
            적용
          </Button>
        </>
      )}

      {/* No pending changes state */}
      {!hasPendingChanges && (
        <span className="text-sm text-muted-foreground">
          변경사항 없음
        </span>
      )}
    </div>
  )
}
```

### File 2: useEditingKeyboard.ts (NEW)

**Path:** `frontend/src/hooks/useEditingKeyboard.ts`

```typescript
// hooks/useEditingKeyboard.ts
import { useEffect } from 'react'
import { useEditingStore } from '@/stores/useEditingStore'

export function useEditingKeyboard() {
  const { undo, redo, canUndo, canRedo } = useEditingStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Check for Ctrl+Z (undo)
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) undo()
      }
      // Check for Ctrl+Y (redo)
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        if (canRedo()) redo()
      }
      // Also support Ctrl+Shift+Z for redo (common alternative)
      if (e.ctrlKey && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        if (canRedo()) redo()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, canUndo, canRedo])
}
```

### File 3: RegistryPage.tsx (MODIFY)

**Path:** `frontend/src/pages/RegistryPage.tsx`

Add the following modifications:

1. Import the new components:
```typescript
import EditingToolbar from '@/components/EditingToolbar'
import { useEditingKeyboard } from '@/hooks/useEditingKeyboard'
```

2. Call the keyboard hook inside the component:
```typescript
export default function RegistryPage() {
  // ... existing code ...

  // Enable keyboard shortcuts for editing
  useEditingKeyboard()

  // ... rest of component ...
}
```

3. Add the toolbar to the page layout (positioned above the 3D view):
```tsx
return (
  <div className="flex flex-col h-full">
    {/* Toolbar area */}
    <div className="flex items-center justify-between p-4 border-b">
      {/* View mode toggle (from Section 04) */}
      {/* ... */}

      {/* Editing toolbar */}
      <EditingToolbar />
    </div>

    {/* 3D Scene area */}
    <div className="flex-1">
      <Scene3D ... />
    </div>

    {/* ... rest of page ... */}
  </div>
)
```

### File 4: useEditingStore.ts (MODIFY)

**Path:** `frontend/src/stores/useEditingStore.ts`

Add the `clearHistory` action to the store (should already be partially implemented from Section 05):

```typescript
interface EditingStore {
  // ... existing interface ...

  // Add this if not present
  clearHistory: () => void
}

export const useEditingStore = create<EditingStore>((set, get) => ({
  // ... existing implementation ...

  clearHistory: () => set({
    history: [],
    historyIndex: -1,
    splitPlane: null,
    selectedPoints: new Set()
  }),
}))
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/components/EditingToolbar.tsx` | CREATE | Main toolbar component with tool buttons, undo/redo, pending changes indicator |
| `frontend/src/hooks/useEditingKeyboard.ts` | CREATE | Keyboard shortcut handler for Ctrl+Z/Y |
| `frontend/src/pages/RegistryPage.tsx` | MODIFY | Import and render EditingToolbar, call useEditingKeyboard hook |
| `frontend/src/stores/useEditingStore.ts` | MODIFY | Add clearHistory action if not present |

---

## UI Components Required

The toolbar uses the following shadcn/ui components (should already be installed):

- `Button` - Tool buttons and action buttons
- `Separator` - Visual divider between button groups
- `Badge` - Pending changes indicator

The toolbar uses the following lucide-react icons:

- `Scissors` - Split tool icon
- `Square` - Box selection tool icon
- `Undo` - Undo button icon
- `Redo` - Redo button icon

---

## Acceptance Criteria

- [ ] EditingToolbar component created and renders correctly
- [ ] Toolbar displays on RegistryPage above 3D view
- [ ] Split tool button toggles active state (visual highlight when active)
- [ ] Selection tool button toggles active state (visual highlight when active)
- [ ] Only one tool can be active at a time (clicking one deactivates the other)
- [ ] Clicking active tool deactivates it (returns to null)
- [ ] Undo button is disabled when no operations in history
- [ ] Redo button is disabled when at end of history
- [ ] Undo button enabled after an operation is pushed to history
- [ ] Redo button enabled after undo is performed
- [ ] Clicking Undo calls store's undo() action
- [ ] Clicking Redo calls store's redo() action
- [ ] Ctrl+Z keyboard shortcut triggers undo
- [ ] Ctrl+Y keyboard shortcut triggers redo
- [ ] Ctrl+Shift+Z keyboard shortcut triggers redo (alternative)
- [ ] "변경사항 대기 중" badge appears when historyIndex >= 0
- [ ] "취소" button appears when pending changes exist
- [ ] "적용" button appears when pending changes exist
- [ ] "취소" button clears history and pending state
- [ ] "변경사항 없음" text shows when no pending changes
- [ ] Toolbar styling matches application theme

---

## Testing Checklist

### Manual Testing

1. **Tool Activation**
   - Open Registry page
   - Click "분할" button - should highlight
   - Click "선택" button - should highlight, "분할" should unhighlight
   - Click active tool again - should deactivate

2. **Undo/Redo Buttons**
   - Initially both should be disabled
   - Trigger an operation (from Section 07/08 when available, or manually push to history in dev tools)
   - Undo button should enable
   - Click Undo - Redo should enable, Undo may disable
   - Click Redo - should restore state

3. **Keyboard Shortcuts**
   - Press Ctrl+Z - should trigger undo (when available)
   - Press Ctrl+Y - should trigger redo (when available)
   - Press Ctrl+Shift+Z - should trigger redo (when available)

4. **Pending Changes Indicator**
   - Initially should show "변경사항 없음"
   - After operation, should show badge and buttons
   - Click "취소" - should clear and show "변경사항 없음"

### Integration Testing

Once Sections 07 and 08 are complete:
- Verify split tool activates split mode in 3D view
- Verify selection tool activates box select mode in 3D view
- Verify operations from tools appear in history
- Verify undo/redo correctly reverses operations

---

## Notes for Implementer

1. **Zustand Store Dependency**: Ensure Section 05 is complete and the useEditingStore is properly exported. The store should have all the required state and actions.

2. **Styling**: The toolbar uses Tailwind classes. Adjust spacing and colors as needed to match the existing application theme.

3. **Korean Labels**: The UI uses Korean labels as shown in the plan:
   - 분할 = Split
   - 선택 = Select
   - 변경사항 대기 중 = Changes pending
   - 취소 = Cancel
   - 적용 = Apply
   - 변경사항 없음 = No changes

4. **Apply Button Placeholder**: The `applyChanges` function is a placeholder. The actual implementation will be completed in Section 09 (Apply Selection Changes).

5. **Keyboard Event Handling**: The keyboard hook is designed to work globally on the window. Ensure no other components prevent event propagation that would block these shortcuts.

6. **History Index Logic**:
   - `historyIndex = -1` means no operations have been performed
   - `historyIndex >= 0` means there are pending changes
   - This is why we check `historyIndex >= 0` for hasPendingChanges

7. **Accessibility**: Consider adding ARIA labels and keyboard focus indicators for accessibility compliance in production.

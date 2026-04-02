# Section 05: Equipment Editing State (Zustand)

Generated: 2026-04-01

---

## Background

The FACTOR Digital Twin equipment registration system currently has no editing capabilities. Users can view equipment in the 3D scene but cannot modify, split, or select points within equipment point clouds.

This section implements the foundational state management layer for all editing features using Zustand. The editing store manages:
- Active tool state (which editing tool is currently selected)
- Operation history (for undo/redo support)
- Split plane configuration
- Point selection state

**Key Design Decision:** Undo/redo operates on *pending changes* only. Changes are not persisted to the backend until the user explicitly clicks "Apply Changes". This prevents accidental data modification and allows true undo/redo behavior within a single editing session.

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| Requires | None | This section has no dependencies |
| Blocks | Section 06 (Editing Toolbar UI) | The toolbar requires this store to function |

---

## Requirements

When this section is complete, the following must be true:

1. A Zustand store exists at `frontend/src/stores/useEditingStore.ts`
2. The store manages active tool state (select, split, box_select, or null)
3. The store maintains an operation history stack
4. Undo/redo functions correctly navigate the history stack
5. The store tracks split plane configuration (point + normal vector)
6. The store tracks selected point indices as a Set
7. The store is importable and usable from any React component

---

## Implementation Details

### File to Create

**Path:** `frontend/src/stores/useEditingStore.ts`

### Type Definitions

```typescript
type OperationType = 'split' | 'select_points' | 'exclude_points'

interface Operation {
  type: OperationType
  equipmentId: string
  data: any
  timestamp: number
}

interface EditingStore {
  // Tool state
  activeTool: 'select' | 'split' | 'box_select' | null
  setActiveTool: (tool: EditingStore['activeTool']) => void

  // History
  history: Operation[]
  historyIndex: number

  // Actions
  pushOperation: (op: Omit<Operation, 'timestamp'>) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Split state
  splitPlane: { point: [number, number, number], normal: [number, number, number] } | null
  setSplitPlane: (plane: EditingStore['splitPlane']) => void

  // Selection state
  selectedPoints: Set<number>
  addToSelection: (indices: number[]) => void
  removeFromSelection: (indices: number[]) => void
  clearSelection: () => void
}
```

### Full Implementation

```typescript
// stores/useEditingStore.ts
import { create } from 'zustand'

type OperationType = 'split' | 'select_points' | 'exclude_points'

interface Operation {
  type: OperationType
  equipmentId: string
  data: any
  timestamp: number
}

interface EditingStore {
  // Tool state
  activeTool: 'select' | 'split' | 'box_select' | null
  setActiveTool: (tool: EditingStore['activeTool']) => void

  // History
  history: Operation[]
  historyIndex: number

  // Actions
  pushOperation: (op: Omit<Operation, 'timestamp'>) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Split state
  splitPlane: { point: [number, number, number], normal: [number, number, number] } | null
  setSplitPlane: (plane: EditingStore['splitPlane']) => void

  // Selection state
  selectedPoints: Set<number>
  addToSelection: (indices: number[]) => void
  removeFromSelection: (indices: number[]) => void
  clearSelection: () => void
}

export const useEditingStore = create<EditingStore>((set, get) => ({
  // Tool state
  activeTool: null,
  setActiveTool: (tool) => set({ activeTool: tool }),

  // History
  history: [],
  historyIndex: -1,

  pushOperation: (op) => set(state => {
    // Clear future history if we're not at the end
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push({ ...op, timestamp: Date.now() })
    return {
      history: newHistory,
      historyIndex: newHistory.length - 1
    }
  }),

  undo: () => set(state => {
    if (state.historyIndex < 0) return state
    return { historyIndex: state.historyIndex - 1 }
  }),

  redo: () => set(state => {
    if (state.historyIndex >= state.history.length - 1) return state
    return { historyIndex: state.historyIndex + 1 }
  }),

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // Split state
  splitPlane: null,
  setSplitPlane: (plane) => set({ splitPlane: plane }),

  // Selection state
  selectedPoints: new Set(),
  addToSelection: (indices) => set(state => ({
    selectedPoints: new Set([...state.selectedPoints, ...indices])
  })),
  removeFromSelection: (indices) => set(state => {
    const next = new Set(state.selectedPoints)
    indices.forEach(i => next.delete(i))
    return { selectedPoints: next }
  }),
  clearSelection: () => set({ selectedPoints: new Set() }),
}))
```

### Usage Examples

**Accessing tool state in a component:**
```typescript
import { useEditingStore } from '@/stores/useEditingStore'

function MyComponent() {
  const activeTool = useEditingStore(state => state.activeTool)
  const setActiveTool = useEditingStore(state => state.setActiveTool)

  return (
    <button onClick={() => setActiveTool('split')}>
      Activate Split Tool
    </button>
  )
}
```

**Using undo/redo:**
```typescript
function UndoRedoButtons() {
  const { undo, redo, canUndo, canRedo } = useEditingStore()

  return (
    <>
      <button disabled={!canUndo()} onClick={undo}>Undo</button>
      <button disabled={!canRedo()} onClick={redo}>Redo</button>
    </>
  )
}
```

**Pushing an operation to history:**
```typescript
const { pushOperation } = useEditingStore()

pushOperation({
  type: 'split',
  equipmentId: 'eq-123',
  data: {
    newIds: ['eq-123_A', 'eq-123_B'],
    plane: { point: [0, 0, 0], normal: [1, 0, 0] }
  }
})
```

---

## History Stack Behavior

The history implementation follows standard undo/redo conventions:

1. **Initial state:** `history = []`, `historyIndex = -1`
2. **After first operation:** `history = [op1]`, `historyIndex = 0`
3. **After second operation:** `history = [op1, op2]`, `historyIndex = 1`
4. **After undo:** `historyIndex = 0` (op2 still in history)
5. **After new operation (while undone):** `history = [op1, op3]`, `historyIndex = 1` (op2 discarded)

This "branching" behavior matches user expectations from applications like Photoshop or text editors.

### Memory Management Note

To prevent memory bloat from accumulating too many operations, downstream code should limit history to approximately 50 operations. This can be enforced in `pushOperation` or periodically cleaned up.

---

## Files to Create/Modify

| Action | Path | Description |
|--------|------|-------------|
| Create | `frontend/src/stores/useEditingStore.ts` | Zustand store for editing state |

---

## Prerequisites Check

Before implementing, verify:

1. Zustand is installed in the frontend project:
   ```bash
   cd frontend && npm list zustand
   ```
   If not installed:
   ```bash
   npm install zustand
   ```

2. The `frontend/src/stores/` directory exists (create if needed)

---

## Acceptance Criteria

- [ ] File `frontend/src/stores/useEditingStore.ts` exists
- [ ] Zustand store is created and exports `useEditingStore` hook
- [ ] `activeTool` state can be set to 'select', 'split', 'box_select', or null
- [ ] `setActiveTool` updates the active tool state
- [ ] `pushOperation` adds operations to history with timestamp
- [ ] `pushOperation` clears future history when adding new operation after undo
- [ ] `undo` decrements `historyIndex` (minimum -1)
- [ ] `redo` increments `historyIndex` (maximum history.length - 1)
- [ ] `canUndo()` returns true when `historyIndex >= 0`
- [ ] `canRedo()` returns true when `historyIndex < history.length - 1`
- [ ] `splitPlane` can be set to a point/normal object or null
- [ ] `selectedPoints` is a Set<number>
- [ ] `addToSelection` adds indices to the Set
- [ ] `removeFromSelection` removes indices from the Set
- [ ] `clearSelection` empties the Set
- [ ] Store is importable from other components without errors

---

## Testing Approach

### Manual Testing

1. Import the store in a test component
2. Verify tool state changes reflect in the store
3. Add multiple operations and test undo/redo sequence
4. Verify branching behavior (new op after undo clears future)

### Unit Tests (Optional)

```typescript
// __tests__/useEditingStore.test.ts
import { useEditingStore } from '@/stores/useEditingStore'

describe('useEditingStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useEditingStore.setState({
      activeTool: null,
      history: [],
      historyIndex: -1,
      splitPlane: null,
      selectedPoints: new Set(),
    })
  })

  test('setActiveTool updates tool state', () => {
    const { setActiveTool } = useEditingStore.getState()
    setActiveTool('split')
    expect(useEditingStore.getState().activeTool).toBe('split')
  })

  test('pushOperation adds to history', () => {
    const { pushOperation } = useEditingStore.getState()
    pushOperation({ type: 'split', equipmentId: 'eq-1', data: {} })

    const state = useEditingStore.getState()
    expect(state.history.length).toBe(1)
    expect(state.historyIndex).toBe(0)
  })

  test('undo/redo navigates history', () => {
    const { pushOperation, undo, redo } = useEditingStore.getState()

    pushOperation({ type: 'split', equipmentId: 'eq-1', data: {} })
    pushOperation({ type: 'split', equipmentId: 'eq-2', data: {} })

    expect(useEditingStore.getState().historyIndex).toBe(1)

    undo()
    expect(useEditingStore.getState().historyIndex).toBe(0)

    redo()
    expect(useEditingStore.getState().historyIndex).toBe(1)
  })

  test('new operation after undo clears future', () => {
    const { pushOperation, undo } = useEditingStore.getState()

    pushOperation({ type: 'split', equipmentId: 'eq-1', data: {} })
    pushOperation({ type: 'split', equipmentId: 'eq-2', data: {} })

    undo()

    pushOperation({ type: 'split', equipmentId: 'eq-3', data: {} })

    const state = useEditingStore.getState()
    expect(state.history.length).toBe(2) // eq-1 and eq-3
    expect(state.history[1].equipmentId).toBe('eq-3')
  })
})
```

---

## Downstream Dependencies

After completing this section, **Section 06 (Editing Toolbar UI)** can begin. The toolbar will:
- Use `activeTool` and `setActiveTool` to display and change the current tool
- Use `undo`, `redo`, `canUndo`, `canRedo` for undo/redo buttons
- Display pending changes indicator based on history state

---

## Troubleshooting

**Issue:** Store state not updating in component
- Ensure you're using the selector pattern: `useEditingStore(state => state.activeTool)`
- Check that the component re-renders when state changes

**Issue:** `canUndo()` or `canRedo()` always returns false
- These are functions, not properties. Call them: `canUndo()` not `canUndo`

**Issue:** Selection Set not updating UI
- React doesn't detect mutations to Set. The implementation creates a new Set each time, which should trigger re-renders. If issues persist, verify you're selecting the entire Set: `useEditingStore(state => state.selectedPoints)`

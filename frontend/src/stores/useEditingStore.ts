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
  clearHistory: () => void

  // Split state
  splitPlane: { point: [number, number, number]; normal: [number, number, number] } | null
  setSplitPlane: (plane: EditingStore['splitPlane']) => void

  // Selection state
  selectedPoints: Set<number>
  addToSelection: (indices: number[]) => void
  removeFromSelection: (indices: number[]) => void
  clearSelection: () => void
}

const MAX_HISTORY_SIZE = 50

export const useEditingStore = create<EditingStore>((set, get) => ({
  // Tool state
  activeTool: null,
  setActiveTool: (tool) => set({ activeTool: tool }),

  // History
  history: [],
  historyIndex: -1,

  pushOperation: (op) =>
    set((state) => {
      // Clear future history if we're not at the end
      let newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push({ ...op, timestamp: Date.now() })

      // Limit history size to prevent memory bloat
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory = newHistory.slice(newHistory.length - MAX_HISTORY_SIZE)
      }

      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      }
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex < 0) return state
      return { historyIndex: state.historyIndex - 1 }
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      return { historyIndex: state.historyIndex + 1 }
    }),

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  clearHistory: () =>
    set({
      history: [],
      historyIndex: -1,
      splitPlane: null,
      selectedPoints: new Set(),
    }),

  // Split state
  splitPlane: null,
  setSplitPlane: (plane) => set({ splitPlane: plane }),

  // Selection state
  selectedPoints: new Set(),
  addToSelection: (indices) =>
    set((state) => ({
      selectedPoints: new Set([...state.selectedPoints, ...indices]),
    })),
  removeFromSelection: (indices) =>
    set((state) => {
      const next = new Set(state.selectedPoints)
      indices.forEach((i) => next.delete(i))
      return { selectedPoints: next }
    }),
  clearSelection: () => set({ selectedPoints: new Set() }),
}))

import { useEffect } from 'react'
import { useEditingStore } from '@/stores/useEditingStore'

export function useEditingKeyboard() {
  const { undo, redo, canUndo, canRedo } = useEditingStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

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
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        if (canRedo()) redo()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, canUndo, canRedo])
}

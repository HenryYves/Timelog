export class UndoManager {
  constructor(maxSize = 100) {
    this._undo = []
    this._redo = []
    this._maxSize = maxSize
  }

  push(action) {
    this._undo.push(action)
    this._redo = [] // clear redo on new action
    if (this._undo.length > this._maxSize) {
      this._undo.shift()
    }
  }

  /** Replace the redo target of the top undo entry without pushing a new one */
  updateRedo(redo) {
    const top = this._undo[this._undo.length - 1]
    if (top) top.redo = redo
  }

  /** Top undo entry, or null */
  top() {
    return this._undo.length ? this._undo[this._undo.length - 1] : null
  }

  undo() {
    const action = this._undo.pop()
    if (!action) return false
    action.undo()
    this._redo.push(action)
    return true
  }

  redo() {
    const action = this._redo.pop()
    if (!action) return false
    action.redo()
    this._undo.push(action)
    return true
  }

  get canUndo() { return this._undo.length > 0 }
  get canRedo() { return this._redo.length > 0 }

  clear() {
    this._undo = []
    this._redo = []
  }
}

/** Limit for continuous-typing merge (characters). */
const MERGE_MAX_CHARS = 80

/**
 * Return true when two consecutive editor snapshots should be merged
 * into a single undo entry — i.e. the user kept typing without a
 * structural break (Enter, Backspace, Delete, Paste).
 */
export function shouldMergeEditorEntry(prevEntry, nextEntry) {
  if (!prevEntry) return false
  // Don't merge if the text change is too large (likely paste or deletion)
  const delta = Math.abs(
    (nextEntry.prev.text || '').length - (prevEntry.prev.text || '').length
  )
  return delta <= MERGE_MAX_CHARS
}

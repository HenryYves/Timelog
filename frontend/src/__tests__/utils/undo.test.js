import { describe, it, expect } from 'vitest'
import { UndoManager, shouldMergeEditorEntry } from '../../utils/undo.js'

describe('UndoManager', () => {
  it('push and undo', () => {
    const m = new UndoManager()
    const steps = []
    m.push({ undo: () => steps.push('u1'), redo: () => steps.push('r1') })
    m.push({ undo: () => steps.push('u2'), redo: () => steps.push('r2') })
    expect(m.canUndo).toBe(true)
    expect(m.canRedo).toBe(false)

    m.undo()
    expect(steps).toEqual(['u2'])
    expect(m.canRedo).toBe(true)

    m.redo()
    expect(steps).toEqual(['u2', 'r2'])
    expect(m.canUndo).toBe(true)
  })

  it('new action clears redo stack', () => {
    const m = new UndoManager()
    m.push({ undo: () => {}, redo: () => {} })
    m.undo()
    expect(m.canRedo).toBe(true)
    m.push({ undo: () => {}, redo: () => {} })
    expect(m.canRedo).toBe(false)
  })

  it('updateRedo replaces top redo target', () => {
    const m = new UndoManager()
    const r1 = () => {}
    const r2 = () => {}
    m.push({ undo: () => {}, redo: r1 })
    expect(m.top().redo).toBe(r1)
    m.updateRedo(r2)
    expect(m.top().redo).toBe(r2)
  })

  it('max size trims oldest', () => {
    const m = new UndoManager(3)
    for (let i = 0; i < 5; i++) {
      m.push({ undo: () => {}, redo: () => {} })
    }
    expect(m._undo.length).toBe(3)
  })

  it('undo/redo empty returns false', () => {
    const m = new UndoManager()
    expect(m.undo()).toBe(false)
    expect(m.redo()).toBe(false)
  })

  it('clear empties both stacks', () => {
    const m = new UndoManager()
    m.push({ undo: () => {}, redo: () => {} })
    m.undo()
    m.clear()
    expect(m.canUndo).toBe(false)
    expect(m.canRedo).toBe(false)
  })
})

describe('shouldMergeEditorEntry', () => {
  it('returns false for null prev', () => {
    expect(shouldMergeEditorEntry(null, { prev: { text: 'a' } })).toBe(false)
  })

  it('returns true for small delta', () => {
    const prev = { prev: { text: 'abc' } }
    const next = { prev: { text: 'abcd' } }
    expect(shouldMergeEditorEntry(prev, next)).toBe(true)
  })

  it('returns false for large delta', () => {
    const prev = { prev: { text: 'a' } }
    const next = { prev: { text: 'a' + 'x'.repeat(100) } }
    expect(shouldMergeEditorEntry(prev, next)).toBe(false)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTimelogStore, dkey, fmt, toInput, fromInput } from '../../store/timelog.js'

// Mock localStorage
const store = {}
globalThis.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v },
  removeItem: (k) => { delete store[k] },
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.keys(store).forEach(k => delete store[k])
})

describe('dkey', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(dkey(new Date(2026, 6, 6))).toBe('2026-07-06')
  })
  it('pads single digit month and day', () => {
    expect(dkey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('fmt', () => {
  it('formats minutes to HH:MM', () => {
    expect(fmt(0)).toBe('00:00')
    expect(fmt(60)).toBe('01:00')
    expect(fmt(90)).toBe('01:30')
    expect(fmt(1439)).toBe('23:59')
  })
})

describe('toInput / fromInput', () => {
  it('round trips correctly', () => {
    expect(fromInput(toInput(90))).toBe(90)
    expect(fromInput(toInput(0))).toBe(0)
    expect(fromInput(toInput(1439))).toBe(1439)
  })
})

describe('useTimelogStore', () => {
  it('starts with empty blocks', () => {
    const s = useTimelogStore()
    expect(s.blocks).toEqual([])
  })

  it('addBlock adds and saves', () => {
    const s = useTimelogStore()
    s.addBlock({ id: 'b1', start: 60, end: 120, title: 'Test', note: '', tags: [] })
    expect(s.blocks).toHaveLength(1)
    expect(s.blocks[0].title).toBe('Test')
  })

  it('updateBlock modifies existing block', () => {
    const s = useTimelogStore()
    s.addBlock({ id: 'b1', start: 60, end: 120, title: 'Old', note: '', tags: [] })
    s.updateBlock({ id: 'b1', start: 60, end: 150, title: 'New', note: '', tags: ['tag1'] })
    expect(s.blocks[0].title).toBe('New')
    expect(s.blocks[0].end).toBe(150)
  })

  it('deleteBlock removes block', () => {
    const s = useTimelogStore()
    s.addBlock({ id: 'b1', start: 60, end: 120, title: 'X', note: '', tags: [] })
    s.deleteBlock('b1')
    expect(s.blocks).toHaveLength(0)
  })

  it('copySelected copies to clipboard', () => {
    const s = useTimelogStore()
    s.addBlock({ id: 'b1', start: 60, end: 120, title: 'A', note: '', tags: ['x'] })
    s.addBlock({ id: 'b2', start: 180, end: 240, title: 'B', note: '', tags: [] })
    s.selectedBlocks.add('b1')
    s.selectedBlocks.add('b2')
    expect(s.copySelected()).toBe(true)
    expect(s.clipboard).toHaveLength(2)
    expect(s.clipboard[0].title).toBe('A')
  })

  it('copySelected returns false when nothing selected', () => {
    const s = useTimelogStore()
    expect(s.copySelected()).toBe(false)
  })

  it('pasteBlocks pastes with offset', () => {
    const s = useTimelogStore()
    s.clipboard = [{ id: 'c1', start: 60, end: 120, title: 'Pasted', note: '', tags: [] }]
    s.pasteBlocks(180)
    expect(s.blocks).toHaveLength(1)
    expect(s.blocks[0].start).toBe(180)
    expect(s.blocks[0].end).toBe(240)
  })

  it('pasteBlocks returns empty array when clipboard empty', () => {
    const s = useTimelogStore()
    expect(s.pasteBlocks(0)).toEqual([])
  })

  it('deleteSelectedBlocks removes selected', () => {
    const s = useTimelogStore()
    s.addBlock({ id: 'b1', start: 60, end: 120, title: 'A', note: '', tags: [] })
    s.addBlock({ id: 'b2', start: 180, end: 240, title: 'B', note: '', tags: [] })
    s.selectedBlocks.add('b1')
    s.deleteSelectedBlocks()
    expect(s.blocks).toHaveLength(1)
    expect(s.blocks[0].id).toBe('b2')
  })
})

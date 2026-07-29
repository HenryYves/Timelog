import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useTimelogStore, dkey, fmt, toInput, fromInput,
  dateStr, addDays, isBefore,
  canCutForward, canCutBackward,
  cutDay, glueBack, getGlueBlocks,
} from '../../store/timelog.js'

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

describe('date helpers', () => {
  it('dateStr works with Date and string', () => {
    expect(dateStr(new Date(2026, 6, 24))).toBe('2026-07-24')
    expect(dateStr('2026-07-24')).toBe('2026-07-24')
  })

  it('addDays adds and subtracts', () => {
    expect(addDays('2026-07-24', 1)).toBe('2026-07-25')
    expect(addDays('2026-07-24', -1)).toBe('2026-07-23')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('isBefore compares date strings', () => {
    expect(isBefore('2026-07-23', '2026-07-24')).toBe(true)
    expect(isBefore('2026-07-25', '2026-07-24')).toBe(false)
  })
})

describe('cut constraints', () => {
  it('canCutForward rejects if blocks from tomorrow exist', () => {
    const blocks = [{ id: 'b1', start: 0, end: 60, _cut: { sourceDate: '2026-07-25', cutAt: 0 } }]
    expect(canCutForward(blocks, '2026-07-24')).toBe(false)
  })

  it('canCutForward allows if no blocks from tomorrow', () => {
    const blocks = [{ id: 'b1', start: 0, end: 60, _cut: { sourceDate: '2026-07-23', cutAt: 0 } }]
    expect(canCutForward(blocks, '2026-07-24')).toBe(true)
  })

  it('canCutBackward rejects if blocks from yesterday exist', () => {
    const blocks = [{ id: 'b1', start: 0, end: 60, _cut: { sourceDate: '2026-07-23', cutAt: 0 } }]
    expect(canCutBackward(blocks, '2026-07-24')).toBe(false)
  })
})

describe('cutDay', () => {
  beforeEach(() => {
    // Seed localStorage with test data
    localStorage.setItem('timelog:2026-07-24', JSON.stringify([
      { id: 'a', start: 480, end: 600, title: 'Morning', note: '', tags: [] },   // 08:00-10:00
      { id: 'b', start: 720, end: 840, title: 'Afternoon', note: '', tags: [] }, // 12:00-14:00
      { id: 'c', start: 1200, end: 1380, title: 'Evening', note: '', tags: [] }, // 20:00-23:00
    ]))
    localStorage.removeItem('timelog:2026-07-25')
    localStorage.removeItem('timelog:2026-07-23')
  })

  it('cutDay forward moves blocks after cutAt to next day', () => {
    const result = cutDay('2026-07-24', 780, 'forward') // cut at 13:00
    expect(result).toBeTruthy()
    expect(result.moved).toBeGreaterThan(0)

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))

    // Block 'b' (12:00-14:00) should be split: 12:00-13:00 stays, 13:00-14:00 moves
    const splitB = src.find(x => x.id === 'b')
    expect(splitB).toBeTruthy()
    expect(splitB.end).toBe(780) // 13:00

    const movedB = tgt.find(x => x.id === 'b')
    expect(movedB).toBeTruthy()
    expect(movedB.start).toBe(780)
    expect(movedB._cut).toBeTruthy()
    expect(movedB._cut.sourceDate).toBe('2026-07-24')
  })

  it('cutDay backward moves blocks before cutAt to prev day', () => {
    const result = cutDay('2026-07-24', 660, 'backward') // cut at 11:00
    expect(result).toBeTruthy()

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-23'))

    // Block 'a' (08:00-10:00) should be moved entirely (before 11:00)
    const movedA = tgt.find(x => x.id === 'a')
    expect(movedA).toBeTruthy()
    expect(movedA._cut).toBeTruthy()
  })
})

describe('glueBack', () => {
  beforeEach(() => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify([
      { id: 'a', start: 0, end: 60, title: 'Normal', note: '', tags: [] },
    ]))
    localStorage.setItem('timelog:2026-07-25', JSON.stringify([
      { id: 'b', start: 480, end: 600, _cut: { sourceDate: '2026-07-24', cutAt: 480 }, title: 'Cut', note: '', tags: [] },
    ]))
  })

  it('glueBack moves blocks back to source date', () => {
    const result = glueBack('2026-07-25', '2026-07-24')
    expect(result).toBeTruthy()

    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25')) || []
    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24')) || []

    // Target should have no glue blocks
    expect(tgt.find(x => x._cut)).toBeFalsy()

    // Source should have the returned block
    const returned = src.find(x => x.id === 'b')
    expect(returned).toBeTruthy()
    expect(returned._cut).toBeFalsy()
  })
})

describe('getGlueBlocks', () => {
  it('separates fromPrev, fromNext, today', () => {
    const blocks = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 60, end: 120, _cut: { sourceDate: '2026-07-23', cutAt: 0 } },
      { id: 'c', start: 120, end: 180, _cut: { sourceDate: '2026-07-25', cutAt: 0 } },
    ]
    const { fromPrev, fromNext, today } = getGlueBlocks(blocks, '2026-07-24')
    expect(fromPrev).toHaveLength(1)
    expect(fromPrev[0].id).toBe('b')
    expect(fromNext).toHaveLength(1)
    expect(fromNext[0].id).toBe('c')
    expect(today).toHaveLength(1)
    expect(today[0].id).toBe('a')
  })
})

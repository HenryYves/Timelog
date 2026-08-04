import { describe, it, expect } from 'vitest'
import { unionMinutes, computeUnrecorded } from '../../utils/stats.js'

describe('unionMinutes', () => {
  it('returns 0 for empty array', () => {
    expect(unionMinutes([])).toBe(0)
  })

  it('returns 0 for null/undefined', () => {
    expect(unionMinutes(null)).toBe(0)
    expect(unionMinutes(undefined)).toBe(0)
  })

  it('calculates single block duration', () => {
    const blocks = [{ start: 60, end: 120 }]
    expect(unionMinutes(blocks)).toBe(60)
  })

  it('calculates non-overlapping blocks', () => {
    const blocks = [
      { start: 60, end: 120 },
      { start: 180, end: 240 },
    ]
    expect(unionMinutes(blocks)).toBe(120)
  })

  it('merges overlapping blocks', () => {
    const blocks = [
      { start: 60, end: 120 },
      { start: 90, end: 150 },
    ]
    // Union: [60, 150) = 90 minutes
    expect(unionMinutes(blocks)).toBe(90)
  })

  it('merges adjacent blocks', () => {
    const blocks = [
      { start: 60, end: 120 },
      { start: 120, end: 180 },
    ]
    // Union: [60, 180) = 120 minutes
    expect(unionMinutes(blocks)).toBe(120)
  })

  it('merges multiple overlapping blocks', () => {
    const blocks = [
      { start: 60, end: 120 },
      { start: 90, end: 150 },
      { start: 140, end: 200 },
    ]
    // Union: [60, 200) = 140 minutes
    expect(unionMinutes(blocks)).toBe(140)
  })

  it('handles blocks that fully contain others', () => {
    const blocks = [
      { start: 60, end: 180 },
      { start: 90, end: 120 },
    ]
    // Union: [60, 180) = 120 minutes
    expect(unionMinutes(blocks)).toBe(120)
  })

  it('handles unsorted blocks', () => {
    const blocks = [
      { start: 180, end: 240 },
      { start: 60, end: 120 },
      { start: 300, end: 360 },
    ]
    // Union: [60,120) + [180,240) + [300,360) = 180 minutes
    expect(unionMinutes(blocks)).toBe(180)
  })

  it('handles complex overlapping pattern', () => {
    const blocks = [
      { start: 0, end: 100 },
      { start: 50, end: 150 },
      { start: 200, end: 300 },
      { start: 250, end: 350 },
      { start: 400, end: 500 },
    ]
    // Union: [0,150) + [200,350) + [400,500) = 150 + 150 + 100 = 400 minutes
    expect(unionMinutes(blocks)).toBe(400)
  })
})

describe('computeUnrecorded', () => {
  it('returns 0 for empty days', () => {
    expect(computeUnrecorded([], [])).toBe(0)
  })

  it('returns 1440 for a day with no blocks', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[]]
    expect(computeUnrecorded(days, blocksByDay)).toBe(1440)
  })

  it('calculates unrecorded time for a day with one block', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[
      { start: 480, end: 600 }, // 08:00-10:00 (120 minutes)
    ]]
    expect(computeUnrecorded(days, blocksByDay)).toBe(1440 - 120)
  })

  it('calculates unrecorded time for a day with multiple non-overlapping blocks', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[
      { start: 480, end: 600 },  // 08:00-10:00 (120 min)
      { start: 720, end: 840 },  // 12:00-14:00 (120 min)
    ]]
    // Recorded: 240 minutes, Unrecorded: 1440 - 240 = 1200
    expect(computeUnrecorded(days, blocksByDay)).toBe(1200)
  })

  it('calculates unrecorded time for a day with overlapping blocks', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[
      { start: 480, end: 600 },  // 08:00-10:00
      { start: 540, end: 660 },  // 09:00-11:00
    ]]
    // Union: [480,660) = 180 minutes recorded, 1260 unrecorded
    expect(computeUnrecorded(days, blocksByDay)).toBe(1260)
  })

  it('calculates unrecorded time across multiple days', () => {
    const days = ['2026-07-24', '2026-07-25']
    const blocksByDay = [
      [{ start: 480, end: 600 }],  // Day 1: 120 minutes recorded
      [{ start: 720, end: 900 }],  // Day 2: 180 minutes recorded
    ]
    // Day 1: 1320 unrecorded, Day 2: 1260 unrecorded, Total: 2580
    expect(computeUnrecorded(days, blocksByDay)).toBe(2580)
  })

  it('returns 0 unrecorded when day is fully recorded', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[
      { start: 0, end: 1440 },
    ]]
    expect(computeUnrecorded(days, blocksByDay)).toBe(0)
  })

  it('filters out glue blocks from other days (coordinates >= 1440)', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[
      { start: 480, end: 600 },    // Today block: 120 minutes
      { start: 1920, end: 2040 },  // Glue block (tomorrow frame): should be ignored
    ]]
    // Only the today block (120 min) should count, unrecorded: 1440 - 120 = 1320
    expect(computeUnrecorded(days, blocksByDay)).toBe(1320)
  })

  it('filters out glue blocks from yesterday (coordinates < 0)', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[
      { start: -60, end: 60 },     // Glue block crossing midnight: should be ignored for unrecorded calc
      { start: 480, end: 600 },    // Today block: 120 minutes
    ]]
    // Only today blocks count, unrecorded: 1440 - 120 = 1320
    expect(computeUnrecorded(days, blocksByDay)).toBe(1320)
  })

  it('handles edge case with block at day boundary', () => {
    const days = ['2026-07-24']
    const blocksByDay = [[
      { start: 0, end: 60 },       // 00:00-01:00
      { start: 1380, end: 1440 },  // 23:00-24:00
    ]]
    // Recorded: 120 minutes, Unrecorded: 1320
    expect(computeUnrecorded(days, blocksByDay)).toBe(1320)
  })

  it('handles days with missing or null blocksByDay entries', () => {
    const days = ['2026-07-24', '2026-07-25']
    const blocksByDay = [
      [{ start: 480, end: 600 }],
      null,
    ]
    // Day 1: 1320 unrecorded, Day 2: 1440 unrecorded (no blocks), Total: 2760
    expect(computeUnrecorded(days, blocksByDay)).toBe(2760)
  })
})

import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import {
  getDaysInRange, loadDayBlocks, computeCardsData,
  buildPieChart, fmtDur, pctOf, barWidth,
} from '../../utils/stats.js'

// ---- fmtDur ----
describe('fmtDur', () => {
  it('formats minutes < 60', () => {
    expect(fmtDur(0)).toBe('0m')
    expect(fmtDur(1)).toBe('1m')
    expect(fmtDur(59)).toBe('59m')
  })
  it('formats whole hours', () => {
    expect(fmtDur(60)).toBe('1h')
    expect(fmtDur(120)).toBe('2h')
  })
  it('formats hours + minutes', () => {
    expect(fmtDur(90)).toBe('1h 30m')
    expect(fmtDur(125)).toBe('2h 5m')
  })
})

// ---- pctOf ----
describe('pctOf', () => {
  const data = [
    { tag: 'A', minutes: 50 },
    { tag: 'B', minutes: 150 },
  ]
  it('computes percentage', () => {
    expect(pctOf(data, 50)).toBe('25.0%')
    expect(pctOf(data, 150)).toBe('75.0%')
  })
  it('handles empty data', () => {
    expect(pctOf([], 0)).toBe('0.0%')
  })
})

// ---- barWidth ----
describe('barWidth', () => {
  it('returns percentage of max', () => {
    const data = [{ minutes: 30 }, { minutes: 60 }, { minutes: 10 }]
    expect(barWidth(data, 30)).toBe(50)
    expect(barWidth(data, 60)).toBe(100)
    expect(barWidth(data, 10)).toBeCloseTo(100 / 6, 10)
  })
  it('handles single item', () => {
    expect(barWidth([{ minutes: 5 }], 5)).toBe(100)
  })
})

// ---- loadDayBlocks ----
describe('loadDayBlocks', () => {
  const key = 'timelog:2026-01-01'
  afterEach(() => { localStorage.clear() })

  it('returns empty array for missing key', () => {
    expect(loadDayBlocks('2026-01-01')).toEqual([])
  })
  it('loads blocks from localStorage', () => {
    localStorage.setItem(key, JSON.stringify([{ start: 0, end: 60 }]))
    expect(loadDayBlocks('2026-01-01')).toEqual([{ start: 0, end: 60 }])
  })
})

// ---- getDaysInRange ----
describe('getDaysInRange', () => {
  it('returns today', () => {
    const days = getDaysInRange('today', '', '')
    expect(days.length).toBe(1)
    // Format YYYY-MM-DD
    expect(days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('returns 7 days for week', () => {
    const days = getDaysInRange('week', '', '')
    expect(days.length).toBeGreaterThanOrEqual(1)
    expect(days.length).toBeLessThanOrEqual(7)
  })
  it('returns 7 days for 168h', () => {
    const days = getDaysInRange('168h', '', '')
    expect(days.length).toBe(7)
  })
  it('returns 7 days for 7d', () => {
    const days = getDaysInRange('7d', '', '')
    expect(days.length).toBe(7)
  })
  it('returns custom range', () => {
    const days = getDaysInRange('custom', '2026-01-01', '2026-01-03')
    expect(days).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })
  it('deduplicates days', () => {
    const days = getDaysInRange('24h', '', '')
    expect(days.length).toBeGreaterThanOrEqual(1)
    expect(days.length).toBeLessThanOrEqual(2)
  })
})

// ---- buildPieChart ----
describe('buildPieChart', () => {
  it('returns empty for no data', () => {
    expect(buildPieChart([])).toEqual({ slices: [], labels: [] })
  })
  it('returns empty for zero total', () => {
    expect(buildPieChart([{ tag: 'A', minutes: 0, color: '#000' }]))
      .toEqual({ slices: [], labels: [] })
  })
  it('handles single item (full circle)', () => {
    const r = buildPieChart([{ tag: 'A', minutes: 60, color: '#FF0000' }])
    expect(r.slices.length).toBe(1)
    expect(r.slices[0].tag).toBe('A')
    expect(r.slices[0].path).toContain('M350')  // SVG path present
    expect(r.labels.length).toBe(1)
    expect(r.labels[0].tag).toBe('A')
    expect(r.labels[0].pctText).toBe('100.0%')
  })
  it('handles two items', () => {
    const r = buildPieChart([
      { tag: 'A', minutes: 30, color: '#FF0000' },
      { tag: 'B', minutes: 30, color: '#00FF00' },
    ])
    expect(r.slices.length).toBe(2)
    expect(r.slices[0].tag).toBe('A')
    expect(r.slices[1].tag).toBe('B')
    // Labels for sizable slices (> 12 degrees)
    expect(r.labels.length).toBe(2)
  })
  it('filters tiny slices from labels', () => {
    const r = buildPieChart([
      { tag: 'Big', minutes: 350, color: '#FF0000' },
      { tag: 'Tiny', minutes: 1, color: '#00FF00' },
    ])
    expect(r.slices.length).toBe(2)
    // Tiny slice < 12 degrees should not get a label
    const labelTags = r.labels.map(l => l.tag)
    expect(labelTags).toContain('Big')
    expect(labelTags).not.toContain('Tiny')
  })
})

// ---- computeCardsData (integration) ----
describe('computeCardsData', () => {
  const mockTagStore = {
    colorOf: (tag) => {
      if (tag === 'Work') return { hex: '#FF6B6B' }
      return { hex: '#C4C3C0' }  // default gray — should fall back to palette
    },
    tags: [{ name: 'Work', group: 'Productive' }],
  }
  const mockSTR = { untagged: '未分类' }
  const tagGroup = (name) => name === 'Work' ? 'Productive' : ''

  beforeEach(() => { localStorage.clear() })

  it('returns empty map for no cards', () => {
    const map = computeCardsData([], tagGroup, mockTagStore, mockSTR,
      { timeRange: 'today', customStart: '', customEnd: '' })
    expect(map).toEqual({})
  })

  it('aggregates block durations by tag', () => {
    // Set up data for today
    const today = new Date()
    const dk = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0')
    localStorage.setItem('timelog:' + dk, JSON.stringify([
      { start: 0, end: 60, tags: ['Work'] },
      { start: 60, end: 90, tags: ['Play'] },
    ]))

    const cards = [{ id: 'c1', onlyFirstTag: false, excludeTags: [], filterGroups: [], includeUntagged: false }]
    const map = computeCardsData(cards, tagGroup, mockTagStore, mockSTR,
      { timeRange: 'today', customStart: '', customEnd: '' })

    expect(map.c1).toBeDefined()
    const work = map.c1.find(d => d.tag === 'Work')
    const play = map.c1.find(d => d.tag === 'Play')
    expect(work).toBeDefined()
    expect(work.minutes).toBe(60)
    expect(play).toBeDefined()
    expect(play.minutes).toBe(30)
  })
})

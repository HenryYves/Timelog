import { describe, it, expect } from 'vitest'
import { buildHalfLines } from '../../utils/timelineLabels.js'

// ---- buildHalfLines ----
// halfline 必须独立于 hourline 存在判定：只要 :30 落在页面可见区间 [lo, hi) 内就画。
describe('buildHalfLines', () => {
  it('full day: 24 half-hour marks, whole hours skipped', () => {
    const lines = buildHalfLines(1440, 2880)
    expect(lines).toHaveLength(24)
    expect(lines[0]).toEqual({ min: 1470, y: 30 })
    expect(lines[lines.length - 1]).toEqual({ min: 2850, y: 1410 })
    expect(lines.some(l => l.min % 60 === 0)).toBe(false)
  })

  it('non-hour page start: first half mark inside page is drawn', () => {
    // 剪切点 23:10（lo=1390）→ 23:30 的 halfline 必须存在，即使 23:00 hourline 不在页内
    const lines = buildHalfLines(1390, 2880)
    expect(lines[0]).toEqual({ min: 1410, y: 20 })
  })

  it('skips a half mark exactly at page start (cut edge)', () => {
    const lines = buildHalfLines(1410, 2880)
    expect(lines.some(l => l.min === 1410)).toBe(false)
    expect(lines[0].min).toBe(1470)
  })

  it('page end not on half mark: last :30 before hi is drawn', () => {
    // 页尾 23:40（hi=2860）→ 23:30 必须存在
    const lines = buildHalfLines(1440, 2860)
    expect(lines[lines.length - 1]).toEqual({ min: 2850, y: 1410 })
  })

  it('excludes a half mark exactly at page end', () => {
    const lines = buildHalfLines(1440, 2910)
    expect(lines.some(l => l.min === 2910)).toBe(false)
    expect(lines[lines.length - 1].min).toBe(2850)
  })

  it('glue-next region: half marks beyond 24:00 included', () => {
    const lines = buildHalfLines(1440, 3000)
    expect(lines[lines.length - 1]).toEqual({ min: 2970, y: 1530 })
  })

  it('empty range', () => {
    expect(buildHalfLines(1440, 1440)).toEqual([])
  })
})

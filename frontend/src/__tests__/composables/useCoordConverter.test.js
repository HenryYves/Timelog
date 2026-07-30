import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCoordConverter } from '../../composables/useCoordConverter.js'
import { useTimelogStore } from '../../store/timelog.js'

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

describe('useCoordConverter', () => {
  it('computes gutterHeights from _cutMeta', () => {
    const timelogStore = useTimelogStore()
    timelogStore._cutMeta = {
      fromPrev: { sourceDate: '2026-07-23', cutAt: 997 },
      fromNext: { sourceDate: '2026-07-25', cutAt: 120 },
      toPrev: { targetDate: '2026-07-23', cutAt: 480 },
      toNext: { targetDate: '2026-07-25', cutAt: 997 },
    }

    const { gutterHeights } = useCoordConverter()

    expect(gutterHeights.value.prev).toBe(443)  // 1440 - 997
    expect(gutterHeights.value.next).toBe(120)  // cutAt
    expect(gutterHeights.value.today).toBe(517) // 997 - 480
  })

  it('blockTop converts block to pixel position', () => {
    const timelogStore = useTimelogStore()
    timelogStore._cutMeta = {
      fromPrev: { sourceDate: '2026-07-23', cutAt: 997 },
      fromNext: null,
      toPrev: null,
      toNext: null,
    }

    const { blockTop } = useCoordConverter()

    // 昨天的块
    expect(blockTop({ start: 1320, end: 1380 })).toBe(1320)
    // 今天的块
    expect(blockTop({ start: 1920, end: 2040 })).toBe(443 + 480)
    // 明天的块
    expect(blockTop({ start: 2880, end: 2940 })).toBe(443 + 1440 + 0)
  })

  it('handles empty _cutMeta (no glue)', () => {
    const timelogStore = useTimelogStore()
    timelogStore._cutMeta = null

    const { gutterHeights, totalHeight, todayRange, blockTop, minuteToY } = useCoordConverter()

    expect(gutterHeights.value).toEqual({ prev: 0, today: 1440, next: 0 })
    expect(totalHeight.value).toBe(1440)
    expect(todayRange.value).toEqual({ start: 0, end: 1440 })
    expect(blockTop({ start: 1500, end: 1560 })).toBe(60)
    expect(minuteToY(1500)).toBe(60)
  })

  it('minuteToY is inverse of blockTop', () => {
    const timelogStore = useTimelogStore()
    timelogStore._cutMeta = {
      fromPrev: { sourceDate: '2026-07-23', cutAt: 997 },
      fromNext: { sourceDate: '2026-07-25', cutAt: 120 },
      toPrev: { targetDate: '2026-07-23', cutAt: 480 },
      toNext: { targetDate: '2026-07-25', cutAt: 997 },
    }

    const { blockTop, minuteToY } = useCoordConverter()

    for (const start of [100, 1300, 1440, 1920, 2800, 2880, 3000, 4300]) {
      expect(minuteToY(start)).toBe(blockTop({ start, end: start + 60 }))
    }
  })

  it('yToMinute converts pixel y to absolute minute per region', () => {
    const timelogStore = useTimelogStore()
    timelogStore._cutMeta = {
      fromPrev: { sourceDate: '2026-07-23', cutAt: 997 },
      fromNext: { sourceDate: '2026-07-25', cutAt: 120 },
      toPrev: null,
      toNext: null,
    }
    // gutterHeights: prev=443, today=1440, next=120

    const { yToMinute, minuteToY } = useCoordConverter()
    // zoom 默认 100 → 缩放因子 1；rect.top = 0
    const dayEl = { getBoundingClientRect: () => ({ top: 0 }) }

    // 昨天胶水区 [0, 443)
    expect(yToMinute(100, dayEl)).toBe(100)
    // 今天显示区 [443, 443+1440)
    expect(yToMinute(443 + 480, dayEl)).toBe(1920)
    // 明天胶水区 [443+1440, +120)
    expect(yToMinute(443 + 1440 + 60, dayEl)).toBe(2880 + 60)

    // 今天/明天区域与 minuteToY 互逆
    for (const minute of [1440, 1920, 2800, 2880, 3000, 4300]) {
      expect(yToMinute(minuteToY(minute), dayEl)).toBe(minute)
    }
  })
})

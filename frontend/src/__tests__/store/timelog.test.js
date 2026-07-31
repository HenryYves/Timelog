import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useTimelogStore, dkey, fmt, toInput, fromInput,
  dateStr, addDays, isBefore,
  canCutForward, canCutBackward,
  cutDay, glueBack, getGlueBlocks, storeUndo,
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
  it('canCutForward rejects if fromNext exists', () => {
    expect(canCutForward({ fromNext: { sourceDate: '2026-07-25', cutAt: 0 } })).toBe(false)
  })

  it('canCutForward allows if no fromNext', () => {
    expect(canCutForward({})).toBe(true)
  })

  it('canCutBackward rejects if fromPrev exists', () => {
    expect(canCutBackward({ fromPrev: { sourceDate: '2026-07-23', cutAt: 0 } })).toBe(false)
  })

  it('canCutBackward allows if no fromPrev', () => {
    expect(canCutBackward({})).toBe(true)
  })
})

describe('cutDay v2', () => {
  beforeEach(() => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [
        { id: 'a', start: 1920, end: 2040 },  // 今天 08:00-10:00
        { id: 'b', start: 2160, end: 2280 },  // 今天 12:00-14:00
      ],
      _cutMeta: {}
    }))
    localStorage.removeItem('timelog:2026-07-25')
  })

  it('cutDay forward updates coordinates and _cutMeta', () => {
    const result = cutDay('2026-07-24', 780, 'forward')  // 13:00

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))

    // 今天的块应该调整坐标（-1440）
    expect(src.blocks.find(b => b.id === 'a').start).toBe(480)
    expect(src.blocks.find(b => b.id === 'b').start).toBe(720)

    // 明天应该有剪过来的块
    expect(tgt.blocks.length).toBeGreaterThan(0)

    // _cutMeta 应该更新
    expect(src._cutMeta.toNext).toEqual({ targetDate: '2026-07-25', cutAt: 780 })
    expect(tgt._cutMeta.fromPrev).toEqual({ sourceDate: '2026-07-24', cutAt: 780 })
  })

  it('cutDay merges same-ID blocks at 00:00 boundary', () => {
    // 先创建一个跨区块
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [
        { id: 'a', start: 1380, end: 1440 },  // 昨天 23:00-24:00
        { id: 'a', start: 1440, end: 1500 },  // 今天 00:00-01:00（同 ID）
      ],
      _cutMeta: {}
    }))

    const result = cutDay('2026-07-24', 720, 'backward')  // 12:00

    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-23'))

    // 同 ID 块应该合并
    const merged = tgt.blocks.filter(b => b.id === 'a')
    expect(merged.length).toBe(1)
    expect(merged[0].start).toBe(1380)
    expect(merged[0].end).toBe(1500)
  })

  it('cutDay forward splits block crossing the cut line', () => {
    cutDay('2026-07-24', 780, 'forward')  // 13:00

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))

    // b (12:00-14:00) 在 13:00 断开：前半留在源日，后半移入明天
    const stayB = src.blocks.find(b => b.id === 'b')
    expect(stayB.start).toBe(720)   // 2160 - 1440
    expect(stayB.end).toBe(780)     // 2220 - 1440

    const movedB = tgt.blocks.find(b => b.id === 'b')
    expect(movedB.start).toBe(780)  // 2220 - 1440
    expect(movedB.end).toBe(840)    // 2280 - 1440
    expect(movedB._cut).toEqual({ sourceDate: '2026-07-24', cutAt: 780 })
  })

  it('cutDay backward moves today head to tomorrow-frame coords in yesterday', () => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [
        { id: 'c', start: 1500, end: 1560 },  // 今天 01:00-02:00
        { id: 'd', start: 2160, end: 2280 },  // 今天 12:00-14:00
      ],
      _cutMeta: {}
    }))
    localStorage.removeItem('timelog:2026-07-23')

    cutDay('2026-07-24', 720, 'backward')  // 12:00

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-23'))

    // c 整体移入昨天，+1440（明天帧 [2880,4320)，渲染进 next gutter）
    const movedC = tgt.blocks.find(b => b.id === 'c')
    expect(movedC.start).toBe(2940)
    expect(movedC.end).toBe(3000)
    expect(movedC._cut).toEqual({ sourceDate: '2026-07-24', cutAt: 720 })

    // d 留在源日，-cutAt（对齐 toPrev 截断后的显示区与标签）
    const stayD = src.blocks.find(b => b.id === 'd')
    expect(stayD.start).toBe(1440)
    expect(stayD.end).toBe(1560)

    expect(src._cutMeta.toPrev).toEqual({ targetDate: '2026-07-23', cutAt: 720 })
    expect(tgt._cutMeta.fromNext).toEqual({ sourceDate: '2026-07-24', cutAt: 720 })
  })

  it('cutDay clears the undo/redo stack', () => {
    const s = useTimelogStore()
    s.addBlock({ id: 'x', start: 60, end: 120, title: 'X', note: '', tags: [] })
    expect(storeUndo.canUndo).toBe(true)

    cutDay('2026-07-24', 780, 'forward')

    expect(storeUndo.canUndo).toBe(false)
    expect(storeUndo.canRedo).toBe(false)
  })

  it('cutDay dropShort drops split fragments < 10 min', () => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [{ id: 's', start: 2215, end: 2280 }],  // 12:55-14:00，13:00 处切断
      _cutMeta: {}
    }))

    cutDay('2026-07-24', 780, 'forward', true)

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))

    // 前半 2215-2220（5min）丢弃；后半 2220-2280 移出
    expect(src.blocks.find(b => b.id === 's')).toBeFalsy()
    const moved = tgt.blocks.find(b => b.id === 's')
    expect(moved.start).toBe(780)
    expect(moved.end).toBe(840)
  })

  it('cutDay forward rejected when target fromPrev slot occupied by different source', () => {
    localStorage.setItem('timelog:2026-07-25', JSON.stringify({
      blocks: [],
      _cutMeta: { fromPrev: { sourceDate: '2026-07-23', cutAt: 200 } }
    }))

    expect(cutDay('2026-07-24', 780, 'forward')).toBe(false)
  })

  it('cutDay forward twice merges with min cutAt', () => {
    cutDay('2026-07-24', 780, 'forward')   // 13:00 → toNext.cutAt=780
    // 第一次剪切后：a 留存 [480,600]，b 前半 [720,780]
    cutDay('2026-07-24', 600, 'forward')   // 10:00 → 合并后 cutAt=600

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))

    // meta 取 min
    expect(src._cutMeta.toNext.cutAt).toBe(600)
    expect(tgt._cutMeta.fromPrev.cutAt).toBe(600)

    // a (08:00-10:00) 留在源日局部帧 [480,600]
    const a = src.blocks.find(b => b.id === 'a')
    expect(a.start).toBe(480)
    expect(a.end).toBe(600)

    // b 的两个半块在明天合并回 [720,840]
    const bs = tgt.blocks.filter(b => b.id === 'b')
    expect(bs.length).toBe(1)
    expect(bs[0].start).toBe(720)
    expect(bs[0].end).toBe(840)
    expect(bs[0]._cut.cutAt).toBe(600)
  })

  it('cutDay forward then backward: both metas, correct positions', () => {
    cutDay('2026-07-24', 780, 'forward')   // 13:00 剪到明天
    localStorage.removeItem('timelog:2026-07-23')
    cutDay('2026-07-24', 540, 'backward')  // 09:00 剪到昨天

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const yst = JSON.parse(localStorage.getItem('timelog:2026-07-23'))

    // 两个 meta 都存在
    expect(src._cutMeta.toNext.cutAt).toBe(780)
    expect(src._cutMeta.toPrev.cutAt).toBe(540)
    expect(yst._cutMeta.fromNext).toEqual({ sourceDate: '2026-07-24', cutAt: 540 })

    // a (08:00-10:00) 在 09:00 断开：前半 [480,540]→昨天 [2880+480, 2880+540]，后半留存
    const movedA = yst.blocks.find(b => b.id === 'a')
    expect(movedA.start).toBe(2880 + 480)
    expect(movedA.end).toBe(2880 + 540)

    // 留存块基准 = -540（both 规范基准）：a 后半 local [540,600] → storage [0,60]
    const stayA = src.blocks.find(b => b.id === 'a')
    expect(stayA.start).toBe(0)
    expect(stayA.end).toBe(60)

    // b 前半 local [720,780] → storage [180,240]
    const stayB = src.blocks.find(b => b.id === 'b')
    expect(stayB.start).toBe(180)
    expect(stayB.end).toBe(240)
  })

  it('v1 array data migrates to today frame with synthesized meta', () => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify([
      { id: 'a', start: 480, end: 600 },   // v1 今天块 08:00-10:00
      { id: 'g', start: 1320, end: 1380, _cut: { sourceDate: '2026-07-23', cutAt: 997 } },  // v1 胶水块
    ]))

    const s = useTimelogStore()
    s.setDate(new Date(2026, 6, 24))

    // 普通块 +1440 移入今天帧；胶水块坐标不变
    const a = s.blocks.find(b => b.id === 'a')
    expect(a.start).toBe(1920)
    const g = s.blocks.find(b => b.id === 'g')
    expect(g.start).toBe(1320)

    // 从 _cut 标签合成 meta
    expect(s._cutMeta.fromPrev).toEqual({ sourceDate: '2026-07-23', cutAt: 997 })
  })
})

describe('glueBack v2', () => {
  beforeEach(() => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [
        { id: 'a', start: 1920, end: 2040 },  // 今天 08:00-10:00
        { id: 'b', start: 2160, end: 2280 },  // 今天 12:00-14:00
      ],
      _cutMeta: {}
    }))
    localStorage.removeItem('timelog:2026-07-25')
    localStorage.removeItem('timelog:2026-07-23')
  })

  it('round-trips a forward cut: restores blocks and clears _cutMeta', () => {
    cutDay('2026-07-24', 780, 'forward')
    const result = glueBack('2026-07-25', '2026-07-24')
    expect(result).toBeTruthy()

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25') || '{"blocks":[],"_cutMeta":{}}')

    const a = src.blocks.find(b => b.id === 'a')
    expect(a.start).toBe(1920)
    expect(a.end).toBe(2040)

    // split 两半重新合并为一个块
    const bs = src.blocks.filter(b => b.id === 'b')
    expect(bs.length).toBe(1)
    expect(bs[0].start).toBe(2160)
    expect(bs[0].end).toBe(2280)
    expect(bs[0]._cut).toBeFalsy()

    expect(src._cutMeta.toNext).toBeFalsy()
    expect(tgt._cutMeta.fromPrev).toBeFalsy()
  })

  it('glueBack splits cross-boundary blocks at 00:00 on backward glue', () => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [
        { id: 'a', start: 1380, end: 1440 },  // 昨天 23:00-24:00
        { id: 'a', start: 1440, end: 1500 },  // 今天 00:00-01:00（同 ID）
      ],
      _cutMeta: {}
    }))

    cutDay('2026-07-24', 720, 'backward')
    const result = glueBack('2026-07-23', '2026-07-24')
    expect(result).toBeTruthy()

    const host = JSON.parse(localStorage.getItem('timelog:2026-07-23'))
    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))

    // 跨区块在边界处 split：host 留下 1380-1440，源日拿回 1440-1500
    const hostA = host.blocks.filter(b => b.id === 'a')
    expect(hostA.length).toBe(1)
    expect(hostA[0].start).toBe(1380)
    expect(hostA[0].end).toBe(1440)

    const srcA = src.blocks.filter(b => b.id === 'a')
    expect(srcA.length).toBe(1)
    expect(srcA[0].start).toBe(1440)
    expect(srcA[0].end).toBe(1500)

    expect(host._cutMeta.fromNext).toBeFalsy()
    expect(src._cutMeta.toPrev).toBeFalsy()
  })

  it('returns false when there is nothing to glue back', () => {
    expect(glueBack('2026-07-25', '2026-07-24')).toBe(false)
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

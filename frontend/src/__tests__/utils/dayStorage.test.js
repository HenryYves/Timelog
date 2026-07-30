import { describe, it, expect } from 'vitest'
import { extractBlocks, extractCutMeta, normalizeDayData } from '../../utils/dayStorage.js'

describe('dayStorage helpers', () => {
  it('extractBlocks returns array for v1 format', () => {
    expect(extractBlocks([{ start: 0 }])).toEqual([{ start: 0 }])
  })

  it('extractBlocks returns blocks for v2 format', () => {
    expect(extractBlocks({ blocks: [{ start: 0 }], _cutMeta: {} })).toEqual([{ start: 0 }])
  })

  it('extractBlocks returns empty array for invalid data', () => {
    expect(extractBlocks(null)).toEqual([])
    expect(extractBlocks(undefined)).toEqual([])
    expect(extractBlocks({})).toEqual([])
  })

  it('extractCutMeta returns empty object for v1 format', () => {
    expect(extractCutMeta([{ start: 0 }])).toEqual({})
  })

  it('extractCutMeta returns _cutMeta for v2 format', () => {
    expect(extractCutMeta({ blocks: [], _cutMeta: { toNext: {} } })).toEqual({ toNext: {} })
  })

  it('normalizeDayData returns both blocks and _cutMeta', () => {
    expect(normalizeDayData([{ start: 0 }])).toEqual({ blocks: [{ start: 0 }], _cutMeta: {} })
    expect(normalizeDayData({ blocks: [{ start: 0 }], _cutMeta: { a: 1 } })).toEqual({ blocks: [{ start: 0 }], _cutMeta: { a: 1 } })
  })
})

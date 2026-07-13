import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTagHint,
  getWordBeforeCursor,
  getAllCandidates,
  confirmTagInFreq,
  loadFreqFromStorage,
  saveFreqToStorage,
} from '../../utils/editor.js'

// Mock localStorage
const storage = {}
globalThis.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => {
    storage[k] = v
  },
  removeItem: (k) => {
    delete storage[k]
  },
}

const TAGS = ['工作', '学习', '运动', '社交', '专注', '摸鱼']

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k])
})

describe('getTagHint', () => {
  it('returns suffix for prefix match', () => {
    const hint = getTagHint('工', TAGS, {})
    expect(hint).toBe('作')
  })

  it('returns null for exact match', () => {
    expect(getTagHint('工作', TAGS, {})).toBeNull()
  })

  it('returns null when no match', () => {
    expect(getTagHint('xyz', TAGS, {})).toBeNull()
  })

  it('sorts by frequency descending', () => {
    // '学业' has higher frequency and should appear first
    const hint = getTagHint('学', ['学习', '学业'], { 学习: 1, 学业: 5 })
    expect(hint).toBe('业')
  })

  it('returns null for empty word', () => {
    expect(getTagHint('', TAGS, {})).toBeNull()
  })

  it('handles case where only exact match exists', () => {
    expect(getTagHint('摸鱼', TAGS, {})).toBeNull()
  })
})

describe('getWordBeforeCursor', () => {
  it('stops at space delimiter (space is always a word boundary)', () => {
    // 'abc def' = a(0) b(1) c(2) sp(3) d(4) e(5) f(6)
    expect(getWordBeforeCursor('abc def', 7)).toBe('def')  // cursor after 'f'
    expect(getWordBeforeCursor('abc def', 3)).toBe('abc')  // cursor after 'c' just before space
  })

  it('stops at comma delimiter at correct offsets', () => {
    // '工作,学习' length is 5: 工(0) 作(1) ,(2) 学(3) 习(4)
    expect(getWordBeforeCursor('工作,学习', 5)).toBe('学习')
    expect(getWordBeforeCursor('工作,学习', 2)).toBe('工作')
  })

  it('stops at Chinese comma delimiter', () => {
    expect(getWordBeforeCursor('工作，学习', 5)).toBe('学习')
    expect(getWordBeforeCursor('工作，学习', 2)).toBe('工作')
  })

  it('stops at period delimiter', () => {
    expect(getWordBeforeCursor('工作.学习', 5)).toBe('学习')
  })

  it('stops at newline delimiter', () => {
    expect(getWordBeforeCursor('工作\n学习', 5)).toBe('学习')
  })

  it('returns full word when no delimiter', () => {
    expect(getWordBeforeCursor('工作学习', 4)).toBe('工作学习')
  })

  it('returns empty string for offset 0', () => {
    expect(getWordBeforeCursor('abc', 0)).toBe('')
  })

  it('returns empty string for null text', () => {
    expect(getWordBeforeCursor(null, 5)).toBe('')
  })

  it('returns empty string for empty text', () => {
    expect(getWordBeforeCursor('', 0)).toBe('')
  })

  it('stops at 、 delimiter at correct offset', () => {
    // '工作、学习' length is 5
    expect(getWordBeforeCursor('工作、学习', 5)).toBe('学习')
  })

  it('returns empty string when cursor is right after delimiter', () => {
    // cursor at offset 3 (immediately after comma)
    expect(getWordBeforeCursor('工作,学习', 3)).toBe('')
  })

  it('stops at first delimiter scanning left', () => {
    // 'aa,bb,cc' — indices: a0 a1 ,2 b3 b4 ,5 c6 c7
    // offset 8 = after 'cc', scanning left hits ',' at 5 → 'cc'
    // offset 5 = after 'bb', scanning left hits ',' at 2 → 'bb'
    expect(getWordBeforeCursor('aa,bb,cc', 8)).toBe('cc')
    expect(getWordBeforeCursor('aa,bb,cc', 5)).toBe('bb')
  })
})

describe('getAllCandidates', () => {
  it('returns sorted prefix matches excluding exact match', () => {
    const tags = ['学习', '学业', '学分']
    const result = getAllCandidates('学', tags, { 学业: 3, 学习: 1 })
    expect(result).toEqual(['学业', '学习', '学分'])
  })

  it('excludes exact match', () => {
    // '学习者'.startsWith('学习') === true, '学习力'.startsWith('学习') === true
    const result = getAllCandidates('学习', ['学习者', '学习力', '学习'])
    expect(result).toEqual(['学习者', '学习力'])
  })

  it('returns empty array for empty word', () => {
    expect(getAllCandidates('', TAGS, {})).toEqual([])
  })

  it('returns empty array when no match', () => {
    expect(getAllCandidates('xyz', TAGS, {})).toEqual([])
  })
})

describe('frequency tracking', () => {
  it('confirmTagInFreq increments count', () => {
    const freq = {}
    confirmTagInFreq('工作', freq)
    expect(freq.工作).toBe(1)
    confirmTagInFreq('工作', freq)
    expect(freq.工作).toBe(2)
  })

  it('confirmTagInFreq increments different tags independently', () => {
    const freq = {}
    confirmTagInFreq('工作', freq)
    confirmTagInFreq('学习', freq)
    confirmTagInFreq('工作', freq)
    expect(freq.工作).toBe(2)
    expect(freq.学习).toBe(1)
  })

  it('save and load frequency from localStorage', () => {
    const freq = { 工作: 3, 学习: 5 }
    saveFreqToStorage(freq)
    const loaded = loadFreqFromStorage()
    expect(loaded).toEqual({ 工作: 3, 学习: 5 })
  })

  it('loadFreqFromStorage returns empty object when no data', () => {
    const result = loadFreqFromStorage()
    expect(result).toEqual({})
  })

  it('round-trips correctly with confirm and save', () => {
    const freq = { 工作: 3, 学习: 5 }
    saveFreqToStorage(freq)
    const loaded = loadFreqFromStorage()
    const newFreq = {}
    Object.assign(newFreq, loaded)
    confirmTagInFreq('运动', newFreq)
    confirmTagInFreq('工作', newFreq)
    expect(newFreq.运动).toBe(1)
    expect(newFreq.工作).toBe(4)
    expect(newFreq.学习).toBe(5)
  })

  it('handles malformed localStorage gracefully', () => {
    storage['timelog:tagFrequency'] = 'not-json'
    const result = loadFreqFromStorage()
    expect(result).toEqual({})
  })
})

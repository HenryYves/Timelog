import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTagStore } from '../../store/tags.js'

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

describe('useTagStore', () => {
  it('loads default tags when localStorage is empty', () => {
    const s = useTagStore()
    expect(s.tags.length).toBeGreaterThanOrEqual(6)
    expect(s.tags.some(t => t.name === '工作')).toBe(true)
  })

  it('addTag adds a new tag', () => {
    const s = useTagStore()
    const before = s.tags.length
    s.addTag({ name: 'NewTag', color: '#FF0000', group: 'Test' })
    expect(s.tags.length).toBe(before + 1)
    expect(s.tags.find(t => t.name === 'NewTag')).toBeTruthy()
  })

  it('updateTag renames and replaces in blocks', () => {
    const s = useTagStore()
    s.tags = [{ name: 'Old', color: '#AABBCC', group: 'G1' }]
    s.updateTag(0, { name: 'New', color: '#AABBCC', group: 'G1' })
    expect(s.tags[0].name).toBe('New')
  })

  it('deleteTag removes tag', () => {
    const s = useTagStore()
    const before = s.tags.length
    s.deleteTag(0)
    expect(s.tags.length).toBe(before - 1)
  })

  it('normColor normalizes colors', () => {
    const s = useTagStore()
    expect(s.normColor('')).toBe('#C4C3C0')
    expect(s.normColor('fff')).toBe('#ffffff')
    expect(s.normColor('#abc')).toBe('#aabbcc')
    expect(s.normColor('#112233')).toBe('#112233')
  })

  it('colorOf returns hex and bg for tag', () => {
    const s = useTagStore()
    s.tags = [{ name: 'Test', color: '#FF8800', group: '' }]
    expect(s.colorOf('Test')).toEqual({ hex: '#FF8800', bg: '#FF880022' })
    expect(s.colorOf('Nonexistent')).toEqual({ hex: '#C4C3C0', bg: '#F0EFED' })
  })
})

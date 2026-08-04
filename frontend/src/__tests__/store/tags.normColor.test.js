import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTagStore } from '../../store/tags.js'

describe('normColor', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTagStore()
  })

  it('returns default gray for empty input', () => {
    expect(store.normColor('')).toBe('#C4C3C0')
    expect(store.normColor('   ')).toBe('#C4C3C0')
    expect(store.normColor(null)).toBe('#C4C3C0')
    expect(store.normColor(undefined)).toBe('#C4C3C0')
  })

  it('resolves palette names', () => {
    expect(store.normColor('gray')).toBe('#6B6B6B')
    expect(store.normColor('blue')).toBe('#2166A8')
    expect(store.normColor('red')).toBe('#C13B2E')
    expect(store.normColor('green')).toBe('#2F7D51')
    expect(store.normColor('yellow')).toBe('#B8860B')
    expect(store.normColor('orange')).toBe('#BE5C1E')
    expect(store.normColor('purple')).toBe('#6D3FB8')
    expect(store.normColor('pink')).toBe('#B03A79')
    expect(store.normColor('brown')).toBe('#8A5A3B')
  })

  it('prepends # if missing', () => {
    expect(store.normColor('FF5733')).toBe('#FF5733')
    expect(store.normColor('abc')).toBe('#aabbcc')
    expect(store.normColor('123456')).toBe('#123456')
  })

  it('expands 3-char hex to 6-char', () => {
    expect(store.normColor('#abc')).toBe('#aabbcc')
    expect(store.normColor('abc')).toBe('#aabbcc')
    expect(store.normColor('#f0a')).toBe('#ff00aa')
    expect(store.normColor('123')).toBe('#112233')
  })

  it('preserves valid 6-char hex with #', () => {
    expect(store.normColor('#FF5733')).toBe('#FF5733')
    expect(store.normColor('#aabbcc')).toBe('#aabbcc')
    expect(store.normColor('#123456')).toBe('#123456')
  })

  it('truncates to 7 characters max', () => {
    expect(store.normColor('#FF5733EXTRA')).toBe('#FF5733')
    expect(store.normColor('FF5733EXTRA')).toBe('#FF5733')
  })

  it('handles mixed case', () => {
    expect(store.normColor('#AbCdEf')).toBe('#AbCdEf')
    expect(store.normColor('AbCdEf')).toBe('#AbCdEf')
  })

  it('handles whitespace trimming', () => {
    expect(store.normColor('  #FF5733  ')).toBe('#FF5733')
    expect(store.normColor('  FF5733  ')).toBe('#FF5733')
    expect(store.normColor('  abc  ')).toBe('#aabbcc')
  })
})

import { describe, it, expect } from 'vitest'
import zh from '../../i18n/locales/zh.json'
import en from '../../i18n/locales/en.json'

// 递归收集叶子路径：数组记为 "array:<len>"，并继续下钻数组内的对象元素
function collect(obj, prefix = '', out = {}) {
  if (Array.isArray(obj)) {
    out[prefix] = 'array:' + obj.length
    obj.forEach((v, i) => { if (v && typeof v === 'object') collect(v, prefix + '[' + i + ']', out) })
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) collect(obj[k], prefix ? prefix + '.' + k : k, out)
  } else {
    out[prefix] = typeof obj
  }
  return out
}

// 收集字符串里的 {placeholder} 名字（排序后拼接，便于比较）
function placeholders(s) {
  return typeof s === 'string' ? (s.match(/\{(\w+)\}/g) || []).sort().join(',') : ''
}

function walkStrings(a, b, cb, path = '') {
  if (typeof a === 'string') { if (b !== undefined) cb(a, b, path); return }
  if (Array.isArray(a)) { a.forEach((v, i) => walkStrings(v, b?.[i], cb, `${path}[${i}]`)); return }
  if (a && typeof a === 'object') {
    for (const k of Object.keys(a)) walkStrings(a[k], b?.[k], cb, `${path}.${k}`)
  }
}

describe('i18n 语言包 key 对齐（zh vs en）', () => {
  it('key 集合完全一致（无缺失、无多余）', () => {
    const z = collect(zh), e = collect(en)
    const zk = Object.keys(z), ek = Object.keys(e)
    expect(ek.filter(k => !(k in z)), 'en 多出的 key').toEqual([])
    expect(zk.filter(k => !(k in e)), 'en 缺失的 key').toEqual([])
  })

  it('数组长度一致', () => {
    const z = collect(zh), e = collect(en)
    for (const k of Object.keys(z)) {
      if (String(z[k]).startsWith('array:')) expect(e[k], k).toBe(z[k])
    }
  })

  it('每个字符串的 {占位符} 名字集合一致', () => {
    walkStrings(zh, en, (zStr, eStr, path) => {
      expect(placeholders(eStr), path).toBe(placeholders(zStr))
    })
  })
})

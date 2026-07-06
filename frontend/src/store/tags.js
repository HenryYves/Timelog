import { defineStore } from 'pinia'
import { ref } from 'vue'
import { KEY_PREFIX } from '../constants.js'
import { useTimelogStore } from './timelog.js'
import { logger } from '../utils/log.js'

const PALETTE = {
  gray: '#6B6B6B', brown: '#8A5A3B', orange: '#BE5C1E',
  yellow: '#B8860B', green: '#2F7D51', blue: '#2166A8',
  purple: '#6D3FB8', pink: '#B03A79', red: '#C13B2E',
}

const DEFAULT_TAGS = [
  { name: '专注', color: '#A1AFC9', group: '自我评价' },
  { name: '摸鱼', color: '#F0C7C1', group: '自我评价' },
  { name: '学习', color: '#C4E0D4', group: '正事' },
  { name: '工作', color: '#A1AFC9', group: '正事' },
  { name: '运动', color: '#B5D8A8', group: '生活' },
  { name: '社交', color: '#FCE38A', group: '生活' },
]

export const useTagStore = defineStore('tags', () => {
  const tags = ref([])

  function loadTags() {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + 'tags')
      tags.value = raw ? JSON.parse(raw) : [...DEFAULT_TAGS]
    } catch (e) { logger.error('tags', 'loadTags failed', e); tags.value = [...DEFAULT_TAGS] }
  }

  function saveTags() {
    localStorage.setItem(KEY_PREFIX + 'tags', JSON.stringify(tags.value))
  }

  function normColor(c) {
    if (!c || !c.trim()) return '#C4C3C0'
    let v = c.trim()
    if (PALETTE[v]) return PALETTE[v]
    if (!v.startsWith('#')) v = '#' + v
    if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
    return v.slice(0, 7)
  }

  function addTag(tag) {
    tags.value.push({ name: tag.name, color: normColor(tag.color), group: tag.group || '' })
    saveTags()
  }

  function updateTag(index, tag) {
    const oldName = tags.value[index].name
    tags.value[index] = { name: tag.name, color: normColor(tag.color), group: tag.group || '' }
    saveTags()
    if (oldName !== tag.name) replaceTagInBlocks(oldName, tag.name)
  }

  function deleteTag(index) {
    const name = tags.value[index].name
    tags.value.splice(index, 1)
    saveTags()
    removeTagFromBlocks(name)
  }

  function removeTagFromBlocks(name) {
    let changed = false
    // Scan ALL localStorage keys — not just the current day's blocks
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k.startsWith(KEY_PREFIX)) continue
      const datePortion = k.slice(KEY_PREFIX.length)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePortion)) continue
      try {
        const arr = JSON.parse(localStorage.getItem(k))
        if (!Array.isArray(arr)) continue
        let mod = false
        for (const b of arr) {
          if (b.tags && b.tags.includes(name)) {
            b.tags = b.tags.filter(t => t !== name)
            mod = true
          }
        }
        if (mod) {
          localStorage.setItem(k, JSON.stringify(arr))
          changed = true
        }
      } catch (e) { logger.error('tags', 'removeTagFromBlocks failed', e) }
    }
    // Also update in-memory blocks for the current day
    const store = useTimelogStore()
    store.blocks.forEach(b => { if (b.tags) b.tags = b.tags.filter(t => t !== name) })
    if (changed) store.saveBlocks()
  }

  function replaceTagInBlocks(oldName, newName) {
    const store = useTimelogStore()
    let changed = false
    store.blocks.forEach(b => { if (b.tags) { b.tags = b.tags.map(t => t === oldName ? newName : t); changed = true } })
    if (changed) store.saveBlocks()
    // Also check ALL date keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags') {
        try {
          const data = JSON.parse(localStorage.getItem(k))
          let changed2 = false
          data.forEach(b => { if (b.tags) { b.tags = b.tags.map(t => t === oldName ? newName : t); changed2 = true } })
          if (changed2) localStorage.setItem(k, JSON.stringify(data))
        } catch (e) { logger.error('tags', 'replaceTagInBlocks failed', e) }
      }
    }
  }

  // Color helpers (local copies to avoid circular deps)
  function hexA(hex, a) {
    const h = hex.replace('#', '')
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    const r = parseInt(n.slice(0, 2), 16) || 0
    const g = parseInt(n.slice(2, 4), 16) || 0
    const b = parseInt(n.slice(4, 6), 16) || 0
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
  }

  function boostHex(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const mean = (r + g + b) / 3
    const f = 1 - amount * 0.3
    const s = 1 + amount * 0.25
    return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, mean + (c - mean) * s)) * f).toString(16).padStart(2, '0')).join('')
  }

  function colorOf(name) {
    const t = tags.value.find(t => t.name === name)
    if (!t) return { hex: '#C4C3C0', bg: '#F0EFED' }
    const hex = t.color
    // Read blockOpacity from localStorage directly to avoid circular deps
    const blockOpacity = parseInt(localStorage.getItem(KEY_PREFIX + 'blockOpacity')) || 15
    if (blockOpacity > 100) {
      const bg = boostHex(hex, (blockOpacity - 100) / 100)
      return { hex, bg }
    }
    const alpha = Math.min(blockOpacity, 100) / 100
    const bg = hexA(hex, alpha)
    return { hex, bg }
  }

  loadTags()
  return { tags, loadTags, saveTags, addTag, updateTag, deleteTag, removeTagFromBlocks, replaceTagInBlocks, colorOf, normColor }
})

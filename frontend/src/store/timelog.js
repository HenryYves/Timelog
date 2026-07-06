import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KEY_PREFIX, PX_MIN, DAY_MIN, EDGE } from '../constants.js'
import { logger } from '../utils/log.js'

export function dkey(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

export function fmt(min) {
  return String(Math.floor(min / 60)) + ':' +
    String(min % 60).padStart(2, '0')
}

export function toInput(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' +
    String(min % 60).padStart(2, '0')
}

export function fromInput(str) {
  const [h, m] = str.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const useTimelogStore = defineStore('timelog', () => {
  const curDate = ref(new Date())
  const blocks = ref([])
  const selectedBlocks = ref(new Set())
  const clipboard = ref([])
  const dateKey = computed(() => dkey(curDate.value))

  function loadBlocks() {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + dateKey.value)
      blocks.value = raw ? JSON.parse(raw) : []
    } catch (e) { logger.error('timelog', 'loadBlocks failed', e); blocks.value = [] }
  }

  function saveBlocks() {
    if (blocks.value.length) {
      localStorage.setItem(KEY_PREFIX + dateKey.value,
        JSON.stringify(blocks.value))
    } else {
      localStorage.removeItem(KEY_PREFIX + dateKey.value)
    }
  }

  function addBlock(rec) {
    blocks.value.push(rec)
    saveBlocks()
  }

  function updateBlock(rec) {
    const idx = blocks.value.findIndex(b => b.id === rec.id)
    if (idx !== -1) blocks.value[idx] = rec
    else blocks.value.push(rec)
    saveBlocks()
  }

  function deleteBlock(id) {
    blocks.value = blocks.value.filter(b => b.id !== id)
    selectedBlocks.value.delete(id)
    saveBlocks()
  }

  function deleteSelectedBlocks() {
    const ids = selectedBlocks.value
    blocks.value = blocks.value.filter(b => !ids.has(b.id))
    selectedBlocks.value.clear()
    saveBlocks()
  }

  function copySelected() {
    if (!selectedBlocks.value.size) return false
    clipboard.value = blocks.value
      .filter(b => selectedBlocks.value.has(b.id))
      .sort((a, b) => a.start - b.start)
      .map(b => ({
        start: b.start, end: b.end,
        title: b.title, note: b.note,
        tags: [...(b.tags || [])]
      }))
    return true
  }

  function pasteBlocks(targetMin) {
    if (!clipboard.value.length) return []
    const offset = targetMin - clipboard.value[0].start
    const newBlocks = []
    clipboard.value.forEach(b => {
      const nb = {
        ...b,
        id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
        start: b.start + offset,
        end: b.end + offset,
        tags: [...(b.tags || [])]
      }
      blocks.value.push(nb)
      newBlocks.push(nb)
    })
    saveBlocks()
    return newBlocks
  }

  function setDate(d) {
    curDate.value = d
    selectedBlocks.value.clear()
    loadBlocks()
  }

  function goNextDay() {
    const n = new Date(curDate.value)
    n.setDate(n.getDate() + 1)
    setDate(n)
  }

  function goPrevDay() {
    const n = new Date(curDate.value)
    n.setDate(n.getDate() - 1)
    setDate(n)
  }

  function goToday() {
    setDate(new Date())
  }

  // Color helpers
  function hexA(hex, a) {
    const h = hex.replace('#', '')
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    const r = parseInt(n.slice(0, 2), 16) || 0
    const g = parseInt(n.slice(2, 4), 16) || 0
    const b = parseInt(n.slice(4, 6), 16) || 0
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
  }
  function boostHex(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
    const mean = (r + g + b) / 3
    const f = 1 - amount * 0.3
    const s = 1 + amount * 0.25
    return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, mean + (c - mean) * s)) * f).toString(16).padStart(2, '0')).join('')
  }

  function colorOf(name) {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + 'tags')
      const tags = raw ? JSON.parse(raw) : []
      const t = tags.find(t => t.name === name)
      const hex = t ? t.color : '#8A8A8A'
      // Read blockOpacity from localStorage directly to avoid cross-store import
      const blockOpacity = parseInt(localStorage.getItem(KEY_PREFIX + 'blockOpacity')) || 15
      if (blockOpacity > 100) {
        const bh = boostHex(hex, (blockOpacity - 100) / 100)
        return { hex: hex, bg: bh }
      }
      const alpha = Math.min(blockOpacity, 100) / 100
      return { hex: hex, bg: hexA(hex, alpha) }
    } catch (e) { return { hex: '#C4C3C0', bg: '#F0EFED' } }
  }

  loadBlocks()

  return {
    curDate, blocks, selectedBlocks, clipboard, dateKey,
    loadBlocks, saveBlocks, addBlock, updateBlock, deleteBlock,
    deleteSelectedBlocks, copySelected, pasteBlocks, setDate,
    goNextDay, goPrevDay, goToday, colorOf,
  }
})

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
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' +
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

  // Tag color lookup — reads directly from localStorage
  // Will be replaced by tag store (Task 4)
  function colorOf(name) {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + 'tags')
      const tags = raw ? JSON.parse(raw) : []
      const t = tags.find(t => t.name === name)
      if (!t) return { hex: '#C4C3C0', bg: '#F0EFED' }
      return { hex: t.color, bg: t.color + '22' }
    } catch (e) { logger.error('timelog', 'colorOf failed', e); return { hex: '#C4C3C0', bg: '#F0EFED' } }
  }

  loadBlocks()

  return {
    curDate, blocks, selectedBlocks, clipboard, dateKey,
    loadBlocks, saveBlocks, addBlock, updateBlock, deleteBlock,
    deleteSelectedBlocks, copySelected, pasteBlocks, setDate,
    goNextDay, goPrevDay, goToday, colorOf,
  }
})

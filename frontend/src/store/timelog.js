import { defineStore, storeToRefs } from 'pinia'
import { ref, computed } from 'vue'
import { KEY_PREFIX, PX_MIN, DAY_MIN, EDGE } from '../constants.js'
import { useSettingsStore } from './settings.js'
import { logger } from '../utils/log.js'
import { UndoManager } from '../utils/undo.js'

export const storeUndo = new UndoManager()
let _undoing = false

function _pushUndo(entry) {
  if (_undoing) return
  storeUndo.push(entry)
}

function _wrapUndo(fn) {
  _undoing = true
  try { fn() } finally { _undoing = false }
}

// Wrap undo/redo so store mutations inside don't record new entries
const _origUndo = storeUndo.undo.bind(storeUndo)
const _origRedo = storeUndo.redo.bind(storeUndo)
storeUndo.undo = () => { let r; _wrapUndo(() => { r = _origUndo() }); return r }
storeUndo.redo = () => { let r; _wrapUndo(() => { r = _origRedo() }); return r }

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
  const settingsStore = useSettingsStore()
  const { blockOpacity: opacityRef } = storeToRefs(settingsStore)

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
    _pushUndo({
      undo: () => { blocks.value = blocks.value.filter(b => b.id !== rec.id); saveBlocks() },
      redo: () => { blocks.value.push(rec); saveBlocks() }
    })
  }

  function updateBlock(rec) {
    const idx = blocks.value.findIndex(b => b.id === rec.id)
    const old = idx !== -1 ? { ...blocks.value[idx], tags: [...(blocks.value[idx].tags || [])] } : null
    if (idx !== -1) blocks.value[idx] = rec
    else blocks.value.push(rec)
    saveBlocks()
    if (old) {
      _pushUndo({
        undo: () => { const i = blocks.value.findIndex(b => b.id === rec.id); if (i !== -1) { blocks.value[i] = old; saveBlocks() } },
        redo: () => { const i = blocks.value.findIndex(b => b.id === rec.id); if (i !== -1) { blocks.value[i] = rec; saveBlocks() } }
      })
    }
  }

  function deleteBlock(id) {
    const block = blocks.value.find(b => b.id === id)
    if (!block) return
    const rec = { ...block, tags: [...(block.tags || [])] }
    blocks.value = blocks.value.filter(b => b.id !== id)
    selectedBlocks.value.delete(id)
    saveBlocks()
    _pushUndo({
      undo: () => { blocks.value.push(rec); saveBlocks() },
      redo: () => { blocks.value = blocks.value.filter(b => b.id !== id); selectedBlocks.value.delete(id); saveBlocks() }
    })
  }

  function deleteSelectedBlocks() {
    const ids = new Set(selectedBlocks.value)
    const deleted = blocks.value.filter(b => ids.has(b.id)).map(b => ({ ...b, tags: [...(b.tags || [])] }))
    blocks.value = blocks.value.filter(b => !ids.has(b.id))
    selectedBlocks.value.clear()
    saveBlocks()
    if (deleted.length) {
      _pushUndo({
        undo: () => { deleted.forEach(b => { blocks.value.push(b); selectedBlocks.value.add(b.id) }); saveBlocks() },
        redo: () => { blocks.value = blocks.value.filter(b => !ids.has(b.id)); selectedBlocks.value.clear(); saveBlocks() }
      })
    }
  }

  function selectAll() {
    selectedBlocks.value.clear()
    blocks.value.forEach(b => selectedBlocks.value.add(b.id))
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
      const hex = t ? t.color : '#C4C3C0'
      const blockOpacity = opacityRef.value
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
    deleteSelectedBlocks, copySelected, pasteBlocks, selectAll, setDate,
    goNextDay, goPrevDay, goToday, colorOf,
  }
})

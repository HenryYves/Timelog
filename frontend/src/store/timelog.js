import { defineStore, storeToRefs } from 'pinia'
import { ref, computed } from 'vue'
import { KEY_PREFIX, PX_MIN, DAY_MIN, EDGE } from '../constants.js'
import { useSettingsStore } from './settings.js'
import { logger } from '../utils/log.js'
import { UndoManager } from '../utils/undo.js'

export const storeUndo = new UndoManager()
let _undoing = false

export function pushStoreUndo(entry) {
  if (_undoing) return
  storeUndo.push(entry)
}

/** Merge multiple undo/redo pairs into a single undo entry. */
export function batchUndo(items) {
  if (!items.length) return
  pushStoreUndo({
    undo: () => items.forEach(item => item.undo()),
    redo: () => [...items].reverse().forEach(item => item.redo()),
  })
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

export function dateStr(d) {
  // Accept Date or 'YYYY-MM-DD' string
  if (typeof d === 'string') return d
  return dkey(d)
}

export function addDays(ds, n) {
  const d = new Date(ds + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return dkey(d)
}

export function isBefore(a, b) {
  // true if date string a < b
  return a < b
}

export function canCutForward(blocks, dateKey) {
  // Can cut to tomorrow if no block came FROM tomorrow
  return !blocks.some(b => b._cut && isBefore(dateKey, b._cut.sourceDate))
}

export function canCutBackward(blocks, dateKey) {
  // Can cut to yesterday if no block came FROM yesterday
  return !blocks.some(b => b._cut && isBefore(b._cut.sourceDate, dateKey))
}

/**
 * Cut a day at cutAt (minutes), moving blocks to adjacent day.
 * @param {string} sourceDate - 'YYYY-MM-DD' of the day being cut
 * @param {number} cutAt - cut point in minutes (0-1440)
 * @param {'forward'|'backward'} direction - forward=to tomorrow, backward=to yesterday
 */
export function cutDay(sourceDate, cutAt, direction) {
  const targetDate = direction === 'forward'
    ? addDays(sourceDate, 1)
    : addDays(sourceDate, -1)

  const srcKey = KEY_PREFIX + sourceDate
  const tgtKey = KEY_PREFIX + targetDate

  // Load both days
  let srcBlocks = []
  let tgtBlocks = []
  try { srcBlocks = JSON.parse(localStorage.getItem(srcKey)) || [] } catch {}
  try { tgtBlocks = JSON.parse(localStorage.getItem(tgtKey)) || [] } catch {}

  // Snapshot for undo
  const srcSnap = JSON.parse(JSON.stringify(srcBlocks))
  const tgtSnap = JSON.parse(JSON.stringify(tgtBlocks))

  console.log('[cut] cutDay START srcKey:', srcKey, 'tgtKey:', tgtKey, 'cutAt:', cutAt, 'direction:', direction, 'srcBlocks:', srcBlocks.length, 'tgtBlocks before:', tgtBlocks.length)
  // Validate constraint
  if (direction === 'forward' && !canCutForward(tgtBlocks, targetDate)) { console.log('[cut] cutDay BLOCKED: canCutForward false'); return false }
  if (direction === 'backward' && !canCutBackward(tgtBlocks, targetDate)) { console.log('[cut] cutDay BLOCKED: canCutBackward false'); return false }

  // Filter out existing _cut blocks from srcBlocks (they stay)
  const normalBlocks = srcBlocks.filter(b => !b._cut)
  const existingCutBlocks = srcBlocks.filter(b => b._cut)

  // Find blocks to move
  let toMove, toStay
  if (direction === 'forward') {
    // Move blocks at/after cutAt
    toMove = []
    toStay = []
    normalBlocks.forEach(b => {
      if (b.start >= cutAt) {
        toMove.push({ ...b, tags: [...(b.tags || [])] })
      } else if (b.end > cutAt) {
        // Split — first half stays, second half moves
        const first = { ...b, end: cutAt, tags: [...(b.tags || [])] }
        const second = { ...b, start: cutAt, tags: [...(b.tags || [])] }
        toStay.push(first)
        toMove.push(second)
      } else {
        toStay.push(b)
      }
    })
  } else {
    // backward: Move blocks before cutAt
    toMove = []
    toStay = []
    normalBlocks.forEach(b => {
      if (b.end <= cutAt) {
        toMove.push({ ...b, tags: [...(b.tags || [])] })
      } else if (b.start < cutAt) {
        // Split — first half moves, second half stays
        const first = { ...b, start: b.start, end: cutAt, tags: [...(b.tags || [])] }
        const second = { ...b, start: cutAt, tags: [...(b.tags || [])] }
        toMove.push(first)
        toStay.push(second)
      } else {
        toStay.push(b)
      }
    })
  }

  // Warn on split fragments < 10 min
  // (handled in UI via confirm — see CutConfirm.vue)

  // Mark moved blocks with _cut
  toMove.forEach(b => {
    b._cut = { sourceDate, cutAt }
  })

  // Merge into target day
  // Remove existing _cut blocks from same sourceDate (re-merge)
  tgtBlocks = tgtBlocks.filter(b => !(b._cut && b._cut.sourceDate === sourceDate))
  tgtBlocks.push(...toMove)

  // Recalculate cutAt for all blocks from this sourceDate
  const allFromSource = tgtBlocks.filter(b => b._cut && b._cut.sourceDate === sourceDate)
  if (allFromSource.length) {
    const cutAts = allFromSource.map(b => b._cut.cutAt)
    const mergedCutAt = direction === 'forward'
      ? Math.min(...cutAts)
      : Math.max(...cutAts)
    allFromSource.forEach(b => { b._cut.cutAt = mergedCutAt })

    // Merge same-ID blocks (split halves reunited)
    const seen = new Map()
    const merged = []
    allFromSource.forEach(b => {
      if (seen.has(b.id)) {
        const prev = seen.get(b.id)
        prev.start = Math.min(prev.start, b.start)
        prev.end = Math.max(prev.end, b.end)
      } else {
        seen.set(b.id, b)
        merged.push(b)
      }
    })
    // Replace old from-source blocks with merged
    tgtBlocks = tgtBlocks.filter(b => !(b._cut && b._cut.sourceDate === sourceDate))
    tgtBlocks.push(...merged)
  }

  // Sort: _cut blocks first by start, then non-_cut by start
  const cutBlocks = tgtBlocks.filter(b => b._cut)
  const nonCutBlocks = tgtBlocks.filter(b => !b._cut)
  cutBlocks.sort((a, b) => a.start - b.start)
  nonCutBlocks.sort((a, b) => a.start - b.start)
  tgtBlocks = [...cutBlocks, ...nonCutBlocks]

  // Save src: remaining + existing cut blocks
  srcBlocks = [...toStay, ...existingCutBlocks]
  console.log('[cut] cutDay saving: srcBlocks:', srcBlocks.length, 'toStay:', toStay.length, 'toMove:', toMove.length)
  if (srcBlocks.length) {
    localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
  } else {
    localStorage.removeItem(srcKey)
  }

  // Save target
  if (tgtBlocks.length) {
    localStorage.setItem(tgtKey, JSON.stringify(tgtBlocks))
  } else {
    localStorage.removeItem(tgtKey)
  }
  console.log('[cut] cutDay DONE srcKey:', srcKey, 'src saved:', localStorage.getItem(srcKey), 'tgtKey:', tgtKey, 'tgt saved:', localStorage.getItem(tgtKey))

  // Push undo
  pushStoreUndo({
    undo: () => {
      if (srcSnap.length) localStorage.setItem(srcKey, JSON.stringify(srcSnap))
      else localStorage.removeItem(srcKey)
      if (tgtSnap.length) localStorage.setItem(tgtKey, JSON.stringify(tgtSnap))
      else localStorage.removeItem(tgtKey)
      // Reload if on affected date
      const store = useTimelogStore()
      if (store.dateKey === sourceDate || store.dateKey === targetDate) store.loadBlocks()
    },
    redo: () => {
      if (srcBlocks.length) localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
      else localStorage.removeItem(srcKey)
      if (tgtBlocks.length) localStorage.setItem(tgtKey, JSON.stringify(tgtBlocks))
      else localStorage.removeItem(tgtKey)
      const store = useTimelogStore()
      if (store.dateKey === sourceDate || store.dateKey === targetDate) store.loadBlocks()
    }
  })

  return { sourceDate, targetDate, moved: toMove.length }
}

/**
 * Glue blocks back to their source date.
 * @param {string} hostDate - 'YYYY-MM-DD' where the glue blocks currently live
 * @param {string} sourceDate - 'YYYY-MM-DD' where blocks originated
 */
export function glueBack(hostDate, sourceDate) {
  const hostKey = KEY_PREFIX + hostDate
  const srcKey = KEY_PREFIX + sourceDate

  let hostBlocks = []
  let srcBlocks = []
  try { hostBlocks = JSON.parse(localStorage.getItem(hostKey)) || [] } catch {}
  try { srcBlocks = JSON.parse(localStorage.getItem(srcKey)) || [] } catch {}

  const hostSnap = JSON.parse(JSON.stringify(hostBlocks))
  const srcSnap = JSON.parse(JSON.stringify(srcBlocks))

  // Find glue blocks from sourceDate
  const glueBlocks = hostBlocks.filter(b => b._cut && b._cut.sourceDate === sourceDate)
  if (!glueBlocks.length) return false

  // Remove from host
  hostBlocks = hostBlocks.filter(b => !(b._cut && b._cut.sourceDate === sourceDate))

  // Add to source (strip _cut, merge same-ID)
  glueBlocks.forEach(b => {
    const clean = { ...b }
    delete clean._cut
    const existing = srcBlocks.find(x => x.id === clean.id)
    if (existing) {
      existing.start = Math.min(existing.start, clean.start)
      existing.end = Math.max(existing.end, clean.end)
    } else {
      srcBlocks.push(clean)
    }
  })

  // Sort source
  srcBlocks.sort((a, b) => a.start - b.start)

  // Save
  if (hostBlocks.length) localStorage.setItem(hostKey, JSON.stringify(hostBlocks))
  else localStorage.removeItem(hostKey)
  if (srcBlocks.length) localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
  else localStorage.removeItem(srcKey)

  // Undo
  pushStoreUndo({
    undo: () => {
      if (hostSnap.length) localStorage.setItem(hostKey, JSON.stringify(hostSnap))
      else localStorage.removeItem(hostKey)
      if (srcSnap.length) localStorage.setItem(srcKey, JSON.stringify(srcSnap))
      else localStorage.removeItem(srcKey)
      const store = useTimelogStore()
      if (store.dateKey === hostDate || store.dateKey === sourceDate) store.loadBlocks()
    },
    redo: () => {
      if (hostBlocks.length) localStorage.setItem(hostKey, JSON.stringify(hostBlocks))
      else localStorage.removeItem(hostKey)
      if (srcBlocks.length) localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
      else localStorage.removeItem(srcKey)
      const store = useTimelogStore()
      if (store.dateKey === hostDate || store.dateKey === sourceDate) store.loadBlocks()
    }
  })

  return { hostDate, sourceDate, moved: glueBlocks.length }
}

/**
 * Split blocks array into fromPrev / today / fromNext groups.
 */
export function getGlueBlocks(blocks, hostDate) {
  const fromPrev = []
  const fromNext = []
  const today = []
  blocks.forEach(b => {
    if (b._cut) {
      if (isBefore(b._cut.sourceDate, hostDate)) fromPrev.push(b)
      else fromNext.push(b)
    } else {
      today.push(b)
    }
  })
  return { fromPrev, fromNext, today }
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
    pushStoreUndo({
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
      pushStoreUndo({
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
    pushStoreUndo({
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
      pushStoreUndo({
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

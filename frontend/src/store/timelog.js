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

/** 统一坐标 → 带符号时间：昨天帧 -hh:mm，今天帧 hh:mm，明天帧 +hh:mm */
export function fmtSigned(min) {
  if (min < DAY_MIN) return '-' + fmt(min)
  if (min < 2 * DAY_MIN) return fmt(min - DAY_MIN)
  return '+' + fmt(min - 2 * DAY_MIN)
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

/**
 * UI 级检查：源日能否向目标方向剪切（只看源日自身状态）。
 * cutDay 另在运行时用双方 _cutMeta 做完整双向检查。
 */
export function canCutForward(srcMeta) {
  return !srcMeta.fromNext  // 已有来自明天的胶水 = 不能便是明朝
}

export function canCutBackward(srcMeta) {
  return !srcMeta.fromPrev  // 已有来自昨天的胶水 = 不能溯与昨宵
}

/**
 * 运行时双向检查（cutDay 内使用，可读双方数据）。
 */
function checkCutBidir(srcMeta, tgtMeta, direction, sourceDate, targetDate) {
  if (direction === 'forward') {
    // 源日已有 fromNext（目标→源的逆向）？
    if (srcMeta.fromNext && srcMeta.fromNext.sourceDate === targetDate) return false
    // 目标日 fromPrev 槽被其他人占用？
    if (tgtMeta.fromPrev && tgtMeta.fromPrev.sourceDate !== sourceDate) return false
    // 目标日曾向源日剪切（逆向）？
    if (tgtMeta.toPrev?.targetDate === sourceDate) return false
  } else {
    if (srcMeta.fromPrev && srcMeta.fromPrev.sourceDate === targetDate) return false
    if (tgtMeta.fromNext && tgtMeta.fromNext.sourceDate !== sourceDate) return false
    if (tgtMeta.toNext?.targetDate === sourceDate) return false
  }
  return true
}

/**
 * 今天块在存储坐标中的基准：local = storage - base。
 * - 无剪切：1440（今天帧）
 * - 仅 toNext：0（局部帧 [0, cutAt)）
 * - 仅 toPrev：1440 - cutAt
 * - toPrev + toNext：-cutAt(toPrev)（规范基准，见 cutDay）
 */
export function todayStorageBase() { return DAY_MIN }

/** 今天的本地时间 → 存储坐标（T 键/批量创建等入口） */
export function todayLocalToStorage(s, en) {
  return { start: s + DAY_MIN, end: en + DAY_MIN }
}

/** 统一坐标 → 存储（纯帧检测，不换算） */
export function unifiedToStorage(x) { return x }

/** 本地时间 → 存储坐标，frame 指定帧类型 */
export function localToStorage(s, en, _cutMeta, frame) {
  if (frame === 'today') return { start: s + DAY_MIN, end: en + DAY_MIN }
  if (frame === 'next') return { start: s + 2 * DAY_MIN, end: en + 2 * DAY_MIN }
  return { start: s, end: en }
}

/**
 * Load a day's storage in v2 object format { blocks, _cutMeta }.
 * v1 数组格式自动迁移：无 _cut 的块 +1440 移入今天帧；
 * 带 _cut 的块坐标不变（v1 与 v2 胶水帧约定一致），并从 _cut 标签合成 meta。
 */
function _loadDay(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { blocks: [], _cutMeta: {} }
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      const blocks = data.map(b => b._cut
        ? b
        : { ...b, start: b.start + DAY_MIN, end: b.end + DAY_MIN })
      const meta = {}
      const cut = data.find(b => b._cut)
      if (cut) {
        const dateKey = key.slice(KEY_PREFIX.length)
        const dir = isBefore(cut._cut.sourceDate, dateKey) ? 'fromPrev' : 'fromNext'
        meta[dir] = { sourceDate: cut._cut.sourceDate, cutAt: cut._cut.cutAt }
      }
      return { blocks, _cutMeta: meta }
    }
    return { blocks: data.blocks || [], _cutMeta: data._cutMeta || {} }
  } catch (e) {
    logger.error('timelog', '_loadDay failed', e)
    return { blocks: [], _cutMeta: {} }
  }
}

/** Save a day; remove the key entirely when no blocks and no meta remain. */
function _saveDay(key, blocks, meta) {
  if (!blocks.length && !Object.keys(meta).length) {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, JSON.stringify({ blocks, _cutMeta: meta }))
  }
}

/**
 * Merge same-ID blocks into one (min start / max end).
 * Pieces split across a 1440 frame boundary are shifted back by multiples
 * of 1440 first, so cross-midnight pieces reunite as continuous coordinates
 * (e.g. [1380,1440) + [2880,2940) → [1380,1500)).
 */
function _mergeById(blocks) {
  const groups = new Map()
  blocks.forEach(b => {
    if (!groups.has(b.id)) groups.set(b.id, [])
    groups.get(b.id).push(b)
  })
  const out = []
  groups.forEach(list => {
    if (list.length === 1) { out.push(list[0]); return }
    list.sort((x, y) => x.start - y.start)
    const merged = { ...list[0] }
    for (let i = 1; i < list.length; i++) {
      let p = list[i]
      if (p.start - merged.end >= DAY_MIN) {
        const k = Math.round((p.start - merged.end) / DAY_MIN)
        p = { ...p, start: p.start - DAY_MIN * k, end: p.end - DAY_MIN * k }
      }
      merged.start = Math.min(merged.start, p.start)
      merged.end = Math.max(merged.end, p.end)
      if (p._cut) merged._cut = p._cut
    }
    out.push(merged)
  })
  return out
}

/**
 * Cut a day at cutAt (local minutes), moving blocks to adjacent day.
 * 诚实存储：统一帧坐标只做 ±1440 变换，不留 local offset。
 * cutAt 是今天的本地分钟数，cut = DAY_MIN + cutAt。
 */
export function cutDay(sourceDate, cutAt, direction, dropShort = false) {
  const targetDate = direction === 'forward'
    ? addDays(sourceDate, 1) : addDays(sourceDate, -1)

  const srcData = _loadDay(KEY_PREFIX + sourceDate)
  const tgtData = _loadDay(KEY_PREFIX + targetDate)
  const srcMeta = srcData._cutMeta
  const tgtMeta = tgtData._cutMeta

  if (!checkCutBidir(srcMeta, tgtMeta, direction, sourceDate, targetDate)) return false

  const cut = DAY_MIN + cutAt  // 统一帧切线（块坐标比较用）
  const newCut = direction === 'forward'
    ? Math.min(srcMeta.toNext?.cutAt ?? Infinity, cutAt)
    : Math.max(srcMeta.toPrev?.cutAt ?? 0, cutAt)

  const toMove = []
  const toStay = []
  const push = (list, b, isFrag) => {
    if (isFrag && dropShort && b.end - b.start < 10) return
    list.push(b)
  }

  srcData.blocks.forEach(b => {
    // 胶水块分类
    if (b._cut) {
      if (direction === 'backward' && b.start < DAY_MIN)  // glue-prev 回家
        toMove.push({ ...b, start: b.start + DAY_MIN, end: b.end + DAY_MIN })
      else toStay.push(b)
      return
    }
    // 非今天帧的无 _cut 块（跨帧碎片/遗留）
    if (b.start < DAY_MIN || b.start >= 2 * DAY_MIN) {
      if (direction === 'backward' && b.start >= 0 && b.end <= DAY_MIN)
        toMove.push(b)  // 昨天帧碎片回家（坐标不变）
      else toStay.push(b)
      return
    }
    // 今天帧块
    if (direction === 'forward') {
      if (b.start >= cut) {
        toMove.push({ ...b, start: b.start - DAY_MIN, end: b.end - DAY_MIN })
      } else if (b.end > cut) {
        push(toStay, { ...b, start: b.start, end: cut }, true)
        push(toMove, { ...b, start: cut - DAY_MIN, end: b.end - DAY_MIN }, true)
      } else {
        toStay.push(b)
      }
    } else { // backward
      if (b.end <= cut) {
        toMove.push({ ...b, start: b.start + DAY_MIN, end: b.end + DAY_MIN })
      } else if (b.start < cut) {
        push(toMove, { ...b, start: b.start + DAY_MIN, end: cut + DAY_MIN }, true)
        push(toStay, { ...b, start: cut, end: b.end }, true)
      } else {
        toStay.push(b)
      }
    }
  })

  toMove.forEach(b => { b._cut = { sourceDate, cutAt: newCut } })

  const newTgt = _mergeById([...tgtData.blocks, ...toMove])
  newTgt.forEach(b => { if (b._cut?.sourceDate === sourceDate) b._cut.cutAt = newCut })

  if (direction === 'forward') {
    srcMeta.toNext = { targetDate, cutAt: newCut }
    tgtMeta.fromPrev = { sourceDate, cutAt: newCut }
  } else {
    srcMeta.toPrev = { targetDate, cutAt: newCut }
    tgtMeta.fromNext = { sourceDate, cutAt: newCut }
  }

  _saveDay(KEY_PREFIX + sourceDate, toStay, srcMeta)
  _saveDay(KEY_PREFIX + targetDate, newTgt, tgtMeta)
  storeUndo.clear()
  return { sourceDate, targetDate, moved: toMove.length }
}

/**
 * Glue blocks back to their source date (inverse of cutDay).
 * 诚实存储：只做 ±1440 平移。
 * 空胶水区（meta 存在但 0 块）→ 归还时间，清理 meta。
 */
export function glueBack(hostDate, sourceDate) {
  const hostData = _loadDay(KEY_PREFIX + hostDate)
  const srcData = _loadDay(KEY_PREFIX + sourceDate)
  const fwd = isBefore(sourceDate, hostDate)
  const meta = fwd ? hostData._cutMeta.fromPrev : hostData._cutMeta.fromNext

  let lo, hi, shift
  if (meta) {
    lo = fwd ? meta.cutAt : 2 * DAY_MIN
    hi = fwd ? DAY_MIN : 2 * DAY_MIN + meta.cutAt
    shift = fwd ? DAY_MIN : -DAY_MIN
  } else {
    const tagged = hostData.blocks.filter(b => b._cut?.sourceDate === sourceDate)
    if (!tagged.length) return false
    lo = Math.min(...tagged.map(b => b.start))
    hi = Math.max(...tagged.map(b => b.end))
    shift = lo < DAY_MIN ? DAY_MIN : -DAY_MIN
  }

  const toReturn = []
  const newHost = []
  const pushRet = (b, s) => {
    const r = { ...b, start: b.start + s, end: b.end + s }
    delete r._cut
    toReturn.push(r)
  }
  hostData.blocks.forEach(b => {
    if (b.start >= lo && b.end <= hi) {
      pushRet(b, shift)  // 完全在胶水区内
    } else if (b.start >= lo && b.start < hi) {
      // 跨上界：后半在胶水区
      const keep = { ...b, start: hi }
      delete keep._cut
      newHost.push(keep)
      pushRet({ ...b, end: hi }, shift)
    } else if (b.end > lo && b.end <= hi) {
      // 跨下界：前半在胶水区
      const keep = { ...b, end: lo }
      delete keep._cut
      newHost.push(keep)
      pushRet({ ...b, start: lo }, shift)
    } else if (b.start < lo && b.end > hi) {
      // 横跨整个胶水区
      newHost.push({ ...b, end: lo }, { ...b, start: hi })
      pushRet({ ...b, start: lo, end: hi }, shift)
    } else if (b._cut?.sourceDate === sourceDate && b.start < DAY_MIN && b.end > DAY_MIN) {
      // 跨 00:00 边界的合并块（_cut 标记来自源日）
      const keep = { ...b, end: DAY_MIN }
      delete keep._cut
      newHost.push(keep)
      pushRet({ ...b, start: DAY_MIN }, 0)
    } else {
      newHost.push(b)
    }
  })

  const newSrc = _mergeById([...srcData.blocks, ...toReturn])

  if (fwd) { delete hostData._cutMeta.fromPrev; delete srcData._cutMeta.toNext }
  else { delete hostData._cutMeta.fromNext; delete srcData._cutMeta.toPrev }

  _saveDay(KEY_PREFIX + hostDate, newHost, hostData._cutMeta)
  _saveDay(KEY_PREFIX + sourceDate, newSrc, srcData._cutMeta)
  storeUndo.clear()
  return { hostDate, sourceDate, moved: toReturn.length }
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
  const _cutMeta = ref({})
  const selectedBlocks = ref(new Set())
  const clipboard = ref([])
  const dateKey = computed(() => dkey(curDate.value))
  const settingsStore = useSettingsStore()
  const { blockOpacity: opacityRef } = storeToRefs(settingsStore)

  function loadBlocks() {
    const data = _loadDay(KEY_PREFIX + dateKey.value)
    blocks.value = data.blocks
    _cutMeta.value = data._cutMeta
  }

  function saveBlocks() {
    _saveDay(KEY_PREFIX + dateKey.value, blocks.value, _cutMeta.value)
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
    // 如果今天的时间被剪到了相邻天 → 自动跳转到包含当前时间的页
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (_cutMeta.value.toPrev && nowMin < _cutMeta.value.toPrev.cutAt) {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      setDate(d)  // 被剪到了昨天
    } else if (_cutMeta.value.toNext && nowMin >= _cutMeta.value.toNext.cutAt) {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      setDate(d)  // 被剪到了明天
    }
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
    curDate, blocks, _cutMeta, selectedBlocks, clipboard, dateKey,
    loadBlocks, saveBlocks, addBlock, updateBlock, deleteBlock,
    deleteSelectedBlocks, copySelected, pasteBlocks, selectAll, setDate,
    goNextDay, goPrevDay, goToday, colorOf,
  }
})

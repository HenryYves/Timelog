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

export function canCutForward(blocks, dateKey) {
  // Can cut to tomorrow if no block came FROM tomorrow
  return !blocks.some(b => b._cut && isBefore(dateKey, b._cut.sourceDate))
}

export function canCutBackward(blocks, dateKey) {
  // Can cut to yesterday if no block came FROM yesterday
  return !blocks.some(b => b._cut && isBefore(b._cut.sourceDate, dateKey))
}

/**
 * 今天块在存储坐标中的基准：local = storage - base。
 * - 无剪切：1440（今天帧）
 * - 仅 toNext：0（局部帧 [0, cutAt)）
 * - 仅 toPrev：1440 - cutAt
 * - toPrev + toNext：-cutAt(toPrev)（规范基准，见 cutDay）
 */
export function todayStorageBase(cutMeta) {
  if (cutMeta?.toNext) return cutMeta.toPrev ? -cutMeta.toPrev.cutAt : 0
  if (cutMeta?.toPrev) return DAY_MIN - cutMeta.toPrev.cutAt
  return DAY_MIN
}

/** 今天的本地时间 → 存储坐标（用于 T 键/批量创建等以本地时间构造块的入口） */
export function todayLocalToStorage(s, en, cutMeta) {
  const base = todayStorageBase(cutMeta)
  return { start: s + base, end: en + base }
}

/** 统一坐标（带帧）→ 存储坐标：今天帧按基准换算，胶水帧原样 */
export function unifiedToStorage(x, cutMeta) {
  if (x >= DAY_MIN && x < 2 * DAY_MIN) return x - DAY_MIN + todayStorageBase(cutMeta)
  return x
}

/** 存储坐标 → 本地时间（各帧独立）：lastEnd/EditModal 等需要本地时间的入口使用 */
export function storageToLocal(start, end, cutMeta) {
  const base = todayStorageBase(cutMeta)
  if (start >= base && start < base + DAY_MIN) {
    return { start: start - base, end: end - base }
  }
  // 胶水帧：坐标不变（昨天帧）或 -2880（明天帧）
  if (start < DAY_MIN) return { start, end }
  return { start: start - 2 * DAY_MIN, end: end - 2 * DAY_MIN }
}

/** 本地时间 → 存储坐标（EditModal 保存等入口），frame 指定帧类型 */
export function localToStorage(s, en, cutMeta, frame) {
  if (frame === 'today') {
    const base = todayStorageBase(cutMeta)
    return { start: s + base, end: en + base }
  }
  if (frame === 'prev') return { start: s, end: en }
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
      if (p.start - merged.end >= 1440) {
        const k = Math.round((p.start - merged.end) / 1440)
        p = { ...p, start: p.start - 1440 * k, end: p.end - 1440 * k }
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
 * Cut a day at cutAt (minutes), moving blocks to the adjacent day.
 * v2 统一坐标系：昨天 [0,1440)，今天 [1440,2880)，明天 [2880,4320)。
 *
 * cutAt 为今天的本地时间（0-1440）。今天块的存储基准 base = todayStorageBase(srcMeta)，
 * cutLine = base + cutAt。胶水块（_cut 标记）不参与剪切。
 * 无 _cut 且不在今天帧的块（跨帧碎片/遗留）：backward 时昨天帧部分回家（坐标不变），
 * 其余情况原样保留。
 *
 * 坐标变换（local = x - base）：
 *   moved = x - base + (forward ? 0 : 2880)   → 目标日胶水帧
 *   stay  = x - base + baseNew                → 源日新基准
 *   forward:  baseNew = toPrev ? -toPrev.cutAt : 0
 *   backward: baseNew = toNext ? -newCut : 1440 - newCut
 *
 * 多次剪切合并：forward 取 min(cutAt)，backward 取 max(cutAt)。
 * 00:00 边界处同 ID 的块在目标日合并（跨帧碎片先归一化再 min/max）。
 * 剪切后清空 undo/redo 栈（不支持撤销）。
 *
 * @param {string} sourceDate - 'YYYY-MM-DD' of the day being cut
 * @param {number} cutAt - cut point in LOCAL minutes of the source day (0-1440)
 * @param {'forward'|'backward'} direction - forward=to tomorrow, backward=to yesterday
 * @param {boolean} dropShort - drop split fragments < 10 min
 */
export function cutDay(sourceDate, cutAt, direction, dropShort = false) {
  const targetDate = direction === 'forward'
    ? addDays(sourceDate, 1)
    : addDays(sourceDate, -1)

  const srcKey = KEY_PREFIX + sourceDate
  const tgtKey = KEY_PREFIX + targetDate

  const srcData = _loadDay(srcKey)
  const tgtData = _loadDay(tgtKey)
  const srcMeta = srcData._cutMeta
  const tgtMeta = tgtData._cutMeta

  // Constraint: target must not contain glue from beyond itself
  if (direction === 'forward' && !canCutForward(tgtData.blocks, targetDate)) return false
  if (direction === 'backward' && !canCutBackward(tgtData.blocks, targetDate)) return false

  const base = todayStorageBase(srcMeta)
  const cutLine = base + cutAt
  const newCut = direction === 'forward'
    ? Math.min(srcMeta.toNext?.cutAt ?? Infinity, cutAt)
    : Math.max(srcMeta.toPrev?.cutAt ?? 0, cutAt)
  const baseNew = direction === 'forward'
    ? (srcMeta.toPrev ? -srcMeta.toPrev.cutAt : 0)
    : (srcMeta.toNext ? -newCut : DAY_MIN - newCut)

  const moveX = (x) => x - base + (direction === 'forward' ? 0 : 2 * DAY_MIN)
  const stayX = (x) => x - base + baseNew

  const toMove = []
  const toStay = []

  const pushPiece = (list, b, isFrag) => {
    if (isFrag && dropShort && b.end - b.start < 10) return
    list.push(b)
  }

  srcData.blocks.forEach(b => {
    if (b._cut) { toStay.push(b); return }  // 胶水块不参与剪切
    const isTodayFrame = b.start >= base && b.start < base + DAY_MIN
    if (!isTodayFrame) {
      // 跨帧碎片/遗留：backward 时昨天帧部分回家（坐标不变）
      if (direction === 'backward' && b.start >= 0 && b.end <= DAY_MIN) {
        toMove.push(b)
      } else {
        toStay.push(b)
      }
      return
    }
    if (direction === 'forward') {
      if (b.start >= cutLine) {
        toMove.push({ ...b, start: moveX(b.start), end: moveX(b.end) })
      } else if (b.end > cutLine) {
        pushPiece(toStay, { ...b, start: stayX(b.start), end: stayX(cutLine) }, true)
        pushPiece(toMove, { ...b, start: moveX(cutLine), end: moveX(b.end) }, true)
      } else {
        toStay.push({ ...b, start: stayX(b.start), end: stayX(b.end) })
      }
    } else {
      if (b.end <= cutLine) {
        toMove.push({ ...b, start: moveX(b.start), end: moveX(b.end) })
      } else if (b.start < cutLine) {
        pushPiece(toMove, { ...b, start: moveX(b.start), end: moveX(cutLine) }, true)
        pushPiece(toStay, { ...b, start: stayX(cutLine), end: stayX(b.end) }, true)
      } else {
        toStay.push({ ...b, start: stayX(b.start), end: stayX(b.end) })
      }
    }
  })

  // Tag moved blocks (getGlueBlocks / 旧 UI 仍按 _cut 识别)
  toMove.forEach(b => { b._cut = { sourceDate, cutAt: newCut } })

  // Merge same-ID blocks at the 00:00 boundary into the target day
  const newTgtBlocks = _mergeById([...tgtData.blocks, ...toMove])
  // 统一同来源胶水块的 cutAt（多次剪切合并后的新切口）
  newTgtBlocks.forEach(b => { if (b._cut?.sourceDate === sourceDate) b._cut.cutAt = newCut })

  if (direction === 'forward') {
    srcMeta.toNext = { targetDate, cutAt: newCut }
    tgtMeta.fromPrev = { sourceDate, cutAt: newCut }
  } else {
    srcMeta.toPrev = { targetDate, cutAt: newCut }
    tgtMeta.fromNext = { sourceDate, cutAt: newCut }
  }

  _saveDay(srcKey, toStay, srcMeta)
  _saveDay(tgtKey, newTgtBlocks, tgtMeta)

  // 剪切不支持撤销：清空 undo/redo 栈
  storeUndo.clear()

  return { sourceDate, targetDate, moved: toMove.length }
}

/**
 * Glue blocks back to their source date (inverse of cutDay).
 *
 * 胶水区由 host 的 _cutMeta 决定：
 *   - fromPrev（host = source + 1）：[cutAt, 1440)，粘回时 +1440，
 *     源日保留块同步 +1440 还原今天帧
 *   - fromNext（host = source - 1）：[2880, 2880+cutAt)，粘回时 -1440，
 *     源日保留块 +cutAt 还原
 * 跨 00:00 边界的块在边界处 split（同 ID），属于 source 的一侧粘回。
 * 粘回后清空 undo/redo 栈。
 *
 * @param {string} hostDate - 'YYYY-MM-DD' where the glue blocks currently live
 * @param {string} sourceDate - 'YYYY-MM-DD' where blocks originated
 */
export function glueBack(hostDate, sourceDate) {
  const hostKey = KEY_PREFIX + hostDate
  const srcKey = KEY_PREFIX + sourceDate

  const hostData = _loadDay(hostKey)
  const srcData = _loadDay(srcKey)
  const hostMeta = hostData._cutMeta
  const srcMeta = srcData._cutMeta

  const forwardInv = isBefore(sourceDate, hostDate)  // host = source + 1
  const meta = forwardInv ? hostMeta.fromPrev : hostMeta.fromNext

  // Glue region in host coordinates
  let lo, hi
  if (meta) {
    lo = forwardInv ? meta.cutAt : 2880
    hi = forwardInv ? 1440 : 2880 + meta.cutAt
  } else {
    // Fallback: no meta — identify glue by _cut tags
    const tagged = hostData.blocks.filter(b => b._cut && b._cut.sourceDate === sourceDate)
    if (!tagged.length) return false
    lo = Math.min(...tagged.map(b => b.start))
    hi = Math.max(...tagged.map(b => b.end))
  }  const retShift = forwardInv ? 1440 : -1440
  const toReturn = []
  const newHostBlocks = []
  const pushReturn = (b, shift) => {
    const r = { ...b, start: b.start + shift, end: b.end + shift }
    delete r._cut
    toReturn.push(r)
  }

  hostData.blocks.forEach(b => {
    if (b.end <= lo || b.start >= hi) {
      if (!forwardInv && b.start < 1440 && b.end > 1440) {
        // 跨 00:00 边界的块：边界以上属于 source，split 后粘回（坐标不变）
        const keep = { ...b, end: 1440 }
        delete keep._cut
        newHostBlocks.push(keep)
        pushReturn({ ...b, start: 1440 }, 0)
      } else {
        newHostBlocks.push(b)
      }
    } else if (b.start >= lo && b.end <= hi) {
      pushReturn(b, retShift)  // 完全在胶水区内
    } else {
      // 跨区域边界：split，区外部分留在 host
      if (b.start < lo) {
        const keep = { ...b, end: lo }
        delete keep._cut
        newHostBlocks.push(keep)
      }
      if (b.end > hi) {
        const keep = { ...b, start: hi }
        delete keep._cut
        newHostBlocks.push(keep)
      }
      pushReturn({ ...b, start: Math.max(b.start, lo), end: Math.min(b.end, hi) }, retShift)
    }
  })

  if (!toReturn.length && !meta) return false
  // meta 存在但胶水区无块：依然清理 meta（空胶水区粘回=归还时间，无块可移）

  // Restore source-day blocks to their original frame
  const srcShift = forwardInv
    ? 1440
    : (srcMeta.toPrev ? srcMeta.toPrev.cutAt : (meta ? meta.cutAt : 0))
  const srcBlocks = srcData.blocks.map(b =>
    ({ ...b, start: b.start + srcShift, end: b.end + srcShift }))

  // Merge same-ID blocks (split halves reunite)
  const newSrcBlocks = _mergeById([...srcBlocks, ...toReturn])

  if (forwardInv) {
    delete hostMeta.fromPrev
    delete srcMeta.toNext
  } else {
    delete hostMeta.fromNext
    delete srcMeta.toPrev
  }

  _saveDay(hostKey, newHostBlocks, hostMeta)
  _saveDay(srcKey, newSrcBlocks, srcMeta)

  // 粘回不支持撤销：清空 undo/redo 栈
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

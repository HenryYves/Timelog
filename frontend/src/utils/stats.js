// frontend/src/utils/stats.js
// Stats data computation — pure functions, no Vue dependency.
// Shared by StatsPanel.vue and ExportImagePanel (stats mode).

import { KEY_PREFIX, DAY_MIN, DAY_OFFSET, MIN_PER_HOUR, HOURS_PER_DAY, DAYS_PER_WEEK, HOURS_PER_WEEK, MS_PER_HOUR, MS_PER_DAY } from '../constants.js'
import { localMinToUnified, computePageRange } from '../composables/useCoordConverter.js'
import { extractBlocks } from './dayStorage.js'

// ---- Date helpers ----

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} d - Date 对象
 * @returns {string} 格式化的日期字符串
 */
function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 根据时间范围返回日期数组
 *
 * @param {string} timeRange - 时间范围类型
 * @param {string} customStart - 自定义起始日期
 * @param {string} customEnd - 自定义结束日期
 * @returns {string[]} 日期字符串数组
 *
 * - 为什么 24h/168h 返回多个日期？因为统计需要跨越多天数据
 * - getDaysInRange 返回的是"需要加载数据的日期"，不是"统计范围"
 * - 24h 可能跨越今天和昨天，所以返回两个日期
 */
export function getDaysInRange(timeRange, customStart, customEnd) {
  const now = new Date()
  const days = []
  const r = timeRange
  if (r === 'today') {
    days.push(fmtDate(now))
  } else if (r === '24h') {
    days.push(fmtDate(now))
    const y = new Date(now.getTime() - MS_PER_DAY)
    if (fmtDate(y) !== fmtDate(now)) days.push(fmtDate(y))
  } else if (r === 'week') {

    const dow = now.getDay() || 7
    for (let i = 0; i < dow; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(fmtDate(d))
    }
  } else if (r === '168h') {

    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const d = new Date(now.getTime() - i * MS_PER_DAY)
      days.push(fmtDate(d))
    }
  } else if (r === '7d') {

    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(fmtDate(d))
    }
  } else if (r === 'month') {

    const m = now.getMonth()
    const y = now.getFullYear()
    for (let d = 1; d <= now.getDate(); d++) {
      days.push(fmtDate(new Date(y, m, d)))
    }
  } else if (r === 'custom') {

    if (customStart && customEnd) {
      const s = new Date(customStart)
      const e = new Date(customEnd)
      for (let d = s; d <= e; d.setDate(d.getDate() + 1)) {
        days.push(fmtDate(new Date(d)))
      }
    }
  }
  return [...new Set(days)]
}

/**
 * 加载指定日期的块数据
 *
 * @param {string} dateKey - 日期字符串 "YYYY-MM-DD"
 * @returns {Array} 块数组，每个块包含 start/end（统一帧坐标）
 *
 *
 * - 块的 start/end 使用统一帧坐标存储
 * - 昨天块：[0, 1440)，今天块：[1440, 2880)，明天块：[2880, 4320)
 * - 跨天块会有统一帧跨越 1440 边界的情况（如 [1380, 1500]）
 */
export function loadDayBlocks(dateKey) {
  const raw = localStorage.getItem(KEY_PREFIX + dateKey)
  if (!raw) return []
  try {
    return extractBlocks(JSON.parse(raw))
  } catch { return [] }
}

// ---- Calendar time to unified coordinate conversion ----

/**
 * 将日历日期+时间转换为统一帧坐标（考虑剪刀/胶水）
 *
 * @param {string} dateKey - 日历日期 "YYYY-MM-DD"
 * @param {number} localMin - 本地分钟数 [0, 1439]
 * @param {Function} getCutMeta - (dateKey) => cutMeta
 * @returns {Object} { dateKey, unifiedMin } - 实际日期 + 统一帧坐标
 *
 * 核心逻辑：
 * 1. 无剪刀/胶水：直接返回本地分钟作为统一坐标
 * 2. 有剪刀/胶水：先假设在今天帧 (DAY_OFFSET.today + localMin)，检查是否在 pageRange 内
 * 3. 如果溢出 pageRange，需要找到实际所属的日期：
 *    - 小于 lo：溢出到昨天的明天帧
 *    - 大于等于 hi：溢出到明天的昨天帧
 */
export function calendarTimeToUnified(dateKey, localMin, getCutMeta) {
  const cutMeta = getCutMeta(dateKey)

  // 无剪刀/胶水，直接使用今天帧坐标
  if (!cutMeta) {
    return { dateKey, unifiedMin: DAY_OFFSET.today + localMin }
  }

  const { lo, hi } = computePageRange(cutMeta)

  // 假设在今天帧 (DAY_OFFSET.today + localMin)
  const unifiedMin = DAY_OFFSET.today + localMin

  if (unifiedMin >= lo && unifiedMin < hi) {
    // 在当前日期的 pageRange 内
    return { dateKey, unifiedMin }
  } else if (unifiedMin < lo) {
    // 溢出到昨天：从今天帧变成昨天的"明天帧" (+DAY_MIN)
    const yesterday = addDays(dateKey, -1)
    const yesterdayUnified = unifiedMin + DAY_MIN
    return { dateKey: yesterday, unifiedMin: yesterdayUnified }
  } else {
    // 溢出到明天：从今天帧变成明天的"昨天帧" (-DAY_MIN)
    const tomorrow = addDays(dateKey, 1)
    const tomorrowUnified = unifiedMin - DAY_MIN
    return { dateKey: tomorrow, unifiedMin: tomorrowUnified }
  }
}

/**
 * Helper: add days to a date string
 * @param {string} dateKey - "YYYY-MM-DD"
 * @param {number} days - number of days to add (can be negative)
 * @returns {string} new date string
 */
function addDays(dateKey, days) {
  const d = new Date(dateKey)
  d.setDate(d.getDate() + days)
  return fmtDate(d)
}

// ---- Unrecorded time computation ----

/**
 * Compute the union of block intervals (total covered minutes).
 * 使用统一帧坐标进行区间合并计算。
 * @param {Array} blocks - array of {start, end} objects
 * @returns {number} total minutes covered by union of intervals
 */
export function unionMinutes(blocks) {
  if (!blocks || blocks.length === 0) return 0

  // Sort by start time
  const sorted = [...blocks].sort((a, b) => a.start - b.start)

  let totalMinutes = 0
  let currentStart = sorted[0].start
  let currentEnd = sorted[0].end

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i]

    if (block.start <= currentEnd) {
      // Overlapping or adjacent - merge
      currentEnd = Math.max(currentEnd, block.end)
    } else {
      // Gap found - add current interval to total
      totalMinutes += currentEnd - currentStart
      currentStart = block.start
      currentEnd = block.end
    }
  }

  // Add the last interval
  totalMinutes += currentEnd - currentStart

  return totalMinutes
}

/**
 * Compute total unrecorded minutes across multiple days.
 * 统一帧坐标：每天可能包含胶水区，使用传入的范围计算。
 * @param {Array<string>} days - array of date strings
 * @param {Array<Array>} blocksByDay - array of block arrays, one per day
 * @param {Array<Object>} rangesByDay - optional array of {lo, hi} ranges per day (统一帧坐标)
 * @returns {number} total unrecorded minutes
 */
export function computeUnrecorded(days, blocksByDay, rangesByDay = null) {
  if (!days || days.length === 0) return 0

  let totalUnrecorded = 0

  for (let i = 0; i < days.length; i++) {
    const blocks = blocksByDay[i] || []
    const range = rangesByDay?.[i] || { lo: 0, hi: DAY_MIN }

    // Filter to blocks within this day's visible range and clamp to range boundaries
    const visibleBlocks = blocks
      .filter(b => b.start < range.hi && b.end > range.lo)
      .map(b => ({
        start: Math.max(b.start, range.lo),
        end: Math.min(b.end, range.hi)
      }))

    const recordedMinutes = unionMinutes(visibleBlocks)
    const totalVisible = range.hi - range.lo
    const unrecordedMinutes = totalVisible - recordedMinutes

    totalUnrecorded += unrecordedMinutes
  }

  return totalUnrecorded
}

// ---- Card data aggregation ----

/**
 * @param {Array} cards - card config objects
 * @param {Function} tagGroup - (tagName) => group string
 * @param {Object} tagStore - Pinia tag store (has .colorOf method + .tags array)
 * @param {Object} STR - stats strings (needs .untagged)
 * @param {Object} timeRangeState - { timeRange, customStart, customEnd, now }
 * @param {Object} cutMetaByDay - optional map of dateKey -> cutMeta for computing ranges
 * @returns {Object} map of cardId -> [{tag, minutes, color}]
 */
export function computeCardsData(cards, tagGroup, tagStore, STR, { timeRange, customStart, customEnd, now }, cutMetaByDay = {}) {
  const days = getDaysInRange(timeRange, customStart, customEnd)
  const blocksByDay = days.map(d => loadDayBlocks(d))
  const PAL = ['#A1AFC9', '#F0C7C1', '#C4E0D4', '#B5D8A8', '#FCE38A', '#F36838', '#9370DB', '#20B2AA', '#FF7F50', '#87CEEB']
  const map = {}

  // For 24h/168h, compute exact time window using unified coordinates
  let timeWindow = null
  if (timeRange === '24h' || timeRange === '168h') {
    const nowDate = now || new Date()
    const hours = timeRange === '24h' ? HOURS_PER_DAY : HOURS_PER_WEEK
    const startTime = new Date(nowDate.getTime() - hours * MS_PER_HOUR)

    const getCutMeta = (dk) => cutMetaByDay[dk] || null

    // Convert calendar times to unified coordinates
    const startDateKey = fmtDate(startTime)
    const startLocalMin = startTime.getHours() * MIN_PER_HOUR + startTime.getMinutes()
    const startUnified = calendarTimeToUnified(startDateKey, startLocalMin, getCutMeta)

    const endDateKey = fmtDate(nowDate)
    const endLocalMin = nowDate.getHours() * MIN_PER_HOUR + nowDate.getMinutes()
    const endUnified = calendarTimeToUnified(endDateKey, endLocalMin, getCutMeta)

    timeWindow = {
      startDate: startUnified.dateKey,
      startMin: startUnified.unifiedMin,
      endDate: endUnified.dateKey,
      endMin: endUnified.unifiedMin
    }

  }

  // Compute visible range for each day (统一帧坐标)
  const rangesByDay = days.map((dateKey, idx) => {
    // For absolute time windows (24h/168h), compute precise boundaries
    if (timeWindow) {
      // Default: not in window
      let lo = 0
      let hi = 0

      if (dateKey === timeWindow.startDate && dateKey === timeWindow.endDate) {
        // Same day: [startMin, endMin)
        lo = timeWindow.startMin
        hi = timeWindow.endMin
      } else if (dateKey === timeWindow.startDate) {
        // Start day: [startMin, ∞) - need to find where this day ends
        const cutMeta = cutMetaByDay[dateKey]
        const dayHi = cutMeta?.fromNext
          ? 2880 + cutMeta.fromNext.cutAt
          : 1440 + (cutMeta?.toNext?.cutAt ?? 1440)
        lo = timeWindow.startMin
        hi = dayHi
      } else if (dateKey === timeWindow.endDate) {
        // End day: [0, endMin) - need to find where this day starts
        const cutMeta = cutMetaByDay[dateKey]
        const dayLo = cutMeta?.fromPrev
          ? cutMeta.fromPrev.cutAt
          : 1440 + (cutMeta?.toPrev?.cutAt ?? 0)
        lo = dayLo
        hi = timeWindow.endMin
      } else {
        // Middle days: use full visible range
        const cutMeta = cutMetaByDay[dateKey]
        lo = cutMeta?.fromPrev
          ? cutMeta.fromPrev.cutAt
          : 1440 + (cutMeta?.toPrev?.cutAt ?? 0)
        hi = cutMeta?.fromNext
          ? 2880 + cutMeta.fromNext.cutAt
          : 1440 + (cutMeta?.toNext?.cutAt ?? 1440)
      }

      return { lo, hi }
    }

    const cutMeta = cutMetaByDay[dateKey]
    if (!cutMeta) {
      // No scissors/glue - default to calendar day [0, 1440)
      return { lo: 0, hi: 1440 }
    }
    // Calculate pageRange for this day (same logic as useCoordConverter)
    const lo = cutMeta.fromPrev ? cutMeta.fromPrev.cutAt : 1440 + (cutMeta.toPrev?.cutAt ?? 0)
    const hi = cutMeta.fromNext ? 2880 + cutMeta.fromNext.cutAt : 1440 + (cutMeta.toNext?.cutAt ?? 1440)
    return { lo, hi }
  })

  for (const card of cards) {
    const tagMap = {}
    const exclude = new Set(card.excludeTags || [])
    const groups = card.filterGroups?.length > 0 ? new Set(card.filterGroups) : null

    for (let di = 0; di < days.length; di++) {
      const range = rangesByDay[di]
      for (const b of blocksByDay[di]) {
        // Only count blocks within the visible range
        if (b.start >= range.hi || b.end <= range.lo) continue

        // Clamp block to visible range
        const clampedStart = Math.max(b.start, range.lo)
        const clampedEnd = Math.min(b.end, range.hi)
        const dur = clampedEnd - clampedStart

        const tags = card.onlyFirstTag
          ? [b.tags[0]].filter(Boolean)
          : (b.tags || [])
        let counted = false
        for (const t of tags) {
          if (!exclude.has(t)) {
            if (groups && !groups.has(tagGroup(t))) continue
            tagMap[t] = (tagMap[t] || 0) + dur
            counted = true
          }
        }
        if (!counted && card.includeUntagged) {
          tagMap[STR.untagged] = (tagMap[STR.untagged] || 0) + dur
        }
      }
    }

    // Add unrecorded time if enabled
    if (card.includeUnrecorded) {
      const unrecordedMinutes = computeUnrecorded(days, blocksByDay, rangesByDay)
      if (unrecordedMinutes > 0) {
        tagMap[STR.unrecorded] = unrecordedMinutes
      }
    }

    map[card.id] = Object.entries(tagMap)
      .map(([tag, minutes], idx) => {
        const c = tagStore.colorOf(tag)
        let color = PAL[idx % PAL.length]
        if (c && c.hex && /^#[0-9A-Fa-f]{6}$/.test(c.hex) && c.hex.toUpperCase() !== '#C4C3C0') {
          color = c.hex
        }
        return { tag, minutes, color }
      })
      .sort((a, b) => b.minutes - a.minutes)
  }
  return map
}

// ---- Formatting ----

export function fmtDur(min) {
  if (min >= MIN_PER_HOUR) {
    const h = Math.floor(min / MIN_PER_HOUR)
    const m = min % MIN_PER_HOUR
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${min}m`
}

export function pctOf(data, min) {
  const total = data.reduce((s, d) => s + d.minutes, 0) || 1
  return ((min / total) * 100).toFixed(1) + '%'
}

export function barWidth(data, min) {
  const max = Math.max(...data.map(d => d.minutes), 1)
  return (min / max) * 100
}

// ---- SVG Pie Chart builder ----

const PIE_CX = 350, PIE_CY = 130, PIE_R = 80

export function buildPieChart(data) {
  if (!data.length) return { slices: [], labels: [] }
  const total = data.reduce((s, d) => s + d.minutes, 0)
  if (total === 0) return { slices: [], labels: [] }

  // Single item = full circle — SVG arcs can't draw 360° sweep (start==end point)
  if (data.length === 1) {
    const d = data[0]
    return {
      slices: [{ tag: d.tag, path: `M${PIE_CX},${PIE_CY - PIE_R} A${PIE_R},${PIE_R} 0 1 1 ${PIE_CX},${PIE_CY + PIE_R} A${PIE_R},${PIE_R} 0 1 1 ${PIE_CX},${PIE_CY - PIE_R} Z`, color: d.color, minutes: d.minutes }],
      labels: d.minutes >= 1 ? [{
        tag: d.tag, color: d.color,
        linePoints: `${(PIE_CX + PIE_R + 20).toFixed(1)},${PIE_CY.toFixed(1)} ${(PIE_CX + PIE_R + 55).toFixed(1)},${PIE_CY.toFixed(1)} ${(PIE_CX + PIE_R + 90).toFixed(1)},${PIE_CY.toFixed(1)}`,
        textX: (PIE_CX + PIE_R + 96).toFixed(1), textY: (PIE_CY + 5).toFixed(1), anchor: 'start',
        dataText: fmtDur(d.minutes), pctText: '100.0%',
      }] : [],
    }
  }

  let accDeg = 0
  const items = data.map(d => {
    const spanDeg = (d.minutes / total) * 360
    const startDeg = accDeg
    const endDeg = accDeg + spanDeg
    accDeg = endDeg
    const toRad = (deg) => (deg - 90) * Math.PI / 180
    const sr = toRad(startDeg), er = toRad(endDeg)
    const midDeg = (startDeg + endDeg) / 2
    const midRad = (midDeg - 90) * Math.PI / 180
    const largeArc = spanDeg > 180 ? 1 : 0
    const sx = PIE_CX + PIE_R * Math.cos(sr), sy = PIE_CY + PIE_R * Math.sin(sr)
    const ex = PIE_CX + PIE_R * Math.cos(er), ey = PIE_CY + PIE_R * Math.sin(er)
    return {
      tag: d.tag, color: d.color, minutes: d.minutes,
      path: `M${PIE_CX},${PIE_CY} L${sx.toFixed(2)},${sy.toFixed(2)} A${PIE_R},${PIE_R} 0 ${largeArc} 1 ${ex.toFixed(2)},${ey.toFixed(2)} Z`,
      midRad, spanDeg,
    }
  })

  const MIN_ANGLE = 12
  const sizable = items.filter(s => s.spanDeg >= MIN_ANGLE)
  let labels = sizable.map((s, i) => {
    const cos = Math.cos(s.midRad), sin = Math.sin(s.midRad)
    const isRight = cos >= 0
    const stagger = i % 2
    const r2 = 20 + stagger * 18
    const px = PIE_CX + PIE_R * cos, py = PIE_CY + PIE_R * sin
    const ex = PIE_CX + (PIE_R + r2) * cos, ey = PIE_CY + (PIE_R + r2) * sin
    const lx = isRight ? ex + 35 : ex - 35, ly = ey
    return {
      px, py, ex, ey, lx, ly,
      tx: isRight ? lx + 6 : lx - 6,
      ty: ly + 5,
      anchor: isRight ? 'start' : 'end',
      tag: s.tag, color: s.color, minutes: s.minutes,
    }
  })

  labels.sort((a, b) => a.ty - b.ty)
  const MIN_GAP = 18
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].ty - labels[i - 1].ty < MIN_GAP) {
      const delta = MIN_GAP - (labels[i].ty - labels[i - 1].ty)
      labels[i].ty += delta
      labels[i].ly += delta
      labels[i].ey += delta
    }
  }

  return {
    slices: items.map(s => ({ tag: s.tag, path: s.path, color: s.color, minutes: s.minutes })),
    labels: labels.map(l => ({
      tag: l.tag, color: l.color,
      linePoints: `${l.px.toFixed(1)},${l.py.toFixed(1)} ${l.ex.toFixed(1)},${l.ey.toFixed(1)} ${l.lx.toFixed(1)},${l.ly.toFixed(1)}`,
      textX: l.tx.toFixed(1), textY: l.ty.toFixed(1), anchor: l.anchor,
      dataText: fmtDur(l.minutes),
      pctText: ((l.minutes / total) * 100).toFixed(1) + '%',
    })),
  }
}

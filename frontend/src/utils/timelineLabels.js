/**
 * timelineLabels.js — 时间轴标签生成函数（纯函数，无 Vue 依赖）
 *
 * 为什么需要这些函数？
 * - Timeline.vue 和 ExportImagePanel.vue 各自复制了相同的标签生成逻辑
 * - 两处复用时就应该抽象，避免每次改两遍
 * - 所有坐标使用统一帧，显示时转为本地分钟
 */
import { DAY_MIN, DAY_OFFSET, PX_MIN } from '../constants.js'
import { fmt } from '../store/timelog.js'

/**
 * 生成昨天胶水区标签
 * @param {number|null} cutAt - fromPrev.cutAt，null 表示无胶水
 * @returns {Array<{min: number, text: string, top: number}>}
 */
export function buildGluePrevLabels(cutAt) {
  if (cutAt == null) return []
  const labels = []
  const firstHour = Math.ceil(cutAt / 60) * 60
  for (let min = firstHour; min < DAY_MIN; min += 60) {
    labels.push({
      min,
      text: `-${fmt(min)}`,
      top: (min - cutAt) * PX_MIN,
    })
  }
  return labels
}

/**
 * 生成今天区段标签
 * @param {number} lo - pageRange.lo（统一帧）
 * @param {number} hi - pageRange.hi（统一帧）
 * @returns {Array<{min: number, text: string, top: number}>}
 */
export function buildTodayLabels(lo, hi) {
  const labels = []
  const firstHour = Math.max(Math.ceil(lo / 60) * 60, DAY_OFFSET.today)
  const clampedEnd = Math.min(hi, DAY_OFFSET.next)
  for (let min = firstHour; min <= clampedEnd; min += 60) {
    labels.push({
      min,
      text: fmt(min - DAY_OFFSET.today),
      top: (min - Math.max(lo, DAY_OFFSET.today)) * PX_MIN,
    })
  }
  return labels
}

/**
 * 生成明天胶水区标签
 * @param {number|null} cutAt - fromNext.cutAt，null/falsy 表示无胶水
 * @returns {Array<{min: number, text: string, top: number}>}
 */
export function buildGlueNextLabels(cutAt) {
  if (!cutAt) return []
  const labels = []
  for (let min = 60; min <= cutAt; min += 60) {
    labels.push({
      min,
      text: `+${fmt(min)}`,
      top: min * PX_MIN,
    })
  }
  return labels
}

/**
 * 合并三个区段的标签为时间轴刻度线
 * @param {Array} prevLabels - buildGluePrevLabels 的结果
 * @param {Array} todayLabels - buildTodayLabels 的结果
 * @param {Array} nextLabels - buildGlueNextLabels 的结果
 * @param {Object} gutterHeights - { prev, today, next } 像素高度
 * @returns {Array<{min: number, text: string, y: number}>}
 */
export function mergeAllLabels(prevLabels, todayLabels, nextLabels, gutterHeights) {
  return [
    ...prevLabels.map(l => ({ ...l, y: l.top })),
    ...todayLabels.map(l => ({ ...l, y: gutterHeights.prev * PX_MIN + l.top })),
    ...nextLabels.map(l => ({ ...l, y: (gutterHeights.prev + gutterHeights.today) * PX_MIN + l.top })),
  ]
}

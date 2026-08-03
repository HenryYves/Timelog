/**
 * useCoordConverter — 统一坐标转换 composable
 *
 * 统一坐标系：昨天 [0, 1440)，今天 [1440, 2880)，明天 [2880, 4320)。
 * 渲染坐标系：昨天胶水区 [0, prev)，今天显示区 [prev, prev+today)，明天胶水区 [prev+today, total)。
 * PX_MIN = 1（1 分钟 = 1 像素，缩放前）。
 *
 * 消费 timelog store 的 `_cutMeta`（剪刀/胶水元数据，由 cutDay/glueBack 维护）：
 *   fromPrev — 从昨天末尾剪来的块（cutAt = 昨天剪切点，胶水区高度 = 1440 - cutAt）
 *   fromNext — 从明天开头剪来的块（cutAt = 明天剪切点，胶水区高度 = cutAt）
 *   toPrev   — 今天开头被剪走（cutAt = 今天显示起点）
 *   toNext   — 今天末尾被剪走（cutAt = 今天显示终点）
 */
import { computed } from 'vue'
import { useTimelogStore } from '../store/timelog.js'
import { useSettingsStore } from '../store/settings.js'
import { PX_MIN } from '../constants.js'

export function useCoordConverter() {
  const store = useTimelogStore()
  const settingsStore = useSettingsStore()
  const cutMeta = computed(() => store._cutMeta || {})

  const gutterHeights = computed(() => {
    const prev = cutMeta.value.fromPrev ? 1440 - cutMeta.value.fromPrev.cutAt : 0
    const next = cutMeta.value.fromNext ? cutMeta.value.fromNext.cutAt : 0

    // today 显示范围
    const todayStart = cutMeta.value.toPrev ? cutMeta.value.toPrev.cutAt : 0
    const todayEnd = cutMeta.value.toNext ? cutMeta.value.toNext.cutAt : 1440
    const today = todayEnd - todayStart

    return { prev, today, next }
  })

  const totalHeight = computed(() =>
    gutterHeights.value.prev + gutterHeights.value.today + gutterHeights.value.next
  )

  const todayStart = computed(() => (cutMeta.value.toPrev ? cutMeta.value.toPrev.cutAt : 0) + 1440)
  const todayRange = computed(() => ({
    start: todayStart.value - 1440,
    end: cutMeta.value.toNext ? cutMeta.value.toNext.cutAt : 1440,
  }))

  /** 块（统一帧坐标）→ 渲染 top 像素 */
  function blockTop(block) {
    if (block.start < 1440) {
      const cutAt = cutMeta.value.fromPrev?.cutAt || 0
      return (block.start - cutAt) * PX_MIN
    } else if (block.start < 2880) {
      return gutterHeights.value.prev + (block.start - todayStart.value) * PX_MIN
    } else {
      return gutterHeights.value.prev + gutterHeights.value.today + (block.start - 2880) * PX_MIN
    }
  }

  /** 视口 y 像素（clientY）→ 统一帧分钟数 */
  function yToMinute(y, dayEl) {
    const r = dayEl.getBoundingClientRect()
    const z = (settingsStore.zoom || 100) / 100
    const localY = (y - r.top) / z
    const localMin = Math.round(localY / PX_MIN)

    if (localMin < gutterHeights.value.prev) {
      const cutAt = cutMeta.value.fromPrev?.cutAt || 0
      return cutAt + localMin
    } else if (localMin < gutterHeights.value.prev + gutterHeights.value.today) {
      return todayStart.value + (localMin - gutterHeights.value.prev)
    } else {
      return 2880 + (localMin - gutterHeights.value.prev - gutterHeights.value.today)
    }
  }

  /** 统一帧分钟数 → 渲染 y 像素 */
  function minuteToY(minute) {
    if (minute < 1440) {
      const cutAt = cutMeta.value.fromPrev?.cutAt || 0
      return (minute - cutAt) * PX_MIN
    } else if (minute < 2880) {
      return gutterHeights.value.prev + (minute - todayStart.value) * PX_MIN
    } else {
      return gutterHeights.value.prev + gutterHeights.value.today + (minute - 2880) * PX_MIN
    }
  }

  return {
    gutterHeights,
    totalHeight,
    todayRange,
    blockTop,
    yToMinute,
    minuteToY,
  }
}

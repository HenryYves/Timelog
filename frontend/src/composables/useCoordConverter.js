/**
 * @fileoverview 统一坐标转换 composable
 *
 * ## 为什么需要坐标转换？
 *
 * Timelog 使用"剪刀/胶水"功能将不同日期的时间段拼接显示在同一页面。
 * 这导致需要两套坐标系统：
 *
 * 1. **统一帧坐标**（存储/逻辑坐标）：
 *    - 昨天 [0, 1440)，今天 [1440, 2880)，明天 [2880, 4320)
 *    - 块的 start/end 使用此坐标存储
 *    - 优点：跨天块可以用连续的数字表示（如昨天 23:00-今天 01:00 = [1380, 1500]）
 *
 * 2. **渲染坐标**（像素坐标）：
 *    - 按照实际显示顺序排列：[昨天胶水区 | 今天显示区 | 明天胶水区]
 *    - 用于计算 DOM 元素的 top/height 样式
 *    - 优点：直观对应页面上从上到下的显示顺序
 *
 * ## 剪刀/胶水元数据（cutMeta）
 *
 * `_cutMeta` 由 timelog store 的 cutDay/glueBack 维护，包含 4 种剪切/胶水信息：
 *
 * - **fromPrev**：从昨天末尾剪来胶到今天页面顶部
 *   - `cutAt`：昨天的剪切点（统一帧坐标，范围 [0, 1440)）
 *   - 胶水区高度 = 1440 - cutAt
 *   - 示例：cutAt=1380 表示昨天 23:00 之后的内容（60分钟）胶到今天
 *
 * - **fromNext**：从明天开头剪来胶到今天页面底部
 *   - `cutAt`：明天的剪切点（本地分钟，范围 [0, 1440)）
 *   - 胶水区高度 = cutAt
 *   - 示例：cutAt=120 表示明天 00:00-02:00 的内容（120分钟）胶到今天
 *
 * - **toPrev**：今天开头被剪走给昨天
 *   - `cutAt`：今天显示的起点（本地分钟，范围 [0, 1440)）
 *   - 示例：cutAt=420 表示今天从 07:00 开始显示（00:00-07:00 被剪走）
 *
 * - **toNext**：今天末尾被剪走给明天
 *   - `cutAt`：今天显示的终点（本地分钟，范围 [0, 1440)）
 *   - 示例：cutAt=1380 表示今天显示到 23:00（23:00-24:00 被剪走）
 *
 * ## 坐标系统注意事项
 *
 * - fromPrev.cutAt 是**统一帧坐标**（昨天帧 [0, 1440)）
 * - fromNext.cutAt 是**本地分钟**（明天的本地时间 [0, 1440)）
 * - toPrev.cutAt 和 toNext.cutAt 都是**本地分钟**（今天的本地时间 [0, 1440)）
 *
 * 这种不一致是历史原因造成的，但改动成本太高，所以在使用时需要特别注意。
 */
import { computed } from 'vue'
import { useTimelogStore } from '../store/timelog.js'
import { useSettingsStore } from '../store/settings.js'
import { PX_MIN } from '../constants.js'

/**
 * 坐标转换 composable
 *
 * @returns {Object} 坐标转换相关的计算属性和函数
 */
export function useCoordConverter() {
  const store = useTimelogStore()
  const settingsStore = useSettingsStore()
  const cutMeta = computed(() => store._cutMeta || {})

  /**
   * 计算三个区域的像素高度
   *
   * @returns {Object} { prev, today, next } - 三个区域的高度（像素）
   *
   * 为什么需要这个？
   * - 渲染时需要知道每个区域占多少像素，才能正确定位块的 top 位置
   * - 今天区域的高度会因为 toPrev/toNext 剪切而变化
   */
  const gutterHeights = computed(() => {
    // 昨天胶水区高度 = 昨天被剪下的部分
    // 如果没有 fromPrev，高度为 0
    const prev = cutMeta.value.fromPrev ? 1440 - cutMeta.value.fromPrev.cutAt : 0

    // 明天胶水区高度 = 明天被剪下的部分
    // 如果没有 fromNext，高度为 0
    const next = cutMeta.value.fromNext ? cutMeta.value.fromNext.cutAt : 0

    // 今天显示区高度 = 今天实际显示的时间范围
    // todayStart：今天显示的起点（本地分钟）
    // todayEnd：今天显示的终点（本地分钟）
    const todayStart = cutMeta.value.toPrev ? cutMeta.value.toPrev.cutAt : 0
    const todayEnd = cutMeta.value.toNext ? cutMeta.value.toNext.cutAt : 1440
    const today = todayEnd - todayStart

    return { prev, today, next }
  })

  /**
   * 页面总高度（像素）
   *
   * 为什么需要这个？
   * - 用于设置 .day 容器的总高度
   * - 滚动条范围由此决定
   */
  const totalHeight = computed(() =>
    gutterHeights.value.prev + gutterHeights.value.today + gutterHeights.value.next
  )

  /**
   * 今天区段在统一帧中的起点
   *
   * 为什么是 toPrev.cutAt + 1440？
   * - toPrev.cutAt 是今天显示的起点（本地分钟）
   * - 加 1440 转换为统一帧坐标（今天帧 [1440, 2880)）
   *
   * 注意：这个值用于 blockTop 和 minuteToY 的今天区段计算
   */
  const todayStart = computed(() => (cutMeta.value.toPrev ? cutMeta.value.toPrev.cutAt : 0) + 1440)

  /**
   * 今天区段的本地分钟范围
   *
   * 为什么用本地分钟而不是统一帧？
   * - 用于判断"当前本地时间"（0-1439）是否在今天显示范围内
   * - nowMin（当前时间）是本地分钟，所以 todayRange 也必须是本地分钟才能比较
   * - 例如：现在是 15:00（localMin=900），判断是否在 [toPrev, toNext] 范围内
   *
   * 为什么不能用统一帧？
   * - 如果改成统一帧，就要先把 nowMin 转成统一帧（1440+900=2340）
   * - 但这个转换本身就需要知道 nowMin 是否在今天区段、昨天胶水、还是明天胶水
   * - 陷入循环依赖：判断在哪个区段需要 todayRange，但计算统一帧又需要先知道在哪个区段
   * - 所以 todayRange 必须保持本地分钟，作为第一步判断的依据
   */
  const todayRange = computed(() => ({
    start: todayStart.value - 1440,  // 转回本地分钟
    end: cutMeta.value.toNext ? cutMeta.value.toNext.cutAt : 1440,
  }))

  /**
   * 页面可见的统一帧区间 [lo, hi)
   *
   * 为什么需要 pageRange？
   * - 用于判断"某个统一帧坐标"是否在当前页面显示范围内
   * - 包含昨天胶水区 + 今天显示区 + 明天胶水区
   * - 例如：判断一个块 [1380, 1500] 是否在本页（可能跨越昨天胶水和今天区段）
   *
   * 为什么 lo 和 hi 的计算不对称？
   * - fromPrev.cutAt 是统一帧坐标（昨天帧 [0, 1440)），可以直接作为 lo
   * - fromNext.cutAt 是本地分钟（明天的本地时间），需要加 2880 转成统一帧
   * - 这是历史原因导致的不一致，改动成本太高
   */
  const pageRange = computed(() => {
    const fromPrev = cutMeta.value.fromPrev
    const fromNext = cutMeta.value.fromNext
    const toPrev = cutMeta.value.toPrev
    const toNext = cutMeta.value.toNext

    // 计算起点 (lo)
    // 如果有 fromPrev：昨天胶水区的起点就是页面起点
    // 否则：今天区段的起点（1440 + toPrev.cutAt）就是页面起点
    const lo = fromPrev ? fromPrev.cutAt : 1440 + (toPrev?.cutAt ?? 0)

    // 计算终点 (hi)
    // 如果有 fromNext：明天胶水区的终点（2880 + cutAt）就是页面终点
    // 否则：今天区段的终点（1440 + toNext.cutAt）就是页面终点
    const hi = fromNext ? 2880 + fromNext.cutAt : 1440 + (toNext?.cutAt ?? 1440)

    return { lo, hi }
  })

  /**
   * 将块（统一帧坐标）转换为渲染 top 像素
   *
   * @param {Object} block - 块对象，包含 start 和 end（统一帧坐标）
   * @returns {number} 渲染 top 像素位置
   *
   * 为什么要分三个区间处理？
   * - 块的统一帧坐标不直接对应像素位置
   * - 需要根据块在哪个区域（昨天胶水/今天/明天胶水），使用不同的计算公式
   *
   * 计算公式：
   * - 昨天胶水区 [0, 1440)：(start - fromPrev.cutAt) * PX_MIN
   *   - 为什么减 cutAt？因为昨天胶水区从 cutAt 开始，而渲染从 0 开始
   * - 今天区段 [1440, 2880)：prev高度 + (start - todayStart) * PX_MIN
   *   - 为什么减 todayStart？因为今天可能从 toPrev.cutAt 开始，不是从 1440 开始
   * - 明天胶水区 [2880, 4320)：prev高度 + today高度 + (start - 2880) * PX_MIN
   *   - 为什么减 2880？因为明天帧从 2880 开始
   */
  function blockTop(block) {
    if (block.start < 1440) {
      // 昨天胶水区
      const cutAt = cutMeta.value.fromPrev?.cutAt || 0
      return (block.start - cutAt) * PX_MIN
    } else if (block.start < 2880) {
      // 今天区段
      return gutterHeights.value.prev + (block.start - todayStart.value) * PX_MIN
    } else {
      // 明天胶水区
      return gutterHeights.value.prev + gutterHeights.value.today + (block.start - 2880) * PX_MIN
    }
  }

  /**
   * 将视口 y 像素转换为统一帧分钟数
   *
   * @param {number} y - clientY 坐标（相对于视口）
   * @param {HTMLElement} dayEl - .day 容器元素
   * @returns {number} 统一帧分钟数
   *
   * 为什么需要这个？
   * - 用户点击或拖动时，需要将鼠标位置转换为时间（统一帧坐标）
   * - 创建块、拖动块时都需要此转换
   *
   * 为什么要考虑 zoom？
   * - 用户可以缩放时间线（50%-200%）
   * - 缩放后 1 分钟不再等于 1 像素，需要除以缩放比例
   *
   * 反向计算公式（与 blockTop 相反）：
   * - 先将 clientY 转换为相对于 .day 的本地像素（考虑 zoom）
   * - 再根据像素在哪个区域，反推统一帧坐标
   */
  function yToMinute(y, dayEl) {
    const r = dayEl.getBoundingClientRect()
    const z = (settingsStore.zoom || 100) / 100
    const localY = (y - r.top) / z  // 转换为缩放前的像素
    const localMin = Math.round(localY / PX_MIN)  // 像素转分钟

    if (localMin < gutterHeights.value.prev) {
      // 昨天胶水区
      const cutAt = cutMeta.value.fromPrev?.cutAt || 0
      return cutAt + localMin
    } else if (localMin < gutterHeights.value.prev + gutterHeights.value.today) {
      // 今天区段
      return todayStart.value + (localMin - gutterHeights.value.prev)
    } else {
      // 明天胶水区
      return 2880 + (localMin - gutterHeights.value.prev - gutterHeights.value.today)
    }
  }

  /**
   * 将统一帧分钟数转换为渲染 y 像素
   *
   * @param {number} minute - 统一帧分钟数
   * @returns {number} 渲染 y 像素位置
   *
   * 为什么需要这个？
   * - 用于绘制当前时间红线（nowLine）
   * - 用于滚动到指定时间
   * - 与 blockTop 的区别：这里输入是分钟数，blockTop 输入是块对象
   *
   * 计算公式与 blockTop 相同，只是输入格式不同
   */
  function minuteToY(minute) {
    if (minute < 1440) {
      // 昨天胶水区
      const cutAt = cutMeta.value.fromPrev?.cutAt || 0
      return (minute - cutAt) * PX_MIN
    } else if (minute < 2880) {
      // 今天区段
      return gutterHeights.value.prev + (minute - todayStart.value) * PX_MIN
    } else {
      // 明天胶水区
      return gutterHeights.value.prev + gutterHeights.value.today + (minute - 2880) * PX_MIN
    }
  }

  return {
    gutterHeights,
    totalHeight,
    todayRange,
    pageRange,
    blockTop,
    yToMinute,
    minuteToY,
  }
}

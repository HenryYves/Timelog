/**
 * @fileoverview `v-ellipsis` 指令：为单行截断元素在**真的被截断时**挂 `title` 与
 * `aria-label`，悬浮可看完整内容；未截断则不挂（避免无意义的 tooltip）。
 *
 * 用法：元素需带 `ellipsis` 类（提供 overflow:hidden + text-overflow:ellipsis + nowrap）：
 *   <span class="ellipsis" v-ellipsis>{{ 可变长文本 }}</span>
 *
 * 适用场景：内容长度不可控、且不适合换行的元素（标签名、标题、路径、图表标签等）。
 * **不适用于主操作按钮** —— 按钮文字被截断会让用户看不懂操作。
 *
 * 配合 devOverflow.checkOverflow 使用：带 ellipsis 的元素会被自检跳过（有意截断）。
 */
function apply(el) {
  const text = (el.textContent || '').trim()
  const truncated = el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1
  if (truncated && text) {
    el.setAttribute('title', text)
    el.setAttribute('aria-label', text)
  } else {
    el.removeAttribute('title')
    el.removeAttribute('aria-label')
  }
}

export const vEllipsis = {
  mounted(el) {
    apply(el)
    // 容器尺寸变化(窗口缩放/布局变化)后重新判定
    if (typeof ResizeObserver !== 'undefined') {
      el._ellipsisRO = new ResizeObserver(() => apply(el))
      el._ellipsisRO.observe(el)
    }
  },
  updated: apply,
  unmounted(el) {
    el._ellipsisRO?.disconnect()
    delete el._ellipsisRO
  },
}

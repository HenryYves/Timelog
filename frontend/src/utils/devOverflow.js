/**
 * @fileoverview 开发期布局自检：扫描横向溢出元素并告警（多语言布局把关）。
 *
 * 为什么需要：不同语言的文案长度差异很大，按单一语言调好的布局容易被撑破。
 * 本工具在 DEV 下于**语言切换后**自动检测 `scrollWidth > clientWidth` 的元素，
 * 输出到日志，加语言/改文案时立刻暴露问题，不必靠肉眼逐个界面看。
 *
 * 仅 `import.meta.env.DEV` 生效，生产构建下为空操作。
 * 有意截断的元素（`text-overflow: ellipsis`）会被跳过 —— 那是设计行为，不是溢出。
 *
 * 导出：checkOverflow(label)
 */
import { logger } from './log.js'

function describe(el) {
  const cls = typeof el.className === 'string' ? el.className.trim().replace(/\s+/g, '.') : ''
  return el.tagName + (cls ? '.' + cls : '')
}

/**
 * 扫描当前文档中横向溢出的元素。
 * @param {string} [label] 附加说明（触发时机），会写进日志
 * @returns {Array<{el: Element, over: number}>} 按溢出像素降序
 */
export function checkOverflow(label = '') {
  if (!import.meta.env.DEV || typeof document === 'undefined') return []
  const hits = []
  for (const el of document.querySelectorAll('*')) {
    if (el.clientWidth === 0) continue                                  // 隐藏元素
    if (el.scrollWidth <= el.clientWidth + 1) continue                  // 没溢出
    if (getComputedStyle(el).textOverflow === 'ellipsis') continue      // 有意截断
    hits.push({ el, over: el.scrollWidth - el.clientWidth })
  }
  hits.sort((a, b) => b.over - a.over)
  if (hits.length) {
    logger.warn('layout', `检测到 ${hits.length} 处横向溢出 ${label}`.trim(),
      hits.slice(0, 10).map(h => ({ el: describe(h.el), over: h.over })))
  }
  return hits
}

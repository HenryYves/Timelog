/**
 * @fileoverview 时间块重叠布局 + 视觉样式。
 * 从 Timeline.vue 的 layout() 和 computeBlockStyle() 提取，Timeline.vue 与
 * ExportImagePanel.vue 共享。纯函数，无 Vue 依赖。
 * 导出：layoutOverlap / blockStyle / blockVisualStyle
 */

/**
 * 分组重叠的块并分配 _col / _cols / _span。
 * @param {{ start: number, end: number }[]} blocks — 统一帧坐标
 * @returns {typeof blocks} 排序后的数组（原地修改块对象，添加 _col, _cols, _span）
 */
export function layoutOverlap(blocks) {
  const evs = blocks.slice().sort((a, b) => a.start - b.start || a.end - b.end)
  let i = 0
  while (i < evs.length) {
    let j = i
    let ge = evs[i].end
    while (j + 1 < evs.length && evs[j + 1].start < ge) {
      j++
      ge = Math.max(ge, evs[j].end)
    }
    const grp = evs.slice(i, j + 1)
    const cols = []
    grp.forEach(ev => {
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        if (ev.start >= cols[c]) {
          cols[c] = ev.end
          ev._col = c
          placed = true
          break
        }
      }
      if (!placed) {
        ev._col = cols.length
        cols.push(ev.end)
      }
    })
    grp.forEach(ev => (ev._cols = cols.length))

    // Calculate span: how many consecutive columns each block can expand into
    // Note: ev.start, ev.end are unified frame coordinates (昨天 [0,1440), 今天 [1440,2880), 明天 [2880,4320))
    grp.forEach(ev => {
      let span = 1
      for (let c = ev._col + 1; c < cols.length; c++) {
        // Check if column c is free during [ev.start, ev.end) using unified frame coordinates
        const occupied = grp.some(other => other._col === c && other.start < ev.end && other.end > ev.start)
        if (occupied) break
        span++
      }
      ev._span = span
    })

    i = j + 1
  }
  return evs
}

/**
 * 计算单个时间块的 CSS 定位样式（top/height/left/width）。
 * @param {{ start: number, end: number, _col?: number, _cols?: number, _span?: number }} b — 带布局属性的块
 * @param {(b) => number} blockTop — 块顶部 y 像素位置函数
 * @param {number} PX_MIN — 每分钟对应的像素数
 * @returns {{ top: string, height: string, left: string, width: string }}
 */
export function blockStyle(b, blockTop, PX_MIN) {
  const top = blockTop(b)
  const height = (b.end - b.start) * PX_MIN
  const colW = 100 / (b._cols || 1)
  const left = (b._col || 0) * colW
  const width = (b._span || 1) * colW
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${width}% - 4px)`,
  }
}

/**
 * 计算时间块的视觉样式（背景色、文字色）。
 * @param {{ tags?: string[] }} b — 时间块（只需 tags 字段）
 * @param {(name: string|null) => { hex: string, bg: string }} colorOf — 标签颜色查询函数
 * @returns {{ background: string, color: string }}
 */
export function blockVisualStyle(b, colorOf) {
  const c0 = colorOf((b.tags && b.tags.length) ? b.tags[0] : null)
  return {
    background: c0.bg,
    color: 'var(--text, #2C2C2B)',
  }
}

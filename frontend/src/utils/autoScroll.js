/**
 * @fileoverview 拖拽时边缘自动滚动的纯工具函数。
 * 根据鼠标 Y 坐标和容器边缘距离自动滚动，越靠近边缘越快。
 * 无 Vue 依赖，消费方自行决定何时调用（通常在 requestAnimationFrame 循环中）。
 */

const MAX_EDGE_THRESHOLD = 120  // px，鼠标距离容器边缘多远时开始触发自动滚动
const HEIGHT_DIVISOR = 3        // 容器高度的 1/N 作为上限
const DEFAULT_SPEED = 10        // px/frame，最大滚动速度

/**
 * 根据鼠标 Y 坐标自动滚动容器。
 * @param {HTMLElement} container - 滚动容器
 * @param {number} clientY - 鼠标的 clientY 坐标
 * @param {number} [speed=10] - 最大滚动速度（px/frame）
 * @returns {boolean} 是否发生了滚动
 */
export function autoScrollByEdge(container, clientY, speed = DEFAULT_SPEED) {
  const r = container.getBoundingClientRect()
  const threshold = Math.min(MAX_EDGE_THRESHOLD, r.height / HEIGHT_DIVISOR)
  const topDist = clientY - r.top
  const bottomDist = r.bottom - clientY

  if (topDist >= 0 && topDist < threshold && container.scrollTop > 0) {
    const factor = 1 - topDist / threshold
    container.scrollTop = Math.max(0, container.scrollTop - speed * factor)
    return true
  }
  if (bottomDist >= 0 && bottomDist < threshold && container.scrollTop < container.scrollHeight - container.clientHeight) {
    const factor = 1 - bottomDist / threshold
    container.scrollTop = Math.min(
      container.scrollHeight - container.clientHeight,
      container.scrollTop + speed * factor,
    )
    return true
  }
  return false
}

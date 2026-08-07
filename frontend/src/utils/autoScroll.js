/**
 * @fileoverview 拖拽时边缘自动滚动。
 * - autoScrollByEdge：纯函数，根据边缘距离滚动容器
 * - createAutoScroll：工厂函数，包装 RAF 生命周期，消费方只需提供容器和每帧回调
 * 无 Vue 依赖。
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

/**
 * 创建自动滚动的 RAF 生命周期管理器。
 * @param {() => HTMLElement|null} getContainer - 返回滚动容器（每次 RAF tick 调用以兼容动态 DOM）
 * @param {(x:number, y:number) => void} onFrame - 每次 RAF tick 的回调，传入当前鼠标 clientX/clientY
 * @returns {{ updatePos: (x:number, y:number) => void, start: () => void, stop: () => void }}
 */
export function createAutoScroll(getContainer, onFrame) {
  let _rafId = 0
  let _clientX = 0
  let _clientY = 0

  function _loop() {
    _rafId = 0
    const c = getContainer()
    if (!c) return
    autoScrollByEdge(c, _clientY)
    onFrame(_clientX, _clientY)
    _rafId = requestAnimationFrame(_loop)
  }

  return {
    updatePos(x, y) { _clientX = x; _clientY = y },
    start() { if (!_rafId && getContainer()) { _rafId = requestAnimationFrame(_loop) } },
    stop() { cancelAnimationFrame(_rafId); _rafId = 0 },
  }
}

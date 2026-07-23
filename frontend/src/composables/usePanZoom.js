// frontend/src/composables/usePanZoom.js
// Composable: interactive pan & zoom for an image/canvas preview area.
// Zero timeline dependency — works on any container with a transformed child.

import { ref, reactive, onUnmounted } from 'vue'

export function usePanZoom() {
  const previewWrap = ref(null)
  const previewOffset = reactive({ x: 0, y: 0 })
  const previewScale = ref(1)

  let _panStart = null
  let _panOffset = null

  function onMouseDown(e) {
    _panStart = { x: e.clientX, y: e.clientY }
    _panOffset = { x: previewOffset.x, y: previewOffset.y }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e) {
    if (!_panStart) return
    previewOffset.x = _panOffset.x + (e.clientX - _panStart.x)
    previewOffset.y = _panOffset.y + (e.clientY - _panStart.y)
  }

  function onMouseUp() {
    _panStart = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  function onWheel(e) {
    e.preventDefault()
    const container = previewWrap.value
    if (!container) return
    const rect = container.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.max(0.1, Math.min(5, previewScale.value * factor))

    // Zoom centered on mouse
    previewOffset.x = mx - (mx - previewOffset.x) * (newScale / previewScale.value)
    previewOffset.y = my - (my - previewOffset.y) * (newScale / previewScale.value)
    previewScale.value = newScale
  }

  /**
   * Fit the preview to the container width.
   * @param {number} contentWidth - natural width of the content being previewed (px)
   */
  function fitPreview(contentWidth) {
    const container = previewWrap.value
    if (!container) return
    const scale = container.clientWidth / contentWidth
    previewScale.value = Math.min(scale, 1)
    previewOffset.x = 0
    previewOffset.y = 0
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  onUnmounted(cleanup)

  return {
    previewWrap,
    previewOffset,
    previewScale,
    onMouseDown,
    onWheel,
    fitPreview,
    cleanup,
  }
}

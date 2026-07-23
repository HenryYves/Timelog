// frontend/src/utils/watermark.js
// Staggered-tile watermark overlay builder (like obsidian-export-image).
// Creates a full-size <canvas> at 2x scale, returns a data URL for use as <img> overlay.
// Zero Vue/timeline dependency — works on any width×height.

import { loadImg } from './capture.js'

const DEFAULT_FONT_FAMILY = 'system-ui, sans-serif'
const DEFAULT_TEXT_COLOR = '#888'

/**
 * @param {Object} opts
 * @param {number} opts.width            - output canvas width (px)
 * @param {number} opts.height           - output canvas height (px)
 * @param {string} opts.wmType           - 'text' | 'image'
 * @param {string} [opts.wmText]         - watermark text (wmType='text')
 * @param {string} [opts.wmImage]        - watermark image path or data URL (wmType='image')
 * @param {number} [opts.wmOpacity=30]   - 0–100
 * @param {number} [opts.wmRotation=0]   - degrees (-180..180)
 * @param {number} [opts.wmWidth=200]    - image width (wmType='image')
 * @param {number} [opts.wmHeight=0]     - image height (0=auto from aspect ratio)
 * @param {number} [opts.wmGapX=100]     - horizontal tile gap (px)
 * @param {number} [opts.wmGapY=100]     - vertical tile gap (px)
 * @param {(raw: string) => Promise<string>} resolveAssetUrl - asset resolver (from capture.js)
 * @param {string} [opts.fontFamily]     - font for text watermark
 * @param {string} [opts.textColor]      - colour for text watermark
 * @returns {Promise<string>} data URL of the watermark overlay image (empty string if nothing to draw)
 */
export async function buildWatermarkOverlay({
  width,
  height,
  wmType,
  wmText,
  wmImage,
  wmOpacity = 30,
  wmRotation = 0,
  wmWidth = 200,
  wmHeight = 0,
  wmGapX = 100,
  wmGapY = 100,
  resolveAssetUrl: resolveAsset,
  fontFamily,
  textColor,
}) {
  const W = width
  const H = height
  const gapX = Math.max(0, wmGapX || 0)
  const gapY = Math.max(0, wmGapY || 0)
  const rot = (wmRotation || 0) * Math.PI / 180
  const cos = Math.abs(Math.cos(rot))
  const sin = Math.abs(Math.sin(rot))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  let draw          // (ctx) => void, draws content centered at origin
  let cw, ch        // content size before rotation

  if (wmType === 'text' && wmText) {
    const fontSize = 24
    const ff = fontFamily
      || getComputedStyle(document.body).fontFamily
      || DEFAULT_FONT_FAMILY
    const font = `bold ${fontSize}px ${ff}`
    ctx.font = font
    cw = ctx.measureText(wmText).width
    ch = fontSize * 1.3
    const color = textColor
      || getComputedStyle(document.documentElement).getPropertyValue('--text').trim()
      || DEFAULT_TEXT_COLOR
    draw = (c) => {
      c.font = font
      c.fillStyle = color
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(wmText, 0, 0)
    }
  } else if (wmType === 'image' && wmImage) {
    const wmSrc = await resolveAsset(wmImage)
    if (!wmSrc) return ''
    let img
    try { img = await loadImg(wmSrc) } catch { return '' }
    cw = wmWidth || img.naturalWidth
    ch = wmHeight || (img.naturalHeight * cw / img.naturalWidth)
    draw = (c) => c.drawImage(img, -cw / 2, -ch / 2, cw, ch)
  } else {
    return ''
  }

  // Staggered (brick) layout: horizontal period 2 cells, odd rows offset by one cell
  const SCALE = Math.max(2, window.devicePixelRatio || 1)
  const cellW = cw * cos + ch * sin + gapX
  const cellH = cw * sin + ch * cos + gapY
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  ctx.scale(SCALE, SCALE)
  let row = 0
  for (let y = cellH / 2; y < H + cellH; y += cellH, row++) {
    const xStart = (row % 2 ? 1.5 : 0.5) * cellW
    for (let x = xStart; x < W + cellW; x += 2 * cellW) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      draw(ctx)
      ctx.restore()
    }
  }
  return canvas.toDataURL()
}

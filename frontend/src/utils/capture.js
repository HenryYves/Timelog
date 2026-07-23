// frontend/src/utils/capture.js
// Generic canvas capture utilities — no Vue/timeline dependencies.
// Used by ExportImagePanel and StatsPanel.

import html2canvas from 'html2canvas'
import { DATA_DIR } from '../constants.js'
import { tReadBinary } from './tauri.js'

/** Wrap new Image() in a Promise */
export function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Load image into canvas, scale to maxWidth, return blob + dataUrl + bytes */
export async function compressImage(source, maxWidth) {
  const img = await loadImg(source)
  let w = img.naturalWidth, h = img.naturalHeight
  if (w > maxWidth) {
    h = Math.round(h * maxWidth / w)
    w = maxWidth
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  return { blob, dataUrl: canvas.toDataURL('image/png'), bytes: new Uint8Array(await blob.arrayBuffer()) }
}

// ------ Asset path resolution ------

const assetUrlCache = new Map()

/**
 * Resolve an asset path or data URL to a displayable URL.
 * - Tauri: reads binary from AppData, returns base64 data URL
 * - data: URL (browser dev / legacy): returned as-is
 */
export async function resolveAssetUrl(raw) {
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  if (window.__TAURI__) {
    const cached = assetUrlCache.get(raw)
    if (cached) return cached
    try {
      const bytes = await tReadBinary(DATA_DIR + '/' + raw)
      if (!bytes) return raw
      const ext = (raw.split('.').pop() || 'png').toLowerCase()
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[ext] || 'image/png'
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const url = 'data:' + mime + ';base64,' + btoa(binary)
      assetUrlCache.set(raw, url)
      return url
    } catch (e) { console.error('resolveAssetUrl failed:', raw, e); return raw }
  }
  return raw
}

/** Clear the asset URL cache for a specific path */
export function clearAssetCache(path) { assetUrlCache.delete(path) }

// ------ html2canvas capture ------

/**
 * Capture a DOM element as a canvas.
 * @param {HTMLElement} element
 * @param {Object} opts
 * @param {number} opts.width         - output width
 * @param {number} opts.height        - output height
 * @param {string}  [opts.backgroundColor] - background colour (default: resolve from CSS --canvas)
 * @param {number}  [opts.scale]       - device pixel ratio (default: max(2, window.devicePixelRatio))
 * @param {Function} [opts.onclone]    - extra html2canvas onclone handler
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function captureElement(element, { width, height, backgroundColor, scale, onclone }) {
  if (!element) return null

  await document.fonts.ready
  await new Promise(r => setTimeout(r, 100))

  const bg = backgroundColor
    || getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()
    || '#ffffff'

  return await html2canvas(element, {
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scale: scale || Math.max(2, window.devicePixelRatio || 1),
    useCORS: true,
    backgroundColor: bg,
    onclone(doc) {
      // Default: reparent [data-export-root] to <body> at 0,0 to escape overflow:hidden clipping
      const cloned = doc.querySelector('[data-export-root]')
      if (cloned) {
        doc.body.style.margin = '0'
        doc.body.style.overflow = 'visible'
        doc.body.appendChild(cloned)
        cloned.style.position = 'absolute'
        cloned.style.left = '0'
        cloned.style.top = '0'
        cloned.style.margin = '0'
        cloned.style.transform = 'none'
      }
      // Caller's extra onclone hook
      if (onclone) onclone(doc)
    },
  })
}

// ------ Clipboard ------

/**
 * Copy a canvas to the system clipboard.
 * Tauri: uses clipboard_write_image Rust command (RGBA bytes → base64).
 * Browser: navigator.clipboard.write with ClipboardItem.
 */
export async function copyCanvasToClipboard(canvas) {
  if (!canvas) throw new Error('No canvas to copy')

  if (window.__TAURI__) {
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const bytes = new Uint8Array(imageData.data)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const rgbaBase64 = btoa(binary)
    await window.__TAURI__.core.invoke('clipboard_write_image', {
      width: canvas.width, height: canvas.height, rgbaBase64,
    })
  } else {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  }
}

// ------ File save ------

/**
 * Save a canvas as a PNG file.
 * Tauri: opens native save dialog, writes file.
 * Browser: triggers a download.
 * @param {HTMLCanvasElement} canvas
 * @param {string} defaultFilename - e.g. 'timelog-2026-07-23.png'
 * @returns {Promise<string|null>} Saved file path or null if user cancelled
 */
export async function saveCanvasToFile(canvas, defaultFilename) {
  if (!canvas) throw new Error('No canvas to save')

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))

  if (window.__TAURI__) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const filePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    })
    if (filePath) {
      await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()))
    }
    return filePath  // null if user cancelled
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultFilename
    a.click()
    URL.revokeObjectURL(url)
    return defaultFilename
  }
}

# Export Image 解耦 + StatsPanel 导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract canvas capture/watermark/pan-zoom from ExportImagePanel into reusable modules, then add Ctrl+P export + per-card export to StatsPanel.

**Architecture:** Three new utility modules (`capture.js`, `watermark.js`, `usePanZoom.js`) with zero timeline dependency. ExportImagePanel imports them as glue. StatsPanel imports `capture.js` for Ctrl+P whole-panel and per-card image export.

**Tech Stack:** Vue 3 + Vite + html2canvas + Tauri v2 APIs

## Global Constraints

- WebView2 only, no cross-browser compat needed
- All `npm`/`npx` commands must run from `frontend/` directory
- No code changes without user approval first
- Commit message: English prefix + Chinese description (Conventional Commits)
- 85 tests must stay green

---

### Task 1: Create `frontend/src/utils/capture.js`

**Files:**
- Create: `frontend/src/utils/capture.js`

**Interfaces:**
- Produces: `loadImg`, `compressImage`, `resolveAssetUrl`, `captureCanvas`, `copyCanvasToClipboard`, `saveCanvasToFile`

- [ ] **Step 1: Write the file**

```js
// frontend/src/utils/capture.js
// Generic canvas capture utilities — no Vue/timeline dependencies.
// Used by ExportImagePanel and StatsPanel.

import html2canvas from 'html2canvas'
import { DATA_DIR } from '../constants.js'
import { tReadBinary } from './tauri.js'
import { dkey } from '../store/timelog.js'

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
 * @param {string}  [opts.backgroundColor] - background colour (default: resolve from CSS)
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
```

- [ ] **Step 2: Verify build**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 3: Verify tests still pass**

```
cd /d/a_my/project/html/Timelog/frontend && npm test 2>&1 | tail -5
```
Expected: `6 passed`, `85 passed`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/capture.js
git commit -m "feat: 通用画布捕获工具——captureCanvas/copy/save 从 ExportImagePanel 抽出"
```

---

### Task 2: Create `frontend/src/utils/watermark.js`

**Files:**
- Create: `frontend/src/utils/watermark.js`

**Interfaces:**
- Produces: `buildWatermarkOverlay({width, height, wmType, wmText, wmImage, wmOpacity, wmRotation, wmWidth, wmHeight, wmGapX, wmGapY, resolveAssetUrl, fontFamily?, textColor?})`

- [ ] **Step 1: Write the file**

```js
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
```

- [ ] **Step 2: Verify build**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/watermark.js
git commit -m "feat: 通用水印叠加构建器——从 ExportImagePanel 抽出，支持任意宽高"
```

---

### Task 3: Create `frontend/src/composables/usePanZoom.js`

**Files:**
- Create: `frontend/src/composables/usePanZoom.js`

**Interfaces:**
- Produces: `usePanZoom()` → `{ previewWrap, previewOffset, previewScale, onMouseDown, onWheel, fitPreview, cleanup }`

- [ ] **Step 1: Write the file**

```js
// frontend/src/composables/usePanZoom.js
// Composable: interactive pan & zoom for an image/canvas preview area.
// Zero timeline dependency — works on any container with a transformed child.

import { ref, reactive, onMounted, onUnmounted } from 'vue'

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
```

- [ ] **Step 2: Verify build**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/usePanZoom.js
git commit -m "feat: 预览平移缩放 composable——从 ExportImagePanel 抽出"
```

---

### Task 4: Refactor `ExportImagePanel.vue` to use new modules

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `loadImg`, `compressImage`, `resolveAssetUrl`, `captureElement`, `copyCanvasToClipboard`, `saveCanvasToFile` from `utils/capture.js`
- Consumes: `buildWatermarkOverlay` from `utils/watermark.js`
- Consumes: `usePanZoom` from `composables/usePanZoom.js`

- [ ] **Step 1: Replace script imports and remove extracted functions**

Remove imports that are no longer needed (lines 205-219 area):
```js
// REMOVE: import html2canvas from 'html2canvas'
// REMOVE: import { save } from '@tauri-apps/plugin-dialog'
// REMOVE: import { writeFile } from '@tauri-apps/plugin-fs'
// REMOVE: import { DATA_DIR } from '../constants.js'  (if only used by extracted code)
// REMOVE: import { tWriteBinary, tReadBinary, tEnsureSubDir } from '../utils/tauri.js'
//   → but tWriteBinary, tEnsureSubDir still needed for pickAsset — keep those
//   → tReadBinary no longer needed — remove
```

Add new imports:
```js
import { loadImg, compressImage, resolveAssetUrl, captureElement, copyCanvasToClipboard, saveCanvasToFile } from '../utils/capture.js'
import { buildWatermarkOverlay } from '../utils/watermark.js'
import { usePanZoom } from '../composables/usePanZoom.js'
```

Remove the entire `loadImg`, `compressImage`, `resolveAssetUrl`, `assetUrlCache`, `authorAvatarUrl`/`wmImageUrl` refs and their watchers (lines 266-293 in current file), `captureCanvas`, `doCopy`, `doExport` bodies (but keep wrapper functions).

- [ ] **Step 2: Replace pan/zoom with composable**

Remove lines 319-372 (pan/zoom state, handlers, onMounted/onUnmounted) and replace with:
```js
// Preview pan/zoom
const { previewWrap, previewOffset, previewScale, onMouseDown, onWheel, fitPreview } = usePanZoom()
```

`onMounted` → just call `fitPreview`:
```js
onMounted(() => {
  nextTick(() => fitPreview(settings.exportWidth))
})
```

Template event bindings stay the same (`@mousedown="onMouseDown"`, `@wheel.prevent="onWheel"`, `@dblclick="fitPreview(settings.exportWidth)"`)

- [ ] **Step 3: Replace buildWatermarkOverlay**

Replace the entire `buildWatermarkOverlay` function + its watcher (current lines 433-517) with:
```js
// Watermark overlay
const wmOverlayUrl = ref('')

async function buildWatermark() {
  if (!settings.showWatermark) { wmOverlayUrl.value = ''; return }
  wmOverlayUrl.value = await buildWatermarkOverlay({
    width: settings.exportWidth,
    height: exportHeight.value,
    wmType: settings.wmType,
    wmText: settings.wmText,
    wmImage: settings.wmImage,
    wmOpacity: settings.wmOpacity,
    wmRotation: settings.wmRotation,
    wmWidth: settings.wmWidth,
    wmHeight: settings.wmHeight,
    wmGapX: settings.wmGapX,
    wmGapY: settings.wmGapY,
    resolveAssetUrl,
  })
}

watch(
  () => [settings.showWatermark, settings.wmType, settings.wmText, settings.wmImage,
    settings.wmRotation, settings.wmWidth, settings.wmHeight, settings.wmGapX, settings.wmGapY,
    settings.exportWidth, exportHeight.value],
  buildWatermark,
  { immediate: true }
)
```

Keep `wmOverlayUrl` ref — template still binds `:src="wmOverlayUrl"`.

- [ ] **Step 4: Replace captureCanvas + doCopy + doExport**

Replace `captureCanvas` (lines 641-677) with:
```js
async function captureCanvas() {
  const el = timelineDom.value
  if (!el) return null
  return await captureElement(el, {
    width: settings.exportWidth,
    height: exportHeight.value,
    backgroundColor: settings.bgMode === 'custom'
      ? settings.bgColor
      : getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim(),
  })
}
```

Replace `doCopy` (lines 679-702) with:
```js
async function doCopy() {
  try {
    const canvas = await captureCanvas()
    if (!canvas) return
    await copyCanvasToClipboard(canvas)
    toast(STR.exportImage.copied)
  } catch (e) {
    console.error('Copy failed:', e)
    toast(STR.exportImage.copyFail)
  }
}
```

Replace `doExport` (lines 704-740) with:
```js
async function doExport() {
  try {
    const canvas = await captureCanvas()
    if (!canvas) return
    await saveCanvasToFile(canvas, 'timelog-' + dkey(new Date()) + '.png')
    emit('close')
  } catch (e) {
    console.error('Export failed:', e)
    toast(STR.exportImage.copyFail)
  }
}
```

- [ ] **Step 5: Keep resolveAssetUrl author/wmImage watchers**

The `authorAvatarUrl` and `wmImageUrl` refs and their watchers stay in ExportImagePanel (these bind to template). But change from inline `resolveAssetUrl` to imported one:

```js
// Remove: const assetUrlCache, async function resolveAssetUrl(raw) { ... }
// Keep: const authorAvatarUrl = ref(''), const wmImageUrl = ref('')
// Change watchers to use imported resolveAssetUrl
watch(() => settings.authorAvatar, async v => { authorAvatarUrl.value = await resolveAssetUrl(v) }, { immediate: true })
watch(() => settings.wmImage, async v => { wmImageUrl.value = await resolveAssetUrl(v) }, { immediate: true })
```

Also update `pickAsset` to use `clearAssetCache` instead of direct `assetUrlCache.delete`:
```js
import { clearAssetCache } from '../utils/capture.js'
// ...
clearAssetCache(assetPath)
```

- [ ] **Step 6: Update DATA_DIR import**

Check if `DATA_DIR` is still needed after extraction. It's still used in `pickAsset` → `tWriteBinary(DATA_DIR + '/' + assetPath, compressed)`. Keep it.

- [ ] **Step 7: Verify build**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 8: Verify tests**

```
cd /d/a_my/project/html/Timelog/frontend && npm test 2>&1 | tail -5
```
Expected: `6 passed`, `85 passed`

- [ ] **Step 9: Verify file size**

```
wc -l frontend/src/components/ExportImagePanel.vue
```
Expected: < 700 lines

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue
git commit -m "refactor: ExportImagePanel 解耦——抽走 capture/watermark/panZoom 到独立模块"
```

---

### Task 5: Add export to StatsPanel.vue

**Files:**
- Modify: `frontend/src/components/StatsPanel.vue`
- Modify: `frontend/src/strings.js` (add export button labels)

**Interfaces:**
- Consumes: `captureElement`, `copyCanvasToClipboard`, `saveCanvasToFile` from `utils/capture.js`
- Consumes: `dkey` from `store/timelog.js`

- [ ] **Step 1: Add strings**

In `frontend/src/strings.js`, find the stats section and add:
```js
exportImage: '导出图片',
```

- [ ] **Step 2: Add imports to StatsPanel**

```js
import { captureElement, copyCanvasToClipboard, saveCanvasToFile } from '../utils/capture.js'
import { dkey } from '../store/timelog.js'
```

- [ ] **Step 3: Add Ctrl+P handler**

Add a `ref` for the stats content root and a keydown handler:

Template: on the outermost `<div class="modal stats-modal">` element (line 3), add `ref="statsRoot"` and change `@keydown="trapFocus"` to `@keydown="onStatsKeydown"`:

```html
<div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
  <div class="modal stats-modal" ref="statsRoot" @keydown="onStatsKeydown">
```

Script:
```js
const statsRoot = ref(null)

function onStatsKeydown(e) {
  // Ctrl+P: export whole panel as image
  if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault()
    exportPanel()
    return
  }
  trapFocus(e)
}

async function exportPanel() {
  const el = statsRoot.value
  if (!el) return
  try {
    const canvas = await captureElement(el, {
      width: el.scrollWidth,
      height: el.scrollHeight,
    })
    await saveCanvasToFile(canvas, 'timelog-stats-' + dkey(new Date()) + '.png')
  } catch (e) {
    console.error('Stats export failed:', e)
  }
}
```

- [ ] **Step 4: Add per-card export button in config modal**

In the config modal actions section (line 140-145), add an export button before the existing buttons:

```html
<div class="actions">
  <button v-if="editingCard" class="danger" @click="deleteCard">{{ STR.stats.deleteView }}</button>
  <button v-if="editingCard" @click="exportCard(editingCard.id)">{{ STR.stats.exportImage }}</button>
  <span class="spacer"></span>
  <button @click="closeConfig">{{ STR.stats.cancel }}</button>
  <button class="primary" @click="saveConfig">{{ STR.stats.confirm }}</button>
</div>
```

Script:
```js
async function exportCard(cardId) {
  const el = document.querySelector('.stat-card[data-card-id="' + cardId + '"]')
  if (!el) return
  try {
    const canvas = await captureElement(el, {
      width: el.scrollWidth,
      height: el.scrollHeight,
    })
    const card = cards.value.find(c => c.id === cardId)
    const fn = 'timelog-stats-' + (card?.name || cardId) + '.png'
    await saveCanvasToFile(canvas, fn)
  } catch (e) {
    console.error('Card export failed:', e)
  }
}
```

Also add `data-card-id` to the card div in the template (line 31):
```html
<div class="stat-card" v-for="(card, idx) in cards" :key="card.id" :data-card-id="card.id">
```

- [ ] **Step 5: Verify build**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 6: Verify tests**

```
cd /d/a_my/project/html/Timelog/frontend && npm test 2>&1 | tail -5
```
Expected: `6 passed`, `85 passed`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/StatsPanel.vue frontend/src/strings.js
git commit -m "feat: StatsPanel 支持 Ctrl+P 整面板导出 + 卡片单独导出图片"
```

---

## Verification (end-to-end)

After all 5 tasks:

1. `cd /d/a_my/project/html/Timelog/frontend && npx vite build` — no errors
2. `cd /d/a_my/project/html/Timelog/frontend && npm test` — 6 test files, 85 tests passed
3. `npm run tauri dev` — manual test:
   - ExportImagePanel: all features work (settings, preview pan/zoom, copy, save, watermark, author, block display)
   - StatsPanel: open → Ctrl+P → saves PNG file
   - StatsPanel: card gear → "导出图片" button → saves single card PNG
   - StatsPanel: card export button only shows in edit mode (not create mode)

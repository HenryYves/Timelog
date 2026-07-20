# 导出切图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将一整天时间轴渲染为 PNG 图片导出，带实时预览、作者信息、水印。

**Architecture:** 新建 ExportImagePanel.vue 双栏组件（左设置右 Canvas 预览），Canvas 离屏渲染完整时间轴。设置持久化到 localStorage，预览支持拖拽+滚轮缩放。App.vue 加 More 菜单入口 + Ctrl+P 快捷键。

**Tech Stack:** Vue 3 + Canvas 2D API + Tauri save dialog

## Global Constraints
- 仅 WebView2，不考虑跨浏览器
- 所有用户可见文案走 `strings.js`
- Commit: Conventional Commits（英文前缀+中文描述）
- 改前必须用户同意

---

### Task 1: ExportImagePanel 骨架——双栏布局 + 弹窗结构

**Files:**
- Create: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `props.show: Boolean`, `emit('close')`
- Produces: 弹出式双栏弹窗，左栏占位设置区，右栏占位预览区

- [ ] **Step 1: 创建文件，写入模板骨架**

```vue
<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal export-image-modal" @keydown="trapFocus">
      <h2>{{ STR.exportImage.title }}</h2>
      <div class="export-layout">
        <div class="export-left">
          <!-- settings go here -->
          <p class="placeholder">设置区</p>
        </div>
        <div class="export-right">
          <!-- preview canvas -->
          <canvas ref="previewCanvas" class="preview-canvas"></canvas>
        </div>
      </div>
      <div class="actions">
        <span class="spacer"></span>
        <button @click="emit('close')">{{ STR.exportImage.cancel }}</button>
        <button class="primary" @click="doExport">{{ STR.exportImage.export }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { STR } from '../strings.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const previewCanvas = ref(null)

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')
  const visible = [...focusable].filter(el => el.offsetParent !== null)
  if (!visible.length) { e.preventDefault(); return }
  const idx = visible.indexOf(document.activeElement)
  if (e.shiftKey) {
    e.preventDefault()
    visible[idx <= 0 ? visible.length - 1 : idx - 1].focus()
  } else {
    e.preventDefault()
    visible[idx === -1 || idx >= visible.length - 1 ? 0 : idx + 1].focus()
  }
}

function doExport() {
  // placeholder
}
</script>

<style scoped>
.export-image-modal {
  width: 85vw; max-width: 1100px;
  max-height: calc(85vh / var(--zoom, 1)); overflow: auto;
}
.export-layout { display: flex; gap: 16px; min-height: 400px; }
.export-left {
  width: 360px; flex-shrink: 0;
  max-height: calc(80vh / var(--zoom, 1)); overflow-y: auto;
}
.export-right {
  flex: 1; display: flex; align-items: flex-start; justify-content: center;
  background: var(--soft); border-radius: 8px; overflow: hidden;
  min-height: 400px;
}
.preview-canvas { max-width: 100%; height: auto; }
.actions { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
.spacer { flex: 1; }
.placeholder { color: var(--text2); padding: 20px; }
</style>
```

- [ ] **Step 2: 添加 strings**

在 `frontend/src/strings.js` 的 `exportImage` 段落后追加：

```js
exportImage: {
  title: '导出切图',
  cancel: '取消',
  export: '导出 PNG',
},
```

- [ ] **Step 3: Build 验证**

```bash
cd frontend && npm run build
```

Expected: 无报错，新组件编译通过（但尚未被 App 引用，JS 中未被打包）

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue frontend/src/strings.js
git commit -m "feat: ExportImagePanel骨架——双栏弹窗+占位预览"
```

---

### Task 2: 设置状态管理 + 持久化

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Produces: `settings` reactive object + `loadSettings()` / `saveSettings()` functions

- [ ] **Step 1: 添加设置状态和加载逻辑**

在 `<script setup>` 中加入：

```js
import { reactive, watch } from 'vue'

const SETTINGS_KEY = 'timelog:export-image-settings'

const defaults = {
  // Phase 0 — 时间块显示
  showBlockTitle: true,
  showBlockTime: true,
  showBlockTags: true,
  showBlockNote: true,
  showBlockColorBar: true,
  // Phase 1 — 核心
  bgMode: 'theme',       // 'theme' | 'custom'
  bgColor: '#FFFFFF',
  showGutter: true,
  exportWidth: 800,
  // Phase 2 — 作者
  showAuthor: false,
  authorAvatar: null,     // base64 data URL
  authorName: '',
  authorExtra: '',
  authorAlign: 'center',  // 'left' | 'center' | 'right'
  authorPosition: 'bottom', // 'top' | 'bottom'
  // Phase 3 — 水印
  showWatermark: false,
  wmType: 'text',         // 'text' | 'image'
  wmText: '',
  wmImage: null,          // base64 data URL
  wmOpacity: 30,
  wmRotation: 0,
  wmWidth: 200,
  wmHeight: 0,            // 0 = auto
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
    if (saved) Object.assign(settings, defaults, saved)
  } catch { /* use defaults */ }
}

const settings = reactive({ ...defaults })
loadSettings()

// Debounced save
let _saveTimer
watch(settings, () => {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, 300)
}, { deep: true })
```

- [ ] **Step 2: Build 验证**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue
git commit -m "feat: 导出设置状态管理+localStorage持久化"
```

---

### Task 3: 设置区 UI — Phase 1 核心 + Phase 0 折叠区块

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `settings` reactive from Task 2
- Produces: 设置区 UI with Phase 0 (collapsible) + Phase 1

- [ ] **Step 1: 替换占位设置区为实际表单**

将模板中的 `<p class="placeholder">设置区</p>` 替换为：

```html
<div class="export-settings">
  <!-- Phase 1: Core -->
  <div class="setting-group">
    <label>{{ STR.exportImage.bgMode }}</label>
    <select v-model="settings.bgMode">
      <option value="theme">{{ STR.exportImage.bgTheme }}</option>
      <option value="custom">{{ STR.exportImage.bgCustom }}</option>
    </select>
    <input v-if="settings.bgMode === 'custom'" type="color" v-model="settings.bgColor" />
  </div>

  <div class="setting-group">
    <label><input type="checkbox" v-model="settings.showGutter" /> {{ STR.exportImage.showGutter }}</label>
  </div>

  <div class="setting-group">
    <label>{{ STR.exportImage.exportWidth }}</label>
    <input type="number" v-model.number="settings.exportWidth" min="200" max="4000" step="10" />
    <span class="unit">px</span>
  </div>

  <!-- Phase 0: Block display (collapsible) -->
  <div class="setting-collapse">
    <div class="collapse-header" @click="showBlockOpts = !showBlockOpts">
      <span>{{ STR.exportImage.blockDisplay }}</span>
      <span class="arrow" :class="{ open: showBlockOpts }">▸</span>
    </div>
    <div v-show="showBlockOpts" class="collapse-body">
      <label><input type="checkbox" v-model="settings.showBlockTitle" /> {{ STR.settings.showBlockTitle }}</label>
      <label><input type="checkbox" v-model="settings.showBlockTime" /> {{ STR.settings.showBlockTime }}</label>
      <label><input type="checkbox" v-model="settings.showBlockTags" /> {{ STR.settings.showBlockTags }}</label>
      <label><input type="checkbox" v-model="settings.showBlockNote" /> {{ STR.settings.showBlockNote }}</label>
      <label><input type="checkbox" v-model="settings.showBlockColorBar" /> {{ STR.settings.showBlockColorBar }}</label>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 添加 `showBlockOpts` ref 和缺少的 strings**

```js
const showBlockOpts = ref(false)
```

在 `strings.js` 的 `exportImage` 段追加：

```js
exportImage: {
  title: '导出切图',
  cancel: '取消',
  export: '导出 PNG',
  bgMode: '背景色',
  bgTheme: '跟随主题',
  bgCustom: '自定义',
  showGutter: '包含时间标尺',
  exportWidth: '导出宽度',
  blockDisplay: '时间块显示',
},
```

- [ ] **Step 3: 添加折叠容器 CSS**

```css
.setting-group { margin-bottom: 12px; }
.setting-group label { display: flex; align-items: center; gap: 6px; font-size: 13.5px; }
.setting-group select, .setting-group input[type="number"] {
  border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 13px;
}
.setting-group input[type="number"] { width: 80px; }
.unit { font-size: 12px; color: var(--text2); }
.setting-collapse {
  border: 1px solid var(--border); border-radius: 6px; margin-bottom: 12px;
}
.collapse-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; cursor: pointer; font-size: 13.5px; font-weight: 500;
  user-select: none;
}
.collapse-header:hover { background: var(--soft); }
.arrow { transition: transform 0.2s; font-size: 10px; }
.arrow.open { transform: rotate(90deg); }
.collapse-body {
  padding: 8px 10px 10px; border-top: 1px solid var(--soft);
  display: flex; flex-direction: column; gap: 6px;
}
.collapse-body label { font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
```

- [ ] **Step 4: Build 验证**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue frontend/src/strings.js
git commit -m "feat: 导出设置UI——核心选项+时间块显示折叠区块"
```

---

### Task 4: Canvas 渲染引擎——时间轴绘制

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `settings` reactive, `useTimelogStore`, `useTagStore`
- Produces: `renderToCanvas(canvas, scale)` — draws full timeline to given canvas

- [ ] **Step 1: 实现渲染函数**

在 script 中加入：

```js
import { useTimelogStore, fmt } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { PX_MIN, DAY_MIN, GUTTER_WIDTH } from '../constants.js'
import { mdToHtml } from '../utils/markdown.js'

const timelogStore = useTimelogStore()
const tagStore = useTagStore()

function getBgColor() {
  if (settings.bgMode === 'custom') return settings.bgColor
  // Follow theme: read CSS variable
  return getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#FFFFFF'
}

function renderTimeline(canvas, scale) {
  const ctx = canvas.getContext('2d')
  const w = settings.exportWidth
  const gutterW = settings.showGutter ? GUTTER_WIDTH : 0
  const contentW = w - gutterW
  const minuteH = PX_MIN
  const totalH = DAY_MIN * minuteH

  canvas.width = w
  canvas.height = totalH

  // 1. Background
  ctx.fillStyle = getBgColor()
  ctx.fillRect(0, 0, w, totalH)

  // 2. Gutter (time labels)
  if (settings.showGutter) {
    ctx.fillStyle = '#F0EFED'
    ctx.fillRect(0, 0, gutterW, totalH)
    ctx.fillStyle = '#7D7A75'
    ctx.font = '11px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    for (let h = 0; h < 25; h++) {
      const y = h * 60 * minuteH + 4
      const label = String(h).padStart(2, '0') + ':00'
      ctx.fillText(label, gutterW - 6, y + 10)
    }
    // Separator line
    ctx.strokeStyle = '#E6E5E3'
    ctx.beginPath()
    ctx.moveTo(gutterW, 0)
    ctx.lineTo(gutterW, totalH)
    ctx.stroke()
  }

  // 3. Time blocks
  const blocks = timelogStore.blocks
  const opacity = tagStore.colorOf('')?.opacity // get blockOpacity from store
  blocks.forEach(b => {
    const y = b.start * minuteH
    const h = (b.end - b.start) * minuteH
    const tagColor = b.tags?.length ? tagStore.colorOf(b.tags[0]).hex : '#C4C3C0'

    // Block background
    ctx.fillStyle = tagColor + '26' // light tint with opacity
    ctx.fillRect(gutterW, y, contentW, h)

    // Color bar
    if (settings.showBlockColorBar) {
      ctx.fillStyle = tagColor
      ctx.fillRect(gutterW, y, 4, h)
    }

    const innerX = gutterW + (settings.showBlockColorBar ? 8 : 4)
    let textY = y + 16
    const maxW = contentW - (settings.showBlockColorBar ? 12 : 8)

    // Title
    if (settings.showBlockTitle) {
      ctx.fillStyle = '#2C2C2B'
      ctx.font = '13px -apple-system, sans-serif'
      ctx.fillText(b.title || '(未命名)', innerX, textY)
      textY += 18
    }

    // Time
    if (settings.showBlockTime) {
      ctx.fillStyle = '#7D7A75'
      ctx.font = '11px -apple-system, sans-serif'
      ctx.fillText(fmt(b.start) + '–' + fmt(b.end), innerX, textY)
      textY += 16
    }

    // Tags
    if (settings.showBlockTags && b.tags?.length) {
      ctx.fillStyle = '#7D7A75'
      ctx.font = '11px -apple-system, sans-serif'
      b.tags.forEach((t, ti) => {
        const tc = tagStore.colorOf(t).hex
        ctx.fillStyle = tc
        ctx.fillRect(innerX, textY - 9, 6, 6)
        ctx.fillStyle = '#2C2C2B'
        ctx.fillText(t, innerX + 9, textY)
        textY += 15
      })
    }

    // Note
    if (settings.showBlockNote && b.note) {
      ctx.fillStyle = '#7D7A75'
      ctx.font = '11px -apple-system, sans-serif'
      const lines = b.note.split('\n')
      lines.forEach(line => {
        ctx.fillText(line, innerX, textY)
        textY += 14
      })
    }
  })
}
```

- [ ] **Step 2: 挂载时渲染预览**

在 `onMounted` 中添加：

```js
import { nextTick } from 'vue'

onMounted(() => {
  nextTick(() => updatePreview())
})

function updatePreview() {
  if (!previewCanvas.value) return
  const canvas = previewCanvas.value
  const container = canvas.parentElement
  const scale = container.clientWidth / settings.exportWidth
  canvas.width = container.clientWidth
  canvas.height = DAY_MIN * PX_MIN * scale
  renderTimeline(canvas, scale)
}
```

监听 settings 变化重新渲染：

```js
watch(() => ({ ...settings }), () => {
  requestAnimationFrame(() => updatePreview())
}, { deep: true })
```

- [ ] **Step 3: Build 验证**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue
git commit -m "feat: Canvas渲染引擎——时间轴背景+标尺+时间块绘制"
```

---

### Task 5: 作者信息 + 水印渲染

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `renderTimeline` from Task 4
- Produces: author block + watermark rendering appended to timeline

- [ ] **Step 1: 添加作者信息和水印渲染函数**

在 `renderTimeline` 末尾（`// 3. Time blocks` 循环之后、函数结束前）加入：

```js
  let contentBottom = totalH

  // 4. Author info
  if (settings.showAuthor && (settings.authorName || settings.authorAvatar)) {
    const padding = 20
    const blockH = 60
    const blockY = settings.authorPosition === 'top' ? padding : totalH + padding

    // Avatar
    if (settings.authorAvatar) {
      const img = new Image()
      img.src = settings.authorAvatar
      if (img.complete) {
        let ax
        if (settings.authorAlign === 'left') ax = gutterW + padding
        else if (settings.authorAlign === 'right') ax = w - padding - 40
        else ax = w / 2 - 20
        ctx.drawImage(img, ax, blockY, 40, 40)
      }
    }

    // Text
    const nameY = blockY + 20
    ctx.font = '14px -apple-system, sans-serif'
    ctx.fillStyle = '#2C2C2B'
    let tx
    if (settings.authorAlign === 'left') tx = gutterW + padding + (settings.authorAvatar ? 50 : 0)
    else if (settings.authorAlign === 'right') tx = w - padding - 200
    else tx = w / 2
    ctx.textAlign = settings.authorAlign === 'center' ? 'center' : (settings.authorAlign === 'left' ? 'left' : 'right')
    if (settings.authorName) {
      ctx.fillText(settings.authorName, tx, nameY)
      if (settings.authorExtra) {
        ctx.font = '12px -apple-system, sans-serif'
        ctx.fillStyle = '#7D7A75'
        ctx.fillText(settings.authorExtra, tx, nameY + 18)
      }
    } else if (settings.authorExtra) {
      ctx.fillText(settings.authorExtra, tx, nameY)
    }
    ctx.textAlign = 'left' // reset

    if (settings.authorPosition === 'bottom') contentBottom += blockH + padding * 2
  }

  // 5. Watermark
  if (settings.showWatermark) {
    ctx.save()
    ctx.globalAlpha = settings.wmOpacity / 100

    if (settings.wmType === 'text' && settings.wmText) {
      const cx = w / 2
      const cy = contentBottom / 2
      ctx.translate(cx, cy)
      if (settings.wmRotation) ctx.rotate(settings.wmRotation * Math.PI / 180)
      ctx.font = `bold ${settings.wmWidth / 10}px -apple-system, sans-serif`
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.textAlign = 'center'
      ctx.fillText(settings.wmText, 0, 0)
    } else if (settings.wmType === 'image' && settings.wmImage) {
      const img = new Image()
      img.src = settings.wmImage
      if (img.complete) {
        const cx = w / 2
        const cy = contentBottom / 2
        ctx.translate(cx, cy)
        if (settings.wmRotation) ctx.rotate(settings.wmRotation * Math.PI / 180)
        const iw = settings.wmWidth
        const ih = settings.wmHeight || (img.height / img.width * iw)
        ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih)
      }
    }

    ctx.restore()
  }

  // Update total height to include author block
  if (settings.showAuthor && settings.authorPosition === 'bottom') {
    // canvas height already set; blocks end at totalH
    // author block is drawn below, extending canvas
  }
```

- [ ] **Step 2: 处理作者块对 canvas 高度的影响**

作者块在底部时会扩展画布。在 `renderTimeline` 开始处，如果 `showAuthor && authorPosition === 'bottom'`，增加 `totalH`。

```js
const authorBlockH = (settings.showAuthor && settings.authorPosition === 'bottom') ? 80 : 0
const totalH = DAY_MIN * minuteH + authorBlockH
```

- [ ] **Step 3: 添加 Phase 2 + Phase 3 设置 UI**

在设置区加入作者信息和水印的折叠区块（结构与 Phase 0 类似）。每个区块带开关+子项，子项只在开关打开时显示。

- [ ] **Step 4: 添加头像/水印图片选择功能**

```js
function pickImage(callback) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => callback(reader.result)
    reader.readAsDataURL(file)
  }
  input.click()
}
```

- [ ] **Step 5: Build 验证**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue frontend/src/strings.js
git commit -m "feat: 作者信息+水印渲染+设置UI——图片选择+对齐位置"
```

---

### Task 6: 预览拖拽+滚轮缩放

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `previewCanvas` ref, `updatePreview` from Task 4
- Produces: pan/zoom interaction on preview canvas

- [ ] **Step 1: 添加拖拽和缩放状态**

```js
const previewOffset = reactive({ x: 0, y: 0 })
const previewScale = ref(1)
let _panStart = null
let _panOffset = null

function onPreviewMouseDown(e) {
  _panStart = { x: e.clientX, y: e.clientY }
  _panOffset = { x: previewOffset.x, y: previewOffset.y }
  document.addEventListener('mousemove', onPreviewMouseMove)
  document.addEventListener('mouseup', onPreviewMouseUp)
}

function onPreviewMouseMove(e) {
  if (!_panStart) return
  previewOffset.x = _panOffset.x + (e.clientX - _panStart.x)
  previewOffset.y = _panOffset.y + (e.clientY - _panStart.y)
  applyPreviewTransform()
}

function onPreviewMouseUp() {
  _panStart = null
  document.removeEventListener('mousemove', onPreviewMouseMove)
  document.removeEventListener('mouseup', onPreviewMouseUp)
}

function onPreviewWheel(e) {
  e.preventDefault()
  const rect = previewCanvas.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.1 : 0.9
  const newScale = Math.max(0.1, Math.min(5, previewScale.value * factor))

  // Zoom centered on mouse
  previewOffset.x = mx - (mx - previewOffset.x) * (newScale / previewScale.value)
  previewOffset.y = my - (my - previewOffset.y) * (newScale / previewScale.value)
  previewScale.value = newScale
  applyPreviewTransform()
}

function applyPreviewTransform() {
  if (!previewCanvas.value) return
  previewCanvas.value.style.transform =
    `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale.value})`
  previewCanvas.value.style.transformOrigin = '0 0'
}
```

- [ ] **Step 2: 绑定事件到预览区**

在模板 preview canvas 上加：

```html
<canvas ref="previewCanvas" class="preview-canvas"
  @mousedown="onPreviewMouseDown"
  @wheel.prevent="onPreviewWheel"
></canvas>
```

CSS:

```css
.export-right { cursor: grab; }
.preview-canvas { transition: transform 0.05s ease-out; }
```

- [ ] **Step 3: Build 验证**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue
git commit -m "feat: 预览拖拽平移+滚轮缩放"
```

---

### Task 7: PNG 导出 + 系统保存对话框

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `renderTimeline` from Task 4
- Produces: `doExport()` — renders to offscreen canvas, saves as PNG via Tauri dialog

- [ ] **Step 1: 实现导出函数**

```js
import { dkey } from '../store/timelog.js'

async function doExport() {
  // Render at full resolution
  const offscreen = document.createElement('canvas')
  renderTimeline(offscreen, 1)

  // Get blob
  const blob = await new Promise(resolve => offscreen.toBlob(resolve, 'image/png'))

  // Save via Tauri dialog
  if (window.__TAURI__) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')
      const filePath = await save({
        defaultPath: 'timelog-' + dkey(timelogStore.curDate) + '.png',
        filters: [{ name: 'PNG', extensions: ['png'] }],
      })
      if (filePath) {
        await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()))
      }
    } catch (e) {
      console.error('Export failed:', e)
    }
  } else {
    // Fallback: browser download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'timelog-' + dkey(timelogStore.curDate) + '.png'
    a.click()
    URL.revokeObjectURL(url)
  }

  emit('close')
}
```

- [ ] **Step 2: Build 验证**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue
git commit -m "feat: PNG导出+Tauri系统保存对话框"
```

---

### Task 8: App.vue 集成——More 菜单 + Ctrl+P 快捷键

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 注册组件和状态**

```js
import ExportImagePanel from './components/ExportImagePanel.vue'
// ...
const showExportImage = ref(false)
```

模板中在 More 菜单加入：

```html
<button class="dropdown-item" @click="showExportImage = true; showMore = false">
  <img src="/icons/export-image.svg" alt="">导出切图
</button>
```

模板末尾加入组件：

```html
<ExportImagePanel v-if="showExportImage" :show="showExportImage" @close="showExportImage = false" />
```

- [ ] **Step 2: 添加 Ctrl+P 快捷键**

在 `onWindowKeyDown` 的 input 检查之后（`?` 快捷键之前）添加：

```js
if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
  e.preventDefault()
  showExportImage.value = true
  return
}
```

注意：需要确保 `showExportImage` 在 `onWindowKeyDown` 的作用域内，或者改用 `showExportImage` ref。

- [ ] **Step 3: Build 验证**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat: 导出切图入口——More菜单+Ctrl+P快捷键"
```

---

### Task 9: 最终验证 + 测试

- [ ] **Step 1: 跑测试**

```bash
cd frontend && npm test
```

Expected: 85 tests pass (same as before, no regressions)

- [ ] **Step 2: 完整构建**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 3: Commit any fixes**

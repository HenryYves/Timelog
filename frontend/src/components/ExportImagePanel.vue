<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal export-image-modal" @keydown="trapFocus">
      <h2>{{ STR.exportImage.title }}</h2>
      <div class="export-layout">
        <div class="export-left">
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

            <!-- Phase 2: Author info -->
            <div class="setting-collapse">
              <div class="collapse-header" @click="showAuthorOpts = !showAuthorOpts">
                <span>{{ STR.exportImage.sectionAuthor }}</span>
                <span class="arrow" :class="{ open: showAuthorOpts }">▸</span>
              </div>
              <div v-show="showAuthorOpts" class="collapse-body">
                <label><input type="checkbox" v-model="settings.showAuthor" /> {{ STR.exportImage.showAuthor }}</label>
                <template v-if="settings.showAuthor">
                  <div class="setting-group">
                    <label>{{ STR.exportImage.authorName }}</label>
                    <input type="text" v-model="settings.authorName" />
                  </div>
                  <div class="setting-group">
                    <label>{{ STR.exportImage.authorExtra }}</label>
                    <input type="text" v-model="settings.authorExtra" />
                  </div>
                  <div class="setting-group">
                    <label>{{ STR.exportImage.authorAvatar }}</label>
                    <button @click="pickImage(url => settings.authorAvatar = url)">{{ STR.exportImage.chooseImage }}</button>
                  </div>
                  <div class="setting-group">
                    <div style="font-size:13.5px;margin-bottom:4px">{{ STR.exportImage.authorAlign }}</div>
                    <label><input type="radio" v-model="settings.authorAlign" value="left" /> {{ STR.exportImage.authorAlignLeft }}</label>
                    <label><input type="radio" v-model="settings.authorAlign" value="center" /> {{ STR.exportImage.authorAlignCenter }}</label>
                    <label><input type="radio" v-model="settings.authorAlign" value="right" /> {{ STR.exportImage.authorAlignRight }}</label>
                  </div>
                  <div class="setting-group">
                    <div style="font-size:13.5px;margin-bottom:4px">{{ STR.exportImage.authorPosition }}</div>
                    <label><input type="radio" v-model="settings.authorPosition" value="top" /> {{ STR.exportImage.authorPosTop }}</label>
                    <label><input type="radio" v-model="settings.authorPosition" value="bottom" /> {{ STR.exportImage.authorPosBottom }}</label>
                  </div>
                </template>
              </div>
            </div>

            <!-- Phase 3: Watermark -->
            <div class="setting-collapse">
              <div class="collapse-header" @click="showWatermarkOpts = !showWatermarkOpts">
                <span>{{ STR.exportImage.sectionWatermark }}</span>
                <span class="arrow" :class="{ open: showWatermarkOpts }">▸</span>
              </div>
              <div v-show="showWatermarkOpts" class="collapse-body">
                <label><input type="checkbox" v-model="settings.showWatermark" /> {{ STR.exportImage.showWatermark }}</label>
                <template v-if="settings.showWatermark">
                  <div class="setting-group">
                    <div style="font-size:13.5px;margin-bottom:4px">{{ STR.exportImage.wmType }}</div>
                    <label><input type="radio" v-model="settings.wmType" value="text" /> {{ STR.exportImage.wmTypeText }}</label>
                    <label><input type="radio" v-model="settings.wmType" value="image" /> {{ STR.exportImage.wmTypeImage }}</label>
                  </div>
                  <template v-if="settings.wmType === 'text'">
                    <div class="setting-group">
                      <label>{{ STR.exportImage.wmText }}</label>
                      <input type="text" v-model="settings.wmText" />
                    </div>
                  </template>
                  <template v-if="settings.wmType === 'image'">
                    <div class="setting-group">
                      <label>{{ STR.exportImage.wmImage }}</label>
                      <button @click="pickImage(url => settings.wmImage = url)">{{ STR.exportImage.chooseImage }}</button>
                    </div>
                  </template>
                  <div class="setting-group">
                    <label>{{ STR.exportImage.wmOpacity }}: {{ settings.wmOpacity }}%</label>
                    <input type="range" v-model.number="settings.wmOpacity" min="0" max="100" />
                  </div>
                  <div class="setting-group">
                    <label>{{ STR.exportImage.wmRotation }}: {{ settings.wmRotation }}&deg;</label>
                    <input type="range" v-model.number="settings.wmRotation" min="-180" max="180" />
                  </div>
                  <div class="setting-group">
                    <label>{{ STR.exportImage.wmWidth }}</label>
                    <input type="number" v-model.number="settings.wmWidth" min="10" max="2000" />
                    <span class="unit">px</span>
                  </div>
                  <div class="setting-group">
                    <label>{{ STR.exportImage.wmHeight }}</label>
                    <input type="number" v-model.number="settings.wmHeight" min="0" max="2000" />
                    <span class="unit">px (0=auto)</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div class="export-right">
          <!-- preview canvas -->
          <canvas ref="previewCanvas" class="preview-canvas"
            @mousedown="onPreviewMouseDown"
            @wheel.prevent="onPreviewWheel"
          ></canvas>
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
import { ref, reactive, watch, nextTick, onMounted } from 'vue'

const showBlockOpts = ref(false)
const showAuthorOpts = ref(false)
const showWatermarkOpts = ref(false)
import { STR } from '../strings.js'
import { useTimelogStore, fmt, dkey } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { PX_MIN, DAY_MIN, GUTTER_WIDTH } from '../constants.js'
import { mdToHtml } from '../utils/markdown.js'

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

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const previewCanvas = ref(null)
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

const timelogStore = useTimelogStore()
const tagStore = useTagStore()

function getBgColor() {
  if (settings.bgMode === 'custom') return settings.bgColor
  return getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#FFFFFF'
}

function renderTimeline(canvas, scale) {
  const ctx = canvas.getContext('2d')
  const w = settings.exportWidth
  const gutterW = settings.showGutter ? GUTTER_WIDTH : 0
  const contentW = w - gutterW
  const minuteH = PX_MIN
  const baseContentH = DAY_MIN * minuteH
  const authorExtraH = (settings.showAuthor && settings.authorPosition === 'bottom') ? 80 : 0
  const totalH = baseContentH + authorExtraH

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
  const opacity = tagStore.colorOf('')?.opacity
  blocks.forEach(b => {
    const y = b.start * minuteH
    const h = (b.end - b.start) * minuteH
    const tagColor = b.tags?.length ? tagStore.colorOf(b.tags[0]).hex : '#C4C3C0'

    // Block background
    ctx.fillStyle = tagColor + '26'
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

  // 4. Author info
  if (settings.showAuthor && (settings.authorName || settings.authorAvatar)) {
    const padding = 20
    const blockH = 60
    const blockY = settings.authorPosition === 'top' ? padding : baseContentH + padding

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
    ctx.textAlign = 'left'
  }

  // 5. Watermark
  if (settings.showWatermark) {
    ctx.save()
    ctx.globalAlpha = settings.wmOpacity / 100

    if (settings.wmType === 'text' && settings.wmText) {
      const cx = w / 2
      const cy = totalH / 2
      ctx.translate(cx, cy)
      if (settings.wmRotation) ctx.rotate(settings.wmRotation * Math.PI / 180)
      ctx.font = `bold ${Math.max(12, settings.wmWidth / 10)}px -apple-system, sans-serif`
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.textAlign = 'center'
      ctx.fillText(settings.wmText, 0, 0)
    } else if (settings.wmType === 'image' && settings.wmImage) {
      const img = new Image()
      img.src = settings.wmImage
      if (img.complete) {
        const cx = w / 2
        const cy = totalH / 2
        ctx.translate(cx, cy)
        if (settings.wmRotation) ctx.rotate(settings.wmRotation * Math.PI / 180)
        const iw = settings.wmWidth
        const ih = settings.wmHeight || (img.height / img.width * iw)
        ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih)
      }
    }

    ctx.restore()
  }
}

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

function updatePreview() {
  if (!previewCanvas.value) return
  const canvas = previewCanvas.value
  const container = canvas.parentElement
  const scale = container.clientWidth / settings.exportWidth
  canvas.width = container.clientWidth
  canvas.height = DAY_MIN * PX_MIN * scale
  renderTimeline(canvas, scale)
}

// Re-render on settings change
watch(() => ({ ...settings }), () => {
  requestAnimationFrame(() => updatePreview())
}, { deep: true })

onMounted(() => {
  nextTick(() => updatePreview())
})

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
  min-height: 400px; cursor: grab;
}
.preview-canvas { max-width: 100%; height: auto; transition: transform 0.05s ease-out; }
.actions { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
.spacer { flex: 1; }
.placeholder { color: var(--text2); padding: 20px; }

.export-settings { padding: 4px 0; }
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
</style>

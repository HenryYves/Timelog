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
                <label><input type="checkbox" v-model="settings.maskBlockOverflow" /> {{ STR.settings.maskBlockOverflow }}</label>
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
                  <div class="setting-group">
                    <label>{{ STR.exportImage.wmGapX }}</label>
                    <input type="number" v-model.number="settings.wmGapX" min="0" max="1000" />
                    <span class="unit">px</span>
                  </div>
                  <div class="setting-group">
                    <label>{{ STR.exportImage.wmGapY }}</label>
                    <input type="number" v-model.number="settings.wmGapY" min="0" max="1000" />
                    <span class="unit">px</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div class="export-right" ref="previewWrap" @mousedown="onPreviewMouseDown" @wheel.prevent="onPreviewWheel" @dblclick="fitPreview">
          <div class="export-timeline" ref="timelineDom" :style="timelineStyle" data-export-root>
            <!-- Author info (top) -->
            <div v-if="showAuthorBlock && settings.authorPosition === 'top'" class="exp-author" :style="authorStyle">
              <img v-if="settings.authorAvatar" :src="settings.authorAvatar" class="exp-avatar" />
              <div class="exp-author-text">
                <div v-if="settings.authorName" class="exp-author-name">{{ settings.authorName }}</div>
                <div v-if="settings.authorExtra" class="exp-author-extra">{{ settings.authorExtra }}</div>
              </div>
            </div>
            <!-- Date title -->
            <div class="exp-date-title">{{ exportDateTitle }}</div>
            <!-- Blocks area (gutter + hour lines + time blocks, always aligned) -->
            <div class="exp-blocks" :style="{
              marginLeft: (settings.showGutter ? GUTTER_WIDTH : 0) + 'px',
              height: DAY_MIN + 'px',
            }">
              <!-- Gutter (time labels) -->
              <div v-if="settings.showGutter" class="exp-gutter" :style="{ width: GUTTER_WIDTH + 'px', left: -GUTTER_WIDTH + 'px' }">
                <div v-for="h in hours" :key="h" class="exp-hlabel" :style="{ top: h * 60 + 'px' }">
                  {{ String(h).padStart(2, '0') }}:00
                </div>
              </div>
              <!-- Hour lines -->
              <div v-for="h in hours" :key="'hl'+h" class="exp-hourline" :style="{ top: h * 60 + 'px' }" />
              <div v-for="h in 24" :key="'hfl'+h" class="exp-halfline" :style="{ top: h * 60 + 30 + 'px' }" />
              <!-- Time blocks -->
              <div v-for="b in layoutBlocks" :key="b.id" class="block" :style="blockStyle(b)">
                <div v-if="settings.showBlockColorBar" class="cbar">
                  <i v-for="(t, ti) in (b.tags || [])" :key="ti" :style="{ background: tagColor(t) }" />
                  <i v-if="!b.tags || !b.tags.length" style="background:#C4C3C0" />
                </div>
                <div v-if="settings.showBlockTitle" class="bt">{{ b.title || '(未命名)' }}</div>
                <div v-if="settings.showBlockTime && (b.end - b.start) >= 32" class="bs">{{ fmt(b.start) }}–{{ fmt(b.end) }}</div>
                <div v-if="settings.showBlockTags && (b.end - b.start) >= 50 && b.tags?.length" class="btags">
                  <span v-for="t in b.tags" :key="t"><span class="tdot" :style="{ background: tagColor(t) }" />{{ t }}</span>
                </div>
                <div v-if="settings.showBlockNote && b.note && (b.end - b.start) >= (b.tags?.length ? 66 : 48)" class="bnote" v-html="mdToHtml(b.note)" />
                <div v-if="settings.maskBlockOverflow" class="block-mask" :style="maskGradientStyle" />
              </div>
            </div>
            <!-- Author info (bottom) -->
            <div v-if="showAuthorBlock && settings.authorPosition === 'bottom'" class="exp-author" :style="authorStyle">
              <img v-if="settings.authorAvatar" :src="settings.authorAvatar" class="exp-avatar" />
              <div class="exp-author-text">
                <div v-if="settings.authorName" class="exp-author-name">{{ settings.authorName }}</div>
                <div v-if="settings.authorExtra" class="exp-author-extra">{{ settings.authorExtra }}</div>
              </div>
            </div>
            <!-- Watermark (tiled repeat, like obsidian-export-image) -->
            <img v-if="settings.showWatermark && wmOverlayUrl" class="exp-watermark"
              :src="wmOverlayUrl" :style="{ opacity: settings.wmOpacity / 100 }" />
          </div>
        </div>
      </div>
      <div class="actions">
        <button @click="emit('close')">{{ STR.exportImage.cancel }}</button>
        <span class="spacer"></span>
        <button @click="doCopy">{{ STR.exportImage.copy }}</button>
        <button class="primary" @click="doExport">{{ STR.exportImage.save }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import html2canvas from 'html2canvas'
import { mdToHtml } from '../utils/markdown.js'

const showBlockOpts = ref(false)
const showAuthorOpts = ref(false)
const showWatermarkOpts = ref(false)
import { STR } from '../strings.js'
import { useTimelogStore, fmt, dkey } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { PX_MIN, DAY_MIN, GUTTER_WIDTH } from '../constants.js'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useToast } from '../composables/useToast.js'

const SETTINGS_KEY = 'timelog:export-image-settings'

const defaults = {
  // Phase 0 — 时间块显示
  showBlockTitle: true,
  showBlockTime: true,
  showBlockTags: true,
  showBlockNote: true,
  showBlockColorBar: true,
  maskBlockOverflow: false,
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
  wmGapX: 100,            // horizontal spacing between tiles
  wmGapY: 100,            // vertical spacing between tiles
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
const previewWrap = ref(null)
const timelineDom = ref(null)
const previewOffset = reactive({ x: 0, y: 0 })
const previewScale = ref(1)
const { toast } = useToast()
const timelogStore = useTimelogStore()
const tagStore = useTagStore()

// ----- Pan / Zoom state -----
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
}

function onPreviewMouseUp() {
  _panStart = null
  document.removeEventListener('mousemove', onPreviewMouseMove)
  document.removeEventListener('mouseup', onPreviewMouseUp)
}

function onPreviewWheel(e) {
  e.preventDefault()
  const rect = previewWrap.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.1 : 0.9
  const newScale = Math.max(0.1, Math.min(5, previewScale.value * factor))

  // Zoom centered on mouse
  previewOffset.x = mx - (mx - previewOffset.x) * (newScale / previewScale.value)
  previewOffset.y = my - (my - previewOffset.y) * (newScale / previewScale.value)
  previewScale.value = newScale
}

function fitPreview() {
  const container = previewWrap.value
  if (!container) return
  const scale = container.clientWidth / settings.exportWidth
  previewScale.value = Math.min(scale, 1)
  previewOffset.x = 0
  previewOffset.y = 0
}

onMounted(() => {
  nextTick(() => fitPreview())
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onPreviewMouseMove)
  document.removeEventListener('mouseup', onPreviewMouseUp)
})

// ----- Timeline data -----
const hours = Array.from({ length: 25 }, (_, i) => i)

function blockBg(b) {
  if (b.tags?.length) return tagStore.colorOf(b.tags[0]).bg
  return tagStore.colorOf(null).bg
}

function tagColor(t) {
  return tagStore.colorOf(t).hex
}

const bgColor = computed(() => {
  if (settings.bgMode === 'custom') return settings.bgColor
  // Resolve actual colour so --export-canvas is never a nested var() reference
  return getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#ffffff'
})

const maskGradientStyle = computed(() => ({
  background: `linear-gradient(to bottom, ${bgColor.value}00, ${bgColor.value} 90%)`,
}))

const showAuthorBlock = computed(() =>
  settings.showAuthor && !!(settings.authorName || settings.authorAvatar)
)

const exportDateTitle = computed(() => {
  const d = new Date()
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
})

const exportHeight = computed(() => {
  let h = DAY_MIN + 36  // date title
  if (showAuthorBlock.value) h += 80
  return h
})

const timelineStyle = computed(() => {
  const s = previewScale.value
  return {
    width: settings.exportWidth + 'px',
    height: exportHeight.value + 'px',
    '--export-canvas': bgColor.value,
    background: bgColor.value,
    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${s})`,
    transformOrigin: '0 0',
    position: 'relative',
  }
})

const authorStyle = computed(() => {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: settings.authorAlign === 'left' ? 'flex-start' : settings.authorAlign === 'right' ? 'flex-end' : 'center',
  }
})

// ----- Tiled watermark (full-size overlay canvas, staggered like obsidian-export-image) -----
// Rendered as one <img> covering the export area — html2canvas' background-size+repeat
// handling is unreliable (stretches tiles → blurry), <img> at 2x is always sharp.
const wmOverlayUrl = ref('')

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function buildWatermarkOverlay() {
  if (!settings.showWatermark) { wmOverlayUrl.value = ''; return }
  const gapX = Math.max(0, settings.wmGapX || 0)
  const gapY = Math.max(0, settings.wmGapY || 0)
  const rot = (settings.wmRotation || 0) * Math.PI / 180
  const cos = Math.abs(Math.cos(rot))
  const sin = Math.abs(Math.sin(rot))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  let draw  // (ctx) => void, draws content centered at origin
  let cw, ch  // content size before rotation

  if (settings.wmType === 'text' && settings.wmText) {
    const fontSize = 24
    const font = `bold ${fontSize}px ${getComputedStyle(document.body).fontFamily}`
    ctx.font = font
    cw = ctx.measureText(settings.wmText).width
    ch = fontSize * 1.3
    const color = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#888'
    draw = (c) => {
      c.font = font
      c.fillStyle = color
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(settings.wmText, 0, 0)
    }
  } else if (settings.wmType === 'image' && settings.wmImage) {
    let img
    try { img = await loadImg(settings.wmImage) } catch { wmOverlayUrl.value = ''; return }
    cw = settings.wmWidth || img.naturalWidth
    ch = settings.wmHeight || (img.naturalHeight * cw / img.naturalWidth)
    draw = (c) => c.drawImage(img, -cw / 2, -ch / 2, cw, ch)
  } else {
    wmOverlayUrl.value = ''
    return
  }

  // Staggered (brick) layout: horizontal period 2 cells, odd rows offset by one cell
  const SCALE = Math.max(2, window.devicePixelRatio || 1)
  const cellW = cw * cos + ch * sin + gapX
  const cellH = cw * sin + ch * cos + gapY
  const W = settings.exportWidth
  const H = exportHeight.value
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
  wmOverlayUrl.value = canvas.toDataURL()
}

watch(
  () => [settings.showWatermark, settings.wmType, settings.wmText, settings.wmImage,
    settings.wmRotation, settings.wmWidth, settings.wmHeight, settings.wmGapX, settings.wmGapY,
    settings.exportWidth, exportHeight.value],
  buildWatermarkOverlay,
  { immediate: true }
)

// ----- Block overlap layout -----
const layoutBlocks = computed(() => {
  const blocks = timelogStore.blocks.map(b => ({ ...b }))
  return layoutOverlap(blocks)
})

function layoutOverlap(blocks) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start)
  const result = sorted.map(b => ({ ...b }))
  let i = 0
  while (i < result.length) {
    let j = i
    let ge = result[i].end
    while (j + 1 < result.length && result[j + 1].start < ge) {
      j++
      ge = Math.max(ge, result[j].end)
    }
    const grp = result.slice(i, j + 1)
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
    i = j + 1
  }
  return result
}

function blockStyle(b) {
  const top = b.start * PX_MIN
  const height = (b.end - b.start) * PX_MIN
  const w = 100 / (b._cols || 1)
  const left = ((b._col || 0) / (b._cols || 1)) * 100
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${w}% - 4px)`,
    background: blockBg(b),
    '--block-bg': blockBg(b),
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

async function captureCanvas() {
  const el = timelineDom.value
  if (!el) return null

  // Wait for images/fonts to settle
  await document.fonts.ready
  await new Promise(r => setTimeout(r, 100))

  const w = settings.exportWidth
  const h = exportHeight.value
  return await html2canvas(el, {
    width: w,
    height: h,
    // Clone viewport = export size, and in the clone reparent the export root
    // to <body> at 0,0 — escapes the preview container's overflow:hidden
    // clipping and any viewport cropping (gutter/author were cut off before).
    windowWidth: w,
    windowHeight: h,
    scale: Math.max(2, window.devicePixelRatio || 1),
    useCORS: true,
    backgroundColor: settings.bgMode === 'custom'
      ? settings.bgColor
      : getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim(),
    onclone(doc) {
      const cloned = doc.querySelector('[data-export-root]')
      if (!cloned) return
      doc.body.style.margin = '0'
      doc.body.style.overflow = 'visible'
      doc.body.appendChild(cloned)
      cloned.style.position = 'absolute'
      cloned.style.left = '0'
      cloned.style.top = '0'
      cloned.style.margin = '0'
      cloned.style.transform = 'none'
    },
  })
}

async function doCopy() {
  try {
    const canvas = await captureCanvas()
    if (!canvas) return
    if (window.__TAURI__) {
      const ctx2 = canvas.getContext('2d')
      const imageData = ctx2.getImageData(0, 0, canvas.width, canvas.height)
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
    toast(STR.exportImage.copied)
  } catch (e) {
    console.error('Copy failed:', e)
    toast(STR.exportImage.copyFail)
  }
}

async function doExport() {
  try {
    const canvas = await captureCanvas()
    if (!canvas) return

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))

    // Save via Tauri dialog
    if (window.__TAURI__) {
      try {
        const filePath = await save({
          defaultPath: 'timelog-' + dkey(new Date()) + '.png',
          filters: [{ name: 'PNG', extensions: ['png'] }],
        })
        if (filePath) {
          await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()))
          toast('已导出到：' + filePath)
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
  } catch (e) {
    console.error('Export failed:', e)
    toast(STR.exportImage.copyFail)
  }
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
  border-radius: 8px; overflow: hidden;
  min-height: 300px; max-height: calc(72vh / var(--zoom, 1)); cursor: grab; position: relative;
  user-select: none;
  /* Checkerboard to indicate preview area (matches obsidian export-image) */
  background-size: 20px 20px;
  background-position: 0 0, 10px 10px;
  background-image:
    linear-gradient(45deg, var(--border) 25%, transparent 25%),
    linear-gradient(-45deg, var(--border) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--border) 75%),
    linear-gradient(-45deg, transparent 75%, var(--border) 75%);
}

/* Responsive: stack vertically on narrow screens */
@media (max-width: 850px) {
  .export-layout { flex-direction: column; }
  .export-left { width: 100%; max-height: none; }
  .export-right { min-height: 250px; }
}
.spacer { flex: 1; }
.placeholder { color: var(--text2); padding: 20px; }

.export-settings { padding: 4px 0; }
.setting-group { margin-bottom: 12px; }
.setting-group select, .setting-group input[type="number"] {
  border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 13px;
}
.setting-group input[type="number"] { width: 80px; }
.unit { font-size: 12px; color: var(--text2); }
.setting-collapse {
  border: 1px solid var(--border); border-radius: 6px; margin-bottom: 12px;
}
.collapse-header {
  padding: 8px 10px; cursor: pointer; font-size: 13.5px; font-weight: 500;
  user-select: none;
}
.collapse-header:hover { background: var(--soft); }
.arrow { transition: transform 0.2s; font-size: 10px; }
.arrow.open { transform: rotate(90deg); }
.collapse-body {
  padding: 8px 10px 10px; border-top: 1px solid var(--soft);
  display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
}

.exp-date-title {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  padding: 8px 0 4px;
  line-height: 1.4;
}

/* ---- Export Timeline DOM styles ---- */
.export-timeline {
  flex-shrink: 0;
}

/* Gutter — positioned inside .exp-blocks so it always aligns with blocks */
.exp-gutter {
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 1;
}
.exp-gutter::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
}
.exp-hlabel {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--text2);
  white-space: nowrap;
}

/* Hour/half-hour lines */
.exp-hourline {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--border);
  pointer-events: none;
}
.exp-halfline {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--soft2);
  pointer-events: none;
}

/* Blocks area */
.exp-blocks {
  position: relative;
  height: 100%;
  padding-top: 8px;
  padding-bottom: 24px;
}

/* Block styles — matching Timeline.vue */
.block {
  position: absolute;
  border-radius: 6px;
  padding: 3px 8px 3px 11px;
  overflow: hidden;
  font-size: 12.5px;
  box-shadow: 0 1px 2px rgba(0,0,0,.05);
}
.block .cbar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.block .cbar i {
  flex: 1;
  display: block;
}
.block .bt {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.block .bs {
  opacity: .7;
  font-size: 11px;
}
.block .btags {
  margin-top: 2px;
  font-size: 10.5px;
  opacity: .9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.block .bnote {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.35;
  opacity: .9;
  overflow: hidden;
}
.tdot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 3px;
  vertical-align: middle;
}

/* Author info */
.exp-author {
  padding: 16px 32px;
  text-align: center;
  gap: 12px;
}
.exp-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.exp-author-text { min-width: 0; }
.exp-author-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.exp-author-extra {
  font-size: 12px;
  color: var(--text2);
}

/* Watermark — full-size overlay image (canvas-generated, staggered tiles) */
.exp-watermark {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}
</style>

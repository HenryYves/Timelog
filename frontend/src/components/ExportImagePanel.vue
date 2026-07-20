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
        <div class="export-right" ref="previewWrap" @mousedown="onPreviewMouseDown" @wheel.prevent="onPreviewWheel">
          <div class="export-timeline" ref="timelineDom" :style="timelineStyle">
            <!-- Gutter (time labels) -->
            <div v-if="settings.showGutter" class="exp-gutter" :style="{ width: GUTTER_WIDTH + 'px' }">
              <div v-for="h in hours" :key="h" class="exp-hlabel" :style="{ top: h * 60 + 'px' }">
                {{ String(h).padStart(2, '0') }}:00
              </div>
            </div>
            <!-- Hour lines -->
            <div v-for="h in hours" :key="'hl'+h" class="exp-hourline" :style="{ top: h * 60 + 'px' }" />
            <div v-for="h in 24" :key="'hfl'+h" class="exp-halfline" :style="{ top: (h * 60 + 30) + 'px' }" />
            <!-- Time blocks -->
            <div class="exp-blocks" :style="{ marginLeft: (settings.showGutter ? GUTTER_WIDTH : 0) + 'px' }">
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
              </div>
            </div>
            <!-- Author info -->
            <div v-if="settings.showAuthor && (settings.authorName || settings.authorAvatar)" class="exp-author" :style="authorStyle">
              <img v-if="settings.authorAvatar" :src="settings.authorAvatar" class="exp-avatar" />
              <div class="exp-author-text">
                <div v-if="settings.authorName" class="exp-author-name">{{ settings.authorName }}</div>
                <div v-if="settings.authorExtra" class="exp-author-extra">{{ settings.authorExtra }}</div>
              </div>
            </div>
            <!-- Watermark -->
            <div v-if="settings.showWatermark && ((settings.wmType === 'text' && settings.wmText) || (settings.wmType === 'image' && settings.wmImage))" class="exp-watermark" :style="watermarkStyle">
              <img v-if="settings.wmType === 'image' && settings.wmImage" :src="settings.wmImage" />
              <span v-else-if="settings.wmType === 'text' && settings.wmText">{{ settings.wmText }}</span>
            </div>
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
  return 'var(--canvas)'
})

const timelineStyle = computed(() => {
  const s = previewScale.value
  return {
    width: settings.exportWidth + 'px',
    height: DAY_MIN + 'px',
    background: bgColor.value,
    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${s})`,
    transformOrigin: '0 0',
    position: 'relative',
  }
})

const authorStyle = computed(() => {
  const base = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }
  if (settings.authorAlign === 'left') base.justifyContent = 'flex-start'
  else if (settings.authorAlign === 'center') base.justifyContent = 'center'
  else base.justifyContent = 'flex-end'
  if (settings.authorPosition === 'top') base.top = '20px'
  else base.bottom = '20px'
  return base
})

const watermarkStyle = computed(() => ({
  opacity: settings.wmOpacity / 100,
  transform: `translate(-50%, -50%) rotate(${settings.wmRotation}deg)`,
  width: settings.wmWidth + 'px',
  height: settings.wmHeight ? settings.wmHeight + 'px' : 'auto',
}))

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
  const height = Math.max((b.end - b.start) * PX_MIN, 16)
  const w = 100 / (b._cols || 1)
  const left = ((b._col || 0) / (b._cols || 1)) * 100
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${w}% - 4px)`,
    background: blockBg(b),
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

async function doCopy() {
  const el = timelineDom.value
  if (!el) return
  try {
    const canvas = await html2canvas(el, {
      width: settings.exportWidth,
      height: el.scrollHeight,
      scale: 1,
      useCORS: true,
      backgroundColor: settings.bgMode === 'custom' ? settings.bgColor : getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim(),
    })
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    // Write as image/png — works for Ctrl+V paste.
    // Also include text/html so Windows clipboard history (Win+V) tracks it.
    await navigator.clipboard.write([new ClipboardItem({
      'image/png': blob,
      'text/html': new Blob([`<img alt="Timelog export" />`], { type: 'text/html' }),
    })])
    toast(STR.exportImage.copied)
  } catch (e) {
    console.error('Copy failed:', e)
    toast(STR.exportImage.copyFail)
  }
}

async function doExport() {
  const el = timelineDom.value
  if (!el) return

  // Wait for images/fonts to settle
  await document.fonts.ready
  await new Promise(r => setTimeout(r, 100))

  // Capture full resolution — temporarily reset transform for capture
  const origTransform = el.style.transform
  const origOrigin = el.style.transformOrigin
  el.style.transform = ''
  el.style.transformOrigin = ''

  try {
    const canvas = await html2canvas(el, {
      width: settings.exportWidth,
      height: el.scrollHeight,
      scale: 1,
      useCORS: true,
      backgroundColor: settings.bgMode === 'custom' ? settings.bgColor : null,
    })

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))

    // Save via Tauri dialog
    if (window.__TAURI__) {
      try {
        const filePath = await save({
          defaultPath: 'timelog-' + dkey(timelogStore.curDate) + '.png',
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
  } finally {
    // Restore preview transform
    el.style.transform = origTransform
    el.style.transformOrigin = origOrigin
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

/* ---- Export Timeline DOM styles ---- */
.export-timeline {
  flex-shrink: 0;
}

/* Gutter */
.exp-gutter {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--soft2);
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
  position: absolute;
  left: 20px;
  right: 20px;
  padding: 10px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 2;
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

/* Watermark */
.exp-watermark {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(0deg);
  pointer-events: none;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0,0,0,0.3);
  font-weight: bold;
  font-size: 24px;
  text-align: center;
}
.exp-watermark img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>

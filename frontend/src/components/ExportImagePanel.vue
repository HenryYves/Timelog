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

            <div v-if="props.mode === 'timeline'" class="setting-group">
            <label><input type="checkbox" v-model="settings.showGutter" /> {{ STR.exportImage.showGutter }}</label>
          </div>

            <div class="setting-group">
              <label>{{ STR.exportImage.exportWidth }}</label>
              <input type="number" v-model.number="settings.exportWidth" min="200" max="4000" step="10" />
              <span class="unit">px</span>
            </div>

            <!-- Phase 0: Block display (collapsible) -->
            <div v-if="props.mode === 'timeline'" class="setting-collapse">
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
                    <button @click="pickAvatar">{{ STR.exportImage.chooseImage }}</button>
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
                      <button @click="pickWmImage">{{ STR.exportImage.chooseImage }}</button>
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
        <div class="export-right" ref="previewWrap" @mousedown="onMouseDown" @wheel.prevent="onWheel" @dblclick="fitPreview(settings.exportWidth)">
          <div class="export-timeline" ref="timelineDom" :style="timelineStyle" data-export-root>
            <!-- Author info (top) — shared -->
            <div v-if="showAuthorBlock && settings.authorPosition === 'top'" class="exp-author" :style="authorStyle">
              <img v-if="authorAvatarUrl" :src="authorAvatarUrl" class="exp-avatar" />
              <div class="exp-author-text">
                <div v-if="settings.authorName" class="exp-author-name">{{ settings.authorName }}</div>
                <div v-if="settings.authorExtra" class="exp-author-extra">{{ settings.authorExtra }}</div>
              </div>
            </div>
            <template v-if="props.mode === 'timeline'">
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
                  <div v-if="settings.showBlockTags && (b.end - b.start) >= 18 && b.tags?.length" class="btags">
                    <span v-for="t in b.tags" :key="t"><span class="tdot" :style="{ background: tagColor(t) }" />{{ t }}</span>
                  </div>
                  <div v-if="settings.showBlockNote && b.note && (b.end - b.start) >= 16" class="bnote" v-html="mdToHtml(b.note)" />
                  <div v-if="settings.maskBlockOverflow" class="block-mask" :style="maskGradientStyle" />
                </div>
              </div>
            </template>
            <!-- Stats preview -->
            <div v-if="props.mode === 'stats'" class="exp-stats">
              <div v-for="card in (props.cardId ? statsCards.filter(c => c.id === props.cardId) : statsCards)" :key="card.id" class="exp-stat-card">
                <div class="exp-stat-card-title">{{ card.name || (card.type === 'pie' ? '饼图' : '柱状图') }}</div>
                <PieChart
                  v-if="card.type === 'pie'"
                  :slices="(statsPieCharts[card.id] || {}).slices || []"
                  :labels="(statsPieCharts[card.id] || {}).labels || []"
                  :interactive="false"
                  :showData="card.chartData"
                  :showPercent="card.chartPercent"
                  :noDataText="STR.stats.noData"
                />
                <BarChart
                  v-else
                  :items="statsCardData[card.id] || []"
                  :interactive="false"
                  :showData="card.chartData"
                  :showPercent="card.chartPercent"
                  :noDataText="STR.stats.noData"
                />
              </div>
              <div v-if="statsCards.length === 0" style="text-align:center;color:var(--text2);padding:20px">{{ STR.stats.noData }}</div>
            </div>
            <!-- Author info (bottom) — shared -->
            <div v-if="showAuthorBlock && settings.authorPosition === 'bottom'" class="exp-author" :style="authorStyle">
              <img v-if="authorAvatarUrl" :src="authorAvatarUrl" class="exp-avatar" />
              <div class="exp-author-text">
                <div v-if="settings.authorName" class="exp-author-name">{{ settings.authorName }}</div>
                <div v-if="settings.authorExtra" class="exp-author-extra">{{ settings.authorExtra }}</div>
              </div>
            </div>
            <!-- Watermark (shared) -->
            <img v-if="settings.showWatermark && wmOverlayUrl" class="exp-watermark"
              :src="wmOverlayUrl" />
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
import { ref, reactive, watch, computed, nextTick, onMounted } from 'vue'
import { mdToHtml } from '../utils/markdown.js'
import { compressImage, resolveAssetUrl, clearAssetCache, captureElement, copyCanvasToClipboard, saveCanvasToFile } from '../utils/capture.js'
import { buildWatermarkOverlay } from '../utils/watermark.js'
import { usePanZoom } from '../composables/usePanZoom.js'

const showBlockOpts = ref(false)
const showAuthorOpts = ref(false)
const showWatermarkOpts = ref(false)
import { STR } from '../strings.js'
import { useTimelogStore, fmt, dkey } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { PX_MIN, DAY_MIN, GUTTER_WIDTH, DATA_DIR } from '../constants.js'
import { useToast } from '../composables/useToast.js'
import { tWriteBinary, tEnsureSubDir } from '../utils/tauri.js'
import { computeCardsData, buildPieChart, fmtDur, pctOf } from '../utils/stats.js'
import PieChart from './PieChart.vue'
import BarChart from './BarChart.vue'

const settingsKey = computed(() => props.mode === 'stats'
  ? 'timelog:stats-export-settings'
  : 'timelog:export-image-settings')

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
  authorAvatar: '',         // path string (Tauri) or compressed data URL (browser dev)
  authorName: '',
  authorExtra: '',
  authorAlign: 'center',  // 'left' | 'center' | 'right'
  authorPosition: 'bottom', // 'top' | 'bottom'
  // Phase 3 — 水印
  showWatermark: false,
  wmType: 'text',         // 'text' | 'image'
  wmText: '',
  wmImage: '',            // path string (Tauri) or compressed data URL (browser dev)
  wmOpacity: 30,
  wmRotation: 0,
  wmWidth: 200,
  wmHeight: 0,            // 0 = auto
  wmGapX: 100,            // horizontal spacing between tiles
  wmGapY: 100,            // vertical spacing between tiles
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey.value))
    if (saved) Object.assign(settings, defaults, saved)
  } catch { /* use defaults */ }
}

const settings = reactive({ ...defaults })
loadSettings()

// Resolve asset paths to displayable data URLs (Tauri reads from file, browser uses as-is)
const authorAvatarUrl = ref('')
const wmImageUrl = ref('')

watch(() => settings.authorAvatar, async v => { authorAvatarUrl.value = await resolveAssetUrl(v) }, { immediate: true })
watch(() => settings.wmImage, async v => { wmImageUrl.value = await resolveAssetUrl(v) }, { immediate: true })

// Debounced save
let _saveTimer
watch(settings, () => {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(settingsKey.value, JSON.stringify(settings))
    } catch (e) {
      console.error('export-image-settings save failed:', e)
      toast('导出设置保存失败，如已选图片请重新选择较小的图片')
    }
  }, 300)
}, { deep: true })

const props = defineProps({
  show: Boolean,
  mode: { type: String, default: 'timeline' },
  cardId: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const timelineDom = ref(null)
const { toast } = useToast()
const timelogStore = useTimelogStore()
const tagStore = useTagStore()

// Stats data refs
const statsCards = ref([])
const statsTimeRange = ref('today')
const statsCustomStart = ref('')
const statsCustomEnd = ref('')

function statsTagGroup(name) {
  const t = tagStore.tags.find(x => x.name === name)
  return t?.group || ''
}

const statsCardData = computed(() => {
  if (props.mode !== 'stats') return {}
  let cards = statsCards.value
  if (props.cardId) cards = cards.filter(c => c.id === props.cardId)
  return computeCardsData(cards, statsTagGroup, tagStore, STR, {
    timeRange: statsTimeRange.value,
    customStart: statsCustomStart.value,
    customEnd: statsCustomEnd.value,
  })
})

const statsPieCharts = computed(() => {
  const map = {}
  if (props.mode !== 'stats') return map
  let cards = statsCards.value
  if (props.cardId) cards = cards.filter(c => c.id === props.cardId)
  for (const card of cards) {
    map[card.id] = buildPieChart(statsCardData.value[card.id] || [])
  }
  return map
})

// Load stats data when panel opens in stats mode
watch(() => props.show, (val) => {
  if (val && props.mode === 'stats') {
    try {
      statsCards.value = JSON.parse(localStorage.getItem('timelog:stats-cards') || '[]')
    } catch { statsCards.value = [] }
    statsTimeRange.value = localStorage.getItem('timelog:stats-time-range') || 'today'
    statsCustomStart.value = localStorage.getItem('timelog:stats-custom-start') || ''
    statsCustomEnd.value = localStorage.getItem('timelog:stats-custom-end') || ''
  }
}, { immediate: true })

// Preview pan/zoom
const { previewWrap, previewOffset, previewScale, onMouseDown, onWheel, fitPreview } = usePanZoom()

onMounted(() => {
  nextTick(() => fitPreview(settings.exportWidth))
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
  settings.showAuthor && !!(settings.authorName || authorAvatarUrl.value)
)

const exportDateTitle = computed(() => {
  const d = new Date()
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
})

const exportHeight = computed(() => {
  if (props.mode === 'stats') return 0  // auto from scrollHeight
  let h = DAY_MIN + 36
  if (showAuthorBlock.value) h += 80
  return h
})

const timelineStyle = computed(() => {
  const s = previewScale.value
  return {
    width: settings.exportWidth + 'px',
    height: (props.mode === 'stats' ? 'auto' : exportHeight.value + 'px'),
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

// Watermark overlay
const wmOverlayUrl = ref('')

async function buildWatermark() {
  if (!settings.showWatermark) { wmOverlayUrl.value = ''; return }
  const h = props.mode === 'stats' && timelineDom.value
    ? timelineDom.value.scrollHeight
    : exportHeight.value
  wmOverlayUrl.value = await buildWatermarkOverlay({
    width: settings.exportWidth,
    height: h,
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
    settings.exportWidth, exportHeight.value, statsCards.value],
  buildWatermark,
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

async function pickAsset(target, callback) {
  const maxWidth = target === 'avatar' ? 256 : 800
  const fileName = target === 'avatar' ? 'avatar.png' : 'watermark.png'
  const assetPath = 'export-assets/' + fileName

  if (window.__TAURI__) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({
      title: target === 'avatar' ? '选择头像' : '选择水印图',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
      multiple: false,
    })
    if (!path) return
    const bytes = await readFile(path)
    const { bytes: compressed } = await compressImage(new Blob([bytes]), maxWidth)
    await tEnsureSubDir('export-assets')
    await tWriteBinary(DATA_DIR + '/' + assetPath, compressed)
    clearAssetCache(assetPath)
    callback(assetPath)
  } else {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const { dataUrl } = await compressImage(file, maxWidth)
      callback(dataUrl)
    }
    input.click()
  }
}

function pickAvatar() { pickAsset('avatar', url => settings.authorAvatar = url) }
function pickWmImage() { pickAsset('watermark', url => settings.wmImage = url) }

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
  const h = props.mode === 'stats' ? el.scrollHeight : exportHeight.value
  return await captureElement(el, {
    width: settings.exportWidth,
    height: h,
    backgroundColor: settings.bgMode === 'custom'
      ? settings.bgColor
      : getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim(),
  })
}

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

async function doExport() {
  try {
    const canvas = await captureCanvas()
    if (!canvas) return
    const fn = props.mode === 'stats'
      ? 'timelog-stats-' + dkey(new Date()) + '.png'
      : 'timelog-' + dkey(new Date()) + '.png'
    const path = await saveCanvasToFile(canvas, fn)
    if (path) toast('已导出到：' + path)
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

/* Stats export preview */
.exp-stats { padding: 16px 24px; display: flex; flex-direction: column; gap: 24px; }
.exp-stat-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--canvas); }
.exp-stat-card-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text); }
</style>

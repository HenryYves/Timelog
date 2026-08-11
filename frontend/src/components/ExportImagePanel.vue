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

          <!-- Phase 0.5: Time range selector (timeline mode only) -->
          <div v-if="props.mode === 'timeline'" class="setting-group">
            <label>{{ STR.export.timeRange }}</label>
            <select v-model="settings.exportTimeRange">
              <option value="all">{{ STR.export.timeRangeAll }}</option>
              <option value="custom">{{ STR.export.timeRangeCustom }}</option>
            </select>
          </div>
          <template v-if="props.mode === 'timeline' && settings.exportTimeRange === 'custom'">
            <div class="setting-group">
              <label>{{ STR.export.timeRangeCustom }}</label>
              <input type="text" v-model="settings.customRangeStart" placeholder="-08:00" maxlength="6" autocomplete="off" />
              <span>→</span>
              <input type="text" v-model="settings.customRangeEnd" placeholder="+08:00" maxlength="6" autocomplete="off" />
            </div>
            <div class="small" style="margin-top:-8px;margin-bottom:12px">{{ STR.export.timeRangeHint }}</div>
          </template>

            <div class="setting-group">
              <label>{{ STR.exportImage.exportWidth }}</label>
              <input type="number" v-model.number="settings.exportWidth" min="200" max="4000" step="10" />
              <span class="unit">px</span>
            </div>

            <div class="setting-group">
              <label><input type="checkbox" v-model="settings.showTitle" /> {{ STR.exportImage.showTitle }}</label>
              <input v-if="settings.showTitle" type="text" v-model="settings.titleText" style="width:100%;margin-top:4px" :placeholder="defaultTitleText" />
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
            <div v-if="props.mode === 'stats'" class="setting-group" style="margin-top:12px">
              <label><input type="checkbox" v-model="settings.showStatsLegend" /> {{ STR.exportImage.showStatsLegend }}</label>
            </div>
            <div class="setting-group" style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
              <button class="del" @click="resetSettings">{{ STR.exportImage.resetSettings }}</button>
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
            <!-- Date title -->
            <div v-if="displayTitle" class="exp-date-title">{{ displayTitle }}</div>
            <template v-if="props.mode === 'timeline'">
              <!-- Unified timeline (glue-prev + today + glue-next) -->
              <div class="exp-blocks" :style="{
                marginLeft: (settings.showGutter ? GUTTER_WIDTH : 0) + 'px',
                height: (totalHeight * PX_MIN) + 'px',
              }">
                <!-- Gutter (three sections) -->
                <div v-if="settings.showGutter" class="exp-gutter" :style="{ width: GUTTER_WIDTH + 'px', left: -GUTTER_WIDTH + 'px' }">
                  <div v-if="gutterHeights.prev" class="exp-gutter-section glue glue-prev" :style="{ top: '0px', height: (gutterHeights.prev * PX_MIN) + 'px' }">
                    <div v-for="l in prevLabels" :key="'gp'+l.min" class="exp-hlabel" :style="{ top: l.top + 'px' }">{{ l.text }}</div>
                  </div>
                  <div class="exp-gutter-section" :style="{ top: (gutterHeights.prev * PX_MIN) + 'px', height: (gutterHeights.today * PX_MIN) + 'px' }">
                    <div v-for="l in todayLabels" :key="'gt'+l.min" class="exp-hlabel" :style="{ top: l.top + 'px' }">{{ l.text }}</div>
                  </div>
                  <div v-if="gutterHeights.next" class="exp-gutter-section glue glue-next" :style="{ top: ((gutterHeights.prev + gutterHeights.today) * PX_MIN) + 'px', height: (gutterHeights.next * PX_MIN) + 'px' }">
                    <div v-for="l in nextLabels" :key="'gn'+l.min" class="exp-hlabel" :style="{ top: l.top + 'px' }">{{ l.text }}</div>
                  </div>
                </div>
                <!-- Hour/half lines -->
                <div v-for="(l, i) in allLabels" :key="'hl'+i" class="exp-hourline" :style="{ top: l.y + 'px' }" />
                <template v-for="(l, i) in allLabels" :key="'hfl'+i"><div v-if="i < allLabels.length - 1" class="exp-halfline" :style="{ top: (l.y + 30 * PX_MIN) + 'px' }" /></template>
                <!-- Time blocks -->
                <div v-for="b in layoutBlocks" :key="b.id" class="block" :style="blockStyle(b)">
                  <div v-if="settings.showBlockColorBar" class="cbar">
                    <i v-for="(t, ti) in (b.tags || [])" :key="ti" :style="{ background: tagColor(t) }" />
                    <i v-if="!b.tags || !b.tags.length" style="background: var(--no-tag, #C4C3C0)" />
                  </div>
                  <div v-if="settings.showBlockTitle" class="bt">{{ b.title || '(未命名)' }}</div>
                  <div v-if="settings.showBlockTime && (b.end - b.start) >= 32" class="bs">{{ fmtSigned(b.start) }}–{{ fmtSigned(b.end) }}</div>
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
                <div v-if="card.type === 'pie' && (card.showLegend || settings.showStatsLegend)" class="legend">
                  <div v-for="d in (statsCardData[card.id] || [])" :key="d.tag" class="legend-item">
                    <span class="legend-dot" :style="{ background: d.color }"></span>
                    <span class="legend-name">{{ d.tag }}</span>
                    <span v-if="card.legendData" class="legend-val">{{ fmtDur(d.minutes) }}</span>
                    <span v-if="card.legendPercent" class="legend-pct">{{ pctOf(statsCardData[card.id] || [], d.minutes) }}</span>
                  </div>
                </div>
                <BarChart
                  v-if="card.type !== 'pie'"
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
        <template v-if="croppedPreviewUrl">
          <div style="margin-bottom:12px;text-align:center">
            <div style="font-size:12px;color:var(--text2);margin-bottom:4px">裁剪预览</div>
            <img :src="croppedPreviewUrl" style="max-width:100%;max-height:200px;border:1px solid var(--border);border-radius:4px" />
          </div>
        </template>
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
import { useTimelogStore, fmt, fmtSigned, dkey } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'

import { useCoordConverter } from '../composables/useCoordConverter.js'
import { layoutOverlap, blockStyle as sharedBlockStyle, blockVisualStyle } from '../utils/blockLayout.js'
import { PX_MIN, DAY_MIN, GUTTER_WIDTH, DATA_DIR, EXPORT_DATE_TITLE_H, EXPORT_AUTHOR_BLOCK_H } from '../constants.js'
import { useToast } from '../composables/useToast.js'
import { logger } from '../utils/log.js'
import { tWriteBinary, tEnsureSubDir } from '../utils/tauri.js'
import { computeCardsData, buildPieChart, fmtDur, pctOf } from '../utils/stats.js'
import { buildGluePrevLabels, buildTodayLabels, buildGlueNextLabels, mergeAllLabels } from '../utils/timelineLabels.js'
import PieChart from './PieChart.vue'
import BarChart from './BarChart.vue'

const defaults = {
  // Phase 0 — 时间块显示
  showBlockTitle: true,
  showBlockTime: true,
  showBlockTags: true,
  showBlockNote: true,
  showBlockColorBar: true,
  maskBlockOverflow: false,
  // Phase 0.5 — 时间范围
  exportTimeRange: 'all',
  customRangeStart: '',
  customRangeEnd: '',
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
  showTitle: true,
  titleText: '',
  showStatsLegend: true,
}

const props = defineProps({
  show: Boolean,
  mode: { type: String, default: 'timeline' },
  cardId: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const settingsKey = computed(() => props.mode === 'stats'
  ? 'timelog:stats-export-settings'
  : 'timelog:export-image-settings')

function loadSettings() {
  try {
    const raw = localStorage.getItem(settingsKey.value)
    logger.info('export', 'loadSettings key=' + settingsKey.value + ' found=' + !!raw)
    if (raw) {
      const saved = JSON.parse(raw)
      Object.assign(settings, defaults, saved)
    }
  } catch (e) { logger.error('export', 'loadSettings failed', e) }
}

const settings = reactive({ ...defaults })
loadSettings()

// Resolve asset paths to displayable data URLs
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
      logger.info('export', 'saveSettings key=' + settingsKey.value + ' size=' + JSON.stringify(settings).length)
    } catch (e) {
      logger.error('export', 'settings save failed', e)
      toast('导出设置保存失败，如已选图片请重新选择较小的图片')
    }
  }, 300)
}, { deep: true })
const timelineDom = ref(null)
const { toast } = useToast()
const timelogStore = useTimelogStore()
const tagStore = useTagStore()

// Cropped preview for custom time range
const croppedPreviewUrl = ref('')
let _cropTimer = null

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
    } catch (e) { logger.error('export', 'statsCards parse failed', e); statsCards.value = [] }
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

// ----- Timeline data (v2 unified coordinates via useCoordConverter) -----
const { gutterHeights, totalHeight, pageRange, blockTop, minuteToY } = useCoordConverter()

const layoutBlocks = computed(() => layoutOverlap(timelogStore.blocks.map(b => ({ ...b }))))

const prevLabels = computed(() =>
  buildGluePrevLabels(timelogStore._cutMeta?.fromPrev?.cutAt))

const todayLabels = computed(() =>
  buildTodayLabels(pageRange.value.lo, pageRange.value.hi))

const nextLabels = computed(() =>
  buildGlueNextLabels(timelogStore._cutMeta?.fromNext?.cutAt))

const allLabels = computed(() =>
  mergeAllLabels(prevLabels.value, todayLabels.value, nextLabels.value, gutterHeights.value))

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

const defaultTitleText = computed(() => {
  if (props.mode === 'stats') {
    const labels = { today: '今天', '24h': '24h', week: '本周', '168h': '24×7h', '7d': '最近 7 天', month: '本月', custom: '自定义' }
    return exportDateTitle.value + ' (' + (labels[statsTimeRange.value] || '') + ')'
  }
  return exportDateTitle.value
})

const displayTitle = computed(() => {
  if (!settings.showTitle) return ''
  return settings.titleText || defaultTitleText.value
})

const exportHeight = computed(() => {
  if (props.mode === 'stats') return 0  // auto from scrollHeight
  let h = totalHeight.value * PX_MIN + EXPORT_DATE_TITLE_H
  if (showAuthorBlock.value) h += EXPORT_AUTHOR_BLOCK_H
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
  const h = props.mode === 'stats'
    ? (timelineDom.value ? timelineDom.value.scrollHeight : exportHeight.value)
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
    settings.wmOpacity, settings.wmRotation, settings.wmWidth, settings.wmHeight, settings.wmGapX, settings.wmGapY,
    settings.exportWidth, exportHeight.value, statsCards.value],
  buildWatermark,
  { immediate: true }
)

// Update cropped preview when custom time range inputs change
function scheduleCropPreview() {
  clearTimeout(_cropTimer)
  _cropTimer = setTimeout(async () => {
    if (props.mode !== 'timeline' || settings.exportTimeRange !== 'custom') {
      croppedPreviewUrl.value = ''
      return
    }
    await nextTick()
    try {
      const canvas = await captureCanvas()
      if (canvas) croppedPreviewUrl.value = canvas.toDataURL('image/png')
    } catch { croppedPreviewUrl.value = '' }
  }, 500)
}

watch(
  () => [settings.exportTimeRange, settings.customRangeStart, settings.customRangeEnd,
    settings.showTitle, settings.showAuthor, settings.authorPosition,
    settings.exportWidth, settings.showGutter],
  scheduleCropPreview,
  { deep: false }
)

function blockStyle(b) {
  return {
    ...sharedBlockStyle(b, blockTop, PX_MIN),
    ...blockVisualStyle(b, timelogStore.colorOf),
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
    try {
      const bytes = await readFile(path)
      const ext = (path.split('.').pop() || 'png').toLowerCase()
      const mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext)
      // Convert to data URL (Blob from Uint8Array can fail in WebView2)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const dataUrl = 'data:' + mime + ';base64,' + btoa(binary)
      const { bytes: compressed } = await compressImage(dataUrl, maxWidth)
      await tEnsureSubDir('export-assets')
      await tWriteBinary(DATA_DIR + '/' + assetPath, compressed)
      clearAssetCache(assetPath)
      callback(assetPath)
    } catch (e) {
      logger.error('export', 'pickAsset Tauri failed', e)
      toast('图片加载失败，请选择有效的图片文件')
    }
  } else {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const url = URL.createObjectURL(file)
        const { dataUrl } = await compressImage(url, maxWidth)
        URL.revokeObjectURL(url)
        callback(dataUrl)
      } catch (e) {
        logger.error('export', 'pickAsset browser failed', e)
        toast('图片加载失败，请选择有效的图片文件')
      }
    }
    input.click()
  }
}

function pickAvatar() { pickAsset('avatar', url => settings.authorAvatar = url) }
function pickWmImage() { pickAsset('watermark', url => settings.wmImage = url) }

function resetSettings() {
  localStorage.removeItem(settingsKey.value)
  Object.assign(settings, defaults)
  authorAvatarUrl.value = ''
  wmImageUrl.value = ''
  toast('已重置为默认设置')
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
  const h = props.mode === 'stats' ? el.scrollHeight : exportHeight.value
  const canvas = await captureElement(el, {
    width: settings.exportWidth,
    height: h,
    backgroundColor: settings.bgMode === 'custom'
      ? settings.bgColor
      : getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim(),
  })
  if (!canvas) return null
  return cropToTimeRange(canvas)
}

/**
 * 解析带符号时间为显示帧坐标，并校验是否落在可截取区段内：
 *   -HH:MM → 昨天帧（须存在 fromPrev 且 cutAt <= min <= 1440）
 *    HH:MM → 今天本地（须 pageRange.lo <= unifiedMin <= pageRange.hi）
 *   +HH:MM → 明天帧（须存在 fromNext 且 0 <= min <= cutAt）
 * 不合法返回 null。
 */
function resolveRangeEndpoint(str) {
  const m = (str || '').trim().match(/^([+-]?)(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const min = parseInt(m[2]) * 60 + parseInt(m[3])
  if (min > DAY_MIN) return null
  if (m[1] === '-') {
    const cutAt = timelogStore._cutMeta?.fromPrev?.cutAt
    if (cutAt == null || min < cutAt) return null
    return min
  }
  if (m[1] === '+') {
    const cutAt = timelogStore._cutMeta?.fromNext?.cutAt
    if (cutAt == null || min > cutAt) return null
    return 2 * DAY_MIN + min
  }
  const { lo, hi } = pageRange.value
  const unifiedMin = DAY_MIN + min
  if (unifiedMin < lo || unifiedMin > hi) return null
  return unifiedMin
}

/**
 * Crop canvas to the custom time range (single continuous strip).
 * Keeps header (author + title) and footer (padding-bottom + author bottom) intact.
 */
function cropToTimeRange(canvas) {
  if (props.mode !== 'timeline' || settings.exportTimeRange !== 'custom') return canvas

  const startMin = resolveRangeEndpoint(settings.customRangeStart)
  const endMin = resolveRangeEndpoint(settings.customRangeEnd)
  if (startMin == null || endMin == null || endMin <= startMin) return canvas

  const titleH = settings.showTitle ? EXPORT_DATE_TITLE_H : 0
  const authorTopH = showAuthorBlock.value && settings.authorPosition === 'top' ? EXPORT_AUTHOR_BLOCK_H : 0
  const authorBottomH = showAuthorBlock.value && settings.authorPosition === 'bottom' ? EXPORT_AUTHOR_BLOCK_H : 0
  const padT = 8   // .exp-blocks padding-top
  const padB = 24  // .exp-blocks padding-bottom

  const headerH = authorTopH + titleH
  const contentStartY = headerH + padT
  const totalH = totalHeight.value * PX_MIN

  const yStart = minuteToY(startMin)
  const yEnd = minuteToY(endMin)
  const stripH = yEnd - yStart

  const newH = headerH + padT + stripH + padB + authorBottomH
  const cropped = document.createElement('canvas')
  cropped.width = canvas.width
  cropped.height = newH
  const ctx = cropped.getContext('2d')

  let dstY = 0

  // 1. Header
  ctx.drawImage(canvas, 0, 0, canvas.width, contentStartY, 0, 0, canvas.width, contentStartY)
  dstY += contentStartY

  // 2. Cropped strip
  ctx.drawImage(canvas, 0, contentStartY + yStart, canvas.width, stripH, 0, dstY, canvas.width, stripH)
  dstY += stripH

  // 3. Footer (padding-bottom + author bottom)
  const footerSrcY = contentStartY + totalH
  ctx.drawImage(canvas, 0, footerSrcY, canvas.width, padB + authorBottomH, 0, dstY, canvas.width, padB + authorBottomH)

  return cropped
}

async function doCopy() {
  try {
    const canvas = await captureCanvas()
    if (!canvas) return
    await copyCanvasToClipboard(canvas)
    toast(STR.exportImage.copied)
  } catch (e) {
    logger.error('export', 'copy failed', e)
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
    logger.error('export', 'export failed', e)
    toast(STR.exportImage.exportFail)
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
  min-height: 300px; max-height: calc(72vh / var(--zoom, 1)); cursor: var(--drag-cursor); position: relative;
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
.export-right:active {
  cursor: var(--drag-cursor) 16 16, grabbing;
}
.export-right .block {
  cursor: var(--drag-cursor) 16 16, grab;
}
.export-right:active .block {
  cursor: var(--drag-cursor) 16 16, grabbing;
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
.exp-gutter-section {
  position: absolute;
  left: 0;
  right: 0;
}
.exp-gutter-section.glue.glue-prev {
  background: #89c3eb;
}
.exp-gutter-section.glue.glue-next {
  background: #e0ebaf;
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
  word-break: break-all;
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
.exp-stats .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; }
.exp-stats .legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text2); }
.exp-stats .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.exp-stats .legend-name { font-weight: 500; color: var(--text); }
.exp-stats .legend-val { margin-left: 4px; }
.exp-stats .legend-pct { margin-left: 2px; }
.exp-stat-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--canvas); }
.exp-stat-card-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text); }
</style>

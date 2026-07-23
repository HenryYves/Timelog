<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal stats-modal" ref="statsRoot" @keydown="onStatsKeydown">
      <h2>{{ STR.stats.title }}</h2>

      <!-- Time range filter -->
      <div class="stats-filter">
        <span>{{ STR.stats.timeRange }}</span>
        <div class="filter-dropdown">
          <button class="filter-btn" @click="showTimeMenu = !showTimeMenu">
            {{ timeLabel }} ▾
          </button>
          <div class="filter-menu" v-if="showTimeMenu" @keydown.escape.stop="showTimeMenu = false">
            <button v-for="opt in timeOptions" :key="opt.value"
              class="filter-item" :class="{ active: timeRange === opt.value }"
              @click="timeRange = opt.value; showTimeMenu = false">
              {{ opt.label }}
            </button>
            <button class="filter-item" @click="timeRange = 'custom'; showTimeMenu = false">
              {{ STR.stats.timeCustom }}
            </button>
          </div>
        </div>
        <input v-if="timeRange === 'custom'" type="text" v-model="customStart" class="date-input" placeholder="yyyy-mm-dd" maxlength="10" @blur="validateDates" />
<input v-if="timeRange === 'custom'" type="text" v-model="customEnd" class="date-input" placeholder="yyyy-mm-dd" maxlength="10" @blur="validateDates" />
        <span v-if="dateError" class="date-error">{{ dateError }}</span>
      </div>

      <!-- Card list -->
      <div class="stats-cards" v-if="cards.length > 0">
        <div class="stat-card" v-for="(card, idx) in cards" :key="card.id" :data-card-id="card.id">
          <div class="card-header">
            <span class="card-title">{{ card.name || (card.type === 'pie' ? STR.stats.pie : STR.stats.bar) }}</span>
            <span v-if="hovered && hovered.cardId === card.id" class="hover-badge">
              <span class="hover-dot" :style="{ background: hovered.color }"></span>
              {{ hovered.tag }}
              <span class="hover-val">{{ hovered.dataText }}</span>
              <span class="hover-pct">{{ hovered.pctText }}</span>
            </span>
            <span class="spacer"></span>
            <button class="card-settings" @click="openSettings(idx)">⚙</button>
          </div>
          <div class="card-body">
            <!-- Pie chart -->
            <div v-if="card.type === 'pie'" class="pie-wrap">
              <PieChart
                :slices="(pieCharts[card.id] || {}).slices || []"
                :labels="(pieCharts[card.id] || {}).labels || []"
                :interactive="card.interactive"
                :showData="card.chartData"
                :showPercent="card.chartPercent"
                :noDataText="STR.stats.noData"
                @slice-enter="onSliceEnter(card, $event)"
                @slice-leave="onSliceLeave"
              />
              <!-- Legend -->
              <div v-if="card.showLegend" class="legend">
                <div v-for="d in (cardTagData[card.id] || [])" :key="d.tag" class="legend-item">
                  <span class="legend-dot" :style="{ background: d.color }"></span>
                  <span class="legend-name">{{ d.tag }}</span>
                  <span v-if="card.legendData" class="legend-val">{{ fmtDur(d.minutes) }}</span>
                  <span v-if="card.legendPercent" class="legend-pct">{{ pctOf(cardTagData[card.id] || [], d.minutes) }}</span>
                </div>
              </div>
            </div>
            <!-- Bar chart -->
            <div v-else class="bar-wrap">
              <BarChart
                :items="cardTagData[card.id] || []"
                :interactive="card.interactive"
                :showData="card.chartData"
                :showPercent="card.chartPercent"
                :noDataText="STR.stats.noData"
                @slice-enter="onSliceEnter(card, $event)"
                @slice-leave="onSliceLeave"
              />
              <!-- Legend -->
              <div v-if="card.showLegend" class="legend">
                <div v-for="d in (cardTagData[card.id] || [])" :key="d.tag" class="legend-item">
                  <span class="legend-dot" :style="{ background: d.color }"></span>
                  <span class="legend-name">{{ d.tag }}</span>
                  <span v-if="card.legendData">{{ fmtDur(d.minutes) }}</span>
                  <span v-if="card.legendPercent">{{ pctOf(cardTagData[card.id] || [], d.minutes) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="no-charts">{{ STR.stats.noChart }}</div>

      <!-- Add button -->
      <button class="add-view-btn" @click="showCreate = true">{{ STR.stats.addView }}</button>
    </div>
  </div>


  <!-- Create / Settings modal -->
  <div v-if="showCreate || showSettingsIdx !== null" class="overlay" @mousedown.self="closeConfig" @keydown.escape.stop="closeConfig">
    <div class="modal config-modal" @keydown="trapFocus">
      <h3>{{ editingCard ? STR.stats.settings : STR.stats.createTitle }}</h3>
      <div class="config-form">
        <label>{{ STR.stats.viewName }}</label>
        <input type="text" v-model="configName" class="name-input" :placeholder="configType === 'pie' ? STR.stats.pie : STR.stats.bar" maxlength="20" />
        <label>{{ STR.stats.chartType }}</label>
        <select v-model="configType">
          <option value="pie">{{ STR.stats.pie }}</option>
          <option value="bar">{{ STR.stats.bar }}</option>
        </select>
        <label><input type="checkbox" v-model="configOnlyFirst">{{ STR.stats.onlyFirstTag }}</label>
        <label><input type="checkbox" v-model="configIncludeUntagged">{{ STR.stats.includeUntagged }}</label>
        <label>{{ STR.stats.excludeTags }}
          <input type="text" v-model="configExcludeTags" class="tag-input" />
        </label>
        <div class="config-groups">
          <span>{{ STR.stats.filterGroups }}</span>
          <label v-for="g in tagGroups" :key="g">
            <input type="checkbox" :value="g" v-model="configFilterGroups" />{{ g }}
          </label>
        </div>
        <label><input type="checkbox" v-model="configShowLegend">{{ STR.stats.showLegend }}</label>
        <label><input type="checkbox" v-model="configLegendData">{{ STR.stats.legendData }}</label>
        <label><input type="checkbox" v-model="configLegendPercent">{{ STR.stats.legendPercent }}</label>
        <label><input type="checkbox" v-model="configChartData">{{ STR.stats.chartData }}</label>
        <label><input type="checkbox" v-model="configChartPercent">{{ STR.stats.chartPercent }}</label>
        <label><input type="checkbox" v-model="configInteractive">{{ STR.stats.interactive }}</label>
      </div>
      <div class="actions">
        <button v-if="editingCard" class="danger" @click="deleteCard">{{ STR.stats.deleteView }}</button>
        <button v-if="editingCard" @click="exportCard(editingCard.id)">{{ STR.stats.exportImage }}</button>
        <span class="spacer"></span>
        <button @click="closeConfig">{{ STR.stats.cancel }}</button>
        <button class="primary" @click="saveConfig">{{ STR.stats.confirm }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { STR } from '../strings.js'
import { useTagStore } from '../store/tags.js'
import { captureElement, saveCanvasToFile } from '../utils/capture.js'
import { dkey } from '../store/timelog.js'
import { computeCardsData, buildPieChart, fmtDur, pctOf } from '../utils/stats.js'
import PieChart from './PieChart.vue'
import BarChart from './BarChart.vue'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const statsRoot = ref(null)

const tagStore = useTagStore()
const tagGroups = computed(() => [...new Set(tagStore.tags.map(t => t.group).filter(Boolean))])
function tagGroup(name) { const t = tagStore.tags.find(x => x.name === name); return t?.group || '' }

// ── Time range ──
const timeOptions = [
  { value: 'today', label: STR.stats.timeToday },
  { value: '24h', label: STR.stats.time24h },
  { value: 'week', label: STR.stats.timeWeek },
  { value: '168h', label: STR.stats.time168h },
  { value: '7d', label: STR.stats.time7d },
  { value: 'month', label: STR.stats.timeMonth },
]
const timeRange = ref(localStorage.getItem('timelog:stats-time-range') || 'today')
const showTimeMenu = ref(false)
const customStart = ref(localStorage.getItem('timelog:stats-custom-start') || '')
const customEnd = ref(localStorage.getItem('timelog:stats-custom-end') || '')
watch(customStart, (v) => v ? localStorage.setItem('timelog:stats-custom-start', v) : localStorage.removeItem('timelog:stats-custom-start'))
watch(customEnd, (v) => v ? localStorage.setItem('timelog:stats-custom-end', v) : localStorage.removeItem('timelog:stats-custom-end'))
const dateError = ref('')

function validateDates() {
  dateError.value = ''
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (customStart.value && !re.test(customStart.value)) { dateError.value = STR.stats.invalidDate; return }
  if (customEnd.value && !re.test(customEnd.value)) { dateError.value = STR.stats.invalidDate; return }
  if (customStart.value) {
    const s = new Date(customStart.value)
    if (isNaN(s.getTime())) { dateError.value = STR.stats.invalidDate; return }
  }
  if (customEnd.value) {
    const e = new Date(customEnd.value)
    if (isNaN(e.getTime())) { dateError.value = STR.stats.invalidDate; return }
  }
}
const timeLabel = computed(() => {
  const opt = timeOptions.find(o => o.value === timeRange.value)
  return opt ? opt.label : STR.stats.timeCustom
})
watch(timeRange, (v) => { localStorage.setItem('timelog:stats-time-range', v); if (v !== 'custom') dateError.value = '' })

// ── Cards ──
const cards = ref(JSON.parse(localStorage.getItem('timelog:stats-cards') || '[]'))
watch(cards, (v) => localStorage.setItem('timelog:stats-cards', JSON.stringify(v)), { deep: true })

// ── Config modal ──
const showCreate = ref(false)
const showSettingsIdx = ref(null)
const editingCard = computed(() => showSettingsIdx.value !== null ? cards.value[showSettingsIdx.value] : null)
const configName = ref('')
const configType = ref('pie')
const configOnlyFirst = ref(true)
const configIncludeUntagged = ref(false)
const configExcludeTags = ref('')
const configFilterGroups = ref([])
const configShowLegend = ref(true)
const configLegendData = ref(false)
const configLegendPercent = ref(true)
const configChartData = ref(false)
const configChartPercent = ref(true)
const configInteractive = ref(true)

function openSettings(idx) {
  const c = cards.value[idx]
  configName.value = c.name || ''
  configType.value = c.type
  configOnlyFirst.value = c.onlyFirstTag
  configIncludeUntagged.value = c.includeUntagged || false
  configExcludeTags.value = (c.excludeTags || []).join(',')
  configFilterGroups.value = c.filterGroups || []
  configShowLegend.value = c.showLegend
  configLegendData.value = c.legendData
  configLegendPercent.value = c.legendPercent
  configChartData.value = c.chartData
  configChartPercent.value = c.chartPercent
  configInteractive.value = c.interactive !== false
  showSettingsIdx.value = idx
}

function closeConfig() {
  showCreate.value = false
  showSettingsIdx.value = null
}

// Auto-focus first input when config opens
watch(() => showCreate.value || showSettingsIdx.value, (open) => {
  if (!open) return
  setTimeout(() => {
    const modal = document.querySelector('.config-modal')
    if (!modal) return
    const first = modal.querySelector('input:not([type="hidden"]), select, button:not(.danger)')
    if (first) first.focus()
  }, 100)
})

function saveConfig() {
  const card = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: configName.value.trim() || '',
    type: configType.value,
    onlyFirstTag: configOnlyFirst.value,
    includeUntagged: configIncludeUntagged.value,
    excludeTags: configExcludeTags.value ? configExcludeTags.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    filterGroups: configFilterGroups.value,
    showLegend: configShowLegend.value,
    legendData: configLegendData.value,
    legendPercent: configLegendPercent.value,
    chartData: configChartData.value,
    chartPercent: configChartPercent.value,
    interactive: configInteractive.value,
  }
  if (editingCard.value) {
    card.id = editingCard.value.id
    cards.value[showSettingsIdx.value] = card
  } else {
    cards.value.push(card)
  }
  // Trigger reactivity
  cards.value = [...cards.value]
  closeConfig()
}

function deleteCard() {
  cards.value.splice(showSettingsIdx.value, 1)
  cards.value = [...cards.value]
  closeConfig()
}

// ── Focus trap ──
function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget.querySelector('.modal')
  if (!modal) return
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

async function exportCard(cardId) {
  const el = document.querySelector('.stat-card[data-card-id="' + cardId + '"]')
  if (!el) return
  // Close config modal first so its overlay doesn't appear in the capture
  closeConfig()
  try {
    const canvas = await captureElement(el, {
      width: el.scrollWidth,
      height: el.scrollHeight,
    })
    const card = cards.value.find(c => c.id === cardId)
    const raw = (card?.name || cardId).replace(/[\/\\:*?"<>|]/g, '_')
    const fn = 'timelog-stats-' + raw + '.png'
    await saveCanvasToFile(canvas, fn)
  } catch (e) {
    console.error('Card export failed:', e)
  }
}

// ── Data ──
const cardTagData = computed(() => computeCardsData(
  cards.value, tagGroup, tagStore, STR.stats,
  { timeRange: timeRange.value, customStart: customStart.value, customEnd: customEnd.value }
))

const pieCharts = computed(() => {
  const map = {}
  for (const card of cards.value) {
    map[card.id] = buildPieChart(cardTagData.value[card.id] || [])
  }
  return map
})

// ── Hover interaction ──
const hovered = ref(null)

function onSliceEnter(card, slice) {
  if (!card.interactive) return
  const total = (cardTagData.value[card.id] || []).reduce((s, d) => s + d.minutes, 0) || 1
  hovered.value = {
    cardId: card.id,
    tag: slice.tag,
    color: slice.color,
    dataText: fmtDur(slice.minutes),
    pctText: ((slice.minutes / total) * 100).toFixed(1) + '%',
  }
}

function onSliceLeave() {
  hovered.value = null
}
</script>

<style scoped>
.stats-modal { width: 72vw; max-width: 880px; max-height: 82vh; overflow: auto; }

/* ── Filter ── */
.stats-filter { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; font-size: 13px; color: var(--text2); }
.filter-dropdown { position: relative; }
.filter-btn {
  border: 1px solid var(--border); border-radius: 20px; padding: 5px 14px;
  background: var(--canvas); cursor: pointer; font-size: 13px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.filter-btn:hover { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(79,140,217,0.12); }
.filter-menu {
  position: absolute; top: calc(100% + 4px); left: 0;
  background: var(--canvas); border: 1px solid var(--border); border-radius: 8px;
  z-index: 10; min-width: 130px; padding: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.filter-item {
  display: block; width: 100%; text-align: left; padding: 7px 12px;
  border: none; background: none; cursor: pointer; font-size: 13px; border-radius: 5px;
  transition: background 0.15s;
}
.filter-item:hover { background: var(--soft); }
.filter-item.active { background: var(--blue); color: #fff; }
.date-input {
  border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px;
  font-size: 13px; width: 130px; transition: border-color 0.2s;
}
.date-input:focus { border-color: var(--blue); outline: none; box-shadow: 0 0 0 2px rgba(79,140,217,0.12); }
.date-error { color: var(--red); font-size: 12px; width: 100%; }

/* ── Cards ── */
.stats-cards { display: flex; flex-direction: column; gap: 14px; }
.stat-card {
  border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 18px 14px 18px; background: var(--canvas);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s;
  position: relative; overflow: hidden;
}
.stat-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px; background: var(--border); border-radius: 0 2px 2px 0;
  transition: background 0.2s;
}
.stat-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.stat-card:hover::before { background: var(--blue); }
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--soft); }
.card-title { font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text2); }
.card-settings { border: none; background: none; cursor: pointer; font-size: 15px; padding: 2px 6px; border-radius: 4px; color: var(--text2); opacity: 0.5; transition: opacity 0.2s, background 0.2s; }
.card-settings:hover { background: var(--soft); opacity: 1; }
.hover-badge {
  display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500;
  background: var(--soft); border-radius: 20px; padding: 2px 10px;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.hover-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 2px rgba(0,0,0,0.06); }
.hover-val, .hover-pct { color: var(--text2); font-size: 12px; }

/* ── Empty ── */
.no-data, .no-charts { color: var(--text2); text-align: center; padding: 32px 0; font-size: 14px; }
.add-view-btn {
  display: block; width: 100%; padding: 14px;
  border: 1.5px dashed var(--border); border-radius: 10px;
  background: var(--soft); cursor: pointer; font-size: 14px;
  color: var(--text2); margin-top: 14px;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.add-view-btn:hover { border-color: var(--blue); color: var(--blue); background: var(--canvas); }

/* ── Pie ── */
.pie-wrap { display: flex; flex-direction: column; gap: 12px; }

/* ── Legend ── */
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; padding-top: 4px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
.legend-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.06);
}
.legend-name { font-weight: 500; }
.legend-val, .legend-pct { color: var(--text2); font-variant-numeric: tabular-nums; }

/* ── Config ── */
.config-modal { max-width: 380px; max-height: calc(76vh / var(--zoom, 1)); overflow: auto; }
.config-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.config-form label { font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.config-form input[type="checkbox"]:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 2px; }
.config-form select, .tag-input, .name-input { border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 14px; background: var(--canvas); }
.name-input { width: 100%; }
.tag-input { width: 100%; }
.config-groups { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
.config-groups > span { width: 100%; font-size: 13px; font-weight: 600; color: var(--text2); padding-bottom: 2px; }
.config-groups label { font-size: 13px; gap: 4px; padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border); transition: background 0.15s; }
.config-groups label:has(input:checked) { background: var(--soft); border-color: var(--blue); }

.actions { display: flex; gap: 8px; align-items: center; }
.spacer { flex: 1; }
.danger { background: none; border: 1px solid var(--red); color: var(--red); border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; transition: background 0.15s; }
.danger:hover { background: var(--red); color: #fff; }
</style>

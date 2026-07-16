<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal stats-modal" @keydown="trapFocus">
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
        <input v-if="timeRange === 'custom'" type="date" v-model="customStart" class="date-input" />
        <span v-if="timeRange === 'custom'">—</span>
        <input v-if="timeRange === 'custom'" type="date" v-model="customEnd" class="date-input" />
      </div>

      <!-- Card list -->
      <div class="stats-cards" v-if="cards.length > 0">
        <div class="stat-card" v-for="(card, idx) in cards" :key="card.id">
          <div class="card-header">
            <span class="card-title">{{ card.type === 'pie' ? STR.stats.pie : STR.stats.bar }}</span>
            <button class="card-settings" @click="openSettings(idx)">⚙</button>
          </div>
          <div class="card-body">
            <!-- Pie chart -->
            <div v-if="card.type === 'pie'" class="pie-wrap">
              <div v-if="tagData.length === 0" class="no-data">{{ STR.stats.noData }}</div>
              <div v-else class="pie-chart" :style="{ background: pieGradient }"></div>
              <!-- Legend -->
              <div v-if="card.showLegend" class="legend">
                <div v-for="d in tagData" :key="d.tag" class="legend-item">
                  <span class="legend-dot" :style="{ background: d.color }"></span>
                  <span class="legend-name">{{ d.tag }}</span>
                  <span v-if="card.legendData" class="legend-val">{{ fmtDur(d.minutes) }}</span>
                  <span v-if="card.legendPercent" class="legend-pct">{{ pct(d.minutes) }}</span>
                </div>
              </div>
              <!-- In-chart labels -->
              <div v-if="card.chartData || card.chartPercent" class="chart-labels">
                <div v-for="d in tagData" :key="d.tag">
                  {{ d.tag }}
                  <span v-if="card.chartData">{{ fmtDur(d.minutes) }}</span>
                  <span v-if="card.chartPercent">{{ pct(d.minutes) }}</span>
                </div>
              </div>
            </div>
            <!-- Bar chart -->
            <div v-else class="bar-wrap">
              <div v-if="tagData.length === 0" class="no-data">{{ STR.stats.noData }}</div>
              <div v-else class="bar-chart">
                <div class="bar-row" v-for="d in tagData" :key="d.tag">
                  <span class="bar-label">{{ d.tag }}</span>
                  <span class="bar-track">
                    <span class="bar-fill" :style="{ width: barPct(d.minutes) + '%', background: d.color }"></span>
                  </span>
                  <span v-if="card.chartData" class="bar-data">{{ fmtDur(d.minutes) }}</span>
                  <span v-if="card.chartPercent" class="bar-pct">{{ pct(d.minutes) }}</span>
                </div>
              </div>
              <!-- Legend -->
              <div v-if="card.showLegend" class="legend">
                <div v-for="d in tagData" :key="d.tag" class="legend-item">
                  <span class="legend-dot" :style="{ background: d.color }"></span>
                  <span class="legend-name">{{ d.tag }}</span>
                  <span v-if="card.legendData">{{ fmtDur(d.minutes) }}</span>
                  <span v-if="card.legendPercent">{{ pct(d.minutes) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="no-charts">{{ STR.stats.noChart }}</div>

      <!-- Add button -->
      <button class="add-view-btn" @click="showCreate = true">+ {{ STR.stats.addView }}</button>
    </div>
  </div>

  <!-- Create / Settings modal -->
  <div v-if="showCreate || showSettingsIdx !== null" class="overlay" @mousedown.self="closeConfig" @keydown.escape.stop="closeConfig">
    <div class="modal config-modal">
      <h3>{{ editingCard ? STR.stats.settings : STR.stats.createTitle }}</h3>
      <div class="config-form">
        <label>{{ STR.stats.chartType }}</label>
        <select v-model="configType">
          <option value="pie">{{ STR.stats.pie }}</option>
          <option value="bar">{{ STR.stats.bar }}</option>
        </select>
        <label><input type="checkbox" v-model="configOnlyFirst">{{ STR.stats.onlyFirstTag }}</label>
        <label><input type="checkbox" v-model="configShowLegend">{{ STR.stats.showLegend }}</label>
        <label><input type="checkbox" v-model="configLegendData">{{ STR.stats.legendData }}</label>
        <label><input type="checkbox" v-model="configLegendPercent">{{ STR.stats.legendPercent }}</label>
        <label><input type="checkbox" v-model="configChartData">{{ STR.stats.chartData }}</label>
        <label><input type="checkbox" v-model="configChartPercent">{{ STR.stats.chartPercent }}</label>
      </div>
      <div class="actions">
        <button v-if="editingCard" class="danger" @click="deleteCard">{{ STR.stats.deleteView }}</button>
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

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const tagStore = useTagStore()

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
const customStart = ref('')
const customEnd = ref('')
const timeLabel = computed(() => {
  const opt = timeOptions.find(o => o.value === timeRange.value)
  return opt ? opt.label : STR.stats.timeCustom
})
watch(timeRange, (v) => localStorage.setItem('timelog:stats-time-range', v))

// ── Cards ──
const cards = ref(JSON.parse(localStorage.getItem('timelog:stats-cards') || '[]'))
watch(cards, (v) => localStorage.setItem('timelog:stats-cards', JSON.stringify(v)), { deep: true })

// ── Config modal ──
const showCreate = ref(false)
const showSettingsIdx = ref(null)
const editingCard = computed(() => showSettingsIdx.value !== null ? cards.value[showSettingsIdx.value] : null)
const configType = ref('pie')
const configOnlyFirst = ref(true)
const configShowLegend = ref(true)
const configLegendData = ref(false)
const configLegendPercent = ref(true)
const configChartData = ref(false)
const configChartPercent = ref(true)

function openSettings(idx) {
  const c = cards.value[idx]
  configType.value = c.type
  configOnlyFirst.value = c.onlyFirstTag
  configShowLegend.value = c.showLegend
  configLegendData.value = c.legendData
  configLegendPercent.value = c.legendPercent
  configChartData.value = c.chartData
  configChartPercent.value = c.chartPercent
  showSettingsIdx.value = idx
}

function closeConfig() {
  showCreate.value = false
  showSettingsIdx.value = null
}

function saveConfig() {
  const card = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: configType.value,
    onlyFirstTag: configOnlyFirst.value,
    showLegend: configShowLegend.value,
    legendData: configLegendData.value,
    legendPercent: configLegendPercent.value,
    chartData: configChartData.value,
    chartPercent: configChartPercent.value,
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

// ── Data ──
function getDaysInRange() {
  const now = new Date()
  const days = []
  const r = timeRange.value
  if (r === 'today') {
    days.push(fmtDate(now))
  } else if (r === '24h') {
    days.push(fmtDate(now))
    const y = new Date(now.getTime() - 86400000) // prev day (for blocks crossing midnight)
    if (fmtDate(y) !== fmtDate(now)) days.push(fmtDate(y))
  } else if (r === 'week') {
    const dow = now.getDay() || 7 // Mon=1..Sun=7
    for (let i = 0; i < dow; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(fmtDate(d))
    }
  } else if (r === '168h') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() - i * 86400000)
      days.push(fmtDate(d))
    }
  } else if (r === '7d') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(fmtDate(d))
    }
  } else if (r === 'month') {
    const m = now.getMonth()
    const y = now.getFullYear()
    for (let d = 1; d <= now.getDate(); d++) {
      days.push(fmtDate(new Date(y, m, d)))
    }
  } else if (r === 'custom') {
    if (customStart.value && customEnd.value) {
      const s = new Date(customStart.value)
      const e = new Date(customEnd.value)
      for (let d = s; d <= e; d.setDate(d.getDate() + 1)) {
        days.push(fmtDate(new Date(d)))
      }
    }
  }
  return [...new Set(days)]
}

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadDayBlocks(dateKey) {
  const raw = localStorage.getItem('timelog:' + dateKey)
  return raw ? JSON.parse(raw) : []
}

const tagData = computed(() => {
  const days = getDaysInRange()
  const tagMap = {}
  // Use first card's onlyFirstTag setting for now — all cards share data
  const onlyFirst = cards.value.length > 0 ? cards.value[0].onlyFirstTag : true
  for (const day of days) {
    const blocks = loadDayBlocks(day)
    for (const b of blocks) {
      const dur = b.end - b.start
      if (onlyFirst) {
        const t = b.tags[0]
        if (t) tagMap[t] = (tagMap[t] || 0) + dur
      } else {
        for (const t of (b.tags || [])) {
          tagMap[t] = (tagMap[t] || 0) + dur
        }
      }
    }
  }
  const total = Object.values(tagMap).reduce((s, v) => s + v, 0) || 1
  return Object.entries(tagMap).map(([tag, minutes]) => ({
    tag,
    minutes,
    color: tagStore.colorOf(tag)?.hex || '#A1AFC9',
    pct: ((minutes / total) * 100).toFixed(1),
  })).sort((a, b) => b.minutes - a.minutes)
})

// ── Formatting ──
function fmtDur(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${min}m`
}

function pct(min) {
  const total = tagData.value.reduce((s, d) => s + d.minutes, 0) || 1
  return ((min / total) * 100).toFixed(1) + '%'
}

function barPct(min) {
  const max = Math.max(...tagData.value.map(d => d.minutes), 1)
  return (min / max) * 100
}

const pieGradient = computed(() => {
  if (tagData.value.length === 0) return 'transparent'
  const total = tagData.value.reduce((s, d) => s + d.minutes, 0)
  let acc = 0
  const parts = tagData.value.map(d => {
    const start = (acc / total) * 360
    acc += d.minutes
    const end = (acc / total) * 360
    return `${d.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`
  })
  return `conic-gradient(${parts.join(', ')})`
})
</script>

<style scoped>
.stats-modal { max-width: 680px; width: 90vw; max-height: 80vh; overflow-y: auto; }
.stats-filter { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-dropdown { position: relative; }
.filter-btn { border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; background: var(--canvas); cursor: pointer; font-size: 13px; }
.filter-menu { position: absolute; top: 100%; left: 0; background: var(--canvas); border: 1px solid var(--border); border-radius: 6px; z-index: 10; min-width: 120px; padding: 4px 0; }
.filter-item { display: block; width: 100%; text-align: left; padding: 6px 12px; border: none; background: none; cursor: pointer; font-size: 13px; }
.filter-item:hover, .filter-item.active { background: var(--soft); }
.date-input { border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; font-size: 13px; }

.stats-cards { display: flex; flex-direction: column; gap: 16px; }
.stat-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; background: var(--canvas); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.card-title { font-weight: 600; font-size: 14px; }
.card-settings { border: none; background: none; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px; }
.card-settings:hover { background: var(--soft); }

.no-data, .no-charts { color: var(--text2); text-align: center; padding: 24px 0; font-size: 14px; }
.add-view-btn { display: block; width: 100%; padding: 12px; border: 2px dashed var(--border); border-radius: 8px; background: none; cursor: pointer; font-size: 14px; color: var(--text2); margin-top: 12px; }
.add-view-btn:hover { border-color: var(--blue); color: var(--blue); }

/* Pie */
.pie-wrap { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.pie-chart { width: 160px; height: 160px; border-radius: 50%; flex-shrink: 0; }

/* Bar */
.bar-chart { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label { width: 60px; font-size: 13px; text-align: right; flex-shrink: 0; }
.bar-track { flex: 1; height: 18px; background: var(--soft); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; min-width: 2px; }
.bar-data, .bar-pct { font-size: 12px; color: var(--text2); min-width: 40px; }

/* Legend */
.legend { display: flex; flex-direction: column; gap: 4px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { min-width: 40px; }
.legend-val, .legend-pct { color: var(--text2); margin-left: 4px; }

.chart-labels { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }

/* Config modal */
.config-modal { max-width: 360px; }
.config-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.config-form label { font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.config-form select { border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 14px; }

.actions { display: flex; gap: 8px; align-items: center; }
.spacer { flex: 1; }
.danger { background: none; border: 1px solid var(--red); color: var(--red); border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; }
</style>

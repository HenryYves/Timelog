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
        <input v-if="timeRange === 'custom'" type="text" v-model="customStart" class="date-input" placeholder="yyyy-mm-dd" maxlength="10" @blur="validateDates" />
<input v-if="timeRange === 'custom'" type="text" v-model="customEnd" class="date-input" placeholder="yyyy-mm-dd" maxlength="10" @blur="validateDates" />
        <span v-if="dateError" class="date-error">{{ dateError }}</span>
      </div>

      <!-- Card list -->
      <div class="stats-cards" v-if="cards.length > 0">
        <div class="stat-card" v-for="(card, idx) in cards" :key="card.id">
          <div class="card-header">
            <span class="card-title">{{ card.type === 'pie' ? STR.stats.pie : STR.stats.bar }}</span>
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
              <div v-if="(cardTagData[card.id] || []).length === 0" class="no-data">{{ STR.stats.noData }}</div>
              <svg v-else class="pie-svg" viewBox="0 0 700 260" xmlns="http://www.w3.org/2000/svg">
                <path v-for="s in (pieCharts[card.id] || {}).slices" :key="s.tag"
                  :d="s.path" :fill="s.color"
                  :class="['pie-slice', { interactive: card.interactive }]"
                  @mouseenter="onSliceEnter(card, s)"
                  @mouseleave="onSliceLeave" />
                <polyline v-for="l in (pieCharts[card.id] || {}).labels" :key="'ln'+l.tag"
                  :points="l.linePoints" :stroke="l.color" fill="none"
                  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <text v-for="l in (pieCharts[card.id] || {}).labels" :key="'tx'+l.tag"
                  :x="l.textX" :y="l.textY" :text-anchor="l.anchor"
                  class="pie-label" font-size="12">
                  <tspan :fill="l.color" font-weight="500">{{ l.tag }}</tspan>
                  <tspan v-if="card.chartData" fill="var(--text2)"> {{ l.dataText }}</tspan>
                  <tspan v-if="card.chartPercent" fill="var(--text2)"> {{ l.pctText }}</tspan>
                </text>
              </svg>
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
              <div v-if="(cardTagData[card.id] || []).length === 0" class="no-data">{{ STR.stats.noData }}</div>
              <div v-else class="bar-chart">
                <div class="bar-row" v-for="d in (cardTagData[card.id] || [])" :key="d.tag"
                  @mouseenter="onSliceEnter(card, d)"
                  @mouseleave="onSliceLeave">
                  <span class="bar-label" :title="d.tag">{{ d.tag }}</span>
                  <span class="bar-track">
                    <span class="bar-fill" :style="{ width: barWidth(cardTagData[card.id] || [], d.minutes) + '%', background: d.color }"></span>
                  </span>
                  <span v-if="card.chartData" class="bar-data">{{ fmtDur(d.minutes) }}</span>
                  <span v-if="card.chartPercent" class="bar-pct">{{ pctOf(cardTagData[card.id] || [], d.minutes) }}</span>
                </div>
              </div>
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
const customStart = ref('')
const customEnd = ref('')
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

function saveConfig() {
  const card = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: configType.value,
    onlyFirstTag: configOnlyFirst.value,
    includeUntagged: configIncludeUntagged.value,
    excludeTags: configExcludeTags.value ? configExcludeTags.value.split(',').map(s => s.trim()).filter(Boolean) : [],
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

// Per-card data: each card has its own onlyFirstTag setting
const cardTagData = computed(() => {
  const days = getDaysInRange()
  const blocksByDay = days.map(d => loadDayBlocks(d))
  const map = {}
  for (const card of cards.value) {
    const tagMap = {}
    const exclude = new Set(card.excludeTags || [])
    const groups = card.filterGroups?.length > 0 ? new Set(card.filterGroups) : null
    for (let di = 0; di < days.length; di++) {
      for (const b of blocksByDay[di]) {
        const dur = b.end - b.start
        const tags = card.onlyFirstTag
          ? [b.tags[0]].filter(Boolean)
          : (b.tags || [])
        let counted = false
        for (const t of tags) {
          if (!exclude.has(t)) {
            // Filter by group if set
            if (groups && !groups.has(tagGroup(t))) continue
            tagMap[t] = (tagMap[t] || 0) + dur
            counted = true
          }
        }
        if (!counted && card.includeUntagged) {
          tagMap[STR.stats.untagged] = (tagMap[STR.stats.untagged] || 0) + dur
        }
      }
    }
    const total = Object.values(tagMap).reduce((s, v) => s + v, 0) || 1
    const PAL = ['#A1AFC9','#F0C7C1','#C4E0D4','#B5D8A8','#FCE38A','#F36838','#9370DB','#20B2AA','#FF7F50','#87CEEB']
    map[card.id] = Object.entries(tagMap)
      .map(([tag, minutes], idx) => {
        const c = tagStore.colorOf(tag)
        let color = PAL[idx % PAL.length]
        if (c && c.hex && /^#[0-9A-Fa-f]{6}$/.test(c.hex) && c.hex.toUpperCase() !== '#C4C3C0') {
          color = c.hex
        }
        return { tag, minutes, color }
      })
      .sort((a, b) => b.minutes - a.minutes)
  }
  return map
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

function pctOf(data, min) {
  const total = data.reduce((s, d) => s + d.minutes, 0) || 1
  return ((min / total) * 100).toFixed(1) + '%'
}

function barWidth(data, min) {
  const max = Math.max(...data.map(d => d.minutes), 1)
  return (min / max) * 100
}

// ── SVG Pie Chart ──
const PIE_CX = 350, PIE_CY = 130, PIE_R = 80

function buildPieChart(data) {
  if (!data.length) return { slices: [], labels: [] }
  const total = data.reduce((s, d) => s + d.minutes, 0)
  if (total === 0) return { slices: [], labels: [] }

  // Pass 1: slices with mid-angle
  let accDeg = 0
  const items = data.map(d => {
    const spanDeg = (d.minutes / total) * 360
    const startDeg = accDeg
    const endDeg = accDeg + spanDeg
    accDeg = endDeg
    const toRad = (deg) => (deg - 90) * Math.PI / 180
    const sr = toRad(startDeg), er = toRad(endDeg)
    const midDeg = (startDeg + endDeg) / 2
    const midRad = (midDeg - 90) * Math.PI / 180
    const largeArc = spanDeg > 180 ? 1 : 0
    const sx = PIE_CX + PIE_R * Math.cos(sr), sy = PIE_CY + PIE_R * Math.sin(sr)
    const ex = PIE_CX + PIE_R * Math.cos(er), ey = PIE_CY + PIE_R * Math.sin(er)
    return {
      tag: d.tag, color: d.color, minutes: d.minutes,
      path: `M${PIE_CX},${PIE_CY} L${sx.toFixed(2)},${sy.toFixed(2)} A${PIE_R},${PIE_R} 0 ${largeArc} 1 ${ex.toFixed(2)},${ey.toFixed(2)} Z`,
      midRad, spanDeg,
    }
  })

  // Pass 2: filter tiny slices for labels, compute raw positions
  const MIN_ANGLE = 12
  const sizable = items.filter(s => s.spanDeg >= MIN_ANGLE)
  let labels = sizable.map((s, i) => {
    const cos = Math.cos(s.midRad), sin = Math.sin(s.midRad)
    const isRight = cos >= 0
    const stagger = i % 2
    const r2 = 20 + stagger * 18
    const px = PIE_CX + PIE_R * cos, py = PIE_CY + PIE_R * sin
    const ex = PIE_CX + (PIE_R + r2) * cos, ey = PIE_CY + (PIE_R + r2) * sin
    const lx = isRight ? ex + 35 : ex - 35, ly = ey
    return {
      px, py, ex, ey, lx, ly,
      tx: isRight ? lx + 6 : lx - 6,
      ty: ly + 5,
      anchor: isRight ? 'start' : 'end',
      tag: s.tag, color: s.color, minutes: s.minutes,
    }
  })

  // Pass 3: anti-overlap — sort by Y, push apart if gap < 18px
  labels.sort((a, b) => a.ty - b.ty)
  const MIN_GAP = 18
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].ty - labels[i - 1].ty < MIN_GAP) {
      const delta = MIN_GAP - (labels[i].ty - labels[i - 1].ty)
      labels[i].ty += delta
      labels[i].ly += delta
      labels[i].ey += delta
    }
  }

  // Format output
  return {
    slices: items.map(s => ({ tag: s.tag, path: s.path, color: s.color, minutes: s.minutes })),
    labels: labels.map(l => ({
      tag: l.tag, color: l.color,
      linePoints: `${l.px.toFixed(1)},${l.py.toFixed(1)} ${l.ex.toFixed(1)},${l.ey.toFixed(1)} ${l.lx.toFixed(1)},${l.ly.toFixed(1)}`,
      textX: l.tx.toFixed(1), textY: l.ty.toFixed(1), anchor: l.anchor,
      dataText: fmtDur(l.minutes),
      pctText: ((l.minutes / total) * 100).toFixed(1) + '%',
    })),
  }
}

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
.stats-filter { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-dropdown { position: relative; }
.filter-btn { border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; background: var(--canvas); cursor: pointer; font-size: 13px; }
.filter-menu { position: absolute; top: 100%; left: 0; background: var(--canvas); border: 1px solid var(--border); border-radius: 6px; z-index: 10; min-width: 120px; padding: 4px 0; }
.filter-item { display: block; width: 100%; text-align: left; padding: 6px 12px; border: none; background: none; cursor: pointer; font-size: 13px; }
.filter-item:hover, .filter-item.active { background: var(--soft); }
.date-input { border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; font-size: 13px; }
.date-error { color: var(--red); font-size: 12px; }

.stats-cards { display: flex; flex-direction: column; gap: 16px; }
.stat-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; background: var(--canvas); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.card-title { font-weight: 600; font-size: 14px; }
.card-settings { border: none; background: none; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px; }
.card-settings:hover { background: var(--soft); }
.hover-badge { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 500; }
.hover-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.hover-val, .hover-pct { color: var(--text2); font-size: 12px; }

.no-data, .no-charts { color: var(--text2); text-align: center; padding: 24px 0; font-size: 14px; }
.add-view-btn { display: block; width: 100%; padding: 12px; border: 2px dashed var(--border); border-radius: 8px; background: none; cursor: pointer; font-size: 14px; color: var(--text2); margin-top: 12px; }
.add-view-btn:hover { border-color: var(--blue); color: var(--blue); }

/* Pie */
.pie-wrap { display: flex; flex-direction: column; gap: 12px; }
.pie-svg { width: 100%; max-width: calc(950px / var(--zoom, 1)); height: auto; }
.pie-slice { transition: opacity 0.2s ease, filter 0.2s ease; }
.pie-slice.interactive { cursor: pointer; }
.pie-slice.interactive:hover { opacity: 0.8; filter: brightness(1.15) drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
.pie-label { dominant-baseline: middle; }

/* Bar */
.bar-chart { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label { width: 90px; font-size: 13px; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; height: 18px; background: var(--soft); border-radius: 4px; overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: 4px; min-width: 2px; }
.bar-data, .bar-pct { font-size: 12px; color: var(--text2); min-width: 40px; }

/* Legend */
.legend { display: flex; flex-direction: column; gap: 4px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { min-width: 40px; }
.legend-val, .legend-pct { color: var(--text2); margin-left: 4px; }

/* Config modal */
.config-modal { max-width: 360px; }
.config-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.config-form label { font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.config-form select, .tag-input { border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 14px; }
.config-groups { display: flex; flex-wrap: wrap; gap: 8px; }
.config-groups span { width: 100%; font-size: 14px; font-weight: 500; }
.config-groups label { font-size: 13px; gap: 4px; }

.actions { display: flex; gap: 8px; align-items: center; }
.spacer { flex: 1; }
.danger { background: none; border: 1px solid var(--red); color: var(--red); border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; }
</style>

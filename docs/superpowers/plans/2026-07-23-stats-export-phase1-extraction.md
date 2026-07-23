# StatsPanel 图表提取 + 完整导出面板 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract PieChart, BarChart, and stats data logic from StatsPanel.vue into independent modules, then refactor StatsPanel to use them. Stop here for user validation before Phase 2.

**Architecture:** Two pure presentation components (PieChart, BarChart) accept data + `interactive` prop. One data utility module (stats.js) contains `getDaysInRange`, `loadDayBlocks`, `computeCardsData`, `buildPieChart`, and formatting helpers. StatsPanel.vue imports all three, dropping ~200 lines while preserving identical rendered output.

**Tech Stack:** Vue 3 SFC + scoped CSS + SVG + localStorage

## Global Constraints

- WebView2 only, no cross-browser compat
- All npm commands from `frontend/` directory
- Build must pass: `npx vite build`
- Tests must pass: `npm test` → 85 passed
- Commit messages: English prefix + Chinese description

---

### Task 1: Create `frontend/src/utils/stats.js`

**Files:**
- Create: `frontend/src/utils/stats.js`

**Interfaces:**
- Produces: `getDaysInRange(timeRange, customStart, customEnd)`, `loadDayBlocks(dateKey)`, `computeCardsData(cards, tagGroupFn, tagStore, STR)`, `buildPieChart(data)`, `fmtDur(min)`, `pctOf(data, min)`, `barWidth(data, min)`
- The `tagGroupFn` parameter is `(tagName) => group` — StatsPanel.vue passes its local `tagGroup` function.

- [ ] **Step 1: Write the file**

Extract from StatsPanel.vue the following pure functions (no Vue reactivity), making `tagGroup` and `tagStore` parameters instead of component-local refs:

```js
// frontend/src/utils/stats.js
// Stats data computation — pure functions, no Vue dependency.
// Shared by StatsPanel.vue and ExportImagePanel (stats mode).

import { KEY_PREFIX } from '../constants.js'

// ---- Date helpers ----

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getDaysInRange(timeRange, customStart, customEnd) {
  const now = new Date()
  const days = []
  const r = timeRange
  if (r === 'today') {
    days.push(fmtDate(now))
  } else if (r === '24h') {
    days.push(fmtDate(now))
    const y = new Date(now.getTime() - 86400000)
    if (fmtDate(y) !== fmtDate(now)) days.push(fmtDate(y))
  } else if (r === 'week') {
    const dow = now.getDay() || 7
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
    if (customStart && customEnd) {
      const s = new Date(customStart)
      const e = new Date(customEnd)
      for (let d = s; d <= e; d.setDate(d.getDate() + 1)) {
        days.push(fmtDate(new Date(d)))
      }
    }
  }
  return [...new Set(days)]
}

export function loadDayBlocks(dateKey) {
  const raw = localStorage.getItem(KEY_PREFIX + dateKey)
  return raw ? JSON.parse(raw) : []
}

// ---- Card data aggregation ----

/**
 * @param {Array} cards - card config objects
 * @param {Function} tagGroup - (tagName) => group string
 * @param {Object} tagStore - Pinia tag store (has .colorOf method + .tags array)
 * @param {Object} STR - stats strings (needs .untagged)
 * @param {Object} timeRangeState - { timeRange, customStart, customEnd }
 * @returns {Object} map of cardId -> [{tag, minutes, color}]
 */
export function computeCardsData(cards, tagGroup, tagStore, STR, { timeRange, customStart, customEnd }) {
  const days = getDaysInRange(timeRange, customStart, customEnd)
  const blocksByDay = days.map(d => loadDayBlocks(d))
  const PAL = ['#A1AFC9','#F0C7C1','#C4E0D4','#B5D8A8','#FCE38A','#F36838','#9370DB','#20B2AA','#FF7F50','#87CEEB']
  const map = {}

  for (const card of cards) {
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
            if (groups && !groups.has(tagGroup(t))) continue
            tagMap[t] = (tagMap[t] || 0) + dur
            counted = true
          }
        }
        if (!counted && card.includeUntagged) {
          tagMap[STR.untagged] = (tagMap[STR.untagged] || 0) + dur
        }
      }
    }

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
}

// ---- Formatting ----

export function fmtDur(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${min}m`
}

export function pctOf(data, min) {
  const total = data.reduce((s, d) => s + d.minutes, 0) || 1
  return ((min / total) * 100).toFixed(1) + '%'
}

export function barWidth(data, min) {
  const max = Math.max(...data.map(d => d.minutes), 1)
  return (min / max) * 100
}

// ---- SVG Pie Chart builder ----

const PIE_CX = 350, PIE_CY = 130, PIE_R = 80

export function buildPieChart(data) {
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

  // Pass 2: filter tiny slices for labels
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

  // Pass 3: anti-overlap
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
```

- [ ] **Step 2: Build**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 3: Tests**

```
cd /d/a_my/project/html/Timelog/frontend && npm test 2>&1 | tail -3
```
Expected: `85 passed`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/stats.js
git commit -m "feat: 统计数据计算工具——从 StatsPanel 抽出 getDaysInRange/computeCardsData/buildPieChart"
```

---

### Task 2: Create `frontend/src/components/PieChart.vue`

**Files:**
- Create: `frontend/src/components/PieChart.vue`

**Interfaces:**
- Props: `slices` (Array<{tag, path, color, minutes}>), `labels` (Array<{tag, color, linePoints, textX, textY, anchor, dataText, pctText}>), `interactive` (Boolean), `showData` (Boolean), `showPercent` (Boolean), `noDataText` (String)
- Emits: `slice-enter(slice)`, `slice-leave`

- [ ] **Step 1: Write the component**

Template extracted verbatim from StatsPanel.vue lines 45-73, with props replacing card.* references:

```vue
<!-- frontend/src/components/PieChart.vue -->
<template>
  <div class="pie-wrap">
    <div v-if="slices.length === 0" class="no-data">{{ noDataText }}</div>
    <svg v-else class="pie-svg" viewBox="0 0 700 260" xmlns="http://www.w3.org/2000/svg">
      <path v-for="s in slices" :key="s.tag"
        :d="s.path" :fill="s.color"
        :class="['pie-slice', { interactive }]"
        @mouseenter="$emit('slice-enter', s)"
        @mouseleave="$emit('slice-leave')" />
      <polyline v-for="l in labels" :key="'ln'+l.tag"
        :points="l.linePoints" :stroke="l.color" fill="none"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <text v-for="l in labels" :key="'tx'+l.tag"
        :x="l.textX" :y="l.textY" :text-anchor="l.anchor"
        class="pie-label" font-size="12">
        <tspan :fill="l.color" font-weight="500">{{ l.tag }}</tspan>
        <tspan v-if="showData" fill="var(--text2)"> {{ l.dataText }}</tspan>
        <tspan v-if="showPercent" fill="var(--text2)"> {{ l.pctText }}</tspan>
      </text>
    </svg>
  </div>
</template>

<script setup>
defineProps({
  slices: { type: Array, required: true },
  labels: { type: Array, required: true },
  interactive: { type: Boolean, default: false },
  showData: { type: Boolean, default: false },
  showPercent: { type: Boolean, default: false },
  noDataText: { type: String, default: '' },
})
defineEmits(['slice-enter', 'slice-leave'])
</script>

<style scoped>
.pie-wrap { display: flex; flex-direction: column; gap: 12px; }
.pie-svg { width: 100%; max-width: calc(950px / var(--zoom, 1)); height: auto; }
.pie-slice { transition: opacity 0.2s ease, filter 0.2s ease; }
.pie-slice.interactive { cursor: pointer; }
.pie-slice.interactive:hover { opacity: 0.8; filter: brightness(1.15) drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
.pie-label { dominant-baseline: middle; }
.no-data { text-align: center; color: var(--text2); font-size: 14px; padding: 20px; }
</style>
```

- [ ] **Step 2: Build + tests**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -3 && npm test 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PieChart.vue
git commit -m "feat: PieChart 纯展示组件——从 StatsPanel 提取 SVG 饼图"
```

---

### Task 3: Create `frontend/src/components/BarChart.vue`

**Files:**
- Create: `frontend/src/components/BarChart.vue`

**Interfaces:**
- Props: `items` (Array<{tag, minutes, color}>), `interactive` (Boolean), `showData` (Boolean), `showPercent` (Boolean), `noDataText` (String)
- Emits: `slice-enter(item)`, `slice-leave`

- [ ] **Step 1: Write the component**

```vue
<!-- frontend/src/components/BarChart.vue -->
<template>
  <div class="bar-wrap">
    <div v-if="items.length === 0" class="no-data">{{ noDataText }}</div>
    <div v-else class="bar-chart">
      <div class="bar-row" v-for="d in items" :key="d.tag"
        @mouseenter="$emit('slice-enter', d)"
        @mouseleave="$emit('slice-leave')">
        <span class="bar-label" :title="d.tag">{{ d.tag }}</span>
        <span class="bar-track">
          <span class="bar-fill" :style="{ width: barPct + '%', background: d.color }"></span>
        </span>
        <span v-if="showData" class="bar-data">{{ fmtDur(d.minutes) }}</span>
        <span v-if="showPercent" class="bar-pct">{{ pctText(d) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fmtDur, pctOf } from '../utils/stats.js'

const props = defineProps({
  items: { type: Array, required: true },
  interactive: { type: Boolean, default: false },
  showData: { type: Boolean, default: false },
  showPercent: { type: Boolean, default: false },
  noDataText: { type: String, default: '' },
})
defineEmits(['slice-enter', 'slice-leave'])

const barPct = computed(() => {
  const max = Math.max(...props.items.map(d => d.minutes), 1)
  // Return as an object with a width getter that the template can use inline — 
  // actually we need per-item bar widths. Instead, expose a function.
  // Simpler: compute the max once, expose as reactive value.
  return { max }
})

// The template uses barPct per item, so we change approach:
// Expose the max for inline calc
function getBarWidth(min) {
  const max = Math.max(...props.items.map(d => d.minutes), 1)
  return (min / max) * 100
}

function pctText(d) {
  return pctOf(props.items, d.minutes)
}
</script>

<style scoped>
.bar-wrap { display: flex; flex-direction: column; }
.bar-chart { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.bar-row {
  display: flex; align-items: center; gap: 10px;
}
.bar-label { width: 90px; font-size: 13px; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.bar-track { flex: 1; height: 20px; background: var(--soft); border-radius: 10px; overflow: hidden; }
.bar-fill {
  height: 100%; border-radius: 10px; transition: width 0.3s ease;
}
.bar-row:hover .bar-fill { filter: brightness(1.1); }
.bar-data, .bar-pct { font-size: 12px; color: var(--text2); min-width: 40px; font-variant-numeric: tabular-nums; }
.no-data { text-align: center; color: var(--text2); font-size: 14px; padding: 20px; }
</style>
```

Wait — the bar width calculation needs improvement. Each bar-row needs its own width based on its minutes relative to max. The template needs to call `getBarWidth` per item. Let me fix the template and simplify:

```vue
<!-- frontend/src/components/BarChart.vue -->
<template>
  <div class="bar-wrap">
    <div v-if="items.length === 0" class="no-data">{{ noDataText }}</div>
    <div v-else class="bar-chart">
      <div class="bar-row" v-for="d in items" :key="d.tag"
        @mouseenter="$emit('slice-enter', d)"
        @mouseleave="$emit('slice-leave')">
        <span class="bar-label" :title="d.tag">{{ d.tag }}</span>
        <span class="bar-track">
          <span class="bar-fill" :style="{ width: barW(d.minutes) + '%', background: d.color }"></span>
        </span>
        <span v-if="showData" class="bar-data">{{ fmtDur(d.minutes) }}</span>
        <span v-if="showPercent" class="bar-pct">{{ pctOf(items, d.minutes) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtDur, pctOf } from '../utils/stats.js'

const props = defineProps({
  items: { type: Array, required: true },
  interactive: { type: Boolean, default: false },
  showData: { type: Boolean, default: false },
  showPercent: { type: Boolean, default: false },
  noDataText: { type: String, default: '' },
})
defineEmits(['slice-enter', 'slice-leave'])

function barW(min) {
  const max = Math.max(...props.items.map(d => d.minutes), 1)
  return (min / max) * 100
}
</script>

<style scoped>
.bar-wrap { display: flex; flex-direction: column; }
.bar-chart { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-label { width: 90px; font-size: 13px; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.bar-track { flex: 1; height: 20px; background: var(--soft); border-radius: 10px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 10px; transition: width 0.3s ease; }
.bar-row:hover .bar-fill { filter: brightness(1.1); }
.bar-data, .bar-pct { font-size: 12px; color: var(--text2); min-width: 40px; font-variant-numeric: tabular-nums; }
.no-data { text-align: center; color: var(--text2); font-size: 14px; padding: 20px; }
</style>
```

- [ ] **Step 2: Build + tests**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -3 && npm test 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BarChart.vue
git commit -m "feat: BarChart 纯展示组件——从 StatsPanel 提取柱状图"
```

---

### Task 4: Refactor StatsPanel.vue to use new modules

**Files:**
- Modify: `frontend/src/components/StatsPanel.vue`

**Interfaces:**
- Consumes: `getDaysInRange`, `loadDayBlocks`, `computeCardsData`, `buildPieChart`, `fmtDur`, `pctOf`, `barWidth` from `../utils/stats.js`
- Consumes: `PieChart` from `./PieChart.vue`, `BarChart` from `./BarChart.vue`

- [ ] **Step 1: Remove extracted code, add imports**

In StatsPanel script:
- Add imports: `import { computeCardsData, buildPieChart, fmtDur, pctOf } from '../utils/stats.js'`
- Import PieChart and BarChart
- Remove inline functions: `getDaysInRange`, `fmtDate`, `loadDayBlocks`, `cardTagData` computed, `buildPieChart`, `fmtDur`, `pctOf`, `barWidth`, `pieCharts` computed
- Replace `cardTagData` computed with:

```js
import { computeCardsData, buildPieChart, fmtDur, pctOf } from '../utils/stats.js'
import PieChart from './PieChart.vue'
import BarChart from './BarChart.vue'

// In setup:
const cardTagData = computed(() => computeCardsData(
  cards.value, tagGroup, tagStore, STR,
  { timeRange: timeRange.value, customStart: customStart.value, customEnd: customEnd.value }
))

const pieCharts = computed(() => {
  const map = {}
  for (const card of cards.value) {
    map[card.id] = buildPieChart(cardTagData.value[card.id] || [])
  }
  return map
})
```

- [ ] **Step 2: Replace template with sub-components**

Replace the pie chart section (template lines 44-73) with:
```html
<PieChart
  v-if="card.type === 'pie'"
  :slices="(pieCharts[card.id] || {}).slices || []"
  :labels="(pieCharts[card.id] || {}).labels || []"
  :interactive="card.interactive"
  :showData="card.chartData"
  :showPercent="card.chartPercent"
  :noDataText="STR.stats.noData"
  @slice-enter="onSliceEnter(card, $event)"
  @slice-leave="onSliceLeave"
/>
```

Replace the bar chart section (template lines 74-98) with:
```html
<BarChart
  v-else
  :items="cardTagData[card.id] || []"
  :interactive="card.interactive"
  :showData="card.chartData"
  :showPercent="card.chartPercent"
  :noDataText="STR.stats.noData"
  @slice-enter="onSliceEnter(card, $event)"
  @slice-leave="onSliceLeave"
/>
```

Keep the legend sections in StatsPanel (they reference cards array directly) or move them to the chart components? Keep in StatsPanel for now — legends reference card.showLegend, card.legendData, card.legendPercent which are card config properties, not chart rendering logic. Move legend into the chart components:

Actually, legends are simple enough to keep inline where they are. But to avoid duplication in Phase 2, move them into the chart components too.

Wait — the spec says Phase 1 stops after extraction for validation. Keep changes minimal. Legend stays in StatsPanel for now.

- [ ] **Step 3: Keep hover interaction**

The `onSliceEnter` and `onSliceLeave` functions stay in StatsPanel. The sub-components emit `slice-enter`/`slice-leave`, and StatsPanel handles them exactly as before:

```js
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
```

The `$event` from the child component's emit is the slice/bar item `{tag, color, minutes}`. The `card` is passed in the template closure.

- [ ] **Step 4: Remove extracted CSS**

Remove scoped CSS rules that moved to PieChart/BarChart:
- `.pie-wrap`, `.pie-svg`, `.pie-slice`, `.pie-label` → in PieChart.vue now
- `.bar-wrap`, `.bar-chart`, `.bar-row`, `.bar-label`, `.bar-track`, `.bar-fill`, `.bar-data`, `.bar-pct` → in BarChart.vue now

- [ ] **Step 5: Build + tests**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5 && npm test 2>&1 | tail -5
```
Must show clean build and 85 passed.

- [ ] **Step 6: Verify line count reduction**

```
wc -l frontend/src/components/StatsPanel.vue
```
Should be < 550 lines (was ~700, saving ~150 from extraction).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/StatsPanel.vue
git commit -m "refactor: StatsPanel 使用 PieChart/BarChart 子组件 + stats.js 数据层"
```

---

## Phase 1 Stop Point

After Task 4 commit, **STOP**. The user will manually verify StatsPanel in Tauri dev to confirm:
- Charts render identically to before
- Hover interactions work on pie slices and bar rows
- Card create/edit/delete still works
- Ctrl+P and card export still work
- No visual regressions

Do NOT proceed to Phase 2 (ExportImagePanel mode prop + App.vue wiring) until the user confirms Phase 1 passes inspection.

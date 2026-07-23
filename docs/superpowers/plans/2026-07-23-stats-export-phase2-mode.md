# StatsPanel 完整导出面板 — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Add `mode` prop to ExportImagePanel so it can render stats charts in preview, wire up App.vue and StatsPanel emit for Ctrl+P and per-card export.

**Architecture:** ExportImagePanel accepts `mode: 'timeline' | 'stats'` and optional `cardId`. Stats mode reads cards data from localStorage, renders `<PieChart>`/`<BarChart>` directly in the preview DOM. Author/watermark/capture unchanged. StatsPanel emits `'export-image'` (Ctrl+P) or `'export-card', cardId` (card button).

**Tech Stack:** Vue 3 + html2canvas + stats.js + PieChart/BarChart components

## Global Constraints

- WebView2 only
- All npm commands from `frontend/` directory
- Build clean, 85 tests pass
- Commit: English prefix + Chinese description
- Copy success shows toast, save success shows toast

---

### Task 5: ExportImagePanel mode prop + stats preview

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

**Interfaces:**
- Consumes: `computeCardsData`, `buildPieChart`, `fmtDur`, `pctOf` from `../utils/stats.js`
- Consumes: `PieChart` from `./PieChart.vue`, `BarChart` from `./BarChart.vue`
- Produces: `mode` prop ('timeline' | 'stats'), optional `cardId` prop

- [ ] **Step 1: Add props**

In the script, add props (currently only `show`):
```js
const props = defineProps({
  show: Boolean,
  mode: { type: String, default: 'timeline' },  // 'timeline' | 'stats'
  cardId: { type: String, default: '' },          // stats mode: single card export
})
```

- [ ] **Step 2: Settings key per mode**

Change `SETTINGS_KEY` from a constant to a computed:
```js
const SETTINGS_KEY = computed(() =>
  props.mode === 'stats' ? 'timelog:stats-export-settings' : 'timelog:export-image-settings'
)
```

But `loadSettings()` and the watch use `SETTINGS_KEY` — currently a `const`. Change the pattern: keep `settings` reactive, and reload/write using the computed key. When mode changes, reload settings.

Simplify: use a `ref` for the key and watch mode:
```js
const settingsKey = computed(() => props.mode === 'stats'
  ? 'timelog:stats-export-settings'
  : 'timelog:export-image-settings')

// Defaults are the same for both modes (author, watermark, bg settings all shared)
const defaults = { /* ...existing defaults... */ }

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey.value))
    if (saved) Object.assign(settings, defaults, saved)
  } catch { /* use defaults */ }
}

const settings = reactive({ ...defaults })
loadSettings()
```

Update the debounced save to use `settingsKey.value`:
```js
watch(settings, () => {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(settingsKey.value, JSON.stringify(settings))
    } catch (e) { console.error('settings save failed:', e); toast('导出设置保存失败') }
  }, 300)
}, { deep: true })
```

- [ ] **Step 3: Stats mode data loading**

Add stats-specific state (only used when mode='stats'):
```js
import { useTagStore } from '../store/tags.js'
import { computeCardsData, buildPieChart, fmtDur, pctOf } from '../utils/stats.js'
import PieChart from './PieChart.vue'
import BarChart from './BarChart.vue'

// Stats mode: read cards config from localStorage
const statsCards = ref([])
const statsTimeRange = ref('today')
const statsCustomStart = ref('')
const statsCustomEnd = ref('')

const statsTagStore = useTagStore()
const statsTagGroup = (name) => {
  const t = statsTagStore.tags.find(x => x.name === name)
  return t?.group || ''
}
const statsSTR = STR  // stats needs .untagged, .noData etc — use STR directly

const statsCardData = computed(() => {
  if (props.mode !== 'stats') return {}
  let cards = statsCards.value
  if (props.cardId) {
    cards = cards.filter(c => c.id === props.cardId)
  }
  return computeCardsData(cards, statsTagGroup, statsTagStore, statsSTR, {
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

// Load stats data when panel opens
watch(() => props.show, (val) => {
  if (val && props.mode === 'stats') {
    try {
      statsCards.value = JSON.parse(localStorage.getItem('timelog:stats-cards') || '[]')
    } catch { statsCards.value = [] }
    statsTimeRange.value = localStorage.getItem('timelog:stats-time-range') || 'today'
    statsCustomStart.value = localStorage.getItem('timelog:stats-custom-start') || ''
    statsCustomEnd.value = localStorage.getItem('timelog:stats-custom-end') || ''
  }
})
```

- [ ] **Step 4: Stats mode template in preview area**

In the template, the preview area currently renders timeline blocks (lines 140-191). Add a stats branch:

```html
<!-- Stats mode preview -->
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
  <div v-if="statsCards.length === 0" class="no-data">{{ STR.stats.noData }}</div>
</div>
```

The stats content replaces the timeline blocks area. Wrap the timeline blocks in `v-if="props.mode === 'timeline'"`.

The `[data-export-root]` attribute stays on the wrapper div — the stats preview is also inside it, so `captureElement` still works.

- [ ] **Step 5: Filename per mode**

Update `doExport` filename:
```js
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
```

- [ ] **Step 6: doCopy toast**

Modify `doCopy` to also show success toast (already does for copy, ensure save also toasts):
```js
async function doCopy() {
  try {
    const canvas = await captureCanvas()
    if (!canvas) return
    await copyCanvasToClipboard(canvas)
    toast(STR.exportImage.copied)  // already present
  } catch (e) {
    console.error('Copy failed:', e)
    toast(STR.exportImage.copyFail)
  }
}
```

The `doExport` should toast on success (already handled in Step 5).

- [ ] **Step 7: Hide irrelevant sections in stats mode**

In stats mode:
- "时间块显示" collapsible → hide (v-show="mode === 'timeline'")
- "水印" section → keep (shared)
- "作者信息" section → keep (shared)
- bg color/gutter/exportWidth → keep for stats (exportWidth still useful)
- Mask → hide (no blocks to mask)

- [ ] **Step 8: Build + tests**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -5 && npm test 2>&1 | tail -5
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue
git commit -m "feat: ExportImagePanel 支持 stats 模式——图表预览+独立设置key+文件名"
```

---

### Task 6: StatsPanel emit export-image/export-card

**Files:**
- Modify: `frontend/src/components/StatsPanel.vue`

**Interfaces:**
- Produces: emit `'export-image'` (Ctrl+P), emit `'export-card', cardId` (card button)

- [ ] **Step 1: Ctrl+P → emit**

Replace `exportPanel()` body:
```js
function exportPanel() {
  emit('export-image')
}
```
Remove the inline capture/save logic. Remove now-unused imports `captureElement`, `saveCanvasToFile`.

- [ ] **Step 2: Card button → emit**

Replace `exportCard(cardId)` body:
```js
function exportCard(cardId) {
  closeConfig()
  emit('export-card', cardId)
}
```
Remove now-unused `dkey` import.

- [ ] **Step 3: Keep data-card-id attribute**

Ensure `:data-card-id="card.id"` still on `.stat-card` div (should already be there).

- [ ] **Step 4: Build + tests**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -3 && npm test 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StatsPanel.vue
git commit -m "refactor: StatsPanel Ctrl+P/card导出改为emit——由App.vue打开完整面板"
```

---

### Task 7: App.vue wire up

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Add state**

```js
const showStatsExport = ref(false)
const statsExportCardId = ref('')
```

- [ ] **Step 2: Handle StatsPanel emits**

In the StatsPanel template mount, add event handlers:
```html
<StatsPanel
  v-if="showStats"
  :show="showStats"
  @close="showStats = false; statsExportCardId = ''"
  @export-image="showStatsExport = true; statsExportCardId = ''"
  @export-card="cardId => { statsExportCardId = cardId; showStatsExport = true }"
/>
```

- [ ] **Step 3: Add ExportImagePanel stats instance**

```html
<ExportImagePanel
  v-if="showStatsExport"
  :show="showStatsExport"
  mode="stats"
  :cardId="statsExportCardId"
  @close="showStatsExport = false; statsExportCardId = ''"
/>
```

- [ ] **Step 4: Build + tests**

```
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1 | tail -3 && npm test 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat: App.vue 接入 StatsPanel 完整导出面板——Ctrl+P/卡片导出均走ExportImagePanel"
```

---

## Verification (end-to-end)

1. `npx vite build` clean, `npm test` 85 passed
2. Tauri dev: StatsPanel Ctrl+P → opens ExportImagePanel in stats mode → all cards rendered as charts → author/watermark editable → copy toasts success → save toasts success with correct filename
3. Tauri dev: StatsPanel card gear → "导出图片" → opens ExportImagePanel in stats mode with single card → only that card rendered
4. Tauri dev: Timeline export (Ctrl+P or More menu) → works exactly as before, no regression
5. Stats export settings persist independently from timeline export settings

# 剪刀/胶水 v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现剪刀/胶水 v2 设计——统一坐标系、三段 gutter、_cutMeta 元数据、真正的剪切（时间转移）、不支持 Undo。

**Architecture:** 统一坐标系（1440 偏移），三段 gutter + 单 day，_cutMeta 存储剪切信息，useCoordConverter composable 处理坐标转换，剪切/粘回直接清空 undo/redo 栈。

**Tech Stack:** Vue 3 + Pinia（无新依赖）

**Branch:** 所有任务直接在 `main` 分支上执行（不使用 worktree）

## Global Constraints

- WebView2 only，不考虑跨浏览器兼容
- 剪切/粘回操作直接清空 undo 栈和 redo 栈（不支持撤销）
- 统一坐标系：昨天 `[0, 1440)`，今天 `[1440, 2880)`，明天 `[2880, 4320)`
- 时间标签只显示整点，带符号（`-17:00` / `08:00` / `+01:00`）
- 跨区创建坐标连续（如 `[-23:00, 01:00)` → `start=1380, end=1500`）
- 粘回时跨区块在边界处 split（同 ID）
- 剪切/粘回时合并 00:00 边界处同 ID 的块
- **所有提交直接在 main 分支上**

---

### Task 1: useCoordConverter Composable

**Files:**
- Create: `frontend/src/composables/useCoordConverter.js`
- Test: `frontend/src/__tests__/composables/useCoordConverter.test.js`

**Interfaces:**
- Consumes: `useTimelogStore`（读取 `_cutMeta`）
- Produces: 
  - `gutterHeights` — `{ prev, today, next }` 各段高度（分钟）
  - `totalHeight` — 总高度（分钟）
  - `blockTop(block)` — 块 → top 像素
  - `yToMinute(y, dayEl)` — y 像素 → 绝对分钟数
  - `minuteToY(minute)` — 绝对分钟数 → y 像素
  - `todayRange` — `{ start, end }` 今天显示范围

- [ ] **Step 1: 编写失败的测试**

```js
// frontend/src/__tests__/composables/useCoordConverter.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCoordConverter } from '../../composables/useCoordConverter.js'
import { useTimelogStore } from '../../store/timelog.js'

// Mock localStorage
const store = {}
globalThis.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v },
  removeItem: (k) => { delete store[k] },
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.keys(store).forEach(k => delete store[k])
})

describe('useCoordConverter', () => {
  it('computes gutterHeights from _cutMeta', () => {
    const timelogStore = useTimelogStore()
    timelogStore._cutMeta = {
      fromPrev: { sourceDate: '2026-07-23', cutAt: 997 },
      fromNext: { sourceDate: '2026-07-25', cutAt: 120 },
      toPrev: { targetDate: '2026-07-23', cutAt: 480 },
      toNext: { targetDate: '2026-07-25', cutAt: 997 },
    }
    
    const { gutterHeights } = useCoordConverter()
    
    expect(gutterHeights.value.prev).toBe(443)  // 1440 - 997
    expect(gutterHeights.value.next).toBe(120)  // cutAt
    expect(gutterHeights.value.today).toBe(517) // 997 - 480
  })
  
  it('blockTop converts block to pixel position', () => {
    const timelogStore = useTimelogStore()
    timelogStore._cutMeta = {
      fromPrev: { sourceDate: '2026-07-23', cutAt: 997 },
      fromNext: null,
      toPrev: null,
      toNext: null,
    }
    
    const { blockTop } = useCoordConverter()
    
    // 昨天的块
    expect(blockTop({ start: 1320, end: 1380 })).toBe(1320)
    // 今天的块
    expect(blockTop({ start: 1920, end: 2040 })).toBe(443 + 480)
    // 明天的块
    expect(blockTop({ start: 2880, end: 2940 })).toBe(443 + 1440 + 0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test -- useCoordConverter`
Expected: FAIL - module not found

- [ ] **Step 3: 实现 useCoordConverter**

```js
// frontend/src/composables/useCoordConverter.js
import { computed } from 'vue'
import { useTimelogStore } from '../store/timelog.js'
import { PX_MIN } from '../constants.js'

export function useCoordConverter() {
  const store = useTimelogStore()
  const cutMeta = computed(() => store._cutMeta || {})
  
  const gutterHeights = computed(() => {
    const prev = cutMeta.value.fromPrev ? 1440 - cutMeta.value.fromPrev.cutAt : 0
    const next = cutMeta.value.fromNext ? cutMeta.value.fromNext.cutAt : 0
    
    // today 显示范围
    const todayStart = cutMeta.value.toPrev ? cutMeta.value.toPrev.cutAt : 0
    const todayEnd = cutMeta.value.toNext ? cutMeta.value.toNext.cutAt : 1440
    const today = todayEnd - todayStart
    
    return { prev, today, next }
  })
  
  const totalHeight = computed(() => 
    gutterHeights.value.prev + gutterHeights.value.today + gutterHeights.value.next
  )
  
  const todayRange = computed(() => ({
    start: cutMeta.value.toPrev ? cutMeta.value.toPrev.cutAt : 0,
    end: cutMeta.value.toNext ? cutMeta.value.toNext.cutAt : 1440,
  }))
  
  function blockTop(block) {
    if (block.start < 1440) {
      // 昨天的块
      return block.start * PX_MIN
    } else if (block.start < 2880) {
      // 今天的块
      return gutterHeights.value.prev + (block.start - 1440) * PX_MIN
    } else {
      // 明天的块
      return gutterHeights.value.prev + gutterHeights.value.today + (block.start - 2880) * PX_MIN
    }
  }
  
  function yToMinute(y, dayEl) {
    const r = dayEl.getBoundingClientRect()
    const z = store.settings?.zoom / 100 || 1
    const localY = (y - r.top) / z
    const localMin = Math.round(localY / PX_MIN)
    
    if (localMin < gutterHeights.value.prev) {
      return localMin  // 昨天坐标
    } else if (localMin < gutterHeights.value.prev + gutterHeights.value.today) {
      return 1440 + (localMin - gutterHeights.value.prev)  // 今天坐标
    } else {
      return 2880 + (localMin - gutterHeights.value.prev - gutterHeights.value.today)  // 明天坐标
    }
  }
  
  function minuteToY(minute) {
    if (minute < 1440) {
      return minute * PX_MIN
    } else if (minute < 2880) {
      return gutterHeights.value.prev + (minute - 1440) * PX_MIN
    } else {
      return gutterHeights.value.prev + gutterHeights.value.today + (minute - 2880) * PX_MIN
    }
  }
  
  return {
    gutterHeights,
    totalHeight,
    todayRange,
    blockTop,
    yToMinute,
    minuteToY,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test -- useCoordConverter`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useCoordConverter.js frontend/src/__tests__/composables/useCoordConverter.test.js
git commit -m "feat: 添加 useCoordConverter composable——统一坐标转换"
```

---

### Task 2: 重写 cutDay/glueBack（统一坐标系 + _cutMeta）

**Files:**
- Modify: `frontend/src/store/timelog.js`
- Test: `frontend/src/__tests__/store/timelog.test.js`

**Interfaces:**
- Consumes: `_cutMeta` 结构
- Produces: `cutDay(sourceDate, cutAt, direction, dropShort)` / `glueBack(hostDate, sourceDate)`

- [ ] **Step 1: 编写失败的测试**

```js
// frontend/src/__tests__/store/timelog.test.js（追加）
describe('cutDay v2', () => {
  beforeEach(() => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [
        { id: 'a', start: 1920, end: 2040 },  // 今天 08:00-10:00
        { id: 'b', start: 2160, end: 2280 },  // 今天 12:00-14:00
      ],
      _cutMeta: {}
    }))
    localStorage.removeItem('timelog:2026-07-25')
  })
  
  it('cutDay forward updates coordinates and _cutMeta', () => {
    const result = cutDay('2026-07-24', 780, 'forward')  // 13:00
    
    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))
    
    // 今天的块应该调整坐标（-1440）
    expect(src.blocks.find(b => b.id === 'a').start).toBe(480)
    expect(src.blocks.find(b => b.id === 'b').start).toBe(720)
    
    // 明天应该有剪过来的块
    expect(tgt.blocks.length).toBeGreaterThan(0)
    
    // _cutMeta 应该更新
    expect(src._cutMeta.toNext).toEqual({ targetDate: '2026-07-25', cutAt: 780 })
    expect(tgt._cutMeta.fromPrev).toEqual({ sourceDate: '2026-07-24', cutAt: 780 })
  })
  
  it('cutDay merges same-ID blocks at 00:00 boundary', () => {
    // 先创建一个跨区块
    localStorage.setItem('timelog:2026-07-24', JSON.stringify({
      blocks: [
        { id: 'a', start: 1380, end: 1440 },  // 昨天 23:00-24:00
        { id: 'a', start: 1440, end: 1500 },  // 今天 00:00-01:00（同 ID）
      ],
      _cutMeta: {}
    }))
    
    const result = cutDay('2026-07-24', 720, 'backward')  // 12:00
    
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-23'))
    
    // 同 ID 块应该合并
    const merged = tgt.blocks.filter(b => b.id === 'a')
    expect(merged.length).toBe(1)
    expect(merged[0].start).toBe(1380)
    expect(merged[0].end).toBe(1500)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test -- timelog`
Expected: FAIL - cutDay v2 not implemented

- [ ] **Step 3: 重写 cutDay/glueBack**

```js
// frontend/src/store/timelog.js

// 添加 _cutMeta 到 store
export const useTimelogStore = defineStore('timelog', () => {
  const curDate = ref(new Date())
  const blocks = ref([])
  const _cutMeta = ref({})  // 新增
  // ...
  
  function loadBlocks() {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + dateKey.value)
      const data = raw ? JSON.parse(raw) : { blocks: [], _cutMeta: {} }
      blocks.value = data.blocks || []
      _cutMeta.value = data._cutMeta || {}
    } catch (e) { 
      logger.error('timelog', 'loadBlocks failed', e)
      blocks.value = []
      _cutMeta.value = {}
    }
  }
  
  function saveBlocks() {
    const data = {
      blocks: blocks.value,
      _cutMeta: _cutMeta.value,
    }
    localStorage.setItem(KEY_PREFIX + dateKey.value, JSON.stringify(data))
  }
  
  // ...
})

/**
 * Cut a day at cutAt (minutes), moving blocks to adjacent day.
 * @param {string} sourceDate - 'YYYY-MM-DD' of the day being cut
 * @param {number} cutAt - cut point in minutes (0-1440)
 * @param {'forward'|'backward'} direction - forward=to tomorrow, backward=to yesterday
 * @param {boolean} dropShort - drop fragments < 10 min
 */
export function cutDay(sourceDate, cutAt, direction, dropShort = false) {
  const targetDate = direction === 'forward'
    ? addDays(sourceDate, 1)
    : addDays(sourceDate, -1)
  
  const srcKey = KEY_PREFIX + sourceDate
  const tgtKey = KEY_PREFIX + targetDate
  
  // Load both days
  let srcData = { blocks: [], _cutMeta: {} }
  let tgtData = { blocks: [], _cutMeta: {} }
  try { 
    const raw = localStorage.getItem(srcKey)
    if (raw) srcData = JSON.parse(raw)
  } catch {}
  try { 
    const raw = localStorage.getItem(tgtKey)
    if (raw) tgtData = JSON.parse(raw)
  } catch {}
  
  const srcBlocks = srcData.blocks || []
  const tgtBlocks = tgtData.blocks || []
  const srcMeta = srcData._cutMeta || {}
  const tgtMeta = tgtData._cutMeta || {}
  
  // Separate blocks to move
  const offset = direction === 'forward' ? 1440 : -1440
  const toMove = []
  const toStay = []
  
  srcBlocks.forEach(b => {
    const shouldMove = direction === 'forward'
      ? b.start >= 1440 + cutAt  // 今天的块，start >= 1440 + cutAt
      : b.start < 1440 + cutAt   // 今天的块，start < 1440 + cutAt
    
    if (shouldMove) {
      // Adjust coordinates
      const moved = {
        ...b,
        start: b.start + offset,
        end: b.end + offset,
        _cut: { sourceDate, cutAt },
      }
      toMove.push(moved)
    } else {
      toStay.push(b)
    }
  })
  
  // Merge same-ID blocks at 00:00 boundary
  const merged = new Map()
  ;[...tgtBlocks, ...toMove].forEach(b => {
    if (merged.has(b.id)) {
      const prev = merged.get(b.id)
      prev.start = Math.min(prev.start, b.start)
      prev.end = Math.max(prev.end, b.end)
    } else {
      merged.set(b.id, { ...b })
    }
  })
  const newTgtBlocks = Array.from(merged.values())
  
  // Update _cutMeta
  if (direction === 'forward') {
    srcMeta.toNext = { targetDate, cutAt }
    tgtMeta.fromPrev = { sourceDate, cutAt }
  } else {
    srcMeta.toPrev = { targetDate, cutAt }
    tgtMeta.fromNext = { sourceDate, cutAt }
  }
  
  // Save
  localStorage.setItem(srcKey, JSON.stringify({ blocks: toStay, _cutMeta: srcMeta }))
  localStorage.setItem(tgtKey, JSON.stringify({ blocks: newTgtBlocks, _cutMeta: tgtMeta }))
  
  // Clear undo/redo
  storeUndo.clear()
  
  return { sourceDate, targetDate, moved: toMove.length }
}

/**
 * Glue blocks back to their source date.
 */
export function glueBack(hostDate, sourceDate) {
  const hostKey = KEY_PREFIX + hostDate
  const srcKey = KEY_PREFIX + sourceDate
  
  let hostData = { blocks: [], _cutMeta: {} }
  let srcData = { blocks: [], _cutMeta: {} }
  try { 
    const raw = localStorage.getItem(hostKey)
    if (raw) hostData = JSON.parse(raw)
  } catch {}
  try { 
    const raw = localStorage.getItem(srcKey)
    if (raw) srcData = JSON.parse(raw)
  } catch {}
  
  const hostBlocks = hostData.blocks || []
  const srcBlocks = srcData.blocks || []
  const hostMeta = hostData._cutMeta || {}
  const srcMeta = srcData._cutMeta || {}
  
  // Find glue blocks
  const glueBlocks = hostBlocks.filter(b => b._cut && b._cut.sourceDate === sourceDate)
  if (!glueBlocks.length) return false
  
  // Determine offset
  const offset = sourceDate < hostDate ? 1440 : -1440
  
  // Move blocks back
  const movedBlocks = glueBlocks.map(b => {
    const clean = { ...b }
    delete clean._cut
    clean.start += offset
    clean.end += offset
    return clean
  })
  
  // Merge same-ID blocks
  const merged = new Map()
  ;[...srcBlocks, ...movedBlocks].forEach(b => {
    if (merged.has(b.id)) {
      const prev = merged.get(b.id)
      prev.start = Math.min(prev.start, b.start)
      prev.end = Math.max(prev.end, b.end)
    } else {
      merged.set(b.id, { ...b })
    }
  })
  const newSrcBlocks = Array.from(merged.values())
  
  // Remove from host
  const newHostBlocks = hostBlocks.filter(b => !(b._cut && b._cut.sourceDate === sourceDate))
  
  // Clear _cutMeta
  if (sourceDate < hostDate) {
    delete hostMeta.fromPrev
    delete srcMeta.toNext
  } else {
    delete hostMeta.fromNext
    delete srcMeta.toPrev
  }
  
  // Save
  localStorage.setItem(hostKey, JSON.stringify({ blocks: newHostBlocks, _cutMeta: hostMeta }))
  localStorage.setItem(srcKey, JSON.stringify({ blocks: newSrcBlocks, _cutMeta: srcMeta }))
  
  // Clear undo/redo
  storeUndo.clear()
  
  return { hostDate, sourceDate, moved: glueBlocks.length }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test -- timelog`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/timelog.js frontend/src/__tests__/store/timelog.test.js
git commit -m "feat: 重写 cutDay/glueBack——统一坐标系+_cutMeta+同ID合并"
```

---

### Task 3: 重写 Timeline.vue（三段 gutter + 单 day）

**Files:**
- Modify: `frontend/src/components/Timeline.vue`

**Interfaces:**
- Consumes: `useCoordConverter`, `cutDay`, `glueBack`
- Produces: 三段 gutter 渲染 + 交互

- [ ] **Step 1: 重写模板**

```vue
<template>
  <div class="grid">
    <div class="gutter-container">
      <!-- Glue-prev gutter -->
      <div v-if="converter.gutterHeights.value.prev" 
           class="gutter glue-prev" 
           :style="{ height: converter.gutterHeights.value.prev * PX_MIN + 'px' }"
           @contextmenu.prevent="onGluePrevRightClick"
           @mousemove="onGutterHover"
           @mouseleave="onGutterLeave">
        <div v-for="label in gluePrevLabels" :key="label.min" 
             class="hlabel" 
             :style="{ top: label.top + 'px' }">
          {{ label.text }}
        </div>
      </div>
      
      <!-- Today gutter -->
      <div class="gutter today" 
           :style="{ height: converter.gutterHeights.value.today * PX_MIN + 'px' }"
           @contextmenu.prevent="onTodayRightClick"
           @mousemove="onGutterHover"
           @mouseleave="onGutterLeave">
        <div v-for="label in todayLabels" :key="label.min" 
             class="hlabel" 
             :style="{ top: label.top + 'px' }">
          {{ label.text }}
        </div>
      </div>
      
      <!-- Glue-next gutter -->
      <div v-if="converter.gutterHeights.value.next" 
           class="gutter glue-next" 
           :style="{ height: converter.gutterHeights.value.next * PX_MIN + 'px' }"
           @contextmenu.prevent="onGlueNextRightClick"
           @mousemove="onGutterHover"
           @mouseleave="onGutterLeave">
        <div v-for="label in glueNextLabels" :key="label.min" 
             class="hlabel" 
             :style="{ top: label.top + 'px' }">
          {{ label.text }}
        </div>
      </div>
    </div>
    
    <!-- Single day area -->
    <div class="day" 
         ref="dayRef"
         :style="{ height: converter.totalHeight.value * PX_MIN + 'px' }"
         @mousedown="onDayMouseDown"
         @mousemove="onMouseMove"
         @mouseup="onMouseUp"
         @mouseleave="onMouseUp"
         @click.self="onDayClick"
         @contextmenu.prevent>
      <!-- Hour lines -->
      <div v-for="label in allLabels" :key="'hl'+label.min" 
           class="hourline" 
           :style="{ top: label.top + 'px' }" />
      <div v-for="label in allLabels" :key="'hfl'+label.min" 
           class="halfline" 
           :style="{ top: label.top + 30 * PX_MIN + 'px' }" />
      
      <!-- Blocks -->
      <div v-for="ev in layoutBlocks" :key="ev.id"
           class="block" 
           :class="{ bsel: selectedBlocks.has(ev.id) }"
           :style="computeBlockStyle(ev)"
           @mousemove="onBlockMouseMove($event, ev)"
           @mousedown.left="onBlockMouseDown($event, ev)"
           @click="onBlockClick($event, ev)"
           @contextmenu.prevent="onBlockContextMenu(ev)">
        <!-- Block content -->
      </div>
      
      <!-- Hover line -->
      <div v-if="hoverLine" 
           class="cut-hover" 
           :style="{ top: hoverLine.y + 'px' }">
        <span class="cut-hover-label">{{ hoverLine.label }}</span>
      </div>
    </div>
  </div>
  
  <!-- Modals -->
  <CutConfirm :show="showCutConfirm" ... />
  <GlueConfirm :show="showGlueConfirm" ... />
</template>
```

- [ ] **Step 2: 添加标签生成逻辑**

```js
// Timeline.vue <script setup>
import { useCoordConverter } from '../composables/useCoordConverter.js'

const converter = useCoordConverter()

// 生成时间标签
const gluePrevLabels = computed(() => {
  const cutAt = store._cutMeta?.fromPrev?.cutAt
  if (!cutAt) return []
  
  const labels = []
  const firstHour = Math.ceil(cutAt / 60) * 60
  for (let min = firstHour; min < 1440; min += 60) {
    labels.push({
      min,
      text: `-${fmt(min)}`,
      top: (min - cutAt) * PX_MIN,
    })
  }
  return labels
})

const todayLabels = computed(() => {
  const { start, end } = converter.todayRange.value
  const labels = []
  for (let min = start; min <= end; min += 60) {
    labels.push({
      min,
      text: fmt(min),
      top: (min - start) * PX_MIN,
    })
  }
  return labels
})

const glueNextLabels = computed(() => {
  const cutAt = store._cutMeta?.fromNext?.cutAt
  if (!cutAt) return []
  
  const labels = []
  for (let min = 60; min <= cutAt; min += 60) {
    labels.push({
      min,
      text: `+${fmt(min)}`,
      top: min * PX_MIN,
    })
  }
  return labels
})

const allLabels = computed(() => [
  ...gluePrevLabels.value,
  ...todayLabels.value,
  ...glueNextLabels.value,
])
```

- [ ] **Step 3: 更新块渲染**

```js
function computeBlockStyle(ev) {
  const has = ev.tags && ev.tags.length
  const c0 = colorOf(has ? ev.tags[0] : null)
  const top = converter.blockTop(ev)
  const height = (ev.end - ev.start) * PX_MIN
  const w = 100 / (ev._cols || 1)
  const left = (ev._col || 0) * w
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${w}% - 4px)`,
    background: c0.bg,
    '--block-bg': c0.bg,
    color: '#2C2C2B',
  }
}
```

- [ ] **Step 4: 更新鼠标交互**

```js
function onDayMouseDown(e) {
  if (e.button !== 0 || adrag) return
  const dayEl = e.currentTarget
  const s = converter.yToMinute(e.clientY, dayEl)
  adrag = { type: 'create', anchor: s, cur: s, dayEl }
  applyDrag()
}

function onTodayRightClick(e) {
  if (!availableDirs.value.length) return
  const min = converter.yToMinute(e.clientY, dayRef.value)
  cutInitialMin.value = min - 1440  // 转换为今天的相对时间
  showCutConfirm.value = true
}
```

- [ ] **Step 5: 运行测试**

Run: `cd /d/a_my/project/html/Timelog/frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Timeline.vue
git commit -m "feat: 重写 Timeline——三段 gutter + 单 day + useCoordConverter"
```

---

### Task 4: 更新导出组件

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`
- Modify: `frontend/src/components/ExportPanel.vue`

**Interfaces:**
- Consumes: `useCoordConverter`, `_cutMeta`
- Produces: 带符号时间显示（`-17:00` / `08:00` / `+01:00`）

- [ ] **Step 1: 更新 ExportImagePanel 三区渲染**

```js
// ExportImagePanel.vue
import { useCoordConverter } from '../composables/useCoordConverter.js'

const converter = useCoordConverter()

// 使用 converter.gutterHeights 计算导出高度
const exportHeight = computed(() => {
  let h = EXPORT_DATE_TITLE_H
  if (showAuthorBlock.value) h += EXPORT_AUTHOR_BLOCK_H
  h += converter.totalHeight.value
  return h
})
```

- [ ] **Step 2: 更新 ExportPanel 胶水块前缀**

```js
// ExportPanel.vue
function buildExport() {
  return timelogStore.blocks.slice().sort((a, b) => a.start - b.start).map(ev => {
    const t = (ev.tags && ev.tags.length) ? ':' + ev.tags.join(',') : ''
    
    // 带符号时间显示
    let timeStr
    if (ev.start < 1440) {
      timeStr = `-${fmt(ev.start)}–-${fmt(ev.end)}`
    } else if (ev.start < 2880) {
      timeStr = `${fmt(ev.start - 1440)}–${fmt(ev.end - 1440)}`
    } else {
      timeStr = `+${fmt(ev.start - 2880)}–+${fmt(ev.end - 2880)}`
    }
    
    return '- (' + timeStr + t + ')' + (ev.title || '') + ';' + ...
  }).join('\n')
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue frontend/src/components/ExportPanel.vue
git commit -m "feat: 导出组件支持带符号时间显示"
```

---

### Task 5: 更新样式

**Files:**
- Modify: `frontend/src/style.css`

**Interfaces:**
- Produces: 三段 gutter 样式 + cursor

- [ ] **Step 1: 添加 gutter 样式**

```css
/* Gutter container */
.gutter-container {
  display: flex;
  flex-direction: column;
}

/* Glue gutters */
.gutter.glue-prev,
.gutter.glue-next {
  background: #89c3eb;
  cursor: url("data:image/svg+xml;base64,...") 3 25, auto;
}

/* Today gutter */
.gutter.today {
  cursor: url("data:image/svg+xml;base64,...") 5 16, auto;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/style.css
git commit -m "feat: 三段 gutter 样式 + cursor"
```

---

### Task 6: 端到端验证

- [ ] **Step 1: Build**

Run: `cd /d/a_my/project/html/Timelog/frontend && npx vite build`
Expected: Build 无错误

- [ ] **Step 2: 运行全部测试**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test`
Expected: 全部测试通过

- [ ] **Step 3: Tauri dev 启动验证**

Run: `cd /d/a_my/project/html/Timelog && npm run tauri dev`

Manual test:
1. 右键 today gutter → 剪刀确认框 → 剪切到明天
2. 验证：今天显示 `[00:00, cutAt)`，明天显示 glue-prev gutter
3. 右键 glue-prev gutter → 粘回
4. 验证：时间块恢复到今天
5. 跨区创建时间块（从 glue-prev 拖到 today）
6. 导出图片 → 验证三区显示
7. 导出文本 → 验证带符号时间前缀

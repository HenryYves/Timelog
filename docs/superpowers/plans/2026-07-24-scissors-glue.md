# 剪刀/胶水 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在时间轴上右键剪刀切分时间轴，切口之后/之前的内容整体移动到相邻日期（胶水块），胶水区右键粘回。

**Architecture:** 胶水块与普通块混存于同一 localStorage key，通过 `_cut` 属性区分。Timeline 渲染时分离出三个区：`glue-from-prev`、`grid`（今天）、`glue-from-next`。剪切/粘回逻辑为独立 store 函数，操作前后 snapshot 并 pushStoreUndo。

**Tech Stack:** Vue 3 + Pinia (无新依赖)

## Global Constraints

- WebView2 only，不考虑跨浏览器兼容
- 所有剪切/粘回操作支持 Ctrl+Z Undo
- 确认弹窗纳入 modalStack，ESC LIFO 关闭 + 焦点管理
- 胶水块 `_cut` 属性持久化到 localStorage（JSON 序列化自动保留）
- 两天之间只能单向（不能你给他、他也给你）
- `start`/`end` 保持原始值不变
- 跨切割线的块 split 后 ID 不变（方便粘回合并）
- 切分后 < 10 分钟的片段弹 confirm 询问是否保留

---

### Task 1: SVG 素材

**Files:**
- Create: `frontend/src/assets/scissors.svg`
- Create: `frontend/src/assets/glue.svg`

**Interfaces:**
- Produces: 两个 SVG 文件供 CSS `cursor: url()` 引用

- [ ] **Step 1: 复制并重命名剪刀 SVG**

Run:
```bash
cp "D:\a_my\seldom\computer_system\transfer\SP_xx_zd\剪刀.svg" "D:\a_my\project\html\Timelog\frontend\src\assets\scissors.svg"
cp "D:\a_my\seldom\computer_system\transfer\SP_xx_zd\胶水.svg" "D:\a_my\project\html\Timelog\frontend\src\assets\glue.svg"
```

- [ ] **Step 2: 验证文件存在**

Run: `ls -la frontend/src/assets/scissors.svg frontend/src/assets/glue.svg`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/scissors.svg frontend/src/assets/glue.svg
git commit -m "feat: 添加剪刀/胶水 cursor SVG 素材"
```

---

### Task 2: Store 剪切/粘回函数

**Files:**
- Modify: `frontend/src/store/timelog.js`

**Interfaces:**
- Produces:
  - `dateStr(d)` — "YYYY-MM-DD" from Date or string
  - `addDays(dateStr, n)` — return "YYYY-MM-DD" +/- n days
  - `isBefore(a, b)` — true if date string a < b
  - `canCutForward(blocks)` — check if blocks contain any `_cut.sourceDate > today`
  - `canCutBackward(blocks)` — check if blocks contain any `_cut.sourceDate < today`
  - `cutDay(sourceDate, cutAt, direction)` — execute cut, push undo
  - `glueBack(hostDate, sourceDate)` — execute glue-back, push undo
  - `getGlueBlocks(blocks, hostDate)` — return `{ fromPrev[], fromNext[], today[] }`

- [ ] **Step 1: 添加日期工具函数**

In `frontend/src/store/timelog.js`, after `dkey` (after line 40), add:

```js
export function dateStr(d) {
  // Accept Date or 'YYYY-MM-DD' string
  if (typeof d === 'string') return d
  return dkey(d)
}

export function addDays(ds, n) {
  const d = new Date(ds + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return dkey(d)
}

export function isBefore(a, b) {
  // true if date string a < b
  return a < b
}
```

- [ ] **Step 2: 运行现有测试确认不变**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test`
Expected: 所有已有测试通过

- [ ] **Step 3: 添加 canCutForward / canCutBackward**

In `frontend/src/store/timelog.js`, after `dateStr`/`addDays`/`isBefore`:

```js
export function canCutForward(blocks, dateKey) {
  // Can cut to tomorrow if no block came FROM tomorrow
  return !blocks.some(b => b._cut && isBefore(dateKey, b._cut.sourceDate))
}

export function canCutBackward(blocks, dateKey) {
  // Can cut to yesterday if no block came FROM yesterday
  return !blocks.some(b => b._cut && isBefore(b._cut.sourceDate, dateKey))
}
```

- [ ] **Step 4: 添加 cutDay 主函数**

After `canCutBackward`:

```js
/**
 * Cut a day at cutAt (minutes), moving blocks to adjacent day.
 * @param {string} sourceDate - 'YYYY-MM-DD' of the day being cut
 * @param {number} cutAt - cut point in minutes (0-1440)
 * @param {'forward'|'backward'} direction - forward=to tomorrow, backward=to yesterday
 */
export function cutDay(sourceDate, cutAt, direction) {
  const targetDate = direction === 'forward'
    ? addDays(sourceDate, 1)
    : addDays(sourceDate, -1)

  const srcKey = KEY_PREFIX + sourceDate
  const tgtKey = KEY_PREFIX + targetDate

  // Load both days
  let srcBlocks = []
  let tgtBlocks = []
  try { srcBlocks = JSON.parse(localStorage.getItem(srcKey)) || [] } catch {}
  try { tgtBlocks = JSON.parse(localStorage.getItem(tgtKey)) || [] } catch {}

  // Snapshot for undo
  const srcSnap = JSON.parse(JSON.stringify(srcBlocks))
  const tgtSnap = JSON.parse(JSON.stringify(tgtBlocks))

  // Validate constraint
  if (direction === 'forward' && !canCutForward(tgtBlocks, targetDate)) return false
  if (direction === 'backward' && !canCutBackward(tgtBlocks, targetDate)) return false

  // Filter out existing _cut blocks from srcBlocks (they stay)
  const normalBlocks = srcBlocks.filter(b => !b._cut)
  const existingCutBlocks = srcBlocks.filter(b => b._cut)

  // Find blocks to move
  let toMove, toStay
  if (direction === 'forward') {
    // Move blocks at/after cutAt
    toMove = []
    toStay = []
    normalBlocks.forEach(b => {
      if (b.start >= cutAt) {
        toMove.push({ ...b, tags: [...(b.tags || [])] })
      } else if (b.end > cutAt) {
        // Split — first half stays, second half moves
        const first = { ...b, end: cutAt, tags: [...(b.tags || [])] }
        const second = { ...b, start: cutAt, tags: [...(b.tags || [])] }
        toStay.push(first)
        toMove.push(second)
      } else {
        toStay.push(b)
      }
    })
  } else {
    // backward: Move blocks before cutAt
    toMove = []
    toStay = []
    normalBlocks.forEach(b => {
      if (b.end <= cutAt) {
        toMove.push({ ...b, tags: [...(b.tags || [])] })
      } else if (b.start < cutAt) {
        // Split — first half moves, second half stays
        const first = { ...b, start: b.start, end: cutAt, tags: [...(b.tags || [])] }
        const second = { ...b, start: cutAt, tags: [...(b.tags || [])] }
        toMove.push(first)
        toStay.push(second)
      } else {
        toStay.push(b)
      }
    })
  }

  // Warn on split fragments < 10 min
  // (handled in UI via confirm — see CutConfirm.vue)

  // Mark moved blocks with _cut
  toMove.forEach(b => {
    b._cut = { sourceDate, cutAt }
  })

  // Merge into target day
  // Remove existing _cut blocks from same sourceDate (re-merge)
  tgtBlocks = tgtBlocks.filter(b => !(b._cut && b._cut.sourceDate === sourceDate))
  tgtBlocks.push(...toMove)

  // Recalculate cutAt for all blocks from this sourceDate
  const allFromSource = tgtBlocks.filter(b => b._cut && b._cut.sourceDate === sourceDate)
  if (allFromSource.length) {
    const cutAts = allFromSource.map(b => b._cut.cutAt)
    const mergedCutAt = direction === 'forward'
      ? Math.min(...cutAts)
      : Math.max(...cutAts)
    allFromSource.forEach(b => { b._cut.cutAt = mergedCutAt })

    // Merge same-ID blocks (split halves reunited)
    const seen = new Map()
    const merged = []
    allFromSource.forEach(b => {
      if (seen.has(b.id)) {
        const prev = seen.get(b.id)
        prev.start = Math.min(prev.start, b.start)
        prev.end = Math.max(prev.end, b.end)
      } else {
        seen.set(b.id, b)
        merged.push(b)
      }
    })
    // Replace old from-source blocks with merged
    tgtBlocks = tgtBlocks.filter(b => !(b._cut && b._cut.sourceDate === sourceDate))
    tgtBlocks.push(...merged)
  }

  // Sort: _cut blocks first by start, then non-_cut by start
  const cutBlocks = tgtBlocks.filter(b => b._cut)
  const nonCutBlocks = tgtBlocks.filter(b => !b._cut)
  cutBlocks.sort((a, b) => a.start - b.start)
  nonCutBlocks.sort((a, b) => a.start - b.start)
  tgtBlocks = [...cutBlocks, ...nonCutBlocks]

  // Save src: remaining + existing cut blocks
  srcBlocks = [...toStay, ...existingCutBlocks]
  if (srcBlocks.length) {
    localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
  } else {
    localStorage.removeItem(srcKey)
  }

  // Save target
  if (tgtBlocks.length) {
    localStorage.setItem(tgtKey, JSON.stringify(tgtBlocks))
  } else {
    localStorage.removeItem(tgtKey)
  }

  // Push undo
  pushStoreUndo({
    undo: () => {
      if (srcSnap.length) localStorage.setItem(srcKey, JSON.stringify(srcSnap))
      else localStorage.removeItem(srcKey)
      if (tgtSnap.length) localStorage.setItem(tgtKey, JSON.stringify(tgtSnap))
      else localStorage.removeItem(tgtKey)
      // Reload if on affected date
      const store = useTimelogStore()
      if (store.dateKey === sourceDate || store.dateKey === targetDate) store.loadBlocks()
    },
    redo: () => {
      if (srcBlocks.length) localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
      else localStorage.removeItem(srcKey)
      if (tgtBlocks.length) localStorage.setItem(tgtKey, JSON.stringify(tgtBlocks))
      else localStorage.removeItem(tgtKey)
      const store = useTimelogStore()
      if (store.dateKey === sourceDate || store.dateKey === targetDate) store.loadBlocks()
    }
  })

  return { sourceDate, targetDate, moved: toMove.length }
}
```

- [ ] **Step 5: 添加 glueBack 函数**

After `cutDay`:

```js
/**
 * Glue blocks back to their source date.
 * @param {string} hostDate - 'YYYY-MM-DD' where the glue blocks currently live
 * @param {string} sourceDate - 'YYYY-MM-DD' where blocks originated
 */
export function glueBack(hostDate, sourceDate) {
  const hostKey = KEY_PREFIX + hostDate
  const srcKey = KEY_PREFIX + sourceDate

  let hostBlocks = []
  let srcBlocks = []
  try { hostBlocks = JSON.parse(localStorage.getItem(hostKey)) || [] } catch {}
  try { srcBlocks = JSON.parse(localStorage.getItem(srcKey)) || [] } catch {}

  const hostSnap = JSON.parse(JSON.stringify(hostBlocks))
  const srcSnap = JSON.parse(JSON.stringify(srcBlocks))

  // Find glue blocks from sourceDate
  const glueBlocks = hostBlocks.filter(b => b._cut && b._cut.sourceDate === sourceDate)
  if (!glueBlocks.length) return false

  // Remove from host
  hostBlocks = hostBlocks.filter(b => !(b._cut && b._cut.sourceDate === sourceDate))

  // Add to source (strip _cut, merge same-ID)
  glueBlocks.forEach(b => {
    const clean = { ...b }
    delete clean._cut
    const existing = srcBlocks.find(x => x.id === clean.id)
    if (existing) {
      existing.start = Math.min(existing.start, clean.start)
      existing.end = Math.max(existing.end, clean.end)
    } else {
      srcBlocks.push(clean)
    }
  })

  // Sort source
  srcBlocks.sort((a, b) => a.start - b.start)

  // Save
  if (hostBlocks.length) localStorage.setItem(hostKey, JSON.stringify(hostBlocks))
  else localStorage.removeItem(hostKey)
  if (srcBlocks.length) localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
  else localStorage.removeItem(srcKey)

  // Undo
  pushStoreUndo({
    undo: () => {
      if (hostSnap.length) localStorage.setItem(hostKey, JSON.stringify(hostSnap))
      else localStorage.removeItem(hostKey)
      if (srcSnap.length) localStorage.setItem(srcKey, JSON.stringify(srcSnap))
      else localStorage.removeItem(srcKey)
      const store = useTimelogStore()
      if (store.dateKey === hostDate || store.dateKey === sourceDate) store.loadBlocks()
    },
    redo: () => {
      if (hostBlocks.length) localStorage.setItem(hostKey, JSON.stringify(hostBlocks))
      else localStorage.removeItem(hostKey)
      if (srcBlocks.length) localStorage.setItem(srcKey, JSON.stringify(srcBlocks))
      else localStorage.removeItem(srcKey)
      const store = useTimelogStore()
      if (store.dateKey === hostDate || store.dateKey === sourceDate) store.loadBlocks()
    }
  })

  return { hostDate, sourceDate, moved: glueBlocks.length }
}
```

- [ ] **Step 6: 添加 getGlueBlocks 辅助函数**

After `glueBack`:

```js
/**
 * Split blocks array into fromPrev / today / fromNext groups.
 */
export function getGlueBlocks(blocks, hostDate) {
  const fromPrev = []
  const fromNext = []
  const today = []
  blocks.forEach(b => {
    if (b._cut) {
      if (isBefore(b._cut.sourceDate, hostDate)) fromPrev.push(b)
      else fromNext.push(b)
    } else {
      today.push(b)
    }
  })
  return { fromPrev, fromNext, today }
}
```

- [ ] **Step 7: 运行现有测试确认不破坏**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test`
Expected: 所有已有测试通过

- [ ] **Step 8: Commit**

```bash
git add frontend/src/store/timelog.js
git commit -m "feat: 添加 cutDay/glueBack/canCut/getGlueBlocks store 函数"
```

---

### Task 3: 文案与样式

**Files:**
- Modify: `frontend/src/strings.js`
- Modify: `frontend/src/style.css`

**Interfaces:**
- Consumes: (none from earlier tasks)
- Produces: `STR.cut.*` / `STR.glue.*` for confirm dialogs; cursor + glue gutter CSS classes

- [ ] **Step 1: 添加 strings.js 文案**

In `frontend/src/strings.js`, add to the top-level `STR` object, after `stats` and before `help`:

```js
cut: {
  forward: '便是明朝',
  backward: '溯与昨宵',
  confirmTitleFwd: (time) => `剪刀落处，${time}，[便是明朝▾]。`,
  confirmTitleBwd: (time) => `剪刀落处，${time}，[溯与昨宵▾]。`,
  shortBlock: (dur) => `切出片段不足10分钟（${dur}分），是否保留？`,
  extremeAll: '将移走当天所有时间块，确定？',
  extremeNone: '该时刻无内容可切。',
},
glue: {
  confirm: (date) => `粘回 ${date}？`,
},
export: {
  timeRange: '时间范围',
  timeRangeAll: '全天',
  timeRangeCustom: '自定义',
  timeRangePrefixPrev: '- ',
  timeRangePrefixNext: '+ ',
  glueBlockPrefix: (date) => `[来自${date}] `,
},
```

- [ ] **Step 2: 添加 style.css 胶水区样式和 cursor**

In `frontend/src/style.css`, at the end of the file, add:

```css

/* ── Glue areas ── */
.glue-from-prev,
.glue-from-next {
  display: flex;
  position: relative;
}

.glue-from-prev .gutter,
.glue-from-next .gutter {
  background: #89c3eb;
}

.glue-from-prev .day,
.glue-from-next .day {
  background: var(--canvas);
  position: relative;
}

/* Cursor: scissors on normal day area */
.day {
  cursor: url('@/assets/scissors.svg') 16 16, auto;
}

/* Cursor: glue on glue area (but not on blocks) */
.glue-from-prev .day,
.glue-from-next .day {
  cursor: url('@/assets/glue.svg') 16 16, auto;
}

/* Blocks inside glue areas use normal cursors */
.glue-from-prev .block,
.glue-from-next .block {
  cursor: pointer;
}
```

Note: Vite handles `@/assets/` alias in CSS `url()`. If this doesn't resolve, use relative paths like `../assets/scissors.svg`.

- [ ] **Step 3: 验证构建**

Run: `cd /d/a_my/project/html/Timelog/frontend && npx vite build`
Expected: Build succeeds with no CSS resolution errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/strings.js frontend/src/style.css
git commit -m "feat: 添加剪刀/胶水文案和 CSS cursor + glue 区样式"
```

---

### Task 4: CutConfirm 组件

**Files:**
- Create: `frontend/src/components/CutConfirm.vue`

**Interfaces:**
- Consumes: `STR.cut.*` from strings.js; `useModal` pattern from App.vue
- Produces: emits `confirm(cutAt, direction)` or `close`

- [ ] **Step 1: 创建 CutConfirm.vue**

Create `frontend/src/components/CutConfirm.vue`:

```vue
<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal cut-confirm" @keydown="trapFocus" style="max-width:420px">
      <p class="cut-line">
        剪刀落处，
        <input
          ref="timeInput"
          type="text"
          class="cut-time-input"
          v-model="timeStr"
          maxlength="5"
          @keydown.enter="onConfirm"
          @keydown.escape.stop="emit('close')"
        />，
        <span class="cut-dir-wrap" @click.stop @keydown.escape.stop="showDir = false">
          <span class="cut-dir-btn" @click="showDir = !showDir" tabindex="0" @keydown.enter="showDir = !showDir" @keydown.space.prevent="showDir = !showDir">[{{ directionText }}▾]</span>
          <div v-if="showDir" class="dropdown open" style="position:absolute;left:0;top:100%">
            <button class="dropdown-item" @click="setDir('forward'); showDir = false">{{ STR.cut.forward }}（→明天）</button>
            <button class="dropdown-item" @click="setDir('backward'); showDir = false">{{ STR.cut.backward }}（→昨天）</button>
          </div>
        </span>。
      </p>
      <div class="actions">
        <span class="spacer"></span>
        <button class="primary" @click="onConfirm">{{ STR.btn.ok }}</button>
        <button @click="emit('close')">{{ STR.btn.cancel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { STR } from '../strings.js'
import { fmt } from '../store/timelog.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  initialMin: { type: Number, default: 0 },
  availableDirs: { type: Array, default: () => ['forward', 'backward'] },
})

const emit = defineEmits(['close', 'confirm'])

const timeInput = ref(null)
const timeStr = ref(fmt(props.initialMin))
const direction = ref(props.availableDirs[0])
const showDir = ref(false)

const directionText = computed(() =>
  direction.value === 'forward' ? STR.cut.forward : STR.cut.backward
)

function setDir(d) {
  direction.value = d
}

watch(() => props.show, async (v) => {
  if (v) {
    timeStr.value = fmt(props.initialMin)
    direction.value = props.availableDirs[0]
    showDir.value = false
    await nextTick()
    timeInput.value?.focus()
    timeInput.value?.select()
  }
})

function parseTime(str) {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1]), min = parseInt(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

function onConfirm() {
  const cutAt = parseTime(timeStr.value)
  if (cutAt == null) {
    timeInput.value?.select()
    return
  }
  emit('confirm', cutAt, direction.value)
}

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const items = e.currentTarget.querySelectorAll('button:not([disabled]), input:not([disabled])')
  const visible = [...items].filter(el => el.offsetParent !== null)
  if (!visible.length) { e.preventDefault(); return }
  const first = visible[0], last = visible[visible.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CutConfirm.vue
git commit -m "feat: 添加 CutConfirm 剪刀确认弹窗组件"
```

---

### Task 5: GlueConfirm 组件

**Files:**
- Create: `frontend/src/components/GlueConfirm.vue`

**Interfaces:**
- Consumes: `STR.glue.*` from strings.js
- Produces: emits `confirm()` or `close`

- [ ] **Step 1: 创建 GlueConfirm.vue**

Create `frontend/src/components/GlueConfirm.vue`:

```vue
<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal" @keydown="trapFocus" style="max-width:360px">
      <p style="text-align:center;font-size:15px;margin-bottom:16px">{{ STR.glue.confirm(sourceLabel) }}</p>
      <div class="actions">
        <span class="spacer"></span>
        <button class="primary" @click="emit('confirm')" ref="okBtn">{{ STR.btn.ok }}</button>
        <button @click="emit('close')">{{ STR.btn.cancel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { STR } from '../strings.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  sourceDate: { type: String, default: '' },
})

const emit = defineEmits(['close', 'confirm'])
const okBtn = ref(null)

const sourceLabel = computed(() => {
  if (!props.sourceDate) return ''
  const [y, m, d] = props.sourceDate.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
})

watch(() => props.show, async (v) => {
  if (v) {
    await nextTick()
    okBtn.value?.focus()
  }
})

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const items = e.currentTarget.querySelectorAll('button:not([disabled])')
  const visible = [...items].filter(el => el.offsetParent !== null)
  if (!visible.length) { e.preventDefault(); return }
  const first = visible[0], last = visible[visible.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/GlueConfirm.vue
git commit -m "feat: 添加 GlueConfirm 胶水确认弹窗组件"
```

---

### Task 6: Timeline.vue — 胶水区渲染 + 光标 + 交互

**Files:**
- Modify: `frontend/src/components/Timeline.vue`

**Interfaces:**
- Consumes: `getGlueBlocks`, `cutDay`, `glueBack`, `canCutForward`, `canCutBackward`, `fmt`, `dkey`, `addDays`, `isBefore` from timelog.js; `STR.cut`/`STR.glue` from strings.js; `useConfirm` composable
- Produces: emits `cut-day`, `glue-back` events to App.vue (or handles inline via store)

Will restructure Timeline.vue to render three sections: glue-from-prev, grid (today), glue-from-next.

This is the most complex task — ~200 line diff to Timeline.vue. Let me break it into steps.

- [ ] **Step 1: 更新 imports**

In Timeline.vue `<script setup>`, update imports to add:

```js
import { useTimelogStore, fmt, dkey, toInput, fromInput, getGlueBlocks, cutDay, glueBack, canCutForward, canCutBackward, addDays, isBefore } from '../store/timelog.js'
```

And add:
```js
import { STR } from '../strings.js'
```

- [ ] **Step 2: 添加胶水块分离 computed**

In Timeline.vue `<script setup>`, after `const layoutBlocks = computed(() => layout(store.blocks))`, add:

```js
const glueBlocks = computed(() => getGlueBlocks(store.blocks, store.dateKey))
const { fromPrev, fromNext, today } = glueBlocks.value
const glueFromPrev = computed(() => glueBlocks.value.fromPrev)
const glueFromNext = computed(() => glueBlocks.value.fromNext)
const todayBlocks = computed(() => glueBlocks.value.today)
const layoutBlocks = computed(() => layout(todayBlocks.value))
```

Wait — `layoutBlocks` is already defined above. I need to restructure. Let me handle this in the actual implementation by replacing the existing `layoutBlocks` definition.

Replace:
```js
const layoutBlocks = computed(() => layout(store.blocks))
```

With:
```js
const glueBlocks = computed(() => getGlueBlocks(store.blocks, store.dateKey))
const layoutBlocks = computed(() => layout(glueBlocks.value.today))
```

And add:
```js
function blocksForArea(area) {
  const gb = glueBlocks.value
  if (area === 'prev') return gb.fromPrev
  if (area === 'next') return gb.fromNext
  return gb.today
}
```

- [ ] **Step 3: 添加约束检查 computed**

After glueBlocks:

```js
const canCutFwd = computed(() => canCutForward(store.blocks, store.dateKey))
const canCutBwd = computed(() => canCutBackward(store.blocks, store.dateKey))

// Available directions for cut confirmation
const availableDirs = computed(() => {
  const dirs = []
  if (canCutFwd.value) dirs.push('forward')
  if (canCutBwd.value) dirs.push('backward')
  return dirs
})

// Glue source dates (for glue-back targets)
const glueSourcePrev = computed(() => {
  const prev = glueBlocks.value.fromPrev
  if (!prev.length) return null
  return prev[0]._cut.sourceDate
})
const glueSourceNext = computed(() => {
  const next = glueBlocks.value.fromNext
  if (!next.length) return null
  return next[0]._cut.sourceDate
})
```

- [ ] **Step 4: 添加 cut confirm 状态**

```js
const showCutConfirm = ref(false)
const cutInitialMin = ref(0)
const { showConfirm } = useConfirm()

function onDayRightClick(e) {
  // Only available if at least one direction is allowed
  if (!availableDirs.value.length) return
  const min = yToMin(e.clientY)
  // Check extremes
  if (!canCutFwd.value && min <= 0) return // no backward cut at 00:00
  if (!canCutBwd.value && min >= DAY_MIN) return // no forward cut at 24:00
  cutInitialMin.value = min
  showCutConfirm.value = true
}

async function onCutConfirm(cutAt, direction) {
  // Check extreme cases
  if (direction === 'forward' && cutAt <= 0) {
    const ok = await showConfirm(STR.cut.extremeAll)
    if (!ok) return
  }
  if (direction === 'backward' && cutAt >= DAY_MIN) {
    const ok = await showConfirm(STR.cut.extremeAll)
    if (!ok) return
  }
  // Check no-op extremes
  if (direction === 'forward' && cutAt >= DAY_MIN) {
    toast(STR.cut.extremeNone)
    return
  }
  if (direction === 'backward' && cutAt <= 0) {
    toast(STR.cut.extremeNone)
    return
  }

  // Check for short fragments
  const gb = glueBlocks.value
  const today = gb.today
  let hasShort = false
  let shortDur = 0
  for (const b of today) {
    if (direction === 'forward') {
      if (b.start >= cutAt && b.end - b.start < 10) { hasShort = true; shortDur = b.end - b.start; break }
      if (b.start < cutAt && b.end > cutAt) {
        const secondHalf = b.end - cutAt
        const firstHalf = cutAt - b.start
        if (secondHalf < 10 || firstHalf < 10) { hasShort = true; shortDur = Math.min(secondHalf, firstHalf); break }
      }
    } else {
      if (b.end <= cutAt && b.end - b.start < 10) { hasShort = true; shortDur = b.end - b.start; break }
      if (b.start < cutAt && b.end > cutAt) {
        const firstHalf = cutAt - b.start
        const secondHalf = b.end - cutAt
        if (firstHalf < 10 || secondHalf < 10) { hasShort = true; shortDur = Math.min(firstHalf, secondHalf); break }
      }
    }
  }
  if (hasShort) {
    const ok = await showConfirm(STR.cut.shortBlock(shortDur))
    if (!ok) return
  }

  const result = cutDay(store.dateKey, cutAt, direction)
  if (result) {
    store.loadBlocks()
    toast(`已剪切 ${result.moved} 个块到 ${direction === 'forward' ? '明天' : '昨天'}`)
  }
  showCutConfirm.value = false
}

async function onGlueBack(sourceDate) {
  const ok = await showConfirm(STR.glue.confirm(sourceDate))
  if (!ok) return
  const result = glueBack(store.dateKey, sourceDate)
  if (result) {
    store.loadBlocks()
    toast('已粘回')
  }
}
```

- [ ] **Step 5: 更新 onDayMouseDown 右键处理**

Replace the right-click block in `onDayMouseDown` (currently line 328-332):

Instead of `selPending = { clientX, clientY }`, change to call `onDayRightClick(e)`:

```js
function onDayMouseDown(e) {
  // Right-click on day background: scissors cut
  if (e.button === 2) {
    e.preventDefault()
    if (e.target === dayRef.value || e.target.classList.contains('hourline') || e.target.classList.contains('halfline')) {
      onDayRightClick(e)
      return
    }
    // Otherwise: selection drag
    selPending = { clientX: e.clientX, clientY: e.clientY }
    return
  }
  // ... rest unchanged
}
```

Wait — we need to distinguish "right-click on empty day area" (scissors) from "right-click-move selection drag". Currently right-click starts a potential drag. The user said scissors should trigger on a simple right-click (no drag). And drag should still work too.

Actually re-reading the spec: right-click on `.day` blank area → scissors confirm. The right-drag selection was initiated by mousedown + mousemove past threshold. So we need:
- Right-click (press + release without moving): scissors
- Right-click + drag: selection

This needs tracking. Let me use a flag:

```js
let rightClickPending = false

function onDayMouseDown(e) {
  if (e.button === 2) {
    e.preventDefault()
    rightClickPending = true
    selPending = { clientX: e.clientX, clientY: e.clientY }
    return
  }
  // ...
}
```

Then in `onMouseUp`:
```js
function onMouseUp(e) {
  // ... existing adrag handling ...

  if (selPending && !selMoved && rightClickPending) {
    // No drag — it was a click → scissors
    rightClickPending = false
    selPending = null
    onDayRightClick(e)
    return
  }
  rightClickPending = false
  selPending = null
  selMoved = false
  // ... existing selRect handling ...
}
```

Actually this is getting complicated. Let me simplify: if the user right-clicks on a `.day` area that's NOT on a block, AND the click didn't move (is a click, not a drag), show scissors. If it moved past threshold, it's a selection drag as before.

The key check is in `onMouseUp`: if `selMoved` is false AND there was a right-click on empty area → scissors.

Let me restructure:

In `onDayMouseDown`:
```js
if (e.button === 2) {
  e.preventDefault()
  // Check if clicking on a block or empty area
  const onBlock = e.target.closest('.block')
  if (!onBlock) {
    selPending = { clientX: e.clientX, clientY: e.clientY, isRight: true }
  } else {
    selPending = { clientX: e.clientX, clientY: e.clientY, isRight: false }
  }
  return
}
```

In `onMouseUp` (after existing drag end logic):
```js
// After the existing selRect logic
if (selMoved === false && selPending && selPending.isRight) {
  // Right-click on empty area — scissors
  onDayRightClick(e)
}
```

Hmm, but selPending is already nulled before the selRect check. Let me look at the current flow more carefully.

Current onMouseUp:
```js
function onMouseUp() {
  if (adrag) { endDrag(true) }
  selPending = null     // <-- nulled here
  selMoved = false
  if (selRect.value) { ... }  // handles selection rectangle finalization
}
```

I need to check selPending BEFORE it's nulled, or save its state. Let me use a separate flag:

```js
let _wasRightClick = false

function onDayMouseDown(e) {
  if (e.button === 2) {
    e.preventDefault()
    const onBlock = e.target.closest('.block')
    if (onBlock) {
      // Right-click on block — handled by onBlockContextMenu
      selPending = { clientX: e.clientX, clientY: e.clientY }
      _wasRightClick = false
    } else {
      selPending = { clientX: e.clientX, clientY: e.clientY }
      _wasRightClick = true
    }
    return
  }
  _wasRightClick = false
  // ... existing left-click logic
}

function onMouseUp(e) {
  if (adrag) { endDrag(true) }
  
  // Check for right-click (no drag) on empty area → scissors
  if (_wasRightClick && !selMoved && selPending) {
    selPending = null
    _wasRightClick = false
    selMoved = false
    onDayRightClick(e)
    return
  }
  
  _wasRightClick = false
  selPending = null
  selMoved = false
  if (selRect.value) { ... }
}
```

This is for the actual implementation. For the plan I'll describe the approach.

- [ ] **Step 5: 更新右键处理逻辑**

In `onDayMouseDown`, change right-click handling to distinguish "on block" vs "on empty area":

```js
let _rightClickOnEmpty = false

function onDayMouseDown(e) {
  if (e.button === 2) {
    e.preventDefault()
    _rightClickOnEmpty = !e.target.closest('.block')
    selPending = { clientX: e.clientX, clientY: e.clientY }
    return
  }
  // ... rest unchanged
}
```

In `onMouseUp`, before nulling selPending, check for scissors:

```js
function onMouseUp(e) {
  if (adrag) { endDrag(true) }
  
  // Right-click on empty area (no drag) → scissors
  if (_rightClickOnEmpty && !selMoved && selPending) {
    _rightClickOnEmpty = false
    selPending = null
    selMoved = false
    onDayRightClick(e)
    return
  }
  _rightClickOnEmpty = false
  selPending = null
  selMoved = false
  // ... existing selRect handling
}
```

- [ ] **Step 6: 添加胶水区右键处理**

Add handler for right-click on glue area background:

```js
function onGlueAreaRightClick(e, sourceDate) {
  e.preventDefault()
  if (e.target.closest('.block')) return // right-click on block → ignore here
  onGlueBack(sourceDate)
}
```

- [ ] **Step 7: 更新模板 — 三区结构**

Replace the current grid-only template. The `<template>` section of Timeline.vue needs to wrap the grid with glue areas.

Current structure:
```html
<div class="grid">
  <div class="gutter">...</div>
  <div class="day" ref="dayRef" ...>...</div>
</div>
```

New structure:
```html
<div v-if="glueBlocks.fromPrev.length" class="glue-from-prev">
  <div class="gutter" :style="{ width: GUTTER_WIDTH + 'px', height: glueHeight('prev') + 'px' }">
    <div v-for="h in glueHours('prev')" :key="'gh'+h" class="hlabel" :style="{ top: ... }">...</div>
  </div>
  <div class="day"
    :style="{ height: glueHeight('prev') + 'px' }"
    @contextmenu.prevent="onGlueAreaRightClick($event, glueSourcePrev)"
    @mousemove="onGlueMouseMove"
    @mouseup="onGlueMouseUp"
    @mouseleave="onGlueMouseUp"
  >
    <!-- glue blocks -->
    <div v-for="ev in glueBlocks.fromPrev" :key="ev.id" class="block" ... />
  </div>
</div>

<div class="grid">...</div>

<div v-if="glueBlocks.fromNext.length" class="glue-from-next">
  ...
</div>
```

For the plan, I'll describe the glue block rendering as reusing the same `computeBlockStyle` function, with `_cols = 1, _col = 0` hardcoded for glue blocks (single column).

- [ ] **Step 7: 更新模板**

Wrap the existing `<div class="grid">` with glue areas. Add `v-if` glue-from-prev and glue-from-next sections before and after the grid. Each glue section has its own gutter + day container, rendering blocks from `glueBlocks.value.fromPrev` and `glueBlocks.value.fromNext`.

Add `@contextmenu.prevent="onGlueAreaRightClick($event, glueSourcePrev)"` (and `glueSourceNext`) to the glue `.day` divs.

Glue blocks re-use existing `computeBlockStyle` — they'll have single-column layout (`_col=0, _cols=1`).

- [ ] **Step 8: 添加胶水区高度和小时标签计算**

```js
function glueAreaHeight(blocks) {
  if (!blocks.length) return 0
  const maxEnd = Math.max(...blocks.map(b => b.end))
  return Math.max(maxEnd, 60) * PX_MIN // at least 1 hour
}

function glueHourCount(blocks) {
  if (!blocks.length) return 0
  const maxEnd = Math.max(...blocks.map(b => b.end))
  return Math.ceil(maxEnd / 60) + 1
}
```

- [ ] **Step 9: 添加胶水块布局计算**

Glue blocks use simple single-column layout:

```js
const gluePrevLayout = computed(() => {
  return glueBlocks.value.fromPrev.map(b => ({ ...b, _col: 0, _cols: 1 }))
})

const glueNextLayout = computed(() => {
  return glueBlocks.value.fromNext.map(b => ({ ...b, _col: 0, _cols: 1 }))
})
```

- [ ] **Step 10: 运行测试确认不破坏**

Run: `cd /d/a_my/project/html/Timelog/frontend && npx vite build`
Expected: Build succeeds

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test`
Expected: 所有已有测试通过

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/Timeline.vue
git commit -m "feat: Timeline 添加胶水区渲染 + 剪刀/胶水右键交互"
```

---

### Task 7: ExportPanel 文本导出胶水块标注

**Files:**
- Modify: `frontend/src/components/ExportPanel.vue`

- [ ] **Step 1: 在 buildExport 中为胶水块加前缀**

In `frontend/src/components/ExportPanel.vue`, in the `buildExport` function (around line 155-162), add a prefix for glue blocks:

Replace:
```js
function buildExport() {
  return timelogStore.blocks.slice().sort((a, b) => a.start - b.start).map(ev => {
    const t = (ev.tags && ev.tags.length) ? ':' + ev.tags.join(',') : ''
    return '- (' + fmt(ev.start) + '-' + fmt(ev.end) + t + ')' + (ev.title || '') + ';' +
      (ev.note || '').replace(/\n(.*)/g, (m, line) =>
        /^\s*(?:[-*]|\d+\.)\s/.test(line) ? '\n\t' + line : '\n ' + line)
  }).join('\n')
}
```

With:
```js
function buildExport() {
  return timelogStore.blocks.slice().sort((a, b) => a.start - b.start).map(ev => {
    const t = (ev.tags && ev.tags.length) ? ':' + ev.tags.join(',') : ''
    const prefix = ev._cut ? `[来自${ev._cut.sourceDate}] ` : ''
    return prefix + '- (' + fmt(ev.start) + '-' + fmt(ev.end) + t + ')' + (ev.title || '') + ';' +
      (ev.note || '').replace(/\n(.*)/g, (m, line) =>
        /^\s*(?:[-*]|\d+\.)\s/.test(line) ? '\n\t' + line : '\n ' + line)
  }).join('\n')
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ExportPanel.vue
git commit -m "feat: 文本导出胶水块添加 [来自X/X] 前缀"
```

---

### Task 8: ExportImagePanel 时间范围选择器

**Files:**
- Modify: `frontend/src/components/ExportImagePanel.vue`

- [ ] **Step 1: 在 timeline 模式导出设置中新增时间范围选择器**

在 `ExportImagePanel.vue` 的 template 中，`mode === 'timeline'` 区域，新增：

```html
<div class="setting-group">
  <label>{{ STR.export.timeRange }}</label>
  <select v-model="exportTimeRange">
    <option value="all">{{ STR.export.timeRangeAll }}</option>
    <option value="custom">{{ STR.export.timeRangeCustom }}</option>
  </select>
</div>
<template v-if="exportTimeRange === 'custom'">
  <!-- Dynamic inputs based on available glue areas -->
  <div v-if="hasPrevGlue" class="setting-group">
    <label>{{ STR.export.timeRangePrefixPrev }}</label>
    <input type="text" v-model="customRangePrevStart" placeholder="HH:MM" maxlength="5" />
    <span>→</span>
    <input type="text" v-model="customRangePrevEnd" placeholder="HH:MM" maxlength="5" />
  </div>
  <div class="setting-group">
    <label>今天</label>
    <input type="text" v-model="customRangeTodayStart" placeholder="HH:MM" maxlength="5" />
    <span>→</span>
    <input type="text" v-model="customRangeTodayEnd" placeholder="HH:MM" maxlength="5" />
  </div>
  <div v-if="hasNextGlue" class="setting-group">
    <label>{{ STR.export.timeRangePrefixNext }}</label>
    <input type="text" v-model="customRangeNextStart" placeholder="HH:MM" maxlength="5" />
    <span>→</span>
    <input type="text" v-model="customRangeNextEnd" placeholder="HH:MM" maxlength="5" />
  </div>
</template>
```

- [ ] **Step 2: 添加相关 data 和 computed**

In `<script setup>`:
```js
import { getGlueBlocks } from '../store/timelog.js'
import { STR } from '../strings.js'

const exportTimeRange = ref('all')
const customRangePrevStart = ref('')
const customRangePrevEnd = ref('')
const customRangeTodayStart = ref('')
const customRangeTodayEnd = ref('')
const customRangeNextStart = ref('')
const customRangeNextEnd = ref('')

const hasPrevGlue = computed(() => {
  const gb = getGlueBlocks(useTimelogStore().blocks, useTimelogStore().dateKey)
  return gb.fromPrev.length > 0
})
const hasNextGlue = computed(() => {
  const gb = getGlueBlocks(useTimelogStore().blocks, useTimelogStore().dateKey)
  return gb.fromNext.length > 0
})
```

- [ ] **Step 3: 在 doExport/doCopy 中使用时间范围裁剪 canvas**

This is the most involved part — the time range settings need to be passed to the capture logic to crop the canvas to the specified range. For the initial implementation, pass the range settings through and apply a clip rect to the captured canvas.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExportImagePanel.vue
git commit -m "feat: 导出图片新增时间范围选择器（含 -/+ 胶水区）"
```

---

### Task 9: App.vue 组件注册

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 导入并使用 CutConfirm / GlueConfirm**

In `App.vue` `<script setup>`, add imports:

```js
import CutConfirm from './components/CutConfirm.vue'
import GlueConfirm from './components/GlueConfirm.vue'
```

In template, inside `<div id="app-container">`, after the existing modal components, add:

```html
<CutConfirm
  v-if="showCutConfirm"
  :show="showCutConfirm"
  :initial-min="cutInitialMin"
  :available-dirs="availableDirs"
  @close="showCutConfirm = false"
  @confirm="onCutConfirm"
/>
<GlueConfirm
  v-if="showGlueConfirm"
  :show="showGlueConfirm"
  :source-date="glueSourceDate"
  @close="showGlueConfirm = false"
  @confirm="onGlueConfirm"
/>
```

- [ ] **Step 2: 添加状态和事件处理**

In `<script setup>`:
```js
const showCutConfirm = ref(false)
const cutInitialMin = ref(0)
const availableDirs = ref(['forward', 'backward'])
```

These will be managed via provide/inject or event bus pattern. For simplicity, Timeline.vue will handle the cut/glue flow internally (as designed in Task 6). The CutConfirm and GlueConfirm components can be rendered inside Timeline.vue instead.

Actually, let me simplify: put the confirm dialogs inside Timeline.vue since that's where the interaction originates. No need to bubble up to App.vue.

Revised: CutConfirm and GlueConfirm are used INSIDE Timeline.vue, not App.vue. App.vue just needs to import Timeline which now internally uses these components.

- [ ] **Step 1 revised: 确认 Timeline.vue 内引用 CutConfirm/GlueConfirm**

In Timeline.vue `<script setup>`:
```js
import CutConfirm from './CutConfirm.vue'
import GlueConfirm from './GlueConfirm.vue'
```

In Timeline.vue template, add at the end:
```html
<CutConfirm
  v-if="showCutConfirm"
  :show="showCutConfirm"
  :initial-min="cutInitialMin"
  :available-dirs="availableDirs"
  @close="showCutConfirm = false"
  @confirm="onCutConfirm"
/>
<GlueConfirm
  v-if="showGlueConfirm"
  :show="showGlueConfirm"
  :source-date="glueSourceToRestore"
  @close="showGlueConfirm = false"
  @confirm="onGlueConfirm"
/>
```

- [ ] **Step 2: 验证构建**

Run: `cd /d/a_my/project/html/Timelog/frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.vue frontend/src/components/Timeline.vue
git commit -m "feat: 注册 CutConfirm/GlueConfirm 到 Timeline"
```

---

### Task 10: 测试

**Files:**
- Create: `frontend/src/__tests__/store/timelog.test.js` (append tests)

- [ ] **Step 1: 添加 cutDay / glueBack 单元测试**

Add to `frontend/src/__tests__/store/timelog.test.js`:

```js
import {
  dateStr, addDays, isBefore,
  canCutForward, canCutBackward,
  cutDay, glueBack, getGlueBlocks,
} from '../../store/timelog.js'

describe('date helpers', () => {
  it('dateStr works with Date and string', () => {
    expect(dateStr(new Date(2026, 6, 24))).toBe('2026-07-24')
    expect(dateStr('2026-07-24')).toBe('2026-07-24')
  })

  it('addDays adds and subtracts', () => {
    expect(addDays('2026-07-24', 1)).toBe('2026-07-25')
    expect(addDays('2026-07-24', -1)).toBe('2026-07-23')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('isBefore compares date strings', () => {
    expect(isBefore('2026-07-23', '2026-07-24')).toBe(true)
    expect(isBefore('2026-07-25', '2026-07-24')).toBe(false)
  })
})

describe('cut constraints', () => {
  it('canCutForward rejects if blocks from tomorrow exist', () => {
    const blocks = [{ id: 'b1', start: 0, end: 60, _cut: { sourceDate: '2026-07-25', cutAt: 0 } }]
    expect(canCutForward(blocks, '2026-07-24')).toBe(false)
  })

  it('canCutForward allows if no blocks from tomorrow', () => {
    const blocks = [{ id: 'b1', start: 0, end: 60, _cut: { sourceDate: '2026-07-23', cutAt: 0 } }]
    expect(canCutForward(blocks, '2026-07-24')).toBe(true)
  })

  it('canCutBackward rejects if blocks from yesterday exist', () => {
    const blocks = [{ id: 'b1', start: 0, end: 60, _cut: { sourceDate: '2026-07-23', cutAt: 0 } }]
    expect(canCutBackward(blocks, '2026-07-24')).toBe(false)
  })
})

describe('cutDay', () => {
  beforeEach(() => {
    // Seed localStorage with test data
    localStorage.setItem('timelog:2026-07-24', JSON.stringify([
      { id: 'a', start: 480, end: 600, title: 'Morning', note: '', tags: [] },   // 08:00-10:00
      { id: 'b', start: 720, end: 840, title: 'Afternoon', note: '', tags: [] }, // 12:00-14:00
      { id: 'c', start: 1200, end: 1380, title: 'Evening', note: '', tags: [] }, // 20:00-23:00
    ]))
    localStorage.removeItem('timelog:2026-07-25')
    localStorage.removeItem('timelog:2026-07-23')
  })

  it('cutDay forward moves blocks after cutAt to next day', () => {
    const result = cutDay('2026-07-24', 780, 'forward') // cut at 13:00
    expect(result).toBeTruthy()
    expect(result.moved).toBeGreaterThan(0)

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))

    // Block 'b' (12:00-14:00) should be split: 12:00-13:00 stays, 13:00-14:00 moves
    const splitB = src.find(x => x.id === 'b')
    expect(splitB).toBeTruthy()
    expect(splitB.end).toBe(780) // 13:00

    const movedB = tgt.find(x => x.id === 'b')
    expect(movedB).toBeTruthy()
    expect(movedB.start).toBe(780)
    expect(movedB._cut).toBeTruthy()
    expect(movedB._cut.sourceDate).toBe('2026-07-24')
  })

  it('cutDay backward moves blocks before cutAt to prev day', () => {
    const result = cutDay('2026-07-24', 660, 'backward') // cut at 11:00
    expect(result).toBeTruthy()

    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))
    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-23'))

    // Block 'a' (08:00-10:00) should be moved entirely (before 11:00)
    const movedA = tgt.find(x => x.id === 'a')
    expect(movedA).toBeTruthy()
    expect(movedA._cut).toBeTruthy()
  })
})

describe('glueBack', () => {
  beforeEach(() => {
    localStorage.setItem('timelog:2026-07-24', JSON.stringify([
      { id: 'a', start: 0, end: 60, title: 'Normal', note: '', tags: [] },
    ]))
    localStorage.setItem('timelog:2026-07-25', JSON.stringify([
      { id: 'b', start: 480, end: 600, _cut: { sourceDate: '2026-07-24', cutAt: 480 }, title: 'Cut', note: '', tags: [] },
    ]))
  })

  it('glueBack moves blocks back to source date', () => {
    const result = glueBack('2026-07-25', '2026-07-24')
    expect(result).toBeTruthy()

    const tgt = JSON.parse(localStorage.getItem('timelog:2026-07-25'))
    const src = JSON.parse(localStorage.getItem('timelog:2026-07-24'))

    // Target should have no glue blocks
    expect(tgt.find(x => x._cut)).toBeFalsy()

    // Source should have the returned block
    const returned = src.find(x => x.id === 'b')
    expect(returned).toBeTruthy()
    expect(returned._cut).toBeFalsy()
  })
})

describe('getGlueBlocks', () => {
  it('separates fromPrev, fromNext, today', () => {
    const blocks = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 60, end: 120, _cut: { sourceDate: '2026-07-23', cutAt: 0 } },
      { id: 'c', start: 120, end: 180, _cut: { sourceDate: '2026-07-25', cutAt: 0 } },
    ]
    const { fromPrev, fromNext, today } = getGlueBlocks(blocks, '2026-07-24')
    expect(fromPrev).toHaveLength(1)
    expect(fromPrev[0].id).toBe('b')
    expect(fromNext).toHaveLength(1)
    expect(fromNext[0].id).toBe('c')
    expect(today).toHaveLength(1)
    expect(today[0].id).toBe('a')
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test`
Expected: 新增测试全部通过，已有测试无回归

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/store/timelog.test.js
git commit -m "test: 添加 cutDay/glueBack/getGlueBlocks 单元测试"
```

---

### Task 11: Help 面板更新

**Files:**
- Modify: `frontend/src/components/HelpPanel.vue`
- Modify: `frontend/src/strings.js`

- [ ] **Step 1: 在帮助面板快捷键中添加剪刀说明**

In strings.js `STR.help.helpShortcuts` array, add:
```js
'右键  时间轴空白处剪刀切分（便是明朝/溯与昨宵）',
'右键  胶水区粘回',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/HelpPanel.vue frontend/src/strings.js
git commit -m "docs: 帮助面板添加剪刀/胶水快捷键说明"
```

---

### Task 12: 端到端验证

- [ ] **Step 1: Build**

Run: `cd /d/a_my/project/html/Timelog/frontend && npx vite build`
Expected: Build 无错误

- [ ] **Step 2: 运行全部测试**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test`
Expected: 全部测试通过

- [ ] **Step 3: Tauri dev 启动验证**

Run: `cd /d/a_my/project/html/Timelog && npm run tauri dev`
Manual test:
1. 右键时间轴空白处 → 弹出剪刀确认框 → 调时间 + 方向 → 确认
2. 被切走的块出现在相邻日期胶水区（gutter 背景 #89c3eb）
3. 胶水区空白处右键 → 粘回
4. Ctrl+Z 撤销剪切 → 两个日期恢复原状
5. 跨区创建时间块
6. 导出图片 → 胶水区正常显示
7. 导出文本 → 胶水块带 `[来自X/X]` 前缀

# 诚实存储 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除所有存储坐标偏移逻辑，统一帧坐标存储只做 ±1440 变换。

**Architecture:** 存储 = 显示（统一帧），渲染偏移仅在 blockTop 减 todayRange.start。todayStorageBase 永远 1440，坐标变换只有 ±1440。

**Tech Stack:** Vue 3 + Pinia（不变）

## Global Constraints

- 今天帧 `[1440, 2880)` 是绝对的，`00:31` 永远存 `1471`
- 所有剪切/粘回/穿界只做 ±1440
- todayStorageBase 永远返回 1440
- 不再有 base/baseNew/-cutAt 分支逻辑
- 胶水区即使 0 块也保留 meta
- 帧判断看坐标区间：`<1440` 昨天、`1440-2880` 今天、`≥2880` 明天

---

### Task 1: timelog.js 核心简化

**Files:**
- `frontend/src/store/timelog.js`

- [ ] **Step 1: 简化 todayStorageBase / helpers**

`todayStorageBase` → always 1440:
```js
export function todayStorageBase() { return DAY_MIN }
```

`todayLocalToStorage` → no base param:
```js
export function todayLocalToStorage(s, en) {
  return { start: s + DAY_MIN, end: en + DAY_MIN }
}
```

`storageToLocal(start, end, cutMeta)` → pure frame detection:
```js
export function storageToLocal(start, end, _cutMeta) {
  if (start >= DAY_MIN && start < 2 * DAY_MIN)
    return { start: start - DAY_MIN, end: end - DAY_MIN }
  if (start >= 2 * DAY_MIN)
    return { start: start - 2 * DAY_MIN, end: end - 2 * DAY_MIN }
  return { start, end }
}
```

`localToStorage(s, en, _cutMeta, frame)` → minus cutMeta:
```js
export function localToStorage(s, en, _cutMeta, frame) {
  if (frame === 'today') return { start: s + DAY_MIN, end: en + DAY_MIN }
  if (frame === 'next') return { start: s + 2 * DAY_MIN, end: en + 2 * DAY_MIN }
  return { start: s, end: en }
}
```

`unifiedToStorage(x, _cutMeta)` → minus cutMeta:
```js
export function unifiedToStorage(x) {
  if (x >= DAY_MIN && x < 2 * DAY_MIN) return x
  return x
}
```

- [ ] **Step 2: 重写 cutDay**

cutAt 使用 `DAY_MIN + localCutAt`。分类：
- `_cut` 在 `[0,1440)` → forward stay / backward 回家 +1440
- `_cut` 在 `[2880,4320)` → always stay
- 今天块：forward start≥cutAt→move(-1440)，backward end≤cutAt→move(+1440)

Moves always ±1440. Stays unchanged.

```js
export function cutDay(sourceDate, cutAt, direction, dropShort = false) {
  const targetDate = direction === 'forward'
    ? addDays(sourceDate, 1) : addDays(sourceDate, -1)

  const srcData = _loadDay(KEY_PREFIX + sourceDate)
  const tgtData = _loadDay(KEY_PREFIX + targetDate)
  const srcMeta = srcData._cutMeta, tgtMeta = tgtData._cutMeta

  if (direction === 'forward' && !canCutForward(tgtMeta)) return false
  if (direction === 'backward' && !canCutBackward(tgtMeta)) return false

  const cut = DAY_MIN + cutAt // unified cut line
  const newCut = direction === 'forward'
    ? Math.min(srcMeta.toNext?.cutAt ?? Infinity, cut)
    : Math.max(srcMeta.toPrev?.cutAt ?? 0, cut)

  const toMove = [], toStay = []
  const push = (list, b, isFrag) => {
    if (isFrag && dropShort && b.end - b.start < 10) return
    list.push(b)
  }

  srcData.blocks.forEach(b => {
    if (b._cut) {
      if (direction === 'backward' && b.start < DAY_MIN)  // glue-prev 回家
        toMove.push({ ...b, start: b.start + DAY_MIN, end: b.end + DAY_MIN })
      else toStay.push(b)
      return
    }
    // 今天帧块
    if (direction === 'forward') {
      if (b.start >= cut) {
        toMove.push({ ...b, start: b.start - DAY_MIN, end: b.end - DAY_MIN })
      } else if (b.end > cut) {
        push(toStay, { ...b, start: b.start, end: cut }, true)
        push(toMove, { ...b, start: cut - DAY_MIN, end: b.end - DAY_MIN }, true)
      } else {
        toStay.push(b)
      }
    } else { // backward
      if (b.end <= cut) {
        toMove.push({ ...b, start: b.start + DAY_MIN, end: b.end + DAY_MIN })
      } else if (b.start < cut) {
        push(toMove, { ...b, start: b.start + DAY_MIN, end: cut + DAY_MIN }, true)
        push(toStay, { ...b, start: cut, end: b.end }, true)
      } else {
        toStay.push(b)
      }
    }
  })

  toMove.forEach(b => b._cut = { sourceDate, cutAt: newCut })
  const newTgt = _mergeById([...tgtData.blocks, ...toMove])
  newTgt.forEach(b => { if (b._cut?.sourceDate === sourceDate) b._cut.cutAt = newCut })

  if (direction === 'forward') {
    srcMeta.toNext = { targetDate, cutAt: newCut }
    tgtMeta.fromPrev = { sourceDate, cutAt: newCut }
  } else {
    srcMeta.toPrev = { targetDate, cutAt: newCut }
    tgtMeta.fromNext = { sourceDate, cutAt: newCut }
  }

  _saveDay(KEY_PREFIX + sourceDate, toStay, srcMeta)
  _saveDay(KEY_PREFIX + targetDate, newTgt, tgtMeta)
  storeUndo.clear()
  return { sourceDate, targetDate, moved: toMove.length }
}
```

- [ ] **Step 3: 重写 glueBack**

Forward inverse: host fromPrev `[cutAt,1440)` +1440 → source today `[1440+cutAt,2880)`
Backward inverse: host fromNext `[2880,2880+cutAt)` -1440 → source today `[1440,1440+cutAt)`

空胶水区（meta 存在但 0 块）→ 归还时间，清理 meta。

```js
export function glueBack(hostDate, sourceDate) {
  const host = _loadDay(KEY_PREFIX + hostDate)
  const src = _loadDay(KEY_PREFIX + sourceDate)
  const fwd = isBefore(sourceDate, hostDate)  // source → host 是便是明朝
  const meta = fwd ? host._cutMeta.fromPrev : host._cutMeta.fromNext

  let lo, hi, shift
  if (meta) {
    lo = fwd ? meta.cutAt : 2 * DAY_MIN
    hi = fwd ? DAY_MIN : 2 * DAY_MIN + meta.cutAt
    shift = fwd ? DAY_MIN : -DAY_MIN
  } else {
    const tagged = host.blocks.filter(b => b._cut?.sourceDate === sourceDate)
    if (!tagged.length) return false
    lo = Math.min(...tagged.map(b => b.start))
    hi = Math.max(...tagged.map(b => b.end))
    shift = lo < DAY_MIN ? DAY_MIN : -DAY_MIN
  }

  const toReturn = [], newHost = []
  host.blocks.forEach(b => {
    const inGlue = b.start >= lo && b.end <= hi && (!b._cut || b._cut.sourceDate === sourceDate)
    if (inGlue) toReturn.push({ ...b, start: b.start + shift, end: b.end + shift, _cut: undefined })
    else newHost.push(b)
  })

  // meta 存在但 0 块 → 照样清 meta
  const srcShift = fwd ? DAY_MIN : (src._cutMeta.toPrev?.cutAt ?? (meta?.cutAt ?? 0))
  const srcBlocks = src.blocks.map(b => ({ ...b, start: b.start + DAY_MIN, end: b.end + DAY_MIN }))
  const newSrc = _mergeById([...srcBlocks, ...toReturn.map(b => { delete b._cut; return b })])

  if (fwd) { delete host._cutMeta.fromPrev; delete src._cutMeta.toNext }
  else { delete host._cutMeta.fromNext; delete src._cutMeta.toPrev }

  _saveDay(KEY_PREFIX + hostDate, newHost, host._cutMeta)
  _saveDay(KEY_PREFIX + sourceDate, newSrc, src._cutMeta)
  storeUndo.clear()
  return { hostDate, sourceDate, moved: toReturn.length }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/timelog.js
git commit -m "refactor: timelog 诚实存储——todayStorageBase→1440，cutDay/glueBack 仅±1440"
```

---

### Task 2: Timeline 去转换层 + nowLineY 修正

**Files:**
- `frontend/src/components/Timeline.vue`

- [ ] **Step 1: 删除转换层**

删除：`todayStorageOffsetForOrig`、`toDisplayBlock`（本地定义）、`toStorageFromDisplay`、`storageTimesForNewDisplayBlock`。

`displayBlocks` = computed 别名 → 直接用 `store.blocks` 替代。

- [ ] **Step 2: 修正坐标入口**

```js
// endDrag create:
emit('create-block', b.s, b.en)  // 统一坐标直接发射

// endDrag resize:
store.updateBlock({ ...rec, start: b.s, end: b.en })

// copySelected:
store.clipboard = store.blocks.filter(...).map(b => ({
  start: b.start, end: b.end, title: b.title, note: b.note, tags: [...(b.tags||[])],
  ...(b._cut ? { _cut: b._cut } : {}),
}))

// doPaste: 统一坐标锚定（无转换）
const offset = Math.round(lastHoverMin.value / 5) * 5 - minStart
const s = c.start + offset, en = c.end + offset
```

- [ ] **Step 3: nowLineY 优先级修正**

```js
function nowLineY() {
  const n = nowMin.value
  // today 优先
  if (n >= todayRange.value.start && n <= todayRange.value.end)
    return minuteToY(DAY_MIN + n - todayRange.value.start)
  const prevCut = store._cutMeta?.fromPrev?.cutAt
  if (prevCut != null && n >= prevCut && n < DAY_MIN)
    return (n - prevCut) * PX_MIN
  const nextCut = store._cutMeta?.fromNext?.cutAt
  if (nextCut != null && n <= nextCut)
    return minuteToY(2 * DAY_MIN + n)
  return 0
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Timeline.vue
git commit -m "refactor: Timeline 去转换层 + nowLineY today 优先"
```

---

### Task 3: EditModal + App + BatchCreate 简化

**Files:**
- `frontend/src/components/EditModal.vue`
- `frontend/src/App.vue`
- `frontend/src/components/BatchCreatePanel.vue`

- [ ] **Step 1: EditModal 简化 save + 修正 splitKey**

```js
// save() 中：
const toStorage = (p) => p.frame + p.min  // frame = 0|1440|2880

// 穿界 split：
if (us < todayUStart && ue > todayUStart) {
  splitKey = { dateKey: D-1, start: us + DAY_MIN, end: todayUStart + DAY_MIN }
  s = todayUStart
}
if (us < todayUEnd && ue > todayUEnd) {
  splitKey = { dateKey: D+1, start: us - DAY_MIN, end: ue - DAY_MIN }  // 实际上..更简单
  en = todayUEnd
}
```

- [ ] **Step 2: App T 键简化**

```js
const maxEnd = Math.max(...store.blocks.map(b => b.end), 0)
let s
if (maxEnd > 0) {
  if (maxEnd < DAY_MIN) s = maxEnd; else if (maxEnd < 2*DAY_MIN) s = maxEnd - DAY_MIN
  else s = maxEnd - 2*DAY_MIN
} else {
  s = store._cutMeta?.fromPrev?.cutAt ?? (store._cutMeta?.toPrev?.cutAt || 0)
}
createTimes = { start: s + DAY_MIN, end: end + DAY_MIN }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EditModal.vue frontend/src/App.vue frontend/src/components/BatchCreatePanel.vue
git commit -m "refactor: EditModal/App 适配诚实存储——splitKey 修正 + T 键简化"
```

---

### Task 4: 导出清理 + 测试更新

**Files:**
- `frontend/src/components/ExportPanel.vue`
- `frontend/src/components/ExportImagePanel.vue`
- `frontend/src/__tests__/store/timelog.test.js`

- [ ] **Step 1: 导出去 toDisplayBlock**

ExportPanel: `store.blocks` 直接使用，`fmtSigned` 按统一帧格式化（已支持）

ExportImagePanel: 移除 `toDisplayBlock` import，`displayBlocks = store.blocks`

- [ ] **Step 2: 更新测试**

cutDay 测试坐标期望改为统一帧。例如 `cutDay forward 780`:
```js
// 今天块 a [1920, 2040] → stay [1920, 2040]（不变！）
expect(src.blocks.find(b=>b.id==='a').start).toBe(1920)
// 移走的 b piece → [780, 840]（-1440）
expect(movedB.start).toBe(780)
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExportPanel.vue frontend/src/components/ExportImagePanel.vue frontend/src/__tests__/store/timelog.test.js
git commit -m "refactor: 导出/测试适配诚实存储"
```

---

### Task 5: 端到端验证

- [ ] `cd frontend && npx vite build` — build pass
- [ ] `cd frontend && npm test` — 158+ tests pass
- [ ] Tauri dev 手动测试：便是明朝 / 溯与昨宵 / 粘回 / 多次剪切 / T 键 / 拖拽创建 / 导出

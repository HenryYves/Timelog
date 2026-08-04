# v0.10.10 打磨 v2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复诚实存储重构后的 9 条 E2E 反馈问题 + 2 个走查缺陷

**Architecture:** 新增 pageRange 作为统一越界判定基准，消费方包括 EditModal / BatchCreatePanel / App T 键处理 / 导出裁剪。修复坐标转换、交互判定、布局算法。新增统计未记录时间、标签排序与拖拽、十六进制颜色输入。

**Tech Stack:** Vue 3 Composition API, Pinia, Vitest

## 核心理念（所有 task 必读）

### 统一帧坐标系

**存储 = 显示 = 统一帧**，一个分钟值就是它在时间轴上的绝对位置：
- 昨天帧：`[0, 1440)` — 昨天 00:00 到 23:59
- 今天帧：`[1440, 2880)` — 今天 00:00 到 23:59
- 明天帧：`[2880, 4320)` — 明天 00:00 到 23:59

**严禁混用"本地分钟"**：`720` 可能是昨天 12:00（统一帧 720）或今天 12:00（统一帧 2160），语义完全不同。代码中任何时间计算都必须明确是哪个帧。

### 剪刀/胶水（cutDay/glueBack）

- **剪刀**：把今天的部分时间"剪走"到相邻天。被剪走的块坐标 ±1440 平移到目标天，打上 `_cut` 标记，成为目标天的"胶水块"。
- **胶水块**：存储在宿主天，但 `_cut.sourceDate` 指向来源日。坐标仍在来源日的帧上（昨天帧或明天帧）。
- **`_cutMeta`**：每天存储的元数据，记录四个方向的剪切/胶水状态：
  - `fromPrev`：昨天末尾剪来的块（cutAt = 昨天剪切点，本页显示 `[cutAt, 1440)` 的内容）
  - `fromNext`：明天开头剪来的块（cutAt = 明天剪切点，本页显示 `[2880, 2880+cutAt)` 的内容）
  - `toPrev`：今天开头被剪走（cutAt = 今天显示起点，`[1440, 1440+cutAt)` 的内容去了昨天）
  - `toNext`：今天末尾被剪走（cutAt = 今天显示终点，`[1440+cutAt, 2880)` 的内容去了明天）

### pageRange — 本页可见的统一帧区间

```javascript
pageLo = fromPrev ? fromPrev.cutAt        : 1440 + (toPrev?.cutAt ?? 0)
pageHi = fromNext ? 2880 + fromNext.cutAt : 1440 + (toNext?.cutAt ?? 1440)
```

- **语义**：本页时间轴上能看到的连续统一帧范围，包含所有胶水区 + 今天显示区。
- **用途**：所有"这个时间在不在本页"的判定都用 pageRange，不得硬编码 1440 或用 todayRange（后者只覆盖今天区段，不含胶水）。
- **例子**：
  - 无剪切：`pageRange = { lo: 1440, hi: 2880 }` — 完整的今天
  - 有 fromPrev (cutAt=1200)：`pageRange.lo = 1200` — 显示昨天 20:00 起
  - 有 toPrev (cutAt=120)：`pageRange.lo = 1560` — 今天从 02:00 起显示
  - 同时有 fromPrev + toPrev：`pageRange.lo = max(fromPrev.cutAt, 1440 + toPrev.cutAt)` — **错！应该是 fromPrev.cutAt，因为 glue-prev 在昨天帧，比今天帧更早**

**核心原则**：任何需要判断"时间 x 是否在本页范围内"的地方，都用 `x >= pageRange.lo && x < pageRange.hi`。

### 坐标转换的"诚实"原则

诚实存储重构后，**存储坐标 = 统一帧坐标**，不再有"本地偏移 + 动态 base"的欺骗转换。

- ✅ `block.start = 1500` → 就是今天 01:00，存的就是 1500
- ✅ `block.start = 720` → 就是昨天 12:00，存的就是 720
- ❌ 旧逻辑"今天块存在 [0, cutAt) 要加 1440 才能显示" — 已废弃
- ❌ `storageToLocal` / `toDisplayBlock` / `todayStorageOffset` — 孤儿函数，删掉

**渲染**：`useCoordConverter` 的 `blockTop(block)` / `minuteToY(minute)` 直接消费统一帧坐标，内部按帧分段计算 y 偏移。

### EditModal 的帧前缀语法

用户输入时间时可用前缀指定帧：
- `-12:00` → 昨天 12:00 (统一帧 720)
- `12:00` → 今天 12:00 (统一帧 2160)
- `+12:00` → 明天 12:00 (统一帧 3600)

**解析后立即转为统一帧**，后续所有计算都在统一帧下进行，不保留"本地分钟 + base"的中间态。

## Global Constraints

- 统一帧坐标 = 存储坐标，不得混用本地分钟与统一帧分钟
- 昨天帧 [0,1440)，今天帧 [1440,2880)，明天帧 [2880,4320)
- 所有越界判定必须使用 pageRange.lo/hi，不得硬编码 1440 或用 todayRange
- 所有 commit message 使用英文前缀 + 中文描述（Conventional Commits）
- 前端命令必须在 frontend 目录下执行
- 每个 task 结束时运行 `npm test` 确保不破坏现有测试
- 修改涉及坐标计算的代码时，必须在注释中注明使用的是统一帧坐标

---

## Task 1: pageRange 基础设施

**Files:**
- Modify: `frontend/src/composables/useCoordConverter.js:19-94`
- Create: `frontend/src/__tests__/composables/useCoordConverter.test.js` (if not exists, else modify)

**Interfaces:**
- Consumes: `store._cutMeta` (readonly, from useTimelogStore)
- Produces: `pageRange: ComputedRef<{ lo: number, hi: number }>` — 本页统一帧显示范围

<!-- PLACEHOLDER_TASK1 -->

---

## Task 2: 列宽展开算法

**Files:**
- Modify: `frontend/src/components/Timeline.vue:230-261` (layout 函数)
- Create: `frontend/src/__tests__/components/Timeline.layout.test.js`

**Interfaces:**
- Consumes: existing `layout(list)` signature
- Produces: blocks with `_span` property in addition to `_col` and `_cols`

<!-- PLACEHOLDER_TASK2 -->

---

## Task 3: 统计未记录时间

**Files:**
- Modify: `frontend/src/utils/stats.js` — 新增 unionMinutes / computeUnrecorded
- Modify: `frontend/src/components/StatsPanel.vue` — 配置面板 + card 数据注入
- Modify: `frontend/src/strings.js` — 新增文案
- Create: `frontend/src/__tests__/utils/stats.unrecorded.test.js`

**Interfaces:**
- Produces: 
  - `unionMinutes(blocks: Array): number` — 块区间并集总长度
  - `computeUnrecorded(days: string[], blocksByDay: Array[]): number` — 未记录分钟数
- Card config 新增: `includeUnrecorded: boolean`

<!-- PLACEHOLDER_TASK3 -->

---

## Task 4: T 键统一帧重构

**Files:**
- Modify: `frontend/src/App.vue:665-699` (T 键 handler)

**Interfaces:**
- Consumes: `pageRange` from useCoordConverter, `store._cutMeta`, `store.blocks`
- Produces: `createTimes = { start: number, end: number }` — 统一帧坐标

<!-- PLACEHOLDER_TASK4 -->

---

## Task 5: 点击 vs 拖动像素判定

**Files:**
- Modify: `frontend/src/components/Timeline.vue:450-461,497-502,527-528` (drag 相关)

**Interfaces:**
- Internal state: `dragPending`, `dragged`, `dragStartX`, `dragStartY`

<!-- PLACEHOLDER_TASK5 -->

---

## Task 6: 标签排序与拖拽

**Files:**
- Modify: `frontend/src/components/TagManager.vue`
- Modify: `frontend/src/store/tags.js` (if needed for normColor)

**Interfaces:**
- Tag row 新增: `_uid` (稳定标识，用于重命名检测)
- `origNames`: `Map<_uid, string>`

<!-- PLACEHOLDER_TASK6 -->

---

## Task 7: 十六进制颜色输入

**Files:**
- Modify: `frontend/src/components/TagManager.vue:8-13` (每行 UI)
- Modify: `frontend/src/store/tags.js` — 补齐 normColor
- Create: `frontend/src/__tests__/store/tags.normColor.test.js`

**Interfaces:**
- `normColor(input: string): string` — 返回规范化的 #RRGGBB 或原值

<!-- PLACEHOLDER_TASK7 -->

---

## Task 8: EditModal 逐端点判帧

**Files:**
- Modify: `frontend/src/components/EditModal.vue:157-179` (watch 填表逻辑)
- Delete usages: `storageToLocal` 调用全部移除

**Interfaces:**
- Helper: `frameOf(x: number): 0 | 1440 | 2880`
- Helper: `frameOfEnd(x: number): 0 | 1440 | 2880`

<!-- PLACEHOLDER_TASK8 -->

---

## Task 9: EditModal split 改用 pageRange

**Files:**
- Modify: `frontend/src/components/EditModal.vue:262-281` (save 函数 split 判定)
- Modify: `frontend/src/components/EditModal.vue:20-23` (pattern 属性)
- Modify: `frontend/src/components/BatchCreatePanel.vue:133` (cap 截断)
- Scan: 全仓搜索 `pattern=.*[+-]` 并修复

**Interfaces:**
- Consumes: `pageRange` from useCoordConverter

<!-- PLACEHOLDER_TASK9 -->

---

## Task 10: 右键拖拽框选修复

**Files:**
- Modify: `frontend/src/components/Timeline.vue:70-76` (selrect 模板绑定)
- Modify: `frontend/src/components/Timeline.vue:527-556` (onMouseUp + contextmenu 逻辑)

**Interfaces:**
- State 新增: `suppressContextMenu: boolean`

<!-- PLACEHOLDER_TASK10 -->

---

## Task 11: 清理孤儿代码

**Files:**
- Delete: `frontend/src/utils/displayBlocks.js`
- Delete: `frontend/src/__tests__/utils/displayBlocks.test.js` (if exists)
- Modify: `frontend/src/components/Timeline.vue:783` — 删除 storageTimesForNewDisplayBlock 调用
- Scan: 全仓搜索 `storageToLocal` 剩余调用点并评估删除

**Interfaces:**
- N/A (cleanup only)

<!-- PLACEHOLDER_TASK11 -->

---

## Task 12: 全量验证与提交

**Files:**
- Verify: 所有修改文件

**Interfaces:**
- N/A (verification only)

<!-- PLACEHOLDER_TASK12 -->

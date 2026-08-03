# v0.10.9 打磨 — 设计规格

> 日期：2026-07-31 | 基于 E2E 测试反馈的 13 个 issue

---

## #1 T 键时间输入省略 `:`

**需求**：EditModal 和 CutConfirm 的时间输入框允许 `0930`（4 位数字）自动解析为 `09:30`，无需手动输入冒号。

**实现**：`parseSignedTime` / `parseTime` 新增分支：`/^(\d{2})(\d{2})$/` → `hh*60+mm`。

---

## #2 阻止浏览器自动填充

**需求**：时间输入框的 HTML `autocomplete` 属性，阻止浏览器弹出历史值建议。

**实现**：所有 `<input type="time">` 和文本型时间输入加 `autocomplete="off"`。

涉及文件：`EditModal.vue`、`CutConfirm.vue`、`ExportImagePanel.vue`（时间范围输入）

---

## #4 穿界块 split

**需求**：T/N 键创建的时间块如果跨越 todayRange 边界（超出 start 或 end），弹出确认对话框，确认后在边界处 split 为两个同 ID 块，超出部分存入对应相邻日的 localStorage。

**规则**：
- 穿 **toPrev** 边界（start < todayRange.start）：前半存到昨天（toPrev.targetDate，坐标 +1440 移入 yesterday 的 next-glue 区），后半存今天
- 穿 **toNext** 边界（end > todayRange.end）：后半存到明天（toNext.targetDate，坐标 -1440 移入 tomorrow 的 prev-glue 区），前半存今天

**实现**：EditModal `save()` 在 `localToStorage` 之后检测越界，弹出 `showConfirm`，确认后写入两个 localStorage key（参照 cutDay 的模式，但不更新 _cutMeta）。

---

## #5 虚线不超出

**需求**：最后一个 hour label 不画半小时虚线（halfline），防止超出 `.day` 底部。

**实现**：`allLabels` 渲染 halfline 时 `v-if="index < allLabels.length - 1"`，或每个 section 的 halfline 数量 = labels.length - 1。

---

## #6 统计"允许统计未记录时间"

**需求**：统计视图的每个 card 新增属性"统计未记录时间"，开启后空白时段算入统计（归为"未记录"分类）。

**数据模型**：`timelog:stats-cards` 数组中每个 card 新增字段 `countGaps: boolean`。

**UI**：卡片编辑面板新增 checkbox。

**计算**：`computeCardsData` 中若 `countGaps` 为 true，按 1 分钟粒度扫描全天时间，未被子块覆盖的分钟数累加到"未记录"条目。

---

## #7 T 键结束时间 fix

**需求**：T 键在有块且 nowMin 跨帧时，end 应正确反映当前时间。

**当前 bug**：start 在 glue-prev（昨天帧），end 在计算时 `nowMin >= s` 但 s 是 yesterday 帧时间、nowMin 是 local 时间，比较无意义，导致 end 用了 fallback 默认时长。

**修复**：end 计算使用统一坐标比较——先把 nowMin 转为 unified frame（判断 now 落在哪个区段），再与 s 的统一坐标比较。

---

## #9 拖拽创建 vs 点击

**需求**：拖拽创建时间块时，即使起点和终点落在同一个已有块上，也应创建新块而非打开编辑器。只有**不拖动**的点击才打开编辑器。

**阈值**：鼠标移动距离 < 3px 视为点击。

**实现**：`onDayMouseDown` 中左键拖拽时 `suppressClick` 已置 true，但 `onBlockMouseDown` 中 resize 的 `suppressClick` 只在 edge 拖拽时触发。需检查"拖拽创建时鼠标在块上经过"的场景——`onDayMouseDown` 触发在 `.day` `@mousedown`，但若鼠标按在 block 上，block 的 `@mousedown.left` 先触发且 stopPropagation，不会冒泡到 `.day`。所以当起点落在块上、终点也落在同块上时，block 的 click 触发打开了编辑器。

**修复**：`onBlockMouseDown` 中左键点击（非 edge）时，不 stopPropagation，让事件冒泡到 `.day` 的 `onDayMouseDown` 开始创建拖拽。或直接在 block mousedown 中也启动 adrag。

更简单：`onBlockMouseDown` 去掉非 edge 分支的 prevent + stop，让它冒泡。

---

## #10 标签排序按钮 + 拖拽

**需求**：SettingsPanel 标签管理页新增"排序"按钮，点击后按分组字母序排列标签。允许拖拽调整顺序。

**数据**：`tagStore.tags` 数组本身即顺序。

**UI**：排序按钮在标签列表顶部；拖拽使用 HTML5 drag/drop API 或 pointer 事件，调整 `tags` 数组索引并 `saveTags()`。

---

## #11 十六进制颜色代码

**需求**：标签颜色输入支持 hex 代码（`#RRGGBB`），不再仅限于 `<input type="color">` 选色器。

**实现**：颜色输入行新增文本框，同步颜色值，双向转换。

---

## #12 红线位置错误

**需求**：今天范围 `[-22:00, 24:00)` 且当前时间 22:34 时，红线跑到 `-22:34` 上而不是正确的 today 22:34。

**根因**：`nowLineY()` 在 glue-prev 区段的判断优先于 today 区段。nowMin = 22:34 = 1354。prevCut 存在且 1354 ≥ cutAt（假设 1320）→ 进入 glue-prev 分支 → 显示在 -22:34 位置。但 22:34（1354）也落在 todayRange [0, 1440) 内，实际应该显示在 today 区段。

**修复**：调整 `nowLineY()` 判断优先级——today 区段优先于胶水区段（因为 22:34 既在 glue-prev 范围也在 today 范围时，它真正属于 today）。

---

## #13 剪走时间后胶水区块显示异常

**需求**：今天范围 `[-22:00, 24:00)`，`[-22:00, 00:00)` 中有块。把 `[22:00, 24:00)` 便是明朝剪给明天后，`[-22:00, 00:00)` 中的块"掉下来"——悬浮 tooltip 中的负号消失了。

**根因分析**：剪切后 todayRange 变为 `[0, 22:00)`，存储基准 base 改变。胶水块坐标未变（昨天帧），但 `toDisplayBlock` → `blockTop` → `fmtSigned` 链路的某一步因 base 改变失效。

**修复**：胶水块 `_cut` 标记确保 `toDisplayBlock` 不做偏移；`blockTop` 中 glue-prev 分支的 `(start - cutAt) * PX_MIN` 正确。需排查 `onGlueBackConfirm` / `onCutConfirm` 后 `store.loadBlocks()` 是否正确重载。

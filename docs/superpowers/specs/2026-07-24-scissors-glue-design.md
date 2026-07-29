# 剪刀/胶水 — 时间轴切分 设计规格

> 讨论记录：[2026-07-24-scissors-glue-discussion.md](./2026-07-24-scissors-glue-discussion.md)

## 概述

在时间轴上右键剪刀切分时间轴——切口之后（或之前）的内容整体移动到相邻日期，目标日的块以"胶水块"形式存在。胶水块右键可粘回源日期。

两个 SVG 素材来自 `D:\a_my\seldom\computer_system\transfer\SP_xx_zd\`（剪刀.svg、胶水.svg），已旋转 90°，复制到 `frontend/src/assets/`。

---

## 数据模型

### `_cut` 属性

每个块可选 `_cut: { sourceDate: 'YYYY-MM-DD', cutAt: number }`：
- `sourceDate`：块被切下来的**来源日期**
- `cutAt`：切割线分钟数（原始日期的坐标）
- `start`/`end`：**保持原始值不变**（方便粘回时还原）

### 两个方向

| 方向 | 口诀 | 移走的块 | 移到哪 |
|------|------|----------|--------|
| ↓ | "便是明朝" | 切口**之后** | 明天 |
| ↑ | "溯与昨宵" | 切口**之前** | 昨天 |

### 约束

两天之间只能单向（你给他 / 他给你 / 互不相欠）：

- 今天有来自昨天的胶水块（`sourceDate < dateKey`）→ 今天不能"溯与昨宵"
- 今天有来自明天的胶水块（`sourceDate > dateKey`）→ 今天不能"便是明朝"

但一天可以**同时接收**来自昨天和明天的胶水块（两个方向各一条边）。

### 被剪天

被剪那天的 blocks 数组自然变少，剩余块的 `start/end` 不变。页面高度按最后一块的 end 重新计算。

### 胶水块存储

胶水块和普通块存在同一个 `localStorage` key（目标日的 `timelog:YYYY-MM-DD`）下，通过 `_cut` 属性区分。

---

## DOM 结构

```
<main>
  <div class="glue-from-prev">
    <div class="gutter" style="background:#89c3eb">...</div>   ← 仅 gutter 有 #89c3eb
    <div class="day">...</div>                                   ← 块本身自有标签颜色
  </div>
  <div class="grid">              ← 今天正常内容
    <div class="gutter">...</div>
    <div class="day">...</div>
  </div>
  <div class="glue-from-next">
    <div class="gutter" style="background:#89c3eb">...</div>
    <div class="day">...</div>
  </div>
</main>
```

- 三个兄弟节点在导出图片时自然都在 DOM 中
- `glue-from-prev` 和 `glue-from-next` 各有独立的 PX_MIN 高度计算
- 胶水块内部复用现有 block 渲染逻辑

---

## 光标与交互

### 光标

- 鼠标在 `.day`（今天正常内容）上 → **剪刀** cursor：`cursor: url('@/assets/scissors.svg'), auto`
- 鼠标在 `.glue-from-prev` 或 `.glue-from-next`（胶水区空白处）上 → **胶水** cursor：`cursor: url('@/assets/glue.svg'), auto`
- 胶水区内的**时间块**上 → 和普通块一样（pointer / ns-resize），不是胶水 cursor

SVG 素材由用户提供已旋转好的版本，CSS cursor 不额外做 transform。

### 右键：剪刀（在 `.day` 空白处）

1. 右键点击 → 弹出剪刀确认框（CutConfirm 组件）
2. 确认框内容：
   ```
   剪刀落处，[hh:mm]，[便是明朝▾]。
           (确认) (取消)
   ```
   - 时间 `[hh:mm]`：预填鼠标点击分钟数，可编辑
   - 方向 `[便是明朝▾]`：hover/click 展开下拉（纳入模态栈，ESC 关闭，焦点循环）
     - 便是明朝（→明天）
     - 溯与昨宵（→昨天）
3. 确认后执行剪切（undoable）

### 右键：胶水（在胶水区空白处）

1. 右键点击胶水区背景（非块上） → 弹出胶水确认框（GlueConfirm 组件）
2. 确认框内容：
   ```
   粘回 X月X日？
   (确认) (取消)
   ```
3. 确认后该批胶水块全部粘回 `sourceDate`（undoable）

### 胶水区块交互

胶水区内的块与普通 `.day` 中的块行为一致：
- 左键拖拽创建新块、调整时间
- 右键切换选中
- 支持复制粘贴、删除等所有现有操作

### 确认框焦点管理

- 两个确认框均纳入模态栈（入栈 → ESC 关闭 → 焦点循环）
- 使用 `useModal` helper 管理

---

## 剪切逻辑

### 通用流程

1. 验证约束（`canCutDirection` 检查）
2. 遍历当天 blocks：
   - 跨切割线的块 split（ID 不变）：前一半 `end = cutAt`，后一半 `start = cutAt`
   - 要移走的块打上 `_cut` 标记
3. 源日和目标日的旧状态 snapshot（用于 undo）
4. 移动块到目标日，save 两边
5. pushStoreUndo

### Split 后片段 < 10 分钟

在确认框弹出前先弹 `confirm("切出片段不足10分钟，保留？")`，用户取消则丢弃该片段。

### 极端时间

| | 便是明朝 | 溯与昨宵 |
|------|----------|------|
| **00:00** | 所有块移走，今天空（警告+允许） | 0 块移走（警告，无操作） |
| **24:00** | 0 块移走（警告，无操作） | 所有块移走，今天空（警告+允许） |

### 多次剪切合并

同一天同一方向再次剪切时：

1. 新切块加入目标日胶水区
2. 同 ID 块合并（之前被拆开的两个半块重新团聚）：取 `min(start)`、`max(end)`
3. 所有胶水块（新旧）的 `_cut.cutAt` 统一重算：
   - "便是明朝"：`cutAt = min(所有块的 cutAt)` — 最早的切口，之后全过去了
   - "溯与昨宵"：`cutAt = max(所有块的 cutAt)` — 最晚的切口，之前全过去了

粘回时整批胶水块用统一的 `cutAt` 还原位置。

---

## 胶水粘回逻辑

1. 读取要粘回的块的 `_cut.sourceDate` 和 `_cut.cutAt`
2. Snapshot 源日和目标日的旧状态
3. 去掉 `_cut` 属性，写回 `sourceDate`
4. 如果源日已有同 ID 块 → 取并集 start/end（合并跨切割线的两个半块）
5. save 两边
6. pushStoreUndo

---

### 跨区创建

胶水区和 `.day` 之间可以跨区拖拽创建时间块（例如从胶水区 "-22:00" 拖到今天的 "02:15"）。粘回时该块在胶水区边界处 split（同 ID），两个半块分别留在两边。

---

## 导出集成

### ExportImagePanel：时间范围选择器

Timeline 导出面板新增时间范围选择器：

```
时间范围: [全天 ▼]
         ├ 全天（- + 今天 + +）
         └ 自定义

自定义模式下：
  [- 22:00] → [+ 08:00]
   前天胶水尾部    明天胶水头部
```

- `-` 前缀 = 来自前一天的胶水区（仅 `glue-from-prev` 有数据时出现）
- 无前缀 = 今天正常内容
- `+` 前缀 = 来自明天的胶水区（仅 `glue-from-next` 有数据时出现）
- 没有数据的区不在选择器中出现
- 起止时间始终保持开始 ≤ 结束
- 默认"全天" = 三个区全部导出（默认包含胶水块）

### ExportPanel：文本导出

胶水块在导出文本中加前缀标注：`[来自7/23] 14:00–15:00 标题`

---

## Undo

所有剪切和粘回操作均支持 Ctrl+Z：

1. 操作前 snapshot 源日和目标日的旧 blocks 数组
2. 操作完成后 pushStoreUndo：undo 还原两个日期的旧状态，redo 重新执行
3. 使用现有 `pushStoreUndo` / `batchUndo` 机制

---

## 文件清单

| 文件 | 改动 |
|------|------|
| `frontend/src/assets/scissors.svg` | 新增 — 剪刀 cursor 图（用户提供） |
| `frontend/src/assets/glue.svg` | 新增 — 胶水 cursor 图（用户提供） |
| `frontend/src/store/timelog.js` | 新增 `cutDay(dateKey, cutAt, direction)`、`glueBack(dateKey)`、`canCutDirection(dateKey, direction)` |
| `frontend/src/components/Timeline.vue` | 新增 `.glue-from-prev` / `.glue-from-next` 渲染区；胶水块右键；剪刀 cursor CSS |
| `frontend/src/components/CutConfirm.vue` | 新增 — 剪刀确认弹窗 |
| `frontend/src/components/GlueConfirm.vue` | 新增 — 胶水确认弹窗 |
| `frontend/src/components/ExportImagePanel.vue` | 新增时间范围选择器 |
| `frontend/src/components/ExportPanel.vue` | 文本导出胶水块前缀 |
| `frontend/src/style.css` | 胶水块样式（`#89c3eb` 背景）、cursor 定义 |
| `frontend/src/strings.js` | 弹窗/导出文案 |
| `frontend/src/App.vue` | 新组件注册 |

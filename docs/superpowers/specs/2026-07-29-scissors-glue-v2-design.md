# 剪刀/胶水 — 时间轴切分 设计规格（v2）

> 讨论记录：2026-07-29
> 基于初版 spec 的问题重新设计

## 概述

在时间轴上右键剪刀切分时间轴——切口之后（或之前）的时间真正移动到相邻日期。被剪过来的时间在目标日期真实存在（包括空白时间），通过三段 gutter 区分显示。

---

## 核心概念

### 真正的剪切

剪切不是数据迁移，而是**时间的真正转移**：
- 源日期：被剪掉的时间段不存在了
- 目标日期：被剪过来的时间段真实存在（即使其中没有任何时间块）

### 统一坐标系

所有时间块使用统一坐标系（1440 分钟偏移）：
- 昨天：`[0, 1440)`
- 今天：`[1440, 2880)`
- 明天：`[2880, 4320)`

### 三段 Gutter

今天的时间轴分为三段 gutter：
- **glue-prev**：昨天剪过来的时间（背景色 `#89c3eb`）
- **today**：今天实际显示的时间范围
- **glue-next**：明天剪过来的时间（背景色 `#89c3eb`）

---

## 数据模型

### localStorage 结构

```js
// timelog:2026-07-24
{
  blocks: [
    // 统一坐标系
    { id: 'a', start: 1320, end: 1380 },        // 昨天 22:00-23:00
    { id: 'b', start: 1920, end: 2040 },        // 今天 08:00-10:00
    { id: 'c', start: 2880, end: 2940 },        // 明天 00:00-01:00
  ],
  _cutMeta: {
    fromPrev: { sourceDate: '2026-07-23', cutAt: 997 },  // 昨天剪给我的
    fromNext: { sourceDate: '2026-07-25', cutAt: 120 },  // 明天剪给我的
    toPrev: { targetDate: '2026-07-23', cutAt: 480 },    // 我剪给昨天的
    toNext: { targetDate: '2026-07-25', cutAt: 997 },    // 我剪给明天的
  }
}
```

### 字段说明

- `fromPrev.cutAt`：昨天剪切的时间点（分钟）
  - glue-prev 高度 = `1440 - cutAt`
- `fromNext.cutAt`：明天剪切的时间点（分钟）
  - glue-next 高度 = `cutAt`
- `toPrev.cutAt`：今天剪给昨天的时间点（分钟）
  - today 显示起点 = `toPrev.cutAt`
- `toNext.cutAt`：今天剪给明天的时间点（分钟）
  - today 显示终点 = `toNext.cutAt`

### 多次剪切合并

- `toNext.cutAt`：取 min（越早剪，剪得越多）
- `toPrev.cutAt`：取 max（越晚剪，剪得越多）

---

## DOM 结构

```html
<div class="grid">
  <div class="gutter-container">
    <div v-if="gutterHeights.prev" 
         class="gutter glue-prev" 
         :style="{ height: gutterHeights.prev + 'px' }"
         @contextmenu.prevent="onGluePrevRightClick">
      <!-- 时间标签：-17:00, -18:00, ... -->
    </div>
    <div class="gutter today" 
         :style="{ height: gutterHeights.today + 'px' }"
         @contextmenu.prevent="onTodayRightClick">
      <!-- 时间标签：08:00, 09:00, ... -->
    </div>
    <div v-if="gutterHeights.next" 
         class="gutter glue-next" 
         :style="{ height: gutterHeights.next + 'px' }"
         @contextmenu.prevent="onGlueNextRightClick">
      <!-- 时间标签：+00:00, +01:00, ... -->
    </div>
  </div>
  <div class="day" :style="{ height: totalHeight + 'px' }">
    <!-- 所有时间块 -->
  </div>
</div>
```

---

## 坐标转换

### useCoordConverter composable

```js
// composables/useCoordConverter.js
export function useCoordConverter() {
  const store = useTimelogStore()
  const cutMeta = computed(() => store._cutMeta)
  
  const gutterHeights = computed(() => ({
    prev: cutMeta.value.fromPrev ? 1440 - cutMeta.value.fromPrev.cutAt : 0,
    today: /* todayEnd - todayStart */,
    next: cutMeta.value.fromNext ? cutMeta.value.fromNext.cutAt : 0,
  }))
  
  // 块 → 渲染位置
  function blockTop(block) {
    if (block.start < 1440) {
      return block.start * PX_MIN
    } else if (block.start < 2880) {
      return gutterHeights.value.prev + (block.start - 1440) * PX_MIN
    } else {
      return gutterHeights.value.prev + gutterHeights.value.today + (block.start - 2880) * PX_MIN
    }
  }
  
  // 鼠标 → 时间
  function yToMinute(y, dayEl) {
    const localMin = /* 从 .day 顶部开始的分钟数 */
    if (localMin < gutterHeights.value.prev) {
      return localMin  // 昨天坐标
    } else if (localMin < gutterHeights.value.prev + gutterHeights.value.today) {
      return 1440 + (localMin - gutterHeights.value.prev)  // 今天坐标
    } else {
      return 2880 + (localMin - gutterHeights.value.prev - gutterHeights.value.today)  // 明天坐标
    }
  }
  
  return { blockTop, yToMinute, gutterHeights, totalHeight }
}
```

---

## 时间标签生成

### glue-prev（昨天的尾部）
- 只显示整点，带 `-` 前缀
- 从 `Math.ceil(cutAt / 60) * 60` 开始
- 省略 `-24:00`（避免和 today 的 `00:00` 重叠）

### today
- 只显示整点，无前缀
- 从 `todayStart` 到 `todayEnd`

### glue-next（明天的头部）
- 只显示整点，带 `+` 前缀
- 从 `0` 到 `cutAt`
- 省略 `+00:00`（避免和 today 的 `24:00` 重叠）

---

## 交互行为

### 右键：剪刀（today gutter）
1. 弹出剪刀确认框（CutConfirm）
2. 确认后执行剪切，**清空 undo 栈**

### 右键：粘回（glue-prev / glue-next gutter）
1. 弹出胶水确认框（GlueConfirm）
2. 确认后执行粘回，**清空 undo 栈**

### 左键：创建/调整时间块（`.day` 空白处）
- 在 `.day` 空白处拖拽创建时间块
- 跨区创建就是普通的创建，坐标连续（如 `[-23:00, 01:00)` → `start=1380, end=1500`）
- 粘回时跨区块在边界处 split（同 ID）

---

## 剪切逻辑

### cutDay(sourceDate, cutAt, direction)

1. 计算目标日期
2. 加载源日期和目标日期的 blocks + _cutMeta
3. 分离要移动的块（统一坐标系）
4. **更新移动块的 start/end 偏移量**（±1440）
5. **合并 00:00 边界处同 ID 的块**（避免 `剪切-创建跨区块-粘回-剪切` 产生的碎片）
6. 更新源日期 `_cutMeta.toNext` 或 `toPrev`（合并多次剪切）
7. 更新目标日期 `_cutMeta.fromPrev` 或 `fromNext`
8. 保存两个 localStorage key
9. 清空 undo 栈和 redo 栈

### glueBack(hostDate, sourceDate)

1. 加载两个日期的 blocks + _cutMeta
2. 移动块回源日期
3. **更新移动块的 start/end 偏移量**（∓1440）
4. **合并 00:00 边界处同 ID 的块**
5. 清除 `_cutMeta` 中的相关字段
6. 保存两个 localStorage key
7. 清空 undo 栈和 redo 栈

---

## 短片段确认

- 确认框弹出后，检查是否有 < 10 分钟的片段
- 弹出确认："切出片段不足10分钟（X分），是否保留？"
- 点击取消：不保留短片段，但**仍然执行剪切**
- 需要在 `cutDay` 中添加 `dropShort` 参数

---

## Cursor

- **today gutter**：剪刀 cursor
- **glue-prev / glue-next gutter**：胶水 cursor
- **`.day` 空白处**：默认 cursor
- **时间块上**：pointer / ns-resize

---

## 导出

### ExportImagePanel
- 时间范围选择器：`-` 前缀（glue-prev）、无前缀（today）、`+` 前缀（glue-next）
- 三区渲染，各自计算高度

### ExportPanel
- 胶水块添加 `[来自X/X]` 前缀

---

## 已确认问题

### 1. 跨区创建时块的坐标保存

**使用统一坐标系**：
- 例子：`[-23:00, 01:00)` 创建时间块
- `start = 1380`（昨天 23:00），`end = 1500`（今天 01:00）
- 跨区创建就是普通的创建，坐标连续

### 2. 切换日期时的坐标转换

**根据 start/end 调整偏移量**：
- 今天的偏移量是 1440
- 移到明天：偏移量变为 0，所有块 `start/end -= 1440`
- 移到昨天：偏移量变为 2880，所有块 `start/end += 1440`
- 渲染时根据新的偏移量计算坐标

### 3. 导出时胶水块的时间显示

**使用带符号的时间格式**：
- glue-prev：`-17:00`（昨天的 17:00）
- today：`08:00`（今天的 08:00）
- glue-next：`+01:00`（明天的 01:00）

# 统计面板 实施计划

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** 仪表盘式统计面板——多图表卡片、按标签统计时长、纯 CSS/SVG 手绘图表。

**Architecture:** `StatsPanel.vue` 单组件，Pinia 直接读 localStorage 跨天数据，不建新 store。

**Tech Stack:** Vue 3 Composition API + Pinia + CSS conic-gradient / SVG

## Global Constraints

- 不引入图表库（Chart.js 等）——纯 CSS/SVG
- 图标从外部复制到 `frontend/src/assets/stats.svg`
- 85 个现有测试保持通过
- 复用现有 `tagStore.colorOf()` 获取标签颜色
- 复用 `STR` 模式管理 UI 文案
- 复用 `App.vue` 的 `useModal` 模态栈

---

### Task 1: 复制图标 + STR 文案

**Files:**
- Create: `frontend/src/assets/stats.svg`
- Modify: `frontend/src/strings.js`

- [ ] **Step 1: 复制 SVG 图标**

```bash
cp "D:/a_my/seldom/computer_system/transfer/SP_xx_zd/统计.svg" frontend/src/assets/stats.svg
```

- [ ] **Step 2: 添加 STR 文案**

```javascript
stats: {
  title: '统计',
  addView: '+ 添加视图',
  noData: '暂无数据',
  noChart: '点击 [+ 添加视图] 创建第一个图表',
  timeRange: '时间范围',
  timeToday: '今天',
  time24h: '24h',
  timeWeek: '本周',
  time168h: '24×7h',
  time7d: '最近 7 天',
  timeMonth: '本月',
  timeCustom: '自定义',
  createTitle: '新建视图',
  chartType: '图表类型',
  pie: '饼图',
  bar: '柱状图',
  onlyFirstTag: '只记录第一个标签',
  showLegend: '显示图例',
  legendData: '图例显示数据',
  legendPercent: '图例显示占比',
  chartData: '图中显示数据',
  chartPercent: '图中显示占比',
  deleteView: '删除此视图',
  settings: '视图设置',
  confirm: '确认',
  cancel: '取消',
  hours: 'h',
  minutes: 'min',
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/stats.svg frontend/src/strings.js
git commit -m "feat: 统计面板——图标+STR文案"
```

---

### Task 2: StatsPanel.vue 基础结构 + 注册

**Files:**
- Create: `frontend/src/components/StatsPanel.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 创建面板骨架**

标准 overlay/modal 结构，`v-if="show"`，`@close` 事件，`trapFocus`。

```html
<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal stats-modal" @keydown="trapFocus">
      <h2>{{ STR.stats.title }}</h2>
      <!-- 时间筛选下拉 -->
      <!-- 卡片列表 -->
      <!-- 添加按钮 -->
    </div>
  </div>
</template>
```

- [ ] **Step 2: 注册到 App.vue**

```javascript
// import
import StatsPanel from './components/StatsPanel.vue'

// ref + useModal
const showStats = ref(false)
const statsClose = useModal(showStats)

// template
<StatsPanel v-if="showStats" :show="showStats" @close="showStats = false" />
```

- [ ] **Step 3: 添加 More 菜单入口**

"标签" 和 "文本导入" 之间：
```html
<button class="dropdown-item" @click="showStats = true; showMore = false">
  <img src="/assets/stats.svg" alt="">统计
</button>
```

- [ ] **Step 4: 运行测试 + Commit**

```bash
cd frontend && npm test -- --run
git add frontend/src/components/StatsPanel.vue frontend/src/App.vue
git commit -m "feat: StatsPanel基础结构+App注册+More菜单入口"
```

---

### Task 3: 时间筛选器 + 数据计算

**Files:**
- Modify: `frontend/src/components/StatsPanel.vue`

- [ ] **Step 1: 时间范围下拉**

下拉选择器，选项从 STR 取。默认读 `localStorage` key `timelog:stats-time-range`，无则 `'today'`。离开面板时保存。

```javascript
const timeRange = ref(localStorage.getItem('timelog:stats-time-range') || 'today')
watch(timeRange, (v) => localStorage.setItem('timelog:stats-time-range', v))
```

- [ ] **Step 2: 数据聚合 computed**

遍历所选时间范围内所有天 blocks，按标签聚合 `duration`。

```javascript
const tagStats = computed(() => {
  const days = getDaysInRange(timeRange.value) // ['2026-07-16', '2026-07-15', ...]
  const tagMap = {}
  for (const day of days) {
    const blocks = loadDayBlocks(day)
    for (const b of blocks) {
      const duration = b.end - b.start
      const tags = onlyFirst ? [b.tags[0]].filter(Boolean) : b.tags
      for (const tag of tags) {
        tagMap[tag] = (tagMap[tag] || 0) + duration
      }
    }
  }
  return tagMap // { '工作': 480, '学习': 120, ... }
})
```

- [ ] **Step 3: 工具函数**

```javascript
function getDaysInRange(range) {
  // 返回 ['YYYY-MM-DD', ...] 数组
}

function loadDayBlocks(dateKey) {
  const raw = localStorage.getItem('timelog:' + dateKey)
  return raw ? JSON.parse(raw) : []
}
```

- [ ] **Step 4: 运行测试 + Commit**

---

### Task 4: 图表卡片渲染

**Files:**
- Modify: `frontend/src/components/StatsPanel.vue`

- [ ] **Step 1: 卡片布局**

`v-for` 渲染 `cards` 数组，每卡片用 `tagStats` + 卡片类型渲染图表。

- [ ] **Step 2: 饼图**

`conic-gradient` 实现。每个扇区角度 = 标签时长 / 总时长 × 360°。

```css
.pie-chart {
  width: 200px; height: 200px;
  border-radius: 50%;
  background: conic-gradient(
    #A1AFC9 0deg 120deg,
    #F0C7C1 120deg 240deg,
    #C4E0D4 240deg 360deg
  );
}
```

- [ ] **Step 3: 柱状图**

横条 `div`，`width` 按比例。每个 bar 用 tag 颜色。

```html
<div class="bar" v-for="(d, tag) in tagStats" :key="tag">
  <span class="label">{{ tag }}</span>
  <span class="fill" :style="{ width: percent(d) + '%', background: colorOf(tag) }"></span>
</div>
```

- [ ] **Step 4: 空状态**

`tagStats` 为空 → 灰色文字"暂无数据"。无卡片 → "点击 [+ 添加视图] 创建第一个图表"。

- [ ] **Step 5: 图例/数据显示**

根据卡片 `showLegend`、`legendData`、`chartData` 等配置，显示对应标签和数据。

- [ ] **Step 6: 运行测试 + Commit**

---

### Task 5: 添加/编辑/删除卡片

**Files:**
- Modify: `frontend/src/components/StatsPanel.vue`

- [ ] **Step 1: 卡片数据持久化**

```javascript
const cards = ref(loadCards())
function loadCards() {
  const raw = localStorage.getItem('timelog:stats-cards')
  return raw ? JSON.parse(raw) : []
}
function saveCards() { localStorage.setItem('timelog:stats-cards', JSON.stringify(cards.value)) }
```

- [ ] **Step 2: 创建弹窗**

点击 [+ 添加视图] → `v-if` 浮层 → 选择饼图/柱状图 → 配置属性 → 确认 → `cards.push(...)` + `saveCards()`。

- [ ] **Step 3: 编辑弹窗**

卡片右上角 ⚙ → 同浮层，预填当前配置 → 确认 → 更新卡片 + `saveCards()`。

浮层内另加红色"删除此视图"按钮 → `cards.splice(i,1)` + `saveCards()`。

- [ ] **Step 4: 运行测试 + Commit**

---

### Task 6: 验证 + 整理

- [ ] **Step 1: 全场景手动验证**

1. 打开面板 → 空状态提示
2. 添加饼图 → 显示标签分布
3. 添加柱状图 → 显示标签柱状图
4. 切换时间范围 → 图表数据更新
5. 编辑卡片设置 → 图例/数据/占比开关生效
6. 删除卡片 → 卡片消失
7. 关闭再打开 → 时间范围和卡片配置保持
8. More 菜单显示统计入口

- [ ] **Step 2: 运行测试**

```bash
cd frontend && npm test -- --run
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatsPanel.vue
git commit -m "feat: 统计面板完成——饼图/柱状图+时间筛选+卡片管理"
```

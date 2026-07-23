# StatsPanel 完整导出面板

## Context

StatsPanel 当前 Ctrl+P 只是静默保存文件，无预览/作者/水印/复制。用户要的是和 Timeline 导出一样的完整体验——真实 DOM 渲染，直接 html2canvas 一拍了事。

## 设计

### 提取图表子组件

从 StatsPanel.vue 抽两个纯展示组件：

**`components/PieChart.vue`**
- Props: `{ slices, labels, interactive }`
- SVG 渲染，所有坐标在 viewBox 内，不依赖外层布局
- `interactive=true` 时绑定 hover 事件，`false` 时纯静态

**`components/BarChart.vue`**
- Props: `{ items, interactive }` — items 是 `[{tag, minutes, color}]
- CSS flex 布局 + 百分比宽度，同样不受外层影响

### ExportImagePanel stats 模式

| 方面 | timeline 模式（不变） | stats 模式 |
|------|----------------------|-----------|
| 预览区 | blocks/gutter/hourlines 实时 DOM | 图表 DOM + 作者 + 水印 |
| 数据源 | timelogStore.blocks | localStorage cards + loadDayBlocks（同 StatsPanel） |
| 图表渲染 | — | `<PieChart>` / `<BarChart>` 组件，`:interactive="false"` |
| 宽高 | settings.exportWidth × exportHeight | 自动计算（根据卡片数量和类型） |
| 文件名 | `timelog-YYYY-MM-DD.png` | `timelog-stats-YYYY-MM-DD.png` |
| settings key | `timelog:export-image-settings` | `timelog:stats-export-settings` |

### 数据流

```
StatsPanel Ctrl+P → emit('export-image')
→ App.vue 打开 ExportImagePanel mode="stats"
→ 面板自己读 localStorage 的 cards 配置 + 日数据
→ 用 <PieChart>/<BarChart> 渲染图表 DOM
→ 加上作者/水印 → 完整预览
→ 复制/保存：html2canvas 拍预览 DOM
```

无需预捕获、无 double-catch——和 timeline 模式完全对称。

### 图表数据获取

ExportImagePanel stats 模式复用 StatsPanel 的数据加载逻辑。从 StatsPanel 抽一个 `getCardTagData(card, timeRange, customStart, customEnd)` 纯函数，两个地方共用。因为不从 Pinia store 读（StatsPanel 直接读 localStorage 跨天聚合），所以不需要 store 态。

### 卡片单独导出

保持在 StatsPanel 配置弹窗里的"导出图片"按钮——不走完整面板，仍是简化流程：`closeConfig → captureElement(卡片 DOM) → saveCanvasToFile`。不覆盖面板。

## 修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/PieChart.vue` | **新建** | 饼图纯展示组件 |
| `components/BarChart.vue` | **新建** | 柱状图纯展示组件 |
| `utils/stats.js` | **新建** | `getDaysInRange`、`loadDayBlocks`、`computeCardsData` 从 StatsPanel 抽出 |
| `components/StatsPanel.vue` | **修改** | 改为使用 PieChart/BarChart 子组件 + stats.js；Ctrl+P 改为 emit |
| `components/ExportImagePanel.vue` | **修改** | 加 `mode` prop；stats 预览区渲染图表组件；宽度/高度/文件名/mask/settings key 按 mode 切换 |
| `App.vue` | **修改** | 加 `ExportImagePanel mode="stats"` 实例 + `showStatsExport` 状态 |

## 不动的

- `capture.js` / `watermark.js` / `usePanZoom.js`
- StatsPanel 卡片单独"导出图片"按钮——保持简化流程

## 验证

1. `cd frontend && npx vite build` 无错误
2. `cd frontend && npm test` 85 passed
3. Tauri dev：StatsPanel Ctrl+P → 打开面板 → 图表预览和 StatsPanel 里看到的一样 → 调作者/水印 → 复制成功有 toast → 保存成功有 toast
4. Tauri dev：timeline 导出全部功能不变
5. Tauri dev：StatsPanel hover 交互在面板外正常，在导出预览中无相关假交互

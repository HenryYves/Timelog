# Spec: 块布局算法统一提取

## 目标

消除 `Timeline.vue` (`layout`) 和 `ExportImagePanel.vue` (`layoutOverlap` + `blockStyle`) 中的重复代码，提取为共享纯函数。

## 新文件

`frontend/src/utils/blockLayout.js`

## 导出函数

### layoutOverlap(blocks)

输入：`Block[]`（含 `start`, `end` 属性，统一帧坐标）

输出：`Block[]`（原地修改，添加 `_col`, `_cols`, `_span` 属性）

算法：
1. 按 `start` 排序
2. 滑动窗口分组：`start` < 组内最大 `end` 的块属于同一重叠组
3. 每组内贪心列分配：每列维护当前占用结束时间，找到第一个空闲列
4. `_span` 计算：每个块向右能扩展多少连续空闲列（跳过被同组其他块占用的列）

### blockStyle(b, blockTop, PX_MIN)

输入：
- `b` — 带 `start`/`end`/`_col`/`_cols` 的块对象
- `blockTop` — `(b) => number`，块顶部 y 像素位置
- `PX_MIN` — 每分钟对应的像素数

输出：`{ top: number, height: number, left: string, width: string }`
- `left`/`width` 为 CSS 百分比字符串

## 调用方适配

### Timeline.vue

- 删除 `layout` 函数（~50 行）
- 改为：
  ```js
  const layoutBlocks = computed(() => layoutOverlap(store.blocks.slice()))
  ```
- `computeBlockStyle` 内部调用 `blockStyle(b, blockTop, PX_MIN)` 获取定位，再追加颜色/交互样式

### ExportImagePanel.vue

- 删除 `layoutOverlap` 函数（~35 行）
- 删除 `blockStyle` 函数（~50 行）
- 改为：
  ```js
  const layoutBlocks = computed(() => layoutOverlap(timelogStore.blocks.map(b => ({ ...b }))))
  ```
- 在 template 的 `blockStyle(b)` 调用处改为 `blockStyle(b, blockTop, PX_MIN)`，再追加 `background`、`--block-bg`

## 不提取

- `blockBg` / `tagColor` — 颜色逻辑与 store 紧耦合，保留在各消费方
- `computeBlockStyle` 中的交互样式（hover、selection、drag cursor）— Timeline 特有

## 验证

1. `cd frontend && npx vitest run` — Timeline.layout.test.js 的 20 个 layout 测试继续通过，无其他回归
2. 手动：Timeline 块布局与改动前一致（重叠列分配、span 扩展）
3. 手动：导出预览块布局与改动前一致

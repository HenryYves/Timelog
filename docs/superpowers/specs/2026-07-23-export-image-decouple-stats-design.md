# Export Image 解耦 + StatsPanel 导出

## Context

ExportImagePanel.vue 膨胀到 953 行，且越来越多功能需要画布导出能力——StatsPanel 统计面板需要用同样的 html2canvas 管道导出整面板和单卡。趁此机会把通用能力拆出独立模块，750 行 → 560 行，StatsPanel 直接复用。

## 新模块

### `frontend/src/utils/capture.js`（~110 行）
从 ExportImagePanel 提取的通用画布工具，全部参数化，零 Vue 依赖：

| 导出 | 签名 | 说明 |
|------|------|------|
| `loadImg(src)` | `src → Promise<Image>` | Image() Promise 包装 |
| `compressImage(source, maxWidth)` | `source, maxWidth → { blob, dataUrl, bytes }` | Canvas 缩放压缩 |
| `resolveAssetUrl(raw)` | `raw → Promise<string>` | 路径/dataURL → 可用 URL |
| `captureCanvas(element, opts)` | `{ width, height, backgroundColor?, scale?, onclone? } → Promise<Canvas>` | html2canvas 通用包装 |
| `copyCanvasToClipboard(canvas)` | `canvas → Promise<void>` | Tauri/browser 剪贴板 |
| `saveCanvasToFile(canvas, defaultFilename)` | `canvas, defaultFilename → Promise<void>` | Tauri 保存对话框/browser download |

### `frontend/src/utils/watermark.js`（~65 行）
从 ExportImagePanel 提取，完全内容无关：

```js
buildWatermarkOverlay({ width, height, wmType, wmText, wmImage,
  wmOpacity, wmRotation, wmWidth, wmHeight, wmGapX, wmGapY,
  resolveAssetUrl, fontFamily, textColor })
```

### `frontend/src/composables/usePanZoom.js`（~45 行）
从 ExportImagePanel 提取预览交互：

```js
function usePanZoom() {
  // 返回 { previewWrap, previewOffset, previewScale,
  //         onMouseDown, onWheel, fitPreview, cleanup }
}
```

## ExportImagePanel 改动

### 脚本（削减 ~180 行）
- **移走**：`loadImg`、`compressImage`、`resolveAssetUrl`、`buildWatermarkOverlay`、`captureCanvas`、pan/zoom 全部逻辑、`assetUrlCache` 和相关 watcher
- **保留**：settings 定义+persistence、时间线计算属性（hours/blockBg/bgColor/exportHeight/timelineStyle/authorStyle）、块布局（layoutBlocks/layoutOverlap/blockStyle）、`pickAsset`/`pickAvatar`/`pickWmImage`（它们调 `compressImage`）
- **胶水**：`doCopy`/`doExport` 改为调 capture.js 后接 toast；水印 watcher 改为调 `buildWatermarkOverlay` 传参

### 模板（不变）
左侧设置面板、右侧时间线预览、底部操作按钮——结构不动

### 导入变化
移除旧的 Tauri 动态 import（已在 capture.js 统一处理），导入 `capture.js`、`watermark.js`、`usePanZoom.js`

缩减后约 560 行（961 → 560）。

## StatsPanel 导出接入

### Ctrl+P 整面板导出
- StatsPanel 根元素加 `ref="statsRoot"` + `@keydown` handler
- Ctrl+P 时调用 `captureCanvas(statsRoot.value, { width, height, backgroundColor })`
- `saveCanvasToFile(canvas, 'timelog-stats-YYYY-MM-DD.png')`
- 仅面板可见（`show=true`）时响应，与 App.vue 的 Ctrl+P（打开 ExportImagePanel）不冲突

### 卡片单独导出
- 每张卡片 DOM 加 `data-card-id="xxx"`
- 配置弹窗（create/settings modal）底部加"导出图片"按钮
- 点击 → 关弹窗 → `document.querySelector('[data-card-id="..."]')` → `captureCanvas` → `saveCanvasToFile`

### 批量勾选导出（后期）
- 卡片加 checkbox + `selectedCards` Set（参照 DataManager 的 `selectedDays`）
- "导出选中 (N)" 按钮逐张导出，或拼接为一张长图导出——待定，本次不实现

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `utils/capture.js` | **新建** | 通用画布工具 |
| `utils/watermark.js` | **新建** | 水印叠加 |
| `composables/usePanZoom.js` | **新建** | 预览平移缩放 |
| `components/ExportImagePanel.vue` | **修改** | 抽走通用代码，改为 import 调用 |
| `components/StatsPanel.vue` | **修改** | 接入 Ctrl+P + 卡片导出 |

## 验证

1. `cd frontend && npx vite build` 无错误
2. `cd frontend && npm test` 85 tests passed
3. Tauri dev：导出切图面板所有功能正常（设置持久化、预览缩放、复制、保存、水印）
4. Tauri dev：StatsPanel Ctrl+P 导出整面板
5. Tauri dev：StatsPanel 卡片设置弹窗 → 导出单张卡片

# 皮肤元信息（作者 / 版本 / Tip / Warning）— 设计文档

日期：2026-08-15
状态：待实现

## 概述

让皮肤制作者通过 CSS 变量向用户传达信息，共四类：作者名称、版本号、Tip（提示）、Warning（警告）。信息展示在「设置 → 外观」皮肤选择器下方的**默认折叠**区块中，只读当前激活皮肤，零额外 IPC 开销。

## 变量约定（皮肤作者怎么写）

皮肤作者在皮肤 `.css` 的 `:root` 中声明，全部可选：

```css
:root {
  --skin-author: Henry Yves;                 /* 作者名称 */
  --skin-version: 1.2.0;                     /* 版本号 */
  --skin-tip: 第一行提示\A 第二行;             /* 提示，多行用 \A 换行 */
  --skin-warning: 注意事项;                    /* 警告 */
  --skin-info-expanded: 1;                   /* 可选：写 1 则默认展开，否则折叠 */
}
```

- 命名沿用现有 `--skin-palette-*` 风格
- 不加引号（引号会被当成字面量读进来）
- 多行换行用 CSS 原生转义 `\A`，渲染时转成 `\n` 并以 `white-space: pre-line` 呈现

## 读取机制

在 `utils/skin.js` 新增纯函数，职责与文件一致（皮肤相关）：

```js
export function readSkinInfo() {
  const cs = getComputedStyle(document.documentElement)
  const get = n => cs.getPropertyValue(n).trim()
  return {
    author:  get('--skin-author'),
    version: get('--skin-version'),
    tip:     get('--skin-tip').replace(/\\A/g, '\n'),
    warning: get('--skin-warning').replace(/\\A/g, '\n'),
    expanded: get('--skin-info-expanded') === '1',
  }
}
```

只读**当前激活**皮肤的变量——因为只有激活皮肤的 CSS 被注入为 `<style id="skin-style">`，`getComputedStyle` 自然命中所覆盖的 `:root`。

### ⚠️ 换行序列待验证

按项目 Gotcha「勿假设浏览器行为」，实现时须先用诊断日志确认 WebView2 中 `getPropertyValue('--skin-tip')` 对 `\A` 的实际返回形态（可能是 `\A ` 带空格、或其它转义序列化形式），再定替换规则。不凭标准文档猜测。

## 响应式状态

新增 `composables/useSkinInfo.js`，模块级单例（同 `useToast` 模式）：

```js
const skinInfo = ref({ author: '', version: '', tip: '', warning: '', expanded: false })
export function refreshSkinInfo() { skinInfo.value = readSkinInfo() }
export function useSkinInfo() { return { skinInfo, refreshSkinInfo } }
```

- `skinInfo` 是共享单例状态，`App.vue` 写入、`AppearanceTab.vue` 读取
- 不使用 settings store（skinInfo 是派生状态，非持久化设置项，不属于 store 职能）

## 注入时机接线

皮肤注入是异步的（`injectSkinStyle` 含 IPC 文件读取），刷新须在注入完成后触发。由掌握注入时机的 `App.vue` 负责：

1. `onMounted` 初始化：`await injectSkinStyle(...)` 后调 `refreshSkinInfo()`
2. `watch(() => settings.activeSkin)`：`await injectSkinStyle(...)` 后调 `refreshSkinInfo()`

这样避免在 `AppearanceTab` 里对异步注入做竞态补偿。

## UI（外观设置 → 皮肤下方）

皮肤下拉框与「打开文件夹/刷新」按钮之间，新增「皮肤信息」区块：

- **默认折叠**：纯标题「皮肤信息 ▸」，折叠态不显示任何摘要
- **展开后**：按顺序显示非空字段
  - 作者 / 版本 — 普通文本
  - Tip — 信息样式（`--text2`）
  - Warning — 警示样式：`--warn` 文字色 + 一条细窄、低饱和的左边框，不加亮色底块
- **四个信息字段全空 → 整个区块隐藏**（不显示空壳标题）
- 折叠态默认值：作者写了 `--skin-info-expanded: 1` 则初始展开，否则折叠；切换皮肤时重置为该默认值

## 涉及文件

| 文件 | 改动 |
|------|------|
| `utils/skin.js` | 新增 `readSkinInfo()` |
| `composables/useSkinInfo.js` | 新建，单例 `skinInfo` + `refreshSkinInfo()` |
| `App.vue` | 注入后调 `refreshSkinInfo()`（启动 + watch 两处） |
| `components/settings/AppearanceTab.vue` | 新增默认折叠「皮肤信息」区块 |
| `strings.js` | 新增文案（皮肤信息 / 作者 / 版本 / 提示 / 警告） |
| `style.css` | 新增 `.skin-info` 样式 + 4 个变量默认（空值占位注释） |
| `public/skin-template/night.css` | 加示例注释，演示四个变量写法 |

## 边界情况

| 场景 | 处理 |
|------|------|
| 皮肤未声明某变量 | `getPropertyValue` 返回空串，字段隐藏 |
| 四个字段全空 | 整个「皮肤信息」区块隐藏 |
| 皮肤切换（含切回日间 `""`） | `refreshSkinInfo` 重读；日间无皮肤 CSS，读到 `:root` 默认空值 → 区块隐藏 |
| `\A` 换行 | 见上文「换行序列待验证」，需实测后定替换规则 |
| 折叠态与 `--skin-info-expanded` | 仅在皮肤切换时重置为作者默认值；用户本次手动展开/折叠不被覆盖 |
| 非 Tauri（浏览器调试） | `getComputedStyle` 在浏览器同样可用，读不到皮肤变量即空值，不报错 |

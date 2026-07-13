# 自定义轻量 Markdown 编辑框 — 设计文档

## 目标

用 contenteditable + 局部 DOM 操作 + 状态机扫描器替代 Milkdown，实现带语法高亮的所见即所得 Markdown 编辑体验。

## 与 Milkdown 方案的区别

| | Milkdown | 自定义 |
|---|---|---|
| 体积 | 450KB (137KB gzip) | ~5KB |
| 编辑面 | ProseMirror (contenteditable) | contenteditable |
| 焦点 | ProseMirror 状态层 vs 浏览器 DOM 层打架 | 原生 DOM 单层 |
| 样式控制 | nord 主题 + `:deep()` 覆盖 | 一手 CSS |
| 坐标系 | `coordsAtPos` 与 CSSOM 不同步 | `getSelection().getBoundingClientRect()` |
| Markdown 处理 | remark AST + 插件链 | 正则扫描 + 状态机 |

## 渲染效果

**源码保留可见**，语法标记半透明灰色，内容生效：

```
输入：  **粗体** *斜体* ~~删除~~ `code`
渲染：  [**]粗体[**] [*]斜体[*] [~~]删除[~~] [`]code[`]
       灰  加粗  灰   灰 倾斜 灰  灰 划线  灰   灰 等宽 灰
```

不是 Typora 那种源码完全消失，是 VSCode/IDE 风格的语法高亮预览。

## 架构

### 组件

```
MarkdownEditor.vue          ← 重写（复用组件名，接口不变）
├─ enableMd=true  → <div contenteditable> + 事件处理
├─ enableMd=false → <textarea> 降级（保持原样）
```

去掉 MilkdownEditorInner.vue、milkdown-plugins.js 两个文件，逻辑全合并进一个组件。

### 状态机扫描器

`scanMarkdown(textNodes: Text[])` — 每次 input 事件后运行：

```
状态: normal  →  \  → 进入 escape，记位置
                `  → 进入 code，记位置
                *  → 检查 ** 配对 → 包 span
                ~  → 检查 ~~ 配对 → 包 span

状态: escape  →  下一个字：跳过，\ 和该字各自包 span
                回到 normal

状态: code   →  `  → 回到 normal
               其他：跳过（`` `code` `` 内的所有语法标记不解析）
```

单 pass 从左到右，O(n)。1000 字符 <1ms。

### Markdown 语法支持

| 语法 | DOM 操作 | CSS |
|------|----------|-----|
| `**text**` | `<b class="md-bold">**text**</b>` | `b.md-bold { font-weight: bold }` `b.md-bold::before` 灰 | 实际上是包两层：`**` 和 `text` |
| `*text*` | `<i class="md-italic">*text*</i>` | 倾斜 |
| `~~text~~` | `<s class="md-strike">~~text~~</s>` | 划线 |
| `` `text` `` | `<code class="md-code">`text`</code>` | 等宽背景 |
| `\x` | `<span class="md-escape">\</span> + x` | 灰色 |
| `- ` 列表 | 自动续行 | Enter 自动插入 `- ` |

具体的 DOM 结构：

```
**bold** →
  <span class="md-marker">**</span><b class="md-bold-text">bold</b><span class="md-marker">**</span>

*italic* →
  <span class="md-marker">*</span><i class="md-italic-text">italic</i><span class="md-marker">*</span>
```

CSS：
```css
.md-marker { opacity: 0.35; font-weight: normal; font-style: normal; }
.md-bold-text { font-weight: 700; }
.md-italic-text { font-style: italic; }
```

标记（`**`）和内容（`bold`）分别包不同的 span，各自独立的样式。

### 光标位置

`surroundContents` 只改匹配到的 Range 内的 DOM，不 touch 其他文本节点。光标在未匹配区域时完全不受影响。

光标刚好在匹配区域内时（用户刚打完 `**`）：

```js
// 临时保存 cursor 位置
const sel = window.getSelection()
const range = sel.getRangeAt(0)
const offset = range.startOffset
// surroundContents 之后
// 恢复位置
sel.removeAllRanges()
const newRange = document.createRange()
newRange.setStart(surroundContents 之后的新文本节点, adjustedOffset)
sel.addRange(newRange)
```

### 光标居中（打字机模式）

```js
// selection change → 取光标像素坐标 → 计算居中 scrollTop
const rect = window.getSelection().getRangeAt(0).getBoundingClientRect()
const editorRect = editorEl.getBoundingClientRect()
const z = settings.zoom / 100
const cursorY = (rect.top - editorRect.top) / z + editorEl.scrollTop
editorEl.scrollTo({
  top: cursorY - editorEl.clientHeight / 2,
  behavior: 'smooth'
})
```

只在行号变化时触发，同行不滚动。`getBoundingClientRect` 返回视觉像素，÷ zoom 还原为逻辑像素给 `scrollTop`。

### 标签行自动匹配 + 内联 Hint 补全

**触发范围：** 仅 N 键 BatchCreatePanel 的标签行（第 2 行）。T 键 EditModal 的备注区不触发。

**交互逻辑：**

1. 标签行输入文字 → 从标签库前缀匹配 → 光标后出现灰色 hint 文字
2. Hint 文字为 `contenteditable="false"`，光标进不去、Backspace 删它如删一字符
3. 继续打字 → 旧 hint 自动删除 → 重新匹配 → 插入新 hint
4. **精确匹配时不显示 hint**。如用户已输入 `写作` 且库中有 `写作`，不显示 hint
5. Tab → 在多个前缀匹配的候选中**按频率排序循环**：

```
输入 "写" →
  匹配：写作(freq:5), 写作方法(freq:3)
  频率排序 → 光标后灰色显示 [写作]
  Tab → 选定"写作"
  继续 Tab → hint 变成 [写作方法]
  再 Tab → 回到 [写作]
```

6. Enter 或输入分隔符（`,.、` 等） → 确认当前文字，清 hint，记录该标签使用频率 +1
7. 分隔符后继续输入 → 从该位置起作为新词重新匹配

**多标签处理：**

光标向左扫描到上一个分隔符或行首得到当前词：

```
写作, 阅读笔[记]    ← 光标在"阅读笔"后面
             ↑
扫描：光标 ← 倒退到分隔符", "→ 得到"阅读笔"→ 匹配"阅读方法"→ 显示 [记]
```

**频率记录：**

```js
// localStorage: timelog:tagFrequency
{ "写作方法": 5, "阅读笔记": 3, "运动": 1 }

// 每次标签确认（Enter/分隔符）→ count++
// 匹配排序：freq 高的排前面
```

**转义：** `\` 进入 escape 状态，后续字符不触发补全，`\` 灰色显示。

**DOM 结构：**

```html
<div contenteditable>
  <div>标题</div>
  <div>写作<span class="tag-hint" contenteditable="false">方法</span></div>
  <div>0930 1100</div>
  <div>备注</div>
</div>
```

```css
.tag-hint { color: var(--text2); opacity: 0.5; }
```

### Tab 缩进 / ESC 导航

contenteditable 模式：
- Tab → `document.execCommand('insertText', false, '\t')` 插入缩进
- ESC → blur contenteditable → 编辑框近框变色 → Tab 恢复焦点跳转

`tabToIndent` 设置项控制是否启用。

### 列表自动续

Enter 时检查当前行前缀：
- `- ` → 新行自动插入 `- `
- `1. ` → 新行自动插入 `2. `（递增）

纯 DOM 操作，在 contenteditable 的 keydown 事件中处理。

## 设置项（复用现有）

| key | 说明 | 来源 |
|-----|------|------|
| `markdownPreview` | 启用/关闭实时渲染 | 已存在 Task 2 |
| `tabToIndent` | Tab 插入缩进 | 已存在 Task 2 |
| `editorFontSize` | 编辑器字号 | 已存在 Task 2 |
| `customCss` | 自定义 CSS 片段 | 已存在（预留） |

## 依赖（无新增）

不安装任何 npm 包。只用浏览器原生 API：contenteditable、Selection、TreeWalker、Range。

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `MarkdownEditor.vue` | 新建 | 核心组件，合并所有逻辑 |
| `EditModal.vue` | 修改 | textarea → MarkdownEditor |
| `BatchCreatePanel.vue` | 修改 | textarea → MarkdownEditor（tagLine） |
| `SettingsPanel.vue` | 修改 | 激活 markdownPreview 等新设置项 |
| `constants.js` | 修改 | 新增 4 个 DEFAULT_* |
| `settings.js` | 修改 | 新增 4 个设置项 |
| `strings.js` | 修改 | 新增文案 |

## 风险

- **contenteditable 的 IME 行为** — 中文输入法的拼音组合阶段不触发 input 事件，Markdown 扫描需在 `compositionend` 时触发。这是 WebView2 的标准行为，不跨浏览器
- **粘贴内容格式** — 用户可能粘贴带 HTML 的内容。用 `paste` 事件拦截，取 `text/plain` 版本，`document.execCommand('insertText')` 纯文本插入
- **编辑框很长的单行** — `<br>` 换行和 `<div>` 换行有差异，统一用 `<br>` 换行

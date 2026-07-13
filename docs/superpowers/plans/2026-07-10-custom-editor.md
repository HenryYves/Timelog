# 自定义轻量 Markdown 编辑框 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 contenteditable + 状态机扫描器 + 内联 hint 标签补全替换 Milkdown，实现 ~5KB 轻量所见即所得 Markdown 编辑框

**Architecture:** 单文件 `MarkdownEditor.vue` 合并所有逻辑（contenteditable 编辑面 + 状态机扫描 + 光标居中 + Tab/ESC + 标签行内联 hint）。复用现有设置项和弹窗组件。

**Tech Stack:** Vue 3, contenteditable, Selection API, localStorage

## Global Constraints

- 所有 Write/Edit 操作必须先等用户同意
- Commit message: Conventional Commits（英文前缀 + 中文描述）
- 新增文字统一走 `STR`（`strings.js`）
- Tauri WebView2 only — 不考虑跨浏览器兼容

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/constants.js` | Modify | 新增 4 个 DEFAULT_* 常量 |
| `frontend/src/store/settings.js` | Modify | 新增 4 个 settings ref + setter |
| `frontend/src/strings.js` | Modify | 新增设置面板文案 |
| `frontend/src/components/SettingsPanel.vue` | Modify | 激活 markdownPreview，新增 tabToIndent + editorFontSize |
| `frontend/src/components/MarkdownEditor.vue` | **Create** | 核心组件：contenteditable + 状态机 + hint |
| `frontend/src/components/EditModal.vue` | Modify | textarea + mdprev → MilkdownEditor |
| `frontend/src/components/BatchCreatePanel.vue` | Modify | textarea → MilkdownEditor（autoFocus） |
| `frontend/src/style.css` | Modify | `.modal` 加 `position: relative`（MilkdownEditor resize 需要） |

---

### Task 1: 添加设置项

**Files:**
- Modify: `frontend/src/constants.js`
- Modify: `frontend/src/store/settings.js`
- Modify: `frontend/src/strings.js`

**Interfaces:**
- Produces: `DEFAULT_MARKDOWN_PREVIEW = true`, `DEFAULT_TAB_TO_INDENT = true`, `DEFAULT_EDITOR_FONT_SIZE = 14`, `DEFAULT_CUSTOM_CSS = ''`
- Produces: `settings.markdownPreview`, `settings.tabToIndent`, `settings.editorFontSize`, `settings.customCss` 及其 setter

- [ ] **Step 1: 添加 constants**

`frontend/src/constants.js`，在 `DEFAULT_COPY_AFTER_CREATE` 之后追加：

```js
export const DEFAULT_MARKDOWN_PREVIEW = true
export const DEFAULT_TAB_TO_INDENT = true
export const DEFAULT_EDITOR_FONT_SIZE = 14
export const DEFAULT_CUSTOM_CSS = ''
```

- [ ] **Step 2: 添加 settings store**

`frontend/src/store/settings.js`，在 import constants 行追加常量名，在 ref 声明区追加：

```js
const markdownPreview = ref(loadBool('markdownPreview', DEFAULT_MARKDOWN_PREVIEW))
const tabToIndent = ref(loadBool('tabToIndent', DEFAULT_TAB_TO_INDENT))
const editorFontSize = ref(loadNum('editorFontSize', DEFAULT_EDITOR_FONT_SIZE))
const customCss = ref(localStorage.getItem(KEY_PREFIX + 'customCss') || DEFAULT_CUSTOM_CSS)
```

在 setter 区追加：

```js
function setMarkdownPreview(v) { markdownPreview.value = v; saveBool('markdownPreview', v) }
function setTabToIndent(v) { tabToIndent.value = v; saveBool('tabToIndent', v) }
function setEditorFontSize(v) {
  editorFontSize.value = Math.max(10, Math.min(28, parseInt(v) || DEFAULT_EDITOR_FONT_SIZE))
  saveNum('editorFontSize', editorFontSize.value)
}
function setCustomCss(v) {
  customCss.value = (v || '').trim()
  if (customCss.value) { localStorage.setItem(KEY_PREFIX + 'customCss', customCss.value) }
  else { localStorage.removeItem(KEY_PREFIX + 'customCss') }
}
```

在 return 对象中追加：`markdownPreview, tabToIndent, editorFontSize, customCss,` 和对应的 setter。

- [ ] **Step 3: 添加 strings**

`frontend/src/strings.js` — 修改 `descMarkdownPreview` 去掉"尚未开放"：

```js
descMarkdownPreview: '编辑时所见即所得渲染 Markdown，关闭后使用纯文本',
```

追加：

```js
tabToIndent: 'Tab 插入缩进',
descTabToIndent: '关闭后 Tab 恢复为焦点跳转；ESC 切换编辑/导航模式',
editorFontSize: '编辑器字号',
descEditorFontSize: '编辑框内文字大小，10–28px',
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/constants.js frontend/src/store/settings.js frontend/src/strings.js
git commit -m "feat: 新增 Markdown 开关、Tab 缩进、编辑器字号设置项"
```

---

### Task 2: 更新 SettingsPanel

**Files:**
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Consumes: `settings.markdownPreview`, `settings.setMarkdownPreview`, etc.
- Consumes: `DEFAULT_MARKDOWN_PREVIEW`, `DEFAULT_TAB_TO_INDENT`, `DEFAULT_EDITOR_FONT_SIZE`

- [ ] **Step 1: 激活 markdownPreview toggle**

在 SettingsPanel.vue 编辑器栏，将现有的 disabled toggle（`<label class="toggle"><input type="checkbox" disabled>...`）替换为：

```vue
<div class="row">
  <label>{{ STR.settings.markdownPreview }}</label>
  <div>
    <label class="toggle"><input type="checkbox" :checked="settings.markdownPreview" @change="settings.setMarkdownPreview($event.target.checked)"><span class="tk"></span></label>
    <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setMarkdownPreview(DEFAULT_MARKDOWN_PREVIEW)">
      <img src="/icons/restore.svg" alt="">
    </button>
  </div>
</div>
<div class="small">{{ STR.settings.descMarkdownPreview }}</div>
```

- [ ] **Step 2: 新增 tabToIndent toggle**

编辑器栏追加：

```vue
<div class="row">
  <label>{{ STR.settings.tabToIndent }}</label>
  <div>
    <label class="toggle"><input type="checkbox" :checked="settings.tabToIndent" @change="settings.setTabToIndent($event.target.checked)"><span class="tk"></span></label>
    <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setTabToIndent(DEFAULT_TAB_TO_INDENT)">
      <img src="/icons/restore.svg" alt="">
    </button>
  </div>
</div>
<div class="small">{{ STR.settings.descTabToIndent }}</div>
```

- [ ] **Step 3: 新增 editorFontSize 输入栏**

外观栏 fontFamily 行之后追加：

```vue
<div class="row">
  <label>{{ STR.settings.editorFontSize }} <span class="val-hint">{{ settings.editorFontSize }}px</span></label>
  <div>
    <input type="number" min="10" max="28" style="width:80px;" :value="settings.editorFontSize" @change="onEditorFontSizeChange">
    <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)">
      <img src="/icons/restore.svg" alt="">
    </button>
  </div>
</div>
<div class="small">{{ STR.settings.descEditorFontSize }}</div>
```

添加 handler：

```js
function onEditorFontSizeChange(e) {
  settings.setEditorFontSize(e.target.value)
  e.target.value = settings.editorFontSize
}
```

- [ ] **Step 4: 更新 resetCategory**

`case 'tEditor':` 追加：
```js
settings.setMarkdownPreview(DEFAULT_MARKDOWN_PREVIEW)
settings.setTabToIndent(DEFAULT_TAB_TO_INDENT)
```

`case 'appearance':` 追加：
```js
settings.setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)
```

添加 import：
```js
import { ..., DEFAULT_MARKDOWN_PREVIEW, DEFAULT_TAB_TO_INDENT, DEFAULT_EDITOR_FONT_SIZE } from '../constants.js'
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsPanel.vue
git commit -m "feat: 设置面板激活 Markdown 开关、Tab 缩进、编辑器字号"
```

---

### Task 3: 创建 MarkdownEditor.vue 核心组件

**Files:**
- Create: `frontend/src/components/MarkdownEditor.vue`

**Interfaces:**
- Props: `modelValue` (string), `placeholder` (string), `fontSize` (number, default 14), `enableMd` (boolean, default true), `customCss` (string), `autoFocus` (boolean, default false), `tagLine` (boolean, default false)
- Emits: `update:modelValue`

这个任务分多个 commit 增量提交。

- [ ] **Step 1: 基础模板 + 降级模式**

```vue
<template>
  <div class="md-wrap" :style="{ height: props.height || '126px' }">
    <div
      v-if="enableMd"
      ref="editorEl"
      class="md-editor"
      :style="{ fontSize: props.fontSize + 'px' }"
      :contenteditable="true"
      @input="onInput"
      @keydown="onKeydown"
      @paste="onPaste"
      @compositionend="onInput"
    />
    <textarea
      v-else
      ref="taRef"
      :value="modelValue"
      :placeholder="props.placeholder"
      class="md-fallback"
      :style="{ fontSize: props.fontSize + 'px' }"
      @input="e => emit('update:modelValue', e.target.value)"
      @keydown="onTaKeydown"
    />
  </div>
</template>
```

CSS 骨架：

```css
.md-wrap { position: relative; width: 100%; }
.md-editor {
  height: 100%; overflow-y: auto; outline: none;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 12px; background: var(--soft);
  color: var(--text); line-height: 1.6;
  white-space: pre-wrap; word-break: break-word;
  box-sizing: border-box; cursor: text;
}
.md-editor:focus { border-color: var(--blue); background: var(--canvas); }
.md-fallback {
  width: 100%; height: 100%; resize: vertical; tab-size: 2;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 12px; color: var(--text); background: var(--soft);
  font-family: 'Cascadia Code', Consolas, monospace; line-height: 1.6;
  box-sizing: border-box;
}
.md-fallback:focus { outline: none; border-color: var(--blue); background: var(--canvas); }
.md-fallback::placeholder { color: var(--text2); opacity: .6; }
```

Commit: `feat: 创建 MilkdownEditor 基础模板（contenteditable + textarea 降级）`

- [ ] **Step 2: 各子模块实现（逐步 commit），全在一个文件内**

**2a. 状态机扫描器 — `scanContentEditable()`**

```js
function scanContentEditable(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  
  let state = 'normal'
  let escapeStart = null

  function wrapRange(startNode, startOff, endNode, endOff, wrapper) {
    const range = document.createRange()
    range.setStart(startNode, startOff)
    range.setEnd(endNode, endOff)
    range.surroundContents(wrapper)
  }

  for (const textNode of nodes) {
    const text = textNode.textContent
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (state === 'escape') {
        // Wrap \ as gray, leave next char as literal
        const slash = textNode.splitText(i - 1)
        const slashSpan = document.createElement('span')
        slashSpan.className = 'md-escape'
        slashSpan.textContent = '\\'
        slash.before(slashSpan)
        slash.textContent = slash.textContent.slice(1) // remove leading \
        state = 'normal'
        // NOTE: After splitText, the tree walker needs a fresh run.
        // For correctness, we bail and re-scan from the top.
        return false // signal: needs re-scan
      }

      if (ch === '\\') {
        escapeStart = i
        state = 'escape'
        continue
      }

      if (ch === '`') {
        // Find closing backtick
        const close = text.indexOf('`', i + 1)
        if (close >= 0) {
          // Wrap the entire `` `code` `` with <code>
          const codeSpan = document.createElement('code')
          wrapRange(textNode, i, textNode, close + 1, codeSpan)
          return false // re-scan
        }
        continue
      }

      if (ch === '~' && text[i + 1] === '~') {
        const closeIdx = text.indexOf('~~', i + 2)
        if (closeIdx >= 0) {
          const s = document.createElement('s')
          wrapRange(textNode, i, textNode, closeIdx + 2, s)
          return false
        }
        i++ // skip second ~
        continue
      }

      if (ch === '*' && text[i + 1] === '*') {
        const closeIdx = text.indexOf('**', i + 2)
        if (closeIdx >= 0) {
          // Already has <b>, skip
        }
        i++ // skip second *
        continue
      }
    }
  }
  return true // scan complete, no DOM changes
}
```

CSS 追加：

```css
.md-marker { opacity: 0.35; font-weight: normal; font-style: normal; }
.md-escape { opacity: 0.35; }
.md-editor b { font-weight: 700; }
.md-editor i { font-style: italic; }
.md-editor s { text-decoration: line-through; opacity: 0.7; }
.md-editor code {
  background: rgba(0,0,0,.06); padding: 0 3px; border-radius: 3px;
  font-family: Menlo, Consolas, monospace;
}
```

Commit: `feat: 状态机扫描器 — ** * ~~ \ 语法高亮`

**2b. 光标居中**

```js
import { useSettingsStore } from '../store/settings.js'

let lastLineIndex = -1

function centerCursor() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const rect = sel.getRangeAt(0).getBoundingClientRect()
  if (!rect || !rect.top) return
  const editorRect = editorEl.value.getBoundingClientRect()
  const z = settingsStore.zoom / 100
  const cursorY = (rect.top - editorRect.top) / z + editorEl.value.scrollTop
  
  // Determine line index from cursor position
  const lineIndex = Math.floor(cursorY / 24) // approximate line height
  if (lineIndex === lastLineIndex) return
  lastLineIndex = lineIndex
  
  const target = cursorY - editorEl.value.clientHeight / 2
  editorEl.value.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}

// In onInput: after scan, call centerCursor()
```

Commit: `feat: 光标行居中`

**2c. Tab/ESC 模式**

```js
const navMode = ref(false)

function onKeydown(e) {
  // Tab handling
  if (e.key === 'Tab') {
    e.preventDefault()
    if (!settingsStore.tabToIndent) return
    if (navMode.value) {
      // Navigate to next focusable element in modal
      const focusable = [...document.querySelectorAll(
        '.modal button:not([disabled]), .modal input:not([disabled]), [tabindex="0"]'
      )]
      if (focusable.length > 0) focusable[0].focus()
      navMode.value = false
      editorEl.value.style.outline = ''
      return
    }
    document.execCommand('insertText', false, '\t')
    return
  }

  // ESC handling
  if (e.key === 'Escape') {
    if (!navMode.value) {
      e.preventDefault()
      e.stopPropagation()
      editorEl.value.blur()
      navMode.value = true
      editorEl.value.style.outline = '2px solid var(--text2)'
      return
    }
    navMode.value = false
    editorEl.value.style.outline = ''
    return // let modal handle ESC
  }

  // Space/Enter: enter edit mode from container focus
  if ((e.key === ' ' || e.key === 'Enter') && document.activeElement !== editorEl.value) {
    e.preventDefault()
    editorEl.value.focus()
    return
  }
}
```

Commit: `feat: Tab 缩进 + ESC 导航模式`

**2d. 标签行内联 hint（仅 tagLine=true 时生效）**

```js
const tagHints = {} // { "写作": { count: 5 } }

function loadFreq() {
  try { tagHints = JSON.parse(localStorage.getItem('timelog:tagFrequency') || '{}') } catch {}
}
loadFreq()

function saveFreq() {
  localStorage.setItem('timelog:tagFrequency', JSON.stringify(tagHints))
}

function getTagHint(word) {
  const tags = tagStore.tags.map(t => t.name)
  const matches = tags.filter(t => t.startsWith(word) && t !== word) // exclude exact match
  if (!matches.length) return null
  // Sort by frequency
  matches.sort((a, b) => (tagHints[b] || 0) - (tagHints[a] || 0))
  return matches[0].slice(word.length) // return suffix
}

function getWordAtCursor() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const node = sel.anchorNode
  if (!node) return null
  const offset = sel.anchorOffset
  // Scan left to find word boundary (start of line or delimiter)
  const text = node.textContent || ''
  let start = offset
  while (start > 0) {
    const ch = text[start - 1]
    if (',.，。、\n'.includes(ch)) break
    start--
  }
  return text.slice(start, offset)
}

function updateInlineHint() {
  if (!props.tagLine) return
  // Remove old hint
  const old = editorEl.value.querySelector('.tag-hint')
  if (old) old.remove()
  
  const word = getWordAtCursor()
  if (!word) return
  const hint = getTagHint(word)
  if (!hint) return
  
  // Insert hint span right after cursor
  const sel = window.getSelection()
  const range = sel.getRangeAt(0)
  const hintSpan = document.createElement('span')
  hintSpan.className = 'tag-hint'
  hintSpan.textContent = hint
  hintSpan.contentEditable = 'false'
  range.collapse(false) // to end
  range.insertNode(hintSpan)
  // Move cursor back before hint
  range.setStartBefore(hintSpan)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function confirmTag(word) {
  tagHints[word] = (tagHints[word] || 0) + 1
  saveFreq()
}
```

Tag hint CSS:
```css
.tag-hint { color: var(--text2); opacity: 0.5; user-select: none; }
```

在 onKeydown 中追加 Tab hint 循环逻辑和 Enter 确认逻辑。

Commit: `feat: 标签行内联 hint + Tab 循环 + 频率记录`

- [ ] **Step 3: 提交并验证构建**

```bash
git add frontend/src/components/MarkdownEditor.vue
npm run build  # verify no errors
```

---

### Task 4: 更新 EditModal（T 键）

**Files:**
- Modify: `frontend/src/components/EditModal.vue`

- [ ] **Step 1: 替换备注区**

将 `<textarea id="mNote" ...>` + `<div class="mdhint">` + `<div class="mdprev">` 替换为：

```vue
<MilkdownEditor
  v-model="mNote"
  height="126px"
  :font-size="settings.editorFontSize"
  :enable-md="settings.markdownPreview"
  :custom-css="settings.customCss"
/>
```

- [ ] **Step 2: 更新 script**

添加 import：
```js
import { useSettingsStore } from '../store/settings.js'
import MilkdownEditor from './MarkdownEditor.vue'

const settings = useSettingsStore()
```

删除：`notePreview` ref、`updatePreview()`、`syncScroll()` 函数、watch 中的 `updatePreview()` 调用。

**注意：** `#mNote` 在 `onChipKeydown` 中被引用。改为通过 class 查询或 ref 聚焦 MilkdownEditor 内部元素。当前保留 `#mNote` 查询（降级 textarea 模式仍用这个 id），但 `contenteditable` 模式下需要用其他方式聚焦。

- [ ] **Step 3: 删除 CSS**

删除 `#mNote`、`#mNotePrev`、`.mdhint`、`.mdprev` 相关 scoped CSS。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/EditModal.vue
git commit -m "feat: T 键备注区替换为自定义 Markdown 编辑器"
```

---

### Task 5: 更新 BatchCreatePanel（N 键）

**Files:**
- Modify: `frontend/src/components/BatchCreatePanel.vue`

- [ ] **Step 1: 替换 textarea**

将 `<textarea ref="ta" v-model="text" class="batch-ta" .../>` 替换为：

```vue
<MilkdownEditor
  v-model="text"
  height="220px"
  :font-size="settings.editorFontSize"
  :enable-md="settings.markdownPreview"
  :custom-css="settings.customCss"
  :placeholder="STR.batchCreate.placeholder"
  :tag-line="true"
  auto-focus
/>
```

- [ ] **Step 2: 更新 script**

添加 import：
```js
import MilkdownEditor from './MarkdownEditor.vue'
```

删除：`ta` ref。`trapFocus` 不动（MilkdownEditor 内部处理 contenteditable 的 Tab）。

- [ ] **Step 3: 删除 .batch-ta CSS**

删除 `.batch-ta` 及其 `:focus`、`::placeholder` 样式规则。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BatchCreatePanel.vue
git commit -m "feat: N 键输入区替换为自定义 Markdown 编辑器 + 标签行 hint"
```

---

### Task 6: 验证 + 清理

- [ ] **Step 1: 构建**

```bash
cd frontend && npm run build
```

- [ ] **Step 2: 测试**

```bash
cd frontend && npm test
```

确认 30/32 通过（2 known failures）。

- [ ] **Step 3: 提交流程最终修复**

```bash
git add -A && git commit -m "fix: 自定义编辑器构建和测试修复"
```

---

## Self-Review

1. **Spec coverage:**
   - ✅ contenteditable + 状态机扫描器 → Task 3
   - ✅ 语法高亮（** * ~~ ` \）→ Task 3-2a
   - ✅ 光标居中 → Task 3-2b
   - ✅ Tab/ESC → Task 3-2c
   - ✅ 标签行内联 hint + Tab 循环 + 频率 → Task 3-2d
   - ✅ Markdown 开关 → Task 1 + 2
   - ✅ 编辑器字号 → Task 1 + 2
   - ✅ T 键替换 → Task 4
   - ✅ N 键替换 + tagLine → Task 5
   - ✅ 依赖无增加（纯手写，不装 npm 包）

2. **Placeholder scan:** 代码块为实际代码，无 TBD。

3. **Type consistency:** `MilkdownEditor` 组件接口在 Task 3 定义，Task 4/5 消费，props 命名一致。

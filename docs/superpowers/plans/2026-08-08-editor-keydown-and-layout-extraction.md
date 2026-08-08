# Editor Keydown + Block Layout Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract ~360 lines of keydown handlers from MarkdownEditor.vue and eliminate duplicate layout/blockStyle between Timeline.vue and ExportImagePanel.vue

**Architecture:** Two independent extractions. A: MarkdownEditor keydown handlers → `utils/editMarkdownKeyboard.js` (pure DOM functions, no Vue deps). B: Block overlap layout → `utils/blockLayout.js` (pure functions, no Vue deps). Both are zero-behavior-change refactors.

**Tech Stack:** Vue 3, Vite, Vitest (jsdom), JavaScript

**Specs:**
- `docs/superpowers/specs/2026-08-08-markdown-editor-keydown-extraction.md`
- `docs/superpowers/specs/2026-08-08-block-layout-extraction.md`

## Global Constraints

- Zero behavior change — all existing tests must pass unchanged
- New files are pure utility functions, no Vue imports
- Commit after each task

---

## Part A: MarkdownEditor Keydown Extraction

### Task A1: Create `utils/editMarkdownKeyboard.js` — Backspace handler

**Files:**
- Create: `frontend/src/utils/editMarkdownKeyboard.js`
- Read: `frontend/src/components/MarkdownEditor.vue:585-788`

**Interfaces:**
- Produces: `export function handleBackspace(ctx, e)` — returns `true` if handled (caller should return)
- Context: `{ editorEl, inputLock, isComposing, hint, sel, range, node, startUndoEntry, commitUndoEntry, onInput }`

- [ ] **Step 1: Create file with fileoverview comment and handleBackspace**

```js
/**
 * @fileoverview MarkdownEditor 键盘事件处理函数。
 * 从 MarkdownEditor.vue onKeydown 提取，纯 DOM 操作，无 Vue 依赖。
 * 通过 context 对象接收 MarkdownEditor 的内部状态。
 */

/**
 * Backspace/Delete 在 contenteditable 中的 EditMarkdown 元素处理。
 * - escape 元素：退格删除元素 + 前一个字符
 * - marker/content 元素边界：删除前一个 text node 的最后一个字符
 * - marker/escape 中间：手动删除光标前字符
 * - WebView2 quirk #4：block 合并防御（光标在 block 第一个字符时退格）
 */
export function handleBackspace(ctx, e) {
  // Case 1: cursor inside an EditMarkdown element
  // ... (copy from MarkdownEditor.vue:585-788, backspace-specific)
}
```

- [ ] **Step 2: Copy the exact Backspace code from MarkdownEditor.vue:585-788**

Paste the existing code block into `handleBackspace`. Replace direct variable references with `ctx.`:
- `editorEl.value` → `ctx.editorEl.value`
- `inputLock` → `ctx.inputLock`
- `isComposing` → `ctx.isComposing`
- `hint` → `ctx.hint` (or get from `ctx.editorEl.value.querySelector('.tag-hint')`)
- `onInput()` → `ctx.onInput()`
- `startUndoEntry(...)` → `ctx.startUndoEntry(...)`
- `commitUndoEntry()` → `ctx.commitUndoEntry()`

- [ ] **Step 3: Repeat for handleDelete — same style, handle Delete key cases**

The Delete branch (mirrors Backspace logic with `e.key === 'Delete'`, cursor-at-end-of-text, first-char-of-next-node).

- [ ] **Step 4: Add handleEnter**

```js
export function handleEnter(ctx, e) {
  const { tagLine, getWordAtCursor, confirmTag, getListPrefix, getCurrentBlock,
          getOffsetInBlock, inputLock, editorEl, onInput } = ctx
  // ... (copy from MarkdownEditor.vue:789-866)
}
```

- [ ] **Step 5: Add handleTab**

```js
export function handleTab(ctx, e) {
  const { tagLine, hint, getWordAtCursor, confirmTagHint, navMode,
          editorEl, settingsStore } = ctx
  // ... (copy from MarkdownEditor.vue:868-950)
}
```

- [ ] **Step 6: Run `cd frontend && npx vitest run` — editor tests (28) pass**

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(editor): 提取 handleBackspace/Delete/Enter/Tab 到 utils/editMarkdownKeyboard.js"
```

### Task A2: Wire MarkdownEditor.vue to use extracted handlers

**Files:**
- Modify: `frontend/src/components/MarkdownEditor.vue`

- [ ] **Step 1: Import handlers**

```js
import { handleBackspace, handleDelete, handleEnter, handleTab } from '../utils/editMarkdownKeyboard.js'
```

- [ ] **Step 2: In onKeydown, build context and call handlers**

Replace the Backspace/Delete block (~585-788) with:

```js
if (e.key === 'Backspace' || e.key === 'Delete') {
  if (hint) hint.remove()
  const ctx = {
    editorEl, inputLock, isComposing, hint,
    onInput, startUndoEntry, commitUndoEntry,
  }
  if (e.key === 'Backspace') {
    if (handleBackspace(ctx, e)) return
  } else {
    if (handleDelete(ctx, e)) return
  }
}
```

- [ ] **Step 3: Replace Enter block (~789-866) similarly**

```js
if (e.key === 'Enter') {
  const ctx = {
    tagLine: props.tagLine, getWordAtCursor, confirmTag,
    getListPrefix, getCurrentBlock, getOffsetInBlock,
    inputLock, editorEl, onInput,
  }
  if (handleEnter(ctx, e)) return
}
```

- [ ] **Step 4: Replace Tab block (~868-950) similarly**

```js
if (e.key === 'Tab') {
  const ctx = {
    tagLine: props.tagLine, hint, getWordAtCursor, confirmTagHint,
    navMode, editorEl, settingsStore,
  }
  if (handleTab(ctx, e)) return
}
```

- [ ] **Step 5: Run `cd frontend && npx vitest run` — all 220 tests pass**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(editor): MarkdownEditor onKeydown 改为调度器，调用提取的 handler"
```

---

## Part B: Block Layout Extraction

### Task B1: Create `utils/blockLayout.js` — layoutOverlap + blockStyle

**Files:**
- Create: `frontend/src/utils/blockLayout.js`
- Read: `frontend/src/components/Timeline.vue:196-242` (layout function, includes _span)

**Interfaces:**
- Produces: `export function layoutOverlap(blocks)` — sorts, groups, assigns _col/_cols/_span
- Produces: `export function blockStyle(b, blockTop, PX_MIN)` — returns `{ top, height, left, width }`

- [x] **Step 1: Create file with layoutOverlap (from Timeline.vue layout)**

```js
/**
 * @fileoverview 时间块重叠布局算法。
 * Timeline.vue 和 ExportImagePanel.vue 共享，纯函数，无 Vue 依赖。
 */

/**
 * 分组重叠的块并分配 _col / _cols / _span。
 * @param {{ start: number, end: number }[]} blocks — 统一帧坐标
 * @returns {typeof blocks} 原地修改，添加 _col, _cols, _span
 */
export function layoutOverlap(blocks) {
  const evs = blocks.slice().sort((a, b) => a.start - b.start || a.end - b.end)
  // ... full algorithm from Timeline.vue:197-242, including _span
  return evs
}
```

- [x] **Step 2: Add blockStyle**

```js
/**
 * @param {{ start, end, _col?, _cols?, _span? }} b
 * @param {(b) => number} blockTop
 * @param {number} PX_MIN
 * @returns {{ top: string, height: string, left: string, width: string }}
 */
export function blockStyle(b, blockTop, PX_MIN) {
  const top = blockTop(b)
  const height = (b.end - b.start) * PX_MIN
  const colW = 100 / (b._cols || 1)
  const left = (b._col || 0) * colW
  const width = (b._span || 1) * colW
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${width}% - 4px)`,
  }
}
```

- [x] **Step 3: Run `cd frontend && npx vitest run` — no regression (layout.test.js 20 tests must pass)**

- [x] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(layout): 提取 layoutOverlap + blockStyle 到 utils/blockLayout.js"
```

### Task B2: Wire Timeline.vue and ExportImagePanel.vue

**Files:**
- Modify: `frontend/src/components/Timeline.vue:197-293`
- Modify: `frontend/src/components/ExportImagePanel.vue:594-642`

- [ ] **Step 1: Timeline.vue — import and replace layout**

```js
import { layoutOverlap, blockStyle } from '../utils/blockLayout.js'
```

Replace `function layout(list) { ... }` (lines 197-242) with:
```js
function layout(list) { return layoutOverlap(list) }
```

(Keep the wrapper function to preserve the `computed` reference below)

- [ ] **Step 2: Timeline.vue — update computeBlockStyle**

In `computeBlockStyle`, replace position calculations with `blockStyle` call, keep color logic:

```js
function computeBlockStyle(ev) {
  const has = ev.tags && ev.tags.length
  const c0 = colorOf(has ? ev.tags[0] : null)
  const pos = blockStyle(ev, blockTop, PX_MIN)
  return {
    ...pos,
    background: c0.bg,
    '--block-bg': c0.bg,
    color: '#2C2C2B',
  }
}
```

- [ ] **Step 3: ExportImagePanel.vue — import and replace layoutOverlap**

```js
import { layoutOverlap, blockStyle as sharedBlockStyle } from '../utils/blockLayout.js'
```

Delete `function layoutOverlap(blocks) { ... }` (lines 595-627).

- [ ] **Step 4: ExportImagePanel.vue — update blockStyle**

Replace `function blockStyle(b) { ... }` (lines 629-642) with:

```js
function blockStyle(b) {
  const pos = sharedBlockStyle(b, blockTop, PX_MIN)
  return {
    ...pos,
    background: blockBg(b),
    '--block-bg': blockBg(b),
  }
}
```

- [ ] **Step 5: Run `cd frontend && npx vitest run` — all 220 tests pass**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(layout): Timeline + ExportImagePanel 统一使用 utils/blockLayout.js"
```

---

## Verification (End-to-End)

1. `cd frontend && npx vitest run` — 220 tests, 0 failures
2. Total deleted lines: ~400 (MarkdownEditor ~360 + duplicate layout ~60), added: ~400 (two new files)
3. Manual smoke: open the app, type/edit markdown, drag blocks, export preview — all unchanged

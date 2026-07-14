# 光标位置保存/恢复 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将光标保存/恢复逻辑从 MarkdownEditor.vue 抽离到 `utils/cursor.js`，用 `{ offset, trail }` 替代 `{ offset, inElement }`，消除线性偏移量的边界歧义。

**Architecture:** 两个纯函数 `saveCursor` / `restoreCursor`，对 contenteditable 根元素操作，不依赖 Vue/Pinia。save 两阶段（TreeWalker 找文本 → 回退找空元素）。restore（TreeWalker 定位 + trail 步进）。

**Tech Stack:** 纯 DOM API（TreeWalker、Range、Selection），Vitest + jsdom 测试。

## Global Constraints

- 不修改扫描器（scanLists/scanContentEditable）的 DOM 操作方式
- 不修改 undo/redo 的快照结构（仅替换函数名）
- trail 只记录块级空元素（DIV、P），inline 空元素（span）不记录
- trail 存 tag 名（字符串），不存 DOM 引用

---

### Task 1: 创建 `utils/cursor.js` — saveCursor

**Files:**
- Create: `frontend/src/utils/cursor.js`
- Create: `frontend/src/__tests__/utils/cursor.test.js`

**Interfaces:**
- Produces: `saveCursor(root: Element) -> { offset: number, trail: string[] } | null`
- Produces: `restoreCursor(root: Element, state: { offset: number, trail: string[] }) -> void`

- [ ] **Step 1: Write failing tests for saveCursor (S1-S2, S5)**

```javascript
// frontend/src/__tests__/utils/cursor.test.js
import { describe, it, expect } from 'vitest'
import { saveCursor, restoreCursor } from '../../utils/cursor.js'

function setup(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

function placeCursor(root, path, offset) {
  let node = root
  for (const idx of path) node = node.childNodes[idx]
  const sel = window.getSelection()
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

describe('saveCursor', () => {
  it('S1: cursor in middle of text', () => {
    const root = setup('<div>hello world</div>')
    placeCursor(root, [0, 0], 5) // "hello| world"
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 5, trail: [] })
  })

  it('S2: cursor in empty text after marker span', () => {
    const root = setup('<div><span>- </span></div>')
    // Add empty text node after span (simulating scanLists output)
    root.firstChild.appendChild(document.createTextNode(''))
    placeCursor(root, [0, 1], 0) // <span>- </span>|""
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 2, trail: [] })
  })

  it('S5: cursor in empty div at start (no preceding text)', () => {
    const root = setup('<div></div><div>text</div>')
    placeCursor(root, [0], 0) // <div></div>| cursor in first (empty) child
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 0, trail: ['DIV'] })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/__tests__/utils/cursor.test.js
```
Expected: FAIL — `saveCursor is not defined`

- [ ] **Step 3: Implement saveCursor**

```javascript
// frontend/src/utils/cursor.js

/**
 * Count all text within a node subtree.
 */
function countText(node) {
  if (node.nodeType === 3) return (node.textContent || '').length
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null)
  let total = 0
  let n = walker.firstChild()
  while (n) { total += (n.textContent || '').length; n = walker.nextNode() }
  return total
}

/**
 * Check if an element is a block-level container for trail purposes.
 */
function isBlock(el) {
  return el && el.nodeType === 1 && (el.tagName === 'DIV' || el.tagName === 'P')
}

/**
 * Save cursor position within root.
 * Returns { offset: number, trail: string[] } or null.
 */
export function saveCursor(root) {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return null
  const range = sel.getRangeAt(0)

  // Phase 1: TreeWalker — cursor in a text node?
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let offset = 0
  let node = walker.firstChild()
  while (node) {
    if (node === range.startContainer) {
      return { offset: offset + range.startOffset, trail: [] }
    }
    offset += (node.textContent || '').length
    node = walker.nextNode()
  }

  // Phase 2: cursor in an element — backtrack to nearest text.
  // Record empty block elements between cursor and nearest text as trail.
  const trail = []
  let el = range.startContainer

  // Count text within the container up to startOffset
  if (el !== root) {
    for (let i = 0; i < range.startOffset; i++) {
      const child = el.childNodes[i]
      if (child) offset += countText(child)
    }
  }

  // If the starting element itself is an empty block, record it
  if (isBlock(el) && countText(el) === 0) {
    trail.push(el.tagName)
  }

  // Walk backward through previousSibling → parentNode.previousSibling
  // until we hit a node that contains text.
  while (el && el !== root) {
    let prev = el.previousSibling
    while (prev) {
      const textLen = countText(prev)
      if (textLen > 0) {
        trail.reverse()
        return { offset, trail }
      }
      if (isBlock(prev) && countText(prev) === 0) {
        trail.push(prev.tagName)
      }
      prev = prev.previousSibling
    }
    el = el.parentNode
    if (el && el !== root && isBlock(el) && countText(el) > 0) {
      break
    }
  }

  trail.reverse()
  return { offset, trail }
}
```

- [ ] **Step 4: Run tests to verify S1, S2, S5 pass**

```bash
cd frontend && npx vitest run src/__tests__/utils/cursor.test.js
```
Expected: S1, S2, S5 PASS

- [ ] **Step 5: Add tests for S3, S4, S6**

```javascript
  it('S3: cursor in empty div after text div', () => {
    const root = setup('<div>text</div><div></div>')
    placeCursor(root, [1], 0) // cursor in second (empty) div
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 4, trail: ['DIV'] })
  })

  it('S4: cursor in second consecutive empty div (no preceding text)', () => {
    const root = setup('<div></div><div></div>')
    placeCursor(root, [1], 0) // cursor in second empty div
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 0, trail: ['DIV', 'DIV'] })
  })

  it('S6: cursor in empty div after text node at root level', () => {
    const root = setup('') // empty root
    root.appendChild(document.createTextNode('text'))
    const div = document.createElement('div')
    root.appendChild(div)
    placeCursor(root, [1], 0) // cursor in empty div after "text"
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 4, trail: ['DIV'] })
  })
```

- [ ] **Step 6: Run tests — verify all 6 pass**

```bash
cd frontend && npx vitest run src/__tests__/utils/cursor.test.js
```
Expected: all 6 saveCursor tests PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/cursor.js frontend/src/__tests__/utils/cursor.test.js
git commit -m "feat: saveCursor——TreeWalker+backtrack 两阶段光标位置保存"
```

---

### Task 2: 实现 restoreCursor

**Files:**
- Modify: `frontend/src/utils/cursor.js` — add `restoreCursor`
- Modify: `frontend/src/__tests__/utils/cursor.test.js` — add restore tests

**Interfaces:**
- Consumes: `saveCursor(root) -> { offset, trail }` (from Task 1)
- Produces: `restoreCursor(root, state) -> void`

- [ ] **Step 1: Add restore tests (S1-S6)**

```javascript
describe('restoreCursor', () => {
  function cursorText(root) {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return ''
    const range = sel.getRangeAt(0)
    if (range.startContainer.nodeType === 3) {
      return range.startContainer.textContent.slice(0, range.startOffset) +
             '|' +
             range.startContainer.textContent.slice(range.startOffset)
    }
    return '<' + range.startContainer.nodeName + '>|'
  }

  it('S1: restore to middle of text', () => {
    const root = setup('<div>hello world</div>')
    restoreCursor(root, { offset: 5, trail: [] })
    expect(cursorText(root)).toBe('hello| world')
  })

  it('S2: restore to empty text after marker span', () => {
    const root = setup('<div><span>- </span></div>')
    root.firstChild.appendChild(document.createTextNode(''))
    restoreCursor(root, { offset: 2, trail: [] })
    // Should land in the empty text, not in the span
    const sel = window.getSelection()
    const container = sel.getRangeAt(0).startContainer
    expect(container.nodeType).toBe(3)
    expect(container.textContent).toBe('')
    expect(sel.getRangeAt(0).startOffset).toBe(0)
  })

  it('S3: restore to empty div after text', () => {
    const root = setup('<div>text</div><div></div>')
    restoreCursor(root, { offset: 4, trail: ['DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[1])
    expect(sel.getRangeAt(0).startOffset).toBe(0)
  })

  it('S4: restore to second consecutive empty div', () => {
    const root = setup('<div></div><div></div>')
    restoreCursor(root, { offset: 0, trail: ['DIV', 'DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[1])
  })

  it('S5: restore to empty div at start', () => {
    const root = setup('<div></div><div>text</div>')
    restoreCursor(root, { offset: 0, trail: ['DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[0])
  })

  it('S6: restore to empty div after text at root level', () => {
    const root = setup('')
    root.appendChild(document.createTextNode('text'))
    const div = document.createElement('div')
    root.appendChild(div)
    restoreCursor(root, { offset: 4, trail: ['DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[1])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/__tests__/utils/cursor.test.js
```
Expected: restoreCursor tests FAIL — `restoreCursor is not defined`

- [ ] **Step 3: Implement restoreCursor**

```javascript
// Add to frontend/src/utils/cursor.js

function placeAt(sel, root, node, offset) {
  const range = document.createRange()
  if (node.nodeType === 3) {
    const clamped = Math.min(offset, (node.textContent || '').length)
    range.setStart(node, clamped)
  } else {
    const clamped = Math.min(offset, node.childNodes.length)
    range.setStart(node, clamped)
  }
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function findBlockSibling(from) {
  let el = from
  while (el) {
    const next = el.nextSibling
    if (isBlock(next)) return next
    if (!el.nextSibling && el.parentNode) {
      const pt = el.parentNode
      if (isBlock(pt)) {
        const pn = pt.nextSibling
        if (isBlock(pn)) return pn
        break
      }
      el = el.parentNode
      continue
    }
    break
  }
  return null
}

function stepTrailFrom(root, trail, startIdx) {
  let node = root
  let found = 0
  for (let i = startIdx; i < root.childNodes.length; i++) {
    const child = root.childNodes[i]
    if (isBlock(child) && countText(child) === 0) {
      found++
      if (found >= trail.length) return child
    }
  }
  return null
}

export function restoreCursor(root, state) {
  if (!state) return
  const { offset, trail } = state
  const sel = window.getSelection()

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let accumulated = 0
  let node = walker.firstChild()

  while (node) {
    const len = (node.textContent || '').length

    // Cursor inside this text node
    if (accumulated + len > offset || (accumulated + len === offset && len === 0)) {
      placeAt(sel, root, node, Math.min(offset - accumulated, len))
      return
    }

    // Boundary: accumulated + len === offset && len > 0
    if (accumulated + len === offset) {
      if (trail.length === 0) {
        // Cursor in text — prefer next text node at pos 0
        const next = walker.nextNode()
        if (next) { placeAt(sel, root, next, 0); return }
      }
      // Cursor in element — find next block via trail
      if (trail.length > 0) {
        const block = findBlockSibling(node)
        if (block && block.tagName === trail[0]) {
          if (trail.length === 1) {
            placeAt(sel, root, block, 0)
          } else {
            const target = stepTrailFrom(block, trail.slice(1), 0)
            if (target) { placeAt(sel, root, target, 0); return }
          }
          return
        }
      }
      placeAt(sel, root, node, len)
      return
    }

    accumulated += len
    node = walker.nextNode()
  }

  // Offset past all text — step through trail from root
  if (trail.length > 0) {
    const target = stepTrailFrom(root, trail, 0)
    if (target) { placeAt(sel, root, target, 0); return }
  }

  // Fallback: end of content
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd frontend && npx vitest run src/__tests__/utils/cursor.test.js
```
Expected: all 12 tests (6 save + 6 restore) PASS

- [ ] **Step 5: Add saveCursor null/edge case tests**

```javascript
  it('returns null when no selection', () => {
    const root = setup('<div>text</div>')
    window.getSelection().removeAllRanges()
    expect(saveCursor(root)).toBeNull()
  })

  it('cursor at start of text', () => {
    const root = setup('<div>hello</div>')
    placeCursor(root, [0, 0], 0) // |hello
    expect(saveCursor(root)).toEqual({ offset: 0, trail: [] })
  })

  it('cursor inside nested element (span inside div)', () => {
    const root = setup('<div><span>text</span></div>')
    placeCursor(root, [0, 0, 0], 2) // <span>te|xt</span>
    expect(saveCursor(root)).toEqual({ offset: 2, trail: [] })
  })
```

- [ ] **Step 6: Run full test suite**

```bash
cd frontend && npx vitest run
```
Expected: all tests PASS (existing 69 + new cursor tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/cursor.js frontend/src/__tests__/utils/cursor.test.js
git commit -m "feat: restoreCursor——边界处理+trail步进光标恢复"
```

---

### Task 3: 集成到 MarkdownEditor.vue

**Files:**
- Modify: `frontend/src/components/MarkdownEditor.vue`

**Interfaces:**
- Consumes: `saveCursor(root)`, `restoreCursor(root, state)` from `utils/cursor.js`
- Produces: same `_undoSnapshot` / `restoreUndoState` / `scanAndHighlight` behavior with new functions

- [ ] **Step 1: Replace imports and remove old implementations**

In `MarkdownEditor.vue`:

1. Add import:
```javascript
import { saveCursor, restoreCursor } from '../utils/cursor.js'
```

2. Delete `saveCursorOffset` function (currently around line 64-113)

3. Delete `restoreCursorOffset` function (currently around line 117-163)

4. In `_undoSnapshot`, replace:
```javascript
// Old:
offset: saveCursorOffset(root)
// New:
offset: saveCursor(root)
```

5. In `restoreUndoState`, replace:
```javascript
// Old:
if (state.offset != null) restoreCursorOffset(editorEl.value, state.offset)
// New:
if (state.offset) restoreCursor(editorEl.value, state.offset)
```

6. In `scanAndHighlight`, replace:
```javascript
// Old:
const offset = saveCursorOffset(root)
// ...
restoreCursorOffset(root, offset)
// New:
const saved = saveCursor(root)
// ...
restoreCursor(root, saved)
```

- [ ] **Step 2: Run full test suite**

```bash
cd frontend && npx vitest run
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MarkdownEditor.vue
git commit -m "refactor: 光标定位切到 utils/cursor.js——{offset,trail}替换{offset,inElement}"
```

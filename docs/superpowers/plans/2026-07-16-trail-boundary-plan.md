# Trail 结构边界记录 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** `saveCursor` Phase 1 记录光标与前驱 text 间的结构边界到 trail，`restoreCursor` 按 trail 恢复，删跨 div 全取 next 检查。

**Architecture:** 只改 `cursor.js`，不改其他文件。

**Tech Stack:** DOM TreeWalker API

## Global Constraints

- 不碰 MarkdownEditor.vue、scanner.js
- 85 个现有测试保持通过
- 现有 Phase 2 trail 逻辑（空 block 记录）不受影响

---

### Task 1: 实现 `buildStructTrail` + 修改 `saveCursor` Phase 1

**Files:**
- Modify: `frontend/src/utils/cursor.js`（`saveCursor` 函数）

**Steps:**

- [ ] **Step 1: 添加 `buildStructTrail` 函数**

```javascript
// Build trail of structural tags between two text nodes.
// "/" prefix = closing tag, no prefix = opening tag.
function buildStructTrail(fromText, toText) {
  const trail = []
  // Walk up from 'fromText' to common ancestor, recording closing tags
  let el = fromText.parentNode
  const toAncestors = []
  let t = toText.parentNode
  while (t && t !== root) { toAncestors.push(t); t = t.parentNode }
  while (el && el !== root) {
    if (toAncestors.includes(el)) break // reached common ancestor
    trail.push('/' + el.tagName)
    el = el.parentNode
  }
  // Walk down from common ancestor to 'toText' parent, recording opening tags
  const common = el
  const downTags = []
  t = toText.parentNode
  while (t && t !== common) { downTags.unshift(t.tagName); t = t.parentNode }
  for (const tag of downTags) trail.push(tag)
  return trail
}
```

- [ ] **Step 2: 修改 `saveCursor` Phase 1**

光标命中 text node 时，不再直接返回空 trail。检查前一 text node 存在且当前 text 的 offset=0，调用 `buildStructTrail`。

```javascript
// Phase 1: TreeWalker
let prevText = null
while (node) {
    if (node === sc) {
        const trail = []
        if (so === 0 && prevText) {
            trail.push(...buildStructTrail(prevText, node))
        }
        return { offset: offset + so, trail }
    }
    prevText = node
    offset += (node.textContent || '').length
    node = walker.nextNode()
}
```

- [ ] **Step 3: 运行测试**

```bash
cd frontend && npm test -- --run
```

预期：85 tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/cursor.js
git commit -m "feat: saveCursor Phase1 trail记录结构边界——/DIV/DIV/SPAN等"
```

---

### Task 2: 修改 `restoreCursor` 边界处理 + trail 步进

**Files:**
- Modify: `frontend/src/utils/cursor.js`（`restoreCursor` 函数）

**Steps:**

- [ ] **Step 1: 删除跨 div 全取 next 检查**

删除第 319-327 行的 `curBlock !== nextBlock` 检查。

```diff
-        // If next text is in a different block div, cursor was at
-        // the START of that block, not at end of current text.
-        if (next) {
-          const curBlock = node.parentNode?.closest?.('div')
-          const nextBlock = next.parentNode?.closest?.('div')
-          if (curBlock && nextBlock && curBlock !== nextBlock) {
-            placeAt(sel, root, next, 0); return
-          }
-        }
```

- [ ] **Step 2: 添加基于 trail 的恢复逻辑**

`restoreCursor` 边界，trail 非空时按标签步进：

```javascript
if (trail.length > 0) {
    // Step through trail: "/TAG" = go up, "TAG" = find child
    let cursor = node // start from current text node
    for (const step of trail) {
        if (step.startsWith('/')) {
            // Closing tag: go up to that element
            const tag = step.slice(1)
            let p = cursor.parentNode
            while (p && p !== root && p.tagName !== tag) p = p.parentNode
            if (p && p.tagName === tag) { cursor = p; continue }
            // Not found — fallback: stay at closest text
            const w = document.createTreeWalker(cursor, NodeFilter.SHOW_TEXT, null)
            let last = null, n = w.firstChild()
            while (n) { last = n; n = w.nextNode() }
            if (last) { placeAt(sel, root, last, (last.textContent || '').length); return }
            break
        } else {
            // Opening tag: find matching child
            const parent = cursor === node ? cursor.parentNode : cursor
            const children = parent?.childNodes || []
            let found = false
            for (const child of children) {
                if (child.tagName === step) { cursor = child; found = true; break }
            }
            if (!found) {
                // Fallback: place at start of next text
                const next = walker.nextNode()
                if (next) { placeAt(sel, root, next, 0); return }
                placeAt(sel, root, node, len); return
            }
        }
    }
    // After stepping through trail, place cursor at first text inside cursor
    const w = document.createTreeWalker(cursor, NodeFilter.SHOW_TEXT, null)
    const first = w.firstChild()
    if (first) { placeAt(sel, root, first, 0); return }
    placeAt(sel, root, node, len); return
}
```

- [ ] **Step 3: 运行测试**

```bash
cd frontend && npm test -- --run
```

预期：85 tests pass

- [ ] **Step 4: 手动验证**

1. `==1==|` 行尾打字 → 光标不跳下一行
2. `|==1==` 行首 Enter → 正常
3. `=|=2==` Backspace → 不回归 #2
4. `342|==1==` Enter → mid-split 正常

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/cursor.js
git commit -m "fix: restoreCursor按结构trail恢复——替代跨div全取next误判行尾光标"
```

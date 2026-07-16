# Backspace Case 1 修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Backspace 在 EditMarkdown 格式化元素内部时拆格式而非删字符的问题——改为删前一 text node 的最后一个字符，让 scan 自然匹配处理格式变化。

**Architecture:** 修改 `onKeydown` 的 Case 1 分支：光标在格式化元素内 offset=0 时，不拆包装，而是用 TreeWalker 找前一 text node，删其最后一个字符。若标记 `<span>` 变空则移除。Backspace 语义保持一致（删前一字符），`saveCursor`/`restoreCursor` 在 `onInput` 中自然处理 offset。

**Tech Stack:** Vue 3 + contenteditable + WebView2

## Global Constraints

- 只修改 `MarkdownEditor.vue` 的 Case 1 分支，不动 scanner、cursor.js、其他函数
- `saveCursor` 必须在字符删除后执行（已在 `onInput` 中，无需改动）
- 空 `<span>` 需移除以防 TreeWalker 行为异常
- 不改动已有测试，确保 85 个现有测试通过

---

### Task 1: 修改 Case 1 — Backspace/Delete 删标记字符而非拆格式

**Files:**
- Modify: `frontend/src/components/MarkdownEditor.vue:592-626`（Case 1 的 Backspace 分支）+ `:644-655`（Case 2 的 Delete 分支需同步简化）

**Interfaces:**
- Consumes: `range.startOffset`, `range.startContainer`, `window.getSelection`
- Produces: Backspace 删前一 text node 末尾字符，Delete 删后一 text node 开头字符，空 span 移除。对称处理

- [ ] **Step 1: 定位当前 Case 1 + Case 2 的格式处理分支**

Case 1（约 592-626 行）处理 Backspace。Case 2（约 644-655 行）处理 Delete。两者都是"碰到 EditMarkdown 就拆/删"，需要统一改为删字符。

- [ ] **Step 2: Case 1 改为：Backspace 在 text start(offset=0) → 删前一 text node 末尾字符**

```javascript
// Marker/content elements at text start (Backspace): delete previous
// character instead of unwrapping. Scanner re-matches naturally.
if (el.className && /EditMarkdown-/.test(el.className)) {
  if (range.startOffset > 0) break // mid-text: let browser handle
  e.preventDefault()
  let prev = node.previousSibling
  while (prev) {
    if (prev.nodeType === 3) break
    prev = prev.previousSibling
  }
  if (prev && prev.nodeType === 3) {
    const text = prev.textContent || ''
    if (text.length > 0) {
      prev.textContent = text.slice(0, -1) // delete last char
      if (!prev.textContent) {
        const span = prev.parentNode
        if (span && span.nodeType === 1 && span !== el.parentNode) span.remove()
      }
      node.parentNode.normalize?.()
    }
  } else {
    // No previous text node (line start). Let browser handle natively.
    break
  }
  return
}
```

- [ ] **Step 3: Case 2 改为：Delete 在 text end(offset=len) → 删后一 text node 开头字符**

Case 2 的 Delete 分支（约 644 行 `if (e.key === 'Delete' && range.startOffset === ...)`）需要同步处理。当前它检查 `node.nextSibling` 是否 EditMarkdown 后删掉。改为找到后一 text node，删其第一个字符。

```javascript
// Delete at text end next to EditMarkdown: delete first char of next
// text node (mirror of Backspace logic above).
if (e.key === 'Delete' && range.startOffset === (node.textContent || '').length) {
  let el = node.parentNode
  while (el && el !== editorEl.value) {
    if (el.className && /EditMarkdown-/.test(el.className)) {
      e.preventDefault()
      let next = node.nextSibling
      while (next) {
        if (next.nodeType === 3) break
        next = next.nextSibling
      }
      if (next && next.nodeType === 3) {
        const text = next.textContent || ''
        if (text.length > 0) {
          next.textContent = text.slice(1) // delete first char
          if (!next.textContent) {
            const span = next.parentNode
            if (span && span.nodeType === 1 && span !== el.parentNode) span.remove()
          }
          node.parentNode.normalize?.()
        }
      } else {
        break // no next text node — let browser handle
      }
      return
    }
    el = el.parentNode
  }
  // Fall through to existing Delete logic for non-formatted case
}
```

注意：这个新 Delete 逻辑需要放在现有 Case 2（`if (e.key === 'Delete' && ...)`）之前，因为 Case 2 现在只处理非格式化元素边界的 Delete。

- [ ] **Step 4: 运行测试确认无回归**

```bash
cd frontend && npm test -- --run
```

预期：85 tests pass

- [ ] **Step 5: 手动验收**

在 Tauri dev 中测试：

**Backspace:**
1. `**12|3**` → Backspace → 删 "2"，粗体保持，光标 `**1|3**`
2. `**|123**` → Backspace → 删标记 `*` → `*|123**`，粗体消失
3. `*|123*` → Backspace → 删标记 `*` → `|123*`，斜体消失
4. `123*|456*` → Backspace → 删 "3" → `12*|456*`
5. 行首 offset=0 无前驱 text → 退到浏览器原生

**Delete:**
6. `**12|3**` → Delete → 删 "3"，粗体保持
7. `**123|**` → Delete → 删标记 `*` → `**123*`，粗体消失
8. `*123|*` → Delete → 删标记 `*` → `*123|`，斜体消失
9. 行尾 offset=len 无后继 text → 退到浏览器原生

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/MarkdownEditor.vue
git commit -m "fix: Backspace在格式化元素开头删前一字符而非拆格式——自然匹配+offset正确"
```

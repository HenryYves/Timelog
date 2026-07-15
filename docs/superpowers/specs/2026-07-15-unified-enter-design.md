# 统一 Enter 处理 Spec

> **目标**：将所有 Enter 路径（列表续行、mid-line split、缩进继承、plain div-break）统一为一个逻辑：**split → insert → cleanup → scan**。

## 统一公式

```
split(block, offset) → [textBefore, textAfter]
insert(block, textBefore, textAfter, prefix?)
cleanup(empty divs)
onInput → scanAndHighlight → 自动重格式化
```

| 场景 | textAfter | prefix |
|------|:---:|--------|
| 列表续行 | ✗ | `- ` / `1. ` |
| 列表 mid-split | ✓ | `- ` / `1. ` |
| 缩进继承 | ✗ | 原行缩进 |
| 普通行尾 | ✗ | 无 |
| 普通 mid-split | ✓ | 无 |
| 行首 | ✓(全文本) | 无 |

**新光标统一规则**：在新 div 内容开头。有 prefix 时在 prefix 后面。

**永远不变**：新 div 插入到 `block.nextSibling` 前面。不需要判断行首/行尾/行中。

## 详细步骤

### 1. split

```javascript
const textBefore = fullText.slice(0, offset)
const textAfter = fullText.slice(offset)
```

`block.textContent = textBefore` — 自动清空所有子节点（span/b/mark 全部变裸文本）。`scanAndHighlight` 会重新格式化。

### 2. insert

```javascript
const newDiv = document.createElement('div')
if (textAfter) {
  // 有内容 → 新 div 装 textAfter
  newDiv.textContent = (prefix || '') + textAfter
} else {
  // 无内容 → 新 div 空的，加 <br> 防合并
  newDiv.textContent = prefix || ''
  if (!newDiv.textContent) newDiv.appendChild(document.createElement('br'))
}
parent.insertBefore(newDiv, block.nextSibling)
```

### 3. cleanup

如果 `textBefore` 为空，`block` 变空。浏览器自己合并空 div（quirk #4），我们不管。

### 4. cursor

```javascript
const cursorNode = newDiv.firstChild || newDiv // text node or <br>
const cursorOffset = (prefix && textAfter) ? prefix.length : 0
sel.collapse(cursorNode, cursorOffset) // quirk #6: 用 collapse 不用 addRange
```

## 边界

### 空行（textContent 为空，div 里只有 `<br>`）

split 不适用。fallback：`parent.appendChild` 新 `<div><br>`，和现有一致。

### prefix 确定

- 列表：`getListPrefix()` 返回 `indent + marker + ' '`
- 缩进：`text.match(/^(\s+)/)` 返回缩进
- 普通：无

## 替换范围

全部替换以下 4 个路径（约 80 行 → ~30 行）：

1. 列表续行（`continueList` 调用处 + 函数）
2. 列表 mid-line split
3. 普通文本 mid-line split
4. plain div-break（含缩进继承）

## 不变的部分

- `getListPrefix()` / `getCurrentBlock()` / `getOffsetInBlock()` — 不动
- `scanAndHighlight` / `saveCursor` / `restoreCursor` — 不动
- `inputLock` 保护 — 保持（Enter handler 已经有了）
- 旧 `continueList()` 函数 — 可以删掉

## 风险

| 项 | 风险 | 缓解 |
|---|------|------|
| textContent 清空子节点 | 格式化丢失 | onInput 自动 scan 重格式化 |
| 浏览器合并空 div | 行消失 | quirk #4 已知行为，我们用 newDiv 的 `<br>` 防新 div 被合并 |
| sel.collapse 兼容性 | 光标不生效 | quirk #6 已验证 collapse 比 addRange 稳定 |

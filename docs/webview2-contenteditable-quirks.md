# WebView2 contenteditable 怪异行为

本文档记录在 Timelog 编辑器开发中发现的 WebView2 contenteditable 行为与标准/直觉不符之处。

## 编辑器光标相关

以下直接影响 `utils/cursor.js` 的 save/restore 逻辑。

### 1. compareDocumentPosition 对文本+兄弟元素返回反转

`textNode.compareDocumentPosition(siblingElement)` —— 文本节点在元素之前时，预期返回 `PRECEDING` (0x02)，实际返回 `FOLLOWING` (0x04)。

**影响**：不能依赖 `compareDocumentPosition` 判断文本和元素的相对顺序。

**方案**：手动迭代 `root.childNodes` 按文档序判断位置。见 `saveCursor` Phase 2。

### 2. 裸文本节点在 root 下时 setStart 被推到兄弟元素

`setStart(textNode, textNode.length)` 在文本末尾。如果该文本节点是 contenteditable root 的直接子节点，浏览器会将其推到相邻的兄弟元素（div）开头——而非留在文本末尾。

**原因**：文本末尾即 root 子节点边界。浏览器内部光标规范化倾向于把边界光标放入 block 元素而非裸文本节点。

**方案**：`normalizeBlocks` 在 `scanAndHighlight` 末尾将 root 下所有裸文本节点包进 `<div>`，消除扁平 DOM 结构。同时 `saveCursor` 拦截有文字元素开头的浏览器推送模式。

---

### 3. 程序化 setStart(text, len) 被推到父元素（root）

`range.setStart(textNode, textNode.textContent.length)` 将光标放在文本末尾。浏览器可能将其推到父元素（root）的 childOffset 边界——光标不在文本节点里了。

**影响**：光标在 root 级时，Backspace/Delete 行为不可预测（可能删到其他行）。

**方案**：`placeAt` 在 `setStart` + `addRange` 后同帧校验：如果 `startContainer !== textNode`，回退到 `len-1`（文本内）。见 `utils/cursor.js:placeAt`。

---

## 编辑器 DOM 相关

### 4. 空 div 被浏览器合并

空 `<div></div>`（无 `<br>` 子元素）在执行 Backspace/Delete 或某些 Enter 操作后，浏览器自动将它与相邻块合并。

**影响**：标记被清除后的空行消失，内容合并到上一行。

**方案**：清除标记或删除元素后，检查父块是否有实际内容（`textContent.trim()`），若无则补 `<br>` 占位。

---

### 5. input 事件同步触发

`contenteditable` 在 `insertBefore` / `appendChild` 等 DOM 变更时可能**同步**触发 `input` 事件，而非排队为微任务。

**影响**：Enter handler 内创建新 div 时，`input` 可能在 `sel.addRange`（光标设置）之前触发——`onInput` 拿到的光标位置是旧的。

**方案**：DOM 变更前 `inputLock++`，光标设置完成后 `inputLock--`，再显式调用 `onInput()`。

---

### 6. 程序化 vs 自然光标路径不同

`sel.removeAllRanges()` + `sel.addRange(range)` 设置的 cursor 与用户打字时浏览器自然移动的 cursor，渲染路径不同。前者可能在文本末尾时被推走，后者稳定。

**影响**：`restoreCursor` 恢复的光标位置可能被浏览器覆盖；Enter 后光标从 `<BR>` 推到上一行文本。见 #3（Enter 光标丢失）和 #2（Backspace 光标消失）。

**方案**：用 `sel.collapse(node, offset)` 替代 `removeAllRanges + addRange`——collape 走浏览器原生选区坍缩路径，不触发 push。严格规则：**所有程序化光标设置优先用 `collapse`，不用 `removeAllRanges + addRange`**。

---

### 7. cloneNode 后 innerText 不计算换行

`editorEl.cloneNode(true).innerText` —— 脱离文档的 clone 在 WebView2 中 `innerText` 不计算 CSS 布局，`<div>` 间不产生换行，所有文字连成一行。

**影响**：N 模式 `getPlainText` 全部变成一行 → 批量解析失败。

**方案**：不用 `innerText` + clone。改为手动 DOM 遍历，遇到 `<div>` / `<br>` 时插入 `\n`。见 `getPlainText`。

### 8. 元素边界上 collapsed range 的 getBoundingClientRect 返回 height=0

`range.getBoundingClientRect()` 在光标位于元素节点（nodeType=1）而非文本节点时，返回 `height=0`——即使该元素有文本子节点。

**影响**：`centerCursor` 无法获取有效光标 Y 坐标，居中失效。发生在 `restoreCursor` 将光标放在元素边界时（如刚创建的 `<div>` 的 `firstChild` 位置）。

**方案**：回退到 `range.startContainer`（元素）自身的 `getBoundingClientRect()`。见 `centerCursor`。

### 9. scanner 搬迁 `\` 到 escape span 后字符数少 1，saveCursor/restoreCursor 偏移错位

`scanContentEditable` 处理 `\` 转义时把 `\` 从 text node 搬到 `<span class="EditMarkdown-escape">`。TreeWalker 不计数 span 内文本（已在 `unwrapFormatting` 后），字符总数少 1。但 `saveCursor` 在 scan 前计数（包含 `\`），`restoreCursor` 用旧 offset 在新 DOM 找位置→偏差 1 位。每次插 `\` 偏差累加。

**影响**：在格式化文本内连续键入 `\` 时 restoreCursor 定位错误。见 `==123\\\==` 案例。

**方案**：待定。思路——saveCursor 在 unwrap 之后、scan 之前执行；或在 escape span 搬迁前先修正 offset。

---

## saveCursor/restoreCursor 关键实现细节

以下非浏览器 quirks，但是容易回归的关键修复点。

### 10. Phase 2 trail 必须检查父级空 block

当光标在 void 元素（如 `<BR>`）上时，Phase 2 起始 `el=<BR>` 不是 block，不记 trail。往上走到 `<div>` 时原本没有再次检查空 block。会导致 `restoreCursor` 无法区分"在空 div 的 `<BR>` 上"和"在前一 div 文本末尾"——offset 相同。

**修复**：Phase 2 的 while 循环中，`el = el.parentNode` 之后检查父级是否为空的 block div。如果是，push 到 trail。参见 commit `1d3b66c`。

### 11. restoreCursor 跨 div 边界定位

当 offset 落在 text node 边界（`accumulated + len === offset`），且 `walker.nextNode()`（下一 text node）与当前 text node 在不同 `<div>` 中时，光标应该在下一 div 开头，而非当前 text 末尾。否则 `saveCursor(offset=5)` 无法区分 `==1==|`（第一行末尾）和 `|*2*`（第二行开头）。

**修复**：`restoreCursor` 边界检查中，若下一 text node 的最近祖先 `<div>` 与当前不同，`placeAt(next, 0)`。参见 commit `1d3b66c`。

### 12. Case 1 Backspace/Delete 规则

Backspace/Delete 处理 EditMarkdown 元素时的规则（`onKeydown` Case 1/1b）：

- **offset=0（Backspace）或 offset=len（Delete）**：删前一/后一 text node 的边界字符。用 `inputLock` 保护 + 显式 `onInput`。
- **offset>0 在标记/escape span 内**：手动删当前位置字符。用 `sel.collapse`（不用 `removeAllRanges+addRange`——防止 quirk #6 push）。
- **offset>0 在内容包装器（`<b>`/`<i>`/`<mark>` 等）内**：break，交浏览器原生处理。
- 所有手动 DOM 修改必须用 `inputLock++`/`inputLock--` 包裹 + 显式调 `onInput()`。

### 13. 跨 div 边界 offset 重复——restoreCursor 误判行尾为下行开头

两个文本节点之间经过 `<div>` 边界时，offset 指向边界——"上一行末尾"和"下一行开头" offset 相同。`restoreCursor` 原本无条件跨 div 取 next，导致行尾打字后光标跳到下行开头。

**修复**（commit `4b2d3d6`）：
- `saveCursor` Phase 1：光标在 text offset=0 且前一 text 在不同 `<div>` → trail 记 `['DIV']`
- `restoreCursor` 边界：trail 非空 + next 在不同 div → 跨到 next（行首光标）。trail 为空 → `placeAt(node, len)`（行尾光标）

**规则**：不要无 trail 的上下文就做跨 div 的判断。trail 是"光标确实经过了块边界"的证明。

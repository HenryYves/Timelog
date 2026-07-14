# WebView2 contenteditable 怪异行为

本文档记录在 Timelog 编辑器开发中发现的 WebView2 contenteditable 行为与标准/直觉不符之处。

## 1. compareDocumentPosition 对文本+兄弟元素返回反转

`textNode.compareDocumentPosition(siblingElement)` —— 文本节点在元素之前时，预期返回 `PRECEDING` (0x02)，实际返回 `FOLLOWING` (0x04)。

**影响**：不能依赖 `compareDocumentPosition` 判断文本和元素的相对顺序。

**方案**：手动迭代 `root.childNodes` 按文档序判断位置。见 `saveCursor` Phase 2。

---

## 2. 程序化 setStart(text, len) 被推到父元素

`range.setStart(textNode, textNode.textContent.length)` 将光标放在文本末尾。浏览器可能将其推到父元素（root）的 childOffset 边界——光标不在文本节点里了。

**影响**：光标在 root 级时，Backspace/Delete 行为不可预测（可能删到其他行）。

**方案**：`placeAt` 在 `setStart` + `addRange` 后同帧校验：如果 `startContainer !== textNode`，回退到 `len-1`（文本内）。见 `utils/cursor.js:placeAt`。

---

## 3. 空 div 被浏览器合并

空 `<div></div>`（无 `<br>` 子元素）在执行 Backspace/Delete 或某些 Enter 操作后，浏览器自动将它与相邻块合并。

**影响**：标记被清除后的空行消失，内容合并到上一行。

**方案**：清除标记或删除元素后，检查父块是否有实际内容（`textContent.trim()`），若无则补 `<br>` 占位。

---

## 4. input 事件同步触发

`contenteditable` 在 `insertBefore` / `appendChild` 等 DOM 变更时可能**同步**触发 `input` 事件，而非排队为微任务。

**影响**：Enter handler 内创建新 div 时，`input` 可能在 `sel.addRange`（光标设置）之前触发——`onInput` 拿到的光标位置是旧的。

**方案**：DOM 变更前 `inputLock++`，光标设置完成后 `inputLock--`，再显式调用 `onInput()`。

---

## 5. 程序化 vs 自然光标路径不同

`sel.removeAllRanges()` + `sel.addRange(range)` 设置的 cursor 与用户打字时浏览器自然移动的 cursor，渲染路径不同。前者可能在文本末尾时被推走，后者稳定。

**影响**：`restoreCursor` 恢复的光标位置可能被浏览器覆盖。

**方案**：见第 2 条。

---

## 6. cloneNode 后 innerText 不计算换行

`editorEl.cloneNode(true).innerText` —— 脱离文档的 clone 在 WebView2 中 `innerText` 不计算 CSS 布局，`<div>` 间不产生换行，所有文字连成一行。

**影响**：N 模式 `getPlainText` 全部变成一行 → 批量解析失败。

**方案**：不用 `innerText` + clone。改为手动 DOM 遍历，遇到 `<div>` / `<br>` 时插入 `\n`。见 `getPlainText`。

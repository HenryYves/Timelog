# Spec: MarkdownEditor keydown 逻辑提取

## 目标

从 `MarkdownEditor.vue` 的 `onKeydown`（~450 行）抽取 Backspace/Delete/Enter/Tab 处理逻辑到独立文件，`onKeydown` 变成 ~30 行调度器。

## 新文件

`frontend/src/utils/editMarkdownKeyboard.js`

## 导出函数

### Context 对象

各 handler 通过统一的 context 访问 MarkdownEditor 的内部状态：

```js
{
  editorEl,        // ref<HTMLElement> — contenteditable 根元素
  inputLock,       // number — 防止递归 input 事件的锁计数器
  isComposing,     // boolean — IME 组合中
  navMode,         // ref<boolean> — 导航模式
  pendingUndoEntry, // object — 当前 undo 快照
  tagLine,         // boolean — 是否为 tag 行编辑器
  tagFreq,         // object — 标签频率表
  tagStore,        // Pinia store — 标签列表
  settingsStore,   // Pinia store — tabToIndent / batchTabToIndent
  startUndoEntry,  // (inputType) => void
  commitUndoEntry, // () => void
  onInput,         // () => void — 手动触发的 input handler
  getPlainText,    // () => string
  getCurrentBlock, // () => HTMLElement|null
  getOffsetInBlock,// (block) => number
  getListPrefix,   // () => { full, indent, marker, content } | null
  getWordAtCursor, // () => string|null
  getLineType,     // () => LineType
  updateInlineHint,// () => void
  confirmTagHint,  // () => void
  cycleTagHint,    // () => void
  confirmTag,      // (word) => void
  scanAndHighlight,// () => void
}
```

### handleBackspace(ctx, e) → boolean

- 处理 EditMarkdown 元素的退格删除（escape 元素删除、marker/content 元素退格、光标在元素边界时跨元素删除）
- 处理 WebView2 block 合并防御（光标在 block 第二个字符时退格的 quirk #4）
- 处理 tag hint 的删除
- 返回 `true` 表示已处理（调用方应 return），`false` 表示未处理（继续默认行为）

### handleDelete(ctx, e) → boolean

- 处理 EditMarkdown 元素内和边界的 Delete 键
- mirror Backspace 的逻辑但方向相反

### handleEnter(ctx, e) → boolean

- Tag hint 确认（tagLine 模式）
- 列表延续（`- ` / `* ` / `1. `）
- 空表项结束列表
- 缩进传递
- 新 div 创建（含 `<br>` 兜底空行）
- 空行 fallback

### handleTab(ctx, e) → boolean

- Tag hint 确认（tagLine + hint 存在时优先）
- Nav mode 跳转（Shift+Tab 反向）
- 行首 Tab 缩进（仅当 `tabToIndent`/`batchTabToIndent` 开启）
- 非行首 Tab → 焦点跳转

## MarkdownEditor.vue 改动

- `onKeydown` 保留：nav mode 切换、Ctrl+Z/Y undo、Ctrl+Y redo、startUndoEntry（Enter/Backspace/Delete/字符键）、Escape
- 上述四个 handler 调用替换原有内联逻辑
- 所有 handler 需要的函数通过 context 对象传入（无需提取到 util，保持 MarkdownEditor 内部实现不变）

## 不提取的内容

- `scanAndHighlight` — 已是独立文件
- `centerCursor` / `onSelectionChange` — 光标管理，与 keydown 无关
- `confirmTagHint` / `cycleTagHint` — 在 MarkdownEditor 内被多处调用，保持原位

## 验证

1. `cd frontend && npx vitest run` — 28 editor tests 全过
2. 手动：Backspace/Delete 在 markdown 元素内正常
3. 手动：Enter 列表延续正确
4. 手动：Tab tag hint 确认 + nav 跳转正常

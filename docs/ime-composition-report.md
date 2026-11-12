# 水杉输入法在备注编辑器中无法输入中文 — 分析报告

日期：2026-11-12
状态：**待验证**。以下为代码证据与候选机理，未做运行对照，不下因果结论。

## 现象

- 环境：Windows，水杉输入法（开源 Windows 版）。
- 组件：备注编辑器 `MarkdownEditor.vue`（备注编辑、批量创建共用）。
- 条件：当前行**已有被语法渲染的文字**（行内有 `EditMarkdown-*` 包裹的 span）时，无法打出中文。
- 对照观察（用户提供）：行内没有渲染元素时可以输入。

## 相关代码

编辑器每次 `input` 都会执行 `onInput`（`MarkdownEditor.vue:499-521`）：

```
onInput
  -> commitUndoEntry()
  -> scanAndHighlight()      // 重建行内 DOM
  -> emit('update:modelValue', getPlainText())
```

`scanAndHighlight`（`MarkdownEditor.vue:134-176`）：

1. `unwrapFormatting(root)`：删除所有 `EditMarkdown-*` 元素，把文字还原为裸文本节点；
2. `root.normalize()`；
3. `scanLists` / `scanContentEditable`：重新创建 `span` / `b` / `a` 等元素包裹文字；
4. `saveCursor` / `restoreCursor` 保存并恢复光标。

标注：

- `MarkdownEditor.vue:13` 声明了 `@compositionstart="isComposing = true"`；
- `MarkdownEditor.vue:14` 在 `compositionend` 时补一次 `onInput`；
- `isComposing` 只被 `startUndoEntry` 使用（`MarkdownEditor.vue:465-468`），**没有拦住 `scanAndHighlight`**。

## 候选机理（未验证）

**假设 A：组合输入期间重建 DOM 打断 IME 组合。**

中文输入过程：`compositionstart` → 多次 `input`（inputType 为 `insertCompositionText`）→ `compositionend`。第二步每次都会触发 `onInput`，进而 `unwrapFormatting` + 重新包裹，把正在组合的文字节点从 DOM 中摘除、换上新的元素。多数 IME/浏览器组合状态绑定在原文本节点上；节点被替换后组合被取消，候选框关闭，中文落不了字。

与现象吻合的点：

- 未渲染的行没有可拆除的 `EditMarkdown-*` 元素，`unwrapFormatting` 不改变 DOM 结构，组合不受影响；
- 只有“当前行已有渲染文字”时，每次按键都会真正拆装 DOM，符合触发条件。

**假设 B（次要）：组合期间的光标/滚动操作。**

`scanAndHighlight` 内 `saveCursor/restoreCursor` 会移动 Selection；`selectionchange` 监听（`MarkdownEditor.vue:254-261`）还会调用 `centerCursor` 滚动画布。这些可能在组合期间干扰 IME 的位置计算，但一般不会直接终止组合。

**未解释、需对照的部分**

- 为何其他输入法（如微软拼音）在同条件下正常。可能与各 IME 对 composition 被 DOM 变更后的恢复策略不同有关，暂无证据。
- 不排除 WebView2 对 `insertCompositionText` 的特定处理。需按项目规则实测，不能凭经验下结论。

## 验证方案

1. 在 `tauri dev` 中加临时日志（不改最终代码）：`compositionstart` / `compositionend` / `input`（含 `e.inputType`）/ `beforeinput`，并在 `scanAndHighlight` 前后记录 `root.innerHTML` 是否变化。
2. 最小实验（A/B）：组合期间跳过扫描。

   ```
   function onInput() {
     if (isComposing) { emit(...); return }   // 或只记录不扫描
     ...
   }
   ```

   `compositionend` 已会触发一次 `onInput`，补扫不会丢内容。对比实验前后水杉输入法能否输入中文。
3. 若实验证明假设 A，再正式修复；修复后同步更新 `docs/webview2-quirks.md`（项目规则：新发现的浏览器/渲染/API 行为必须入档）。

## 建议修复（验证通过后再改）

- `onInput` 入口：`isComposing` 为真时推迟 `scanAndHighlight`，仅更新 model 或直接返回；
- `compositionend` 保持现有补扫；
- 回归检查：普通输入、撤销（`pendingUndoEntry`）、回车换行、标签提示均正常。

## 影响面

- `EditModal.vue` 备注编辑、`BatchCreatePanel.vue` 批量创建共用 `MarkdownEditor.vue`，两处同时改善。

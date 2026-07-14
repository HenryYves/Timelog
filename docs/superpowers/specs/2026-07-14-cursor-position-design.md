# 光标位置保存/恢复 — 设计文档

日期：2026-07-14

## 动机

`MarkdownEditor.vue` 内嵌了光标保存/恢复逻辑（`saveCursorOffset`、`restoreCursorOffset`）。
`scanAndHighlight` 每次输入都会拆 DOM 重组 DOM，光标容器可能在过程中被替换，
因此不能直接保存 `Range` 对象。当前实现将光标位置压缩为一维线性偏移 + `inElement` 标志，
但压缩与恢复逻辑混在 1200 行的组件里，难以独立测试和维护。

目标：
1. 抽离光标逻辑到独立模块 `utils/cursor.js`，接口干净，内部可独立迭代。
2. 修复线性偏移无法区分同一 offset 下多个空元素的问题（连续空行）。

---

## 接口

```javascript
// utils/cursor.js

/**
 * 在 root 范围内保存光标位置。
 * @param {Element} root - 光标所在的根元素（contenteditable div）
 * @returns {{ offset: number, trail: string[] } | null}
 *   trail 清空   → 光标在文本节点内
 *   trail 非空   → 光标在元素节点内，trail 为从最近文本到光标经过的空元素 tag 序列
 */
export function saveCursor(root)

/**
 * 在 root 范围内恢复光标位置。
 * @param {Element} root
 * @param {{ offset: number, trail: string[] }} state
 */
export function restoreCursor(root, state)
```

两个函数都是纯 DOM 操作，不依赖 Vue / Pinia / MarkdownEditor。

---

## 数据结构

```javascript
{ offset: number, trail: string[] }
```

| 字段 | 含义 |
|------|------|
| `offset` | 光标之前所有文本节点的字符总数（TreeWalker 线性累计） |
| `trail` | 从最近文本节点到光标的空元素 tag 名序列，`[]` = 光标直接在文本节点内 |

示例：

| 场景 | 返回值 |
|------|--------|
| 光标在文本 "hello\| world" | `{ offset: 5, trail: [] }` |
| 光标在空行（前有文本 "text"） | `{ offset: 4, trail: ['DIV'] }` |
| 光标在第二个空行（前无文本） | `{ offset: 0, trail: ['DIV', 'DIV'] }` |

---

## save 算法

**两阶段遍历：**

1. **TreeWalker 阶段**：用 `SHOW_TEXT` 遍历 root 下所有文本节点。
   若光标容器匹配到某个文本节点 → 直接返回 `{ offset: 累计 + 光标偏移, trail: [] }`。

2. **回退阶段**：光标不在任何文本节点里（在空元素中）。
   从光标容器出发，沿 `previousSibling` →
   `parentNode.previousSibling` → … 逐步回退，直到遇到文本节点或 root 起点。
   记录沿途经过的空元素 tag 名（按从近到远排列，restore 时反过来从文本往前步进）。

   伪代码：

   ```
   trail = []
   el = startContainer
   while el != root && el:
       prev = el.previousSibling
       while prev:
           if prev 是文本节点:
               记录 offset = 之前所有文本字数 + 继续回退之前的字数
               返回 { offset, trail.reverse() }
           if prev 是空元素:
               trail.push(prev.tagName)
           prev = prev.previousSibling
       el = el.parentNode
   // 走到 root 起点无文本
   返回 { offset: 0, trail: trail.reverse() }
   ```

---

## restore 算法

1. TreeWalker 线性走到 `offset`。边界逻辑：
   - `accumulated + len > offset`：光标在当前文本内 → 定位 pos。
   - `accumulated + len === offset && len === 0`：光标在空文本 pos=0。
   - `accumulated + len === offset && len > 0`：
     - `trail === []`：优先取下一个文本节点 pos=0（光标在文本里不可能是上一个末尾）。
     - `trail !== []`：从文本节点出发沿父链找下一个 trail[0] 匹配的空块元素。

2. 若 TreeWalker 走完所有文本，按 `trail` 从 root 起步逐个步进找对应的空元素。

---

## 场景覆盖

| # | 场景 | save 结果 | restore 预期 |
|---|------|----------|-------------|
| S1 | 光标在文本中间 `he\|llo` | `{offset:2, trail:[]}` | 文本 pos=2 |
| S2 | 标记后空文本 `<span>- </span>\|""` | `{offset:2, trail:[]}` | 空文本 pos=0（保护标记） |
| S3 | 空行在文本后 `<div>text</div><div></div>` | `{offset:4, trail:['DIV']}` | 第二个 div pos=0 |
| S4 | 连续空行，光标在第二个 | `{offset:0, trail:['DIV','DIV']}` | 第二个空 div |
| S5 | 空行在文本前 | `{offset:0, trail:['DIV']}` | 第一个空 div |
| S6 | 文本后裸空行 "text" + `<div></div>` | `{offset:4, trail:['DIV']}` | text 的 nextSibling div |

---

## 文件变更

| 文件 | 变更 |
|------|------|
| `utils/cursor.js` | **新建**：`saveCursor`、`restoreCursor` |
| `__tests__/utils/cursor.test.js` | **新建**：覆盖上述 6 场景 + undo/redo 场景 |
| `MarkdownEditor.vue` | 替换 `saveCursorOffset` / `restoreCursorOffset`，删除旧实现 |

---

## trail 与 DOM 变化

trail 存的是 tag 名（字符串），不是 DOM 引用。scanAndHighlight 在 save 和 restore
之间修改的是元素**内部**（包 span、拆 span），元素**本身**不增删。因此 restore 时
按 tag 名从文本出发沿 nextSibling 搜索，能找到对应空元素。

trail 只记录**块级空元素**（DIV、P 等）。inline 空元素（如空 span）不影响
光标定位——光标在 inline 空元素内等同于在文本内。

---

## 非目标

- 不修改扫描器（`scanLists`/`scanContentEditable`）的 DOM 操作方式
- 不修改 undo/redo 的其他部分
- 不改变 `_undoSnapshot` / `restoreUndoState` 的调用方式（只替换内部函数名）

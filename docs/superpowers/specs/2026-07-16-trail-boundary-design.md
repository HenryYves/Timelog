# saveCursor trail 记录结构边界 Spec

> **目标**：`saveCursor` 记录光标与前一 text 之间的所有结构边界（`</div>`、`<div>`、`<span>` 等）到 trail，`restoreCursor` 按 trail 精确恢复。替代当前"跨 div 全取 next"误判。

## 问题

当前 `restoreCursor` 第 321-326 行全取跨 div 的 next text，不区分行尾光标和下行开头光标。因为两者 offset 相同。

## 方案

### saveCursor Phase 1

当前 Phase 1 命中 text node 直接返回 `trail: []`。改为：检查光标所在 text node 与前一 text node 之间的 DOM 结构。记录中间经过的所有结构标签（开标签和闭标签），用 `/` 前缀表示闭标签：

```
<div>hello</div>
<div><span>|world</span></div>
```

前一 text 是 "hello"，光标在 "world" offset=0。中间经过：`</div>`（出第一行）、`<div>`（进第二行）、`<span>`（进 span）。trail = `["/DIV", "DIV", "SPAN"]`。

```javascript
if (so === 0 && 前一 text 和光标在不同祖先后代) {
    trail = buildStructTrail(prevTextNode, currentTextNode)
}
return { offset, trail }
```

### buildStructTrail(from, to)

从 `from` 往上走直到公共祖先，记录闭标签（`/DIV`、`/SPAN`）。再从公共祖先往下走到 `to` 的父级，记录开标签（`DIV`、`SPAN`）。

```
from = "hello" text node
to = "world" text node
公共祖先 = root

往上: text → DIV → root    → ["/DIV"]
往下: root → DIV → SPAN    → ["DIV", "SPAN"]
trail = ["/DIV", "DIV", "SPAN"]
```

### restoreCursor 边界处理

删除第 321-326 行的跨 div 检查。trail 为空 → `placeAt(node, len)` 留在当前。trail 非空 → 按 trail 从当前 node 出发找目标：

1. `/TAG` → 向父级走直到该 TAG
2. `TAG`（开标签）→ 在该层级找满足条件的下一个子元素
3. 每一步找不到 → 兜底：停在最近的文本节点

## 场景覆盖

| 场景 | trail | 恢复位置 |
|------|-------|---------|
| `==1==a\|` 行尾打字 | `[]` | `placeAt(node, len)` 留当前 ✓ |
| `=\|2*` Backspace 后 | `["/DIV", "DIV"]` | 按 trail 进下一行 ✓ |
| `\|abc` 行首 | `["/DIV", "DIV"]` | 同上 ✓ |
| 行中 `12\|3` | `[]` | `placeAt(node, len)` 留当前 ✓ |

## 影响

- `saveCursor` Phase 1：+ `buildStructTrail`（~20 行）
- `restoreCursor`：删跨 div 检查（-6 行），+ trail 步进逻辑（与现有 Phase 2 trail 兼容）
- 不碰 `getOffsetInBlock`、scanner、Enter handler

## 风险

| 项 | 缓解 |
|---|------|
| 性能 | `buildStructTrail` 只走高到公共祖先，深度 ≤ 3 |
| 与现有 Phase 2 trail 冲突 | 两个 Phase 互斥——Phase 1 中会优先处理 |
| `stepTrailFrom` 不兼容 | `/TAG` 前缀区分闭标签，现有开标签逻辑不改 |

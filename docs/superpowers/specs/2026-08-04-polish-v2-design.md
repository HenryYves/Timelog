# v0.10.10 打磨 v2 — 设计文档

日期：2026-08-04
分支基线：主仓 `D:\a_my\project\html\Timelog` 的 `main`（fdf6494）
> 注：`.claude/worktrees/feat-scissors-glue`（4cc8738）已过时，不含诚实存储重构。本 spec 与后续实现全部落在主仓 main。

## 背景

诚实存储重构（70d1f86…fdf6494）落地后，E2E 使用中发现 9 条问题。本 spec 覆盖这 9 条，外加代码走查中发现的 2 个必须一起修的缺陷。

核心理念不变：**统一帧坐标 = 存储坐标**。昨天帧 `[0,1440)`，今天帧 `[1440,2880)`，明天帧 `[2880,4320)`。任何位置不得混用"本地分钟"与"统一帧分钟"。

---

## 一、核心概念补充：页面显示范围（pageRange）

现有 `useCoordConverter` 暴露 `todayRange`（今天区段的本地范围）。但多处逻辑真正需要的是**本页在统一帧下能显示的连续区间**，即包含胶水区的完整范围。

```
pageLo = fromPrev ? fromPrev.cutAt        : 1440 + (toPrev?.cutAt ?? 0)
pageHi = fromNext ? 2880 + fromNext.cutAt : 1440 + (toNext?.cutAt ?? 1440)
```

`pageRange = { lo: pageLo, hi: pageHi }`，单位为统一帧分钟，作为**唯一**的越界判定基准。新增到 `useCoordConverter` 返回值，由 EditModal / BatchCreatePanel / T 键 / 导出裁剪共同消费。

这条是第 3、7、8 条的共同根因：它们各自用硬编码 1440 或 `todayRange` 做边界判断，语义都不对。

---

## 二、逐条设计

### 1. 列宽展开（A/B/C/D 布局）

**现状**：`layout()` 把重叠传递闭包内的所有块归为一组，组内所有块 `_cols = cols.length`。所以 D 只与 C 重叠，却仍被压成 1/3 宽。

**改法**：分列不变（贪心装列），新增一趟"向右扩展"：对每个块，从它自己的列开始向右探测，若右侧相邻列在该块的 `[start, end)` 区间内无任何块占用，则 `_span += 1`，继续探测；遇到占用即停。宽度改为 `_span / _cols`，左偏移仍为 `_col / _cols`。

D 与 C 重叠、C 在列 2，则 D 在列 0，向右探测列 1 空闲、列 2 被 C 占用 → `_span = 2`，宽度 2/3。符合期望。

### 2. 统计"未记录时间"

新增 per-card 选项 `includeUnrecorded`（配置面板加一个 checkbox，文案入 `strings.js`）。

计算：
1. 对统计范围内每一天，取该天全部块的 `[start, end)` 区间，做**区间并集**（重叠只算一份）。
2. `recorded = Σ 各天并集长度`。
3. `total = days.length * 1440`。
4. `unrecorded = max(0, total - recorded)`，以伪标签"未记录"注入 card 数据，参与饼图/条形图/图例。

**明确取舍**：
- 分母固定用"天数 × 1440"，不用剪切后的显示范围。剪刀只搬运存储位置，不改变一天有 24 小时这个事实。
- 胶水块只存在于宿主天，源日不留副本，所以源日与宿主日同时在范围内时不会重复计数。
- 反过来，宿主天可能含来自范围外某天的胶水块，导致该天并集超过 1440，故用 `max(0, ...)` 夹紧。
- 并集在**块的原始统一帧坐标**上计算（同一天内不同帧不会重叠，跨帧片段各占自己的区间），不做归一化。
- "未记录"独立于 card 的标签过滤/排除：它表示"没有任何块覆盖的时间"，不受 `excludeTags` / `filterGroups` 影响。

新增 `utils/stats.js` 纯函数 `unionMinutes(blocks)` 与 `computeUnrecorded(days, blocksByDay)`，配单元测试。

### 3. T 键当前时间填充

**现状 bug**：最后一个块末尾在 glue-prev 帧时，`isPrevFrame = true`；随后 `if (isToday && s > nowMin) s = nowMin` 把 `s` 换成今天的本地分钟，但 `isPrevFrame` 没跟着改，于是 `s` 被当昨天帧写入 → 出现 `-09:16`。`end` 同样错。

**改法**：整段改为在统一帧下算，取消 `isPrevFrame` 这个易错的布尔：

```
nowUnified = 1440 + nowMin                       // 仅日历当天有意义
s = blocks.length ? max(b.end) : pageRange.lo    // 统一帧
if (isTodayPage && nowUnified in pageRange && s > nowUnified) s = nowUnified
s = clamp(s, pageRange.lo, pageRange.hi - 1)
end = (settings.endTimeAtNow && isTodayPage && nowUnified > s && nowUnified <= pageRange.hi)
      ? nowUnified
      : min(s + settings.defaultDuration, pageRange.hi)
createTimes = { start: s, end }                   // 直接给统一帧，不再走 todayLocalToStorage
```

`isTodayPage` 复用红线那套判断（`nowInToday` 的语义），即"当前时间落在本页显示范围内"，而非单纯 `dkey(now) === dateKey`。非"今天"页一律用 `defaultDuration`，符合你的期望。

### 4. 点击 vs 拖动判定

**现状 bug**：block 上 mousedown 冒泡到 `.day` 触发 create 拖拽；`endDrag` 用 `b.en - b.s < 3`（3 **分钟**）判定放弃，随后 click 又打开编辑器 → "拖动变成打开编辑器"。

**改法**：改成按**像素位移**判定。`onDayMouseDown` 记录起始 `clientX/clientY`，create 拖拽先进入 pending 态；`onMouseMove` 中位移 > 3px 才真正起 ghost、置 `dragged = true`。`mouseup` 时：`dragged` → 提交创建并 `suppressClick = true`；未 `dragged` → 不创建，让 click 走原有语义（点空白清选中 / 点块开编辑器）。

去掉 `b.en - b.s < 3` 这个分钟阈值——最小时长已由 `settings.minBlockMinutes` 的确认框负责。

### 5. 标签自动排序 + 拖拽排序

TagManager 加"排序"按钮：按**分组名**升序、组内按**标签名**升序（`localeCompare`，中文按拼音/Unicode 由浏览器决定，WebView2 单一实现无需 fallback）。无分组（`group === ''`）排在最后。

拖拽排序：每行加 `draggable="true"`，HTML5 drag 事件在 `tagDraft` 数组内换位。排序与拖拽都只改 `tagDraft`，**保存时才落盘**，与现有"取消即丢弃"语义一致。

注意：现有重命名检测依赖 `origNames` 与 `tagDraft` **同下标**比对。排序/拖拽会破坏这个假设。改为给每行加稳定 `_uid`，`origNames` 存 `Map<_uid, 原名>`，重命名检测按 `_uid` 匹配。这是第 5 条的隐藏前置条件。

### 6. 十六进制颜色输入

每行在 `<input type="color">` 旁加一个文本输入，接受 `#RGB` / `#RRGGBB`（大小写不敏感，可省略 `#`）。双向绑定：文本合法即写回 color；color 变化即回填规范化的 `#RRGGBB`。非法输入 blur 时回退上一个合法值。校验/规范化复用 `tagStore.normColor`，不足则补齐该函数并加测试。原生取色器保留。

### 7. 跨界拖动创建，结束时间偏移 24h

**现状 bug**：Timeline 发出的 `create-block` 已是统一帧；App 传给 EditModal 的 `createTimes` 也是统一帧；但 EditModal 用 `storageToLocal(cTimes.start, cTimes.end)` 换算，而该函数**只按 start 的帧**决定平移量，对 start/end 同减一个偏移。start=1400（昨天帧）、end=1500（今天帧）时不减 → end 显示 `25:00`；反向情形则差 24h。

**改法**：EditModal 的填表改为**逐端点独立判帧**：

```
frameOf(x) = x < 1440 ? 0 : x < 2880 ? 1440 : 2880
// end 落在帧边界时归前一帧（1440 → 昨天帧 24:00，2880 → 今天帧 24:00）
frameOfEnd(x) = x <= 1440 ? 0 : x <= 2880 ? 1440 : 2880
mStart = formatSignedTime(s - frameOf(s), frameOf(s))
mEnd   = formatSignedTime(e - frameOfEnd(e), frameOfEnd(e))
```

`storageToLocal` 只在此处被这样误用，改完后该函数在 EditModal 的调用点全部移除（其它调用点另行核查，无用则删除函数）。

### 8. 越界比较用错基准

**你的复现**：今天页上开始时间 `-12:00`（昨天帧 720），保存时提示"超出今天范围，00:00 之前的部分会存到前一天"。

**根因**：EditModal 的 split 判定用 `todayUStart = 1440 + toPrev.cutAt`（今天区段下界）。但本页若有 glue-prev，`-12:00` 本来就在本页显示范围内、就该存在本页，不该被切走。判定基准错了。

**改法**：split 判定改用 `pageRange`：
- `us < pageRange.lo && ue > pageRange.lo` → 溢出下界段存入前一天（坐标 `+1440`），本页段从 `pageRange.lo` 起。
- `us < pageRange.hi && ue > pageRange.hi` → 溢出上界段存入后一天（坐标 `-1440`），本页段止于 `pageRange.hi`。
- 两个 `if` 独立，可同时命中（现有的双边界 + 同 ID 合并逻辑保留）。

确认框文案同步改为按 `pageRange` 边界描述（用 `fmtSigned` 输出带符号时间），不再写"00:00"。

**顺带修（同一入口，必须一起改）**：两个时间输入的 `pattern="[+-]?\d{1,2}:\d{2}"` 在 WebView2 的 `v` 模式正则下报 `Invalid character in character class`——`-` 是 `v` 模式的语法字符。改为 `[+\-]?\d{1,2}:\d{2}`。全仓扫一遍同类 pattern。

**BatchCreatePanel 同源问题**：`cap = start < 1440 ? 1440 : start < 2880 ? 2880 : 4320` 按帧边界截断，应改为按 `pageRange.hi` 截断。

### 9. 右键拖拽框选无法使用

两个确认的缺陷：

1. **不可见**：`.selrect` 是 `position: absolute` 且 CSS 无 `left/right/width`，模板只绑 `top/height` → 元素横向塌缩到 0 宽，只剩 1px 边框。改为绑定 `left` 与 `width`（用 `selRect` 已有的 `left/right` 算），或 CSS 补 `left: 0; right: 0`。取前者——框选本就有横向语义（`onMouseUp` 里已用 `selLeft/selRight` 做命中判定）。
2. **选中被立刻撤销**：`onMouseUp` 先把 `selMoved = false`，而 `contextmenu` 在 mouseup **之后**才派发；`onBlockContextMenu` 里的 `if (selMoved) return` 因此永不生效，落点所在块被 toggle 掉。改为在 `contextmenu` 处理后再复位——用一次性标记：mouseup 时若发生过框选则置 `suppressContextMenu = true`，`onBlockContextMenu` 命中即 return 并清标记。

---

## 三、走查发现，必须一并处理

- **`storageTimesForNewDisplayBlock` 未定义**：`Timeline.vue:783`（`doPaste`）调用了一个既未导入也未定义的函数 → 粘贴必抛 `ReferenceError`。诚实存储下不需要任何换算，直接用统一帧 `s/en`，删掉该调用。
- **`utils/displayBlocks.js` 已成孤儿**：`toDisplayBlock` / `todayStorageOffset` 无任何消费方（诚实存储后不再需要）。连同其测试一并删除，避免后人误用旧欺骗语义。

---

## 四、验证

- 单测：`layout` 列宽展开、`unionMinutes` / `computeUnrecorded`、`pageRange` 各剪切组合、EditModal split 边界（含双边界与 `-12:00` 复现用例）、逐端点判帧、`normColor` 十六进制解析。
- 全量 `cd frontend && npm test` 通过。
- `npx vite build` 通过（frontend 目录下执行）。
- 交互项（4、5、9 与 T 键）纯前端，`npm run dev` 浏览器手验；不涉及 Rust，无需 `tauri dev`。

## 五、不做

- 不动 `_cutMeta` 结构与 cutDay/glueBack 算法本身。
- 不重构 Timeline 的整体拖拽架构，只改判定阈值与 pending 态。
- 不为统计"未记录"做跨天区间归一化（见第 2 条取舍）。

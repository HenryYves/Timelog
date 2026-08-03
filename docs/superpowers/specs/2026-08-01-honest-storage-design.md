# 诚实存储——统一存储坐标重构

> 日期：2026-08-01 | 基于 gluesplit 分支

## 核心原则

**诚实存储**：时间块在 localStorage 中永远以统一帧坐标存储，不受剪切操作影响。

| 帧 | 坐标 | 含义 |
|----|------|------|
| 昨天帧 | `[0, 1440)` | glue-prev（从昨天剪来的） |
| 今天帧 | `[1440, 2880)` | 今天自己（1440 + 本地分钟） |
| 明天帧 | `[2880, 4320)` | glue-next（从明天剪来的） |

规则：`00:31` 永远存 `1471`。剪切只做 ±1440 平移，不产生局部偏移存储。

显示偏移仅在渲染层——blockTop 的 today 区段减 `todayRange.start`。

## 数据层（timelog.js）

### 函数简化

**todayStorageBase** → 永远返回 `1440`。

**todayLocalToStorage(s, en)** → `{ start: s + 1440, end: en + 1440 }`。

**storageToLocal(start, end)** → 纯帧检测：
```js
if (start >= 1440 && start < 2880) return { start: start - 1440, end: end - 1440 }
if (start >= 2880) return { start: start - 2880, end: end - 2880 }
return { start, end }  // [0, 1440) 昨天帧
```

**localToStorage(s, en, frame)** → 去掉 cutMeta：
```js
if (frame === 'today') return { start: s + 1440, end: en + 1440 }
if (frame === 'next') return { start: s + 2880, end: en + 2880 }
return { start: s, end: en }
```

**unifiedToStorage(x)** → 去掉 cutMeta，纯帧检测。

### cutDay 简化

cutAt 统一使用 `1440 + localCutAt`。

**Forward（便是明朝）**：
- glue-prev 块（`_cut`，`[0,1440)`）→ toStay
- glue-next 块（`_cut`，`[2880,4320)`）→ toStay
- 今天块 `[1440,2880)`：start ≥ cutAt → move（-1440），跨线 split，其余 stay

**Backward（溯与昨宵）**：
- glue-prev 块（`_cut`，`[0,1440)`）→ 回家 +1440
- glue-next 块（`_cut`，`[2880,4320)`）→ toStay
- 今天块 `[1440,2880)`：end ≤ cutAt → move（+1440），跨线 split，其余 stay

多次剪切合并：toNext.cutAt = min(...)，toPrev.cutAt = max(...)。

### glueBack 简化

- meta 驱动：根据 host.fromPrev / host.fromNext 确定胶水区
- 移回：±1440 入 source today 帧
- 空胶水区（meta 存在但 0 块）→ 成功归还空时间
- 无 meta → 退回到 `_cut.sourceDate` 匹配

### _loadDay v1 迁移（保持）

v1 数组 → 非 `_cut` 块 +1440，`_cut` 块不变 + 合成 meta。

## 渲染层（useCoordConverter）

blockTop/minuteToY 的 today 区段：`prev + (start - 1440 - todayRange.start) * PX_MIN`

prev/next 区段不变。

## Timeline 简化

删除 `toDisplayBlock`、`toStorageFromDisplay`、`todayStorageOffsetForOrig`、`storageTimesForNewDisplayBlock`。

`displayBlocks = store.blocks`（存储 = 显示）。

endDrag/resize/clipboard：直接操作统一坐标。

nowLineY / nowInToday：today 区段优先于 glue-prev（修正 #12）。

## EditModal 简化

parseSignedTime 直接返回 `{frame, minute}`（帧由符号确定）。

toStorage = frame + minute（无 base 换算）。

### 穿界 split（修正 #4）

**toPrev 溢出**：`[localStart*1440, tr.start*1440)` → `+1440` → yesterday 存储

**toNext 溢出**：`[tr.end*1440, localEnd*1440)` → `-1440` → tomorrow 存储

splitKey 用统一坐标（已由解析的 `frame+minute` 得到）。

## App / T 键简化

todayLocalToStorage: `{ start: 1440+s, end: 1440+end }`。

扫描所有块：`Math.max(...store.blocks.map(b => b.end))`。

## 导出简化

ExportPanel：移除 `toDisplayBlock`，直接 `store.blocks`，`fmtSigned` 按统一帧格式化。

## BatchCreate

parseTimeToken 已按 frame+minute → unified 工作，保持不变。

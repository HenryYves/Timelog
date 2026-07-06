# Deep Behavioral Audit: OLD vs NEW Timelog

Audit completed 2026-07-06. Each finding is categorized and referenced to old (src/index.html) and new (frontend/src/) line numbers.

---

## 1. Date/Time handling

### 1.1 `dkey()` — Same
**SAME**. Both produce `YYYY-MM-DD` with zero-padded month/day. No difference.

- Old line 462: concatenation with `padStart(2, '0')` on month and day
- New `timelog.js:6-10` + `backup.js:48-52`: identical logic

### 1.2 `fmt()` — DIFFERENT
**DIFFERENT**: Hours are now zero-padded to 2 digits.

| Input | Old (line 478) | New (`timelog.js:12-15`) |
|-------|----------------|--------------------------|
| 0     | `"0:00"`       | `"00:00"`                |
| 60    | `"1:00"`       | `"01:00"`                |
| 540   | `"9:00"`       | `"09:00"`                |
| 1440  | `"24:00"`      | `"24:00"`                |

**Impact**: Affects block time display, drag label, export text format, block title tooltip, ghost label.

### 1.3 `toInput()` / `fromInput()` — ALMOST SAME
- `toInput`: Identical (old line 479, new `timelog.js:17-20`).
- `fromInput`: Slightly different error handling. Old (line 480) uses `parseInt(p[0],10)||0` which coerces NaN to 0. New (`timelog.js:22-25`) uses `Number()` which produces NaN for non-numeric input. **Impact**: Truly garbage input (e.g. `"abc"`) returns NaN in new vs 0 in old. For all real inputs (time fields from browser) behavior is identical.

### 1.4 Date navigation — ALMOST SAME
Both use `setDate(getDate() +/- 1)`. Old mutates the global `curDate` Date object in-place; new creates a new Date object each time (old line 601, new `timelog.js:112-126`). **Net same behavior**.

**KEY DIFFERENCE**: Old explicitly clears `selectedBlocks` on every date navigation (line 601-603). New does NOT (timelog.js `setDate` calls `loadBlocks()` only). The selected Set persists across dates, but has no visible effect because the new day's blocks have different IDs.

---

## 2. Block CRUD

### 2.1 Block ID generation — DIFFERENT
- Old (line 474, `newId()`): `'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)`
- New in `timelog.js:95` (`pasteBlocks`): `'b' + Date.now() + Math.random().toString(36).slice(2,6)` — **no base36 on timestamp**
- New in `EditModal.vue:197`: `'b' + Date.now() + ...` — same, no base36
- New in `Timeline.vue:426` (paste): `'b' + Date.now().toString(36) + ...` — **has base36** (matches old)
- New in `ExportPanel.vue:167` (text import): `'b' + Date.now() + ...` — no base36

**INCONSISTENCY**: New code has THREE different ID formats. Only Timeline.vue's paste matches old's `newId()` format (base36 timestamp).

### 2.2 Save block — Same field names
**SAME**: Both produce `{ id, start, end, title, note, tags }`. Same `end <= start → end = start + 1` guard. Old line 540, new `EditModal.vue:192-207`.

### 2.3 Delete block button — DIFFERENT confirmation
- **Old** (line 534): Deletes directly with NO confirmation dialog.
- **New** (`EditModal.vue:210-216`): Shows confirmation dialog (`STR.confirm.deleteBlock`: "确定删除该时间块？").
- **Delete key shortcut** (`App.vue:337-343`): No confirmation in either (same as old).

### 2.4 Delete key in modal — IMPLEMENTED but expanded
Old (line 610) checks `Delete` key only. New (`App.vue:337-343`) checks both `Delete` and `Backspace`. Same no-confirmation behavior. Both check `document.activeElement.id !== 'mNote'`.

---

## 3. Multi-select & clipboard

### 3.1 Right-click toggle — DIFFERENT toast behavior
- **Old** (line 502): Always shows toast. Deselecting → "已取消勾选". Selecting → "已勾选 N 个..."
- **New** (`Timeline.vue:338-348`): Toast only when deselecting LAST item ("已取消勾选") or when SELECTING. **Deselecting one item among many silently removes it** (no toast).
- Old also calls `render()` after each change; new relies on Vue reactivity (no explicit re-render).

### 3.2 Copy selected — DIFFERENT (missing toast)
- **Old** (line 607): `copySelected()` includes `toast('已复制 N 个...')`.
- **New** (`timelog.js:75-86`): `copySelected()` returns boolean only. **The Ctrl+C key handler in Timeline.vue:373-375 does NOT show a toast**. The copy-block button in EditModal does have toast via `STR.toast.copyBlock`.

**Impact**: Ctrl+C on selected blocks gives no user feedback in the new code.

### 3.3 Paste — Same logic, DIFFERENT (missing toast)
- Both use same offset logic (old line 608, new `Timeline.vue:410-437`): `anchor = Math.round(lastHoverMin/5)*5; offset = anchor - minStart`.
- **Old paste**: Shows toast with anchored position or "(原时间)".
- **New paste**: No toast at all.

### 3.4 ESC clears selection — Implemented
Old (line 610): clears selection after checking all overlays and dropdown. New (`Timeline.vue:395-399`): clears selection, shows toast "已取消勾选". Old also calls `render()`, new calls `clear()` on Vue reactive Set.

**BUT**: New's ESC handler is guarded by `if (props.modalOpen) return` (line 353). If EditModal is open, ESC won't clear selection. The old code's anyModalOpen() check is broader (all overlays), so old would also block clearing when ANY overlay is open. **Same effective behavior**.

---

## 4. Drag system

### 4.1 Create drag minimum — Same value, different feel due to PX_MIN
Both check `b.en - b.s < 3` (3-minute minimum). But old `PXMIN=1` vs new `PX_MIN=1.33` means:

| Aspect | Old | New |
|--------|-----|-----|
| Visual density | 1px = 1min | 1.33px = 1min (more compressed) |
| Drag distance for 3min | 3px | ~4px (3min * 1.33 ≈ 4px) |
| 1 hour visual height | 60px | ~80px |

This affects ALL visual rendering (block heights, scroll positions, ghost positioning).

### 4.2 Resize drag edge detection — Same
Both use `EDGE=6`, both clamp with `Math.min(EDGE, r.height/2)`.

### 4.3 ArrowUp/Down fine-tune — Same
Both adjust ±1 minute during drag.

### 4.4 Escape cancels drag — Same
Both call `endDrag(false)`.

### 4.5 Ghost element — DIFFERENT (no text)
- **Old** (line 514): Ghost div has `textContent = fmt(b.s)+' – '+fmt(b.en)` — shows time range directly inside the ghost.
- **New** (`Timeline.vue:87-91`): Ghost div is empty (no content), only positioned. The time info is shown in the separate dlabel element only.
- Dlabel format is identical between old and new.

---

## 5. Modal interactions

### 5.1 ESC closes topmost overlay — Different structure, same effect
Old (line 610): Checks all overlays in priority order. Special handling for dialog (`closeDialog(false)`) and import (`pendingImport=null`).
New (`App.vue:326-335`): Linear if-chain over boolean state variables.
- **Same**: Both close the topmost visible overlay on ESC.
- **ConfirmDialog**: New handles ESC via `@keydown.escape.stop` on ConfirmDialog itself; old handles it in the global handler via dlgOverlay check.

### 5.2 Tab focus trap — DIFFERENT (partially missing)
- **Old** (line 610): Universal focus trap that works on ALL overlays (including Settings, TagManager, Export, DataManager).
- **New**: Focus trap only in `EditModal.vue:231-247`, `HelpPanel.vue:66-82`, and `ConfirmDialog.vue:51-68`. **Missing** in SettingsPanel, TagManager, ExportPanel, DataManager.

**Impact**: Tab key doesn't cycle focus within Settings, Tag Manager, Export Panel, or Data Manager modals.

### 5.3 Click overlay backdrop closes — Same for most
All overlays close on backdrop click in both. Old `dlgOverlay` did NOT support backdrop click; New `ConfirmDialog` now does (`@mousedown.self="$emit('close')"`).

### 5.4 Enter on title field saves — Same
Old line 610: `if(e.key==='Enter'&&e.target.id==='mTitle'){saveBlock();}`. New `EditModal.vue:13`: `@keydown.enter.prevent="save"`. Same behavior.

---

## 6. Global keyboard shortcuts

### 6.1 T key — Same
Same quick-create logic: round to nearest 5 minutes, min 1380, default duration clamped to 1440.

### 6.2 ? key — Same
Both open help panel when no modal is open and not in a text field.

### 6.3 Delete/Backspace when blocks selected — DIFFERENT guard
- **Old** (line 610): Guarded by `!anyModalOpen()` — prohibits delete when ANY overlay is open.
- **New** (`Timeline.vue:386-391`): Guarded only by `props.modalOpen` (EditModal-specific flag). **Can delete blocks while non-EditModal overlays (Settings, Help, Manage, Tags) are open.**

### 6.4 Ctrl+C/V — Same
Both check `(e.ctrlKey || e.metaKey)`.

---

## 7. Scroll & auto-scroll

### 7.1 `scrollToNow()` calculation — Same formula, different value
Formula: `max(0, min * PX_MIN - 160)`.
- Old PXMIN=1: scrollTop = min - 160
- New PX_MIN=1.33: scrollTop = min * 1.33 - 160

**Impact**: Default scroll position is farther down in new (e.g., at 9:00: old = 380px, new ≈ 558px).

### 7.2 Nowline auto-updates — NEW FEATURE
- **Old**: Nowline created once during `render()`, never updates.
- **New** (`Timeline.vue:451-453`): `setInterval(updateNowMin, 60000)` — updates nowline position every 60 seconds.

---

## 8. Export

### 8.1 Text export (`buildExport()`) — Different `fmt()` output
Same structure and regex. Output differs because `fmt()` now zero-pads hours. Parse is compatible (regex accepts 1-2 digit hours `(\d{1,2})`).

### 8.2 JSON export — DIFFERENT data structure
- **Old** (line 473 `getAllData()`): `{ app: 'timelog', version: 2, updatedAt, tags, days }` — includes `tags` field.
- **New** (`App.vue:200-231` `doExportJson()`): `{ version: 1, exported, days }` — **NO `tags` field, `exported` instead of `updatedAt`, `version: 1` instead of 2, no `app` field**.

**Impact**: Manual JSON exports are incompatible between old and new format. Backup files (via `doAutoSave()` in backup.js) still use `getAllData()` with the old structure.

### 8.3 Text import (`parseImportText()`) — Same
Identical regex and logic. Only ID generation differs (decimal vs base36 timestamp).

### 8.4 JSON import — Same filtering options
Same date range filter, time range filter, merge/replace mode, deduplication logic.

---

## 9. Backup

### 9.1 `scheduleSave` — Same
Both check Tauri and backupOn, debounce 500ms (old line 650, new `backup.js:169-173`).

### 9.2 `scheduleClean` — Same
Both once-per-day via `lastCleanDate` localStorage key, same 500ms debounce (old line 651, new `backup.js:175-185`).

### 9.3 `rotateBackups` — Same
Same regex `/^timelog-backup-\d{4}-\d{2}-\d{2}\.json$/`, same max count of 4.

### 9.4 `migrateBackups` — Same logic
Same migration pattern, uses `T.core.invoke` in both. New code's `resolvePath` helper is cleaner but functionally identical.

---

## 10. Settings

### 10.1 `applyBorderless` — Same
Both toggle `classList` on `#winCtrls` and `document.body`, both call `setDecorations()`.

### 10.2 Validation — Same
- `setDuration`: clamped `>=1` with fallback to DEFAULT_DURATION (30).
- `setBlockOpacity`: no clamping (same as old).
- `setKeepDays`: clamped `>=0`.

### 10.3 Opacity live preview — DIFFERENT (broken)
- **Old** (line 704): `elOp.addEventListener('input',()=>{...render();})` — live preview on slider drag.
- **New** (`SettingsPanel.vue:129-131`): `onOpacityInput` calls `settings.setBlockOpacity(v)` which updates localStorage. **Does NOT trigger a re-render**. Blocks visually update only on next date change or block save.

---

## 11. Edge cases

### 11.1 Empty blocks — Handled (Same)
### 11.2 Corrupted localStorage — Caught (Same)
### 11.3 Empty tag names — Filtered (Same)
### 11.4 Cross-midnight blocks — Handled (Same)

---

## 12. Other differences

### 12.1 `PX_MIN` changed from 1 to 1.33 — DIFFERENT
Affects every visual rendering calculation: block heights, scroll positions, drag tracking, nowline position. The timeline is visually more compressed horizontally per minute, meaning each minute occupies more pixels (~1.33px vs 1px).

### 12.2 Default tags completely changed — DIFFERENT
| Pattern | Old | New |
|---------|-----|-----|
| Tags | 9 tags (很自律, 自律, 不太自律, 工作, 学习, 自我提升, 日常生活, 休息, 娱乐) | 6 tags (专注, 摸鱼, 学习, 工作, 运动, 社交) |
| Colors | Green-based palette | Blue/gray/red palette |
| Groups | 自我评价, 正事, 生活 | 自我评价, 正事, 生活 |

### 12.3 `normColor()` — Expanded validation
Old only checks `charAt(0) === '#'`, falls back to PALETTE then '#8A8A8A'. New handles 3-digit hex expansion (`#abc` → `#aabbcc`), missing `#` prefix, and empty/whitespace input. Fallback: '#C4C3C0'.

### 12.4 `colorOf()` — Two implementations with different fallbacks
- `timelogStore.colorOf()`: Fallback `#8A8A8A` when tag not found (same as old).
- `tagStore.colorOf()`: Fallback `#C4C3C0` when tag not found (different from old).

### 12.5 Block title tooltip — MISSING (DIFFERENT)
- Old (line 497): `el.title = ...` sets native tooltip with time range, title, tags, and note.
- New (Timeline.vue): **No `:title` attribute on block elements**. Native tooltip is completely missing.

### 12.6 Window title — DIFFERENT
Old: "时间块记录". New: "Timelog".

### 12.7 Logo icon path — DIFFERENT
Old: `src="icons/icon.svg"`. New: `src="/icons/logo.svg"` (leading slash).

### 12.8 Tauri window state restoration — MISSING
Old (line 742-743): Restores window position/size via `windowState.restoreStateCurrent`. New: No window state restoration.

### 12.9 Text export area resize — DIFFERENT
New CSS adds `resize: vertical` to export textarea (old had non-resizable).

### 12.10 Toast duration — DIFFERENT
Old: 1600ms. New: 1800ms (`TOAST_DURATION` in constants.js).

### 12.11 TagManager save — In-memory tag cleanup discrepancy
New `TagManager.vue`'s `removeTagFromBlocksAll()` only updates localStorage. But the timelogStore blocks (in-memory) are NOT updated for deleted tags. However, `loadBlocks()` is called in the `onTagMgrSaved` callback, which re-reads from localStorage. **Same end result** as old.

### 12.12 Data manager has built-in import — NEW FEATURE
Old manage overlay has no import. New DataManager.vue includes "导入备份" section that does merge-only JSON import with no filtering options.

### 12.13 Key-prefix changed from `'timelog:'` hardcoded to `KEY_PREFIX` constant
Same value (`'timelog:'`) but the old code hardcodes it, new code uses `KEY_PREFIX` constant.

### 12.14 Logging system — NEW
New code has a structured logging module (`utils/log.js`) with console output and localStorage buffer. Old code had no logging.

### 12.15 Unit tests — NEW
New code has `__tests__/` directory with tests for timelog store, tags store, and markdown utils.

### 12.16 Vue error capture — NEW
New `App.vue:382-386` has `onErrorCaptured` hook for Vue error logging.

### 12.17 Confirm dialog backdrop click — NEW
New ConfirmDialog supports closing via backdrop click (`@mousedown.self`). Old dlgOverlay did not.

### 12.18 Tag rename confirmation flow — Same
Both ask user "是否将已有记录中的...替换为..." with confirm dialog.

### 12.19 Window maximize/restore button image — NEW REACTIVE
New toggle maximizes and changes icon between win-max.svg and win-restore.svg. Old set icon statically and tracked state via `_winMaxed`.

---

## Summary of behavioral impact by severity

### Data-loss risk
1. **JSON export missing tags field**: Manual "导出备份" creates `{ version:1, exported, days }` without tags. Importing this backup loses all tag definitions.
2. **Opacity slider no-op**: No visual feedback until next page change.

### Usability regressions
3. **Missing block tooltip**: No native hover tooltip on time blocks.
4. **Copy/Paste no feedback**: Ctrl+C and Ctrl+V don't show toast.
5. **Focus trap missing**: Settings, Tag Manager, Export, Data Manager panels don't trap Tab focus.
6. **Delete works in non-EditModal overlays**: Delete/Backspace can delete blocks while Settings/Help/etc. are open (old blocked this).
7. **Selection persists across dates**: `selectedBlocks` Set stays populated after date navigation.

### Inconsistencies
8. Three different block ID formats in new code (Timeline paste matches old, rest don't).
9. `fmt()` zero-pads hours — changes exported text format.
10. `colorOf()` has two implementations with different fallback colors.
11. PX_MIN = 1.33 alters all visual dimensions (intentional design choice, but changes rendering).

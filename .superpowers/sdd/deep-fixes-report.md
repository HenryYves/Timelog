# Deep Audit Fixes Report

Date: 2026-07-06
All 10 issues resolved. Build: PASS (0 errors).

---

## Fix 1: JSON export missing tags field (CRITICAL)
**File:** `frontend/src/App.vue` — `doExportJson()`
**Change:** Added `tags` field read from `localStorage.getItem('timelog:tags')`, included in export data object. Version bumped from 1 to 2 to match old format.

## Fix 2: Export text wrapping CSS (CRITICAL)
**File:** `frontend/src/style.css`
**Change:** Added `#exText { white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; overflow-x: hidden; }` rule.

## Fix 3: Ghost drag positioning (HIGH)
**File:** `frontend/src/components/Timeline.vue` — `ghostStyle` computed
**Change:** Added `left: '2px'` and `right: '2px'` to the ghost style return object.

## Fix 4: Block tooltip title attribute (HIGH)
**File:** `frontend/src/components/Timeline.vue`
**Change:** Added `:title="blockTitle(ev)"` to the block `<div>`. Added `blockTitle(ev)` function producing format: `"9:00–10:30  title  [tag1,tag2]\nnote"`.

## Fix 5: Ctrl+C/V toast feedback (HIGH)
**File:** `frontend/src/components/Timeline.vue`
**Change:** 
- Ctrl+C handler now calls `toast(STR.toast.copied(store.clipboard.length))` after successful copy.
- `doPaste()` now calls `toast(STR.toast.pasteResult(newBlocks.length, anchored))` after paste.

## Fix 6: Focus trap in 4 missing modals (MEDIUM)
**Files:** `SettingsPanel.vue`, `TagManager.vue`, `ExportPanel.vue`, `DataManager.vue`
**Change:** Added `@keydown="trapFocus"` on each `.modal` div and the `trapFocus()` function (from EditModal.vue) to each component's script setup.

## Fix 7: Delete/Backspace blocked when any overlay open (MEDIUM)
**File:** `frontend/src/components/Timeline.vue` — keyboard handler
**Change:** Added `if (document.querySelector('.overlay')) return` guard before the Delete/Backspace handler to prevent deletion when any modal overlay is visible.

## Fix 8: Clear selection on date navigation (MEDIUM)
**File:** `frontend/src/store/timelog.js` — `setDate()`
**Change:** Added `selectedBlocks.value.clear()` in `setDate()` to clear block selection on every date change.

## Fix 9: fmt() hours padding (MEDIUM)
**File:** `frontend/src/store/timelog.js` — `fmt()`
**Change:** Removed `.padStart(2, '0')` from the hours part. Old behavior: `Math.floor(min/60)` → "9:00", not "09:00".

## Fix 10: Title text (MEDIUM)
**File:** `frontend/src/App.vue` — header
**Change:** Removed standalone `<img src="/icons/logo.svg">` outside `<h1>`. Changed `<h1>Timelog</h1>` to `<h1><img src="/icons/icon.svg" class="logo" alt="">时间块记录</h1>` (icon.svg, not logo.svg; logo inside h1).

---

## Build Result
```
cd D:/a_my/project/html/Timelog/frontend && npx vite build
✓ built in 821ms
✓ 64 modules transformed
```
No errors, no warnings.

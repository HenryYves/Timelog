# Task Fidelity Report

## Date: 2026-07-06

## Summary

All 5 categories of issues fixed and `vite build` passes cleanly (66 modules, 0 errors).

| Fix | File(s) | Status |
|-----|---------|--------|
| Fix 1: Destructure `selectedBlocks` / `colorOf` in template | `Timeline.vue` | Done |
| Fix 2: Restore `MAIN_NAME` / `DATA_DIR` to old values | `constants.js` | Done |
| Fix 3: Remove stray "导出日志" button, restore old layout | `SettingsPanel.vue` | Done |
| Fix 4: Restore full sub text in tag manager | `TagManager.vue` | Done |
| Fix 5: Separate text import from text export | `ExportPanel.vue`, `App.vue` | Done |

---

## Fix 1: Timeline.vue — missing destructuring

**Problem:** Template used `selectedBlocks.has(ev.id)` and `colorOf(t)` but these weren't top-level bindings in `<script setup>`.

**Fix:** Destructured from store at script level:
```js
const { selectedBlocks, colorOf } = store
```
Also changed `store.colorOf(...)` in `computeBlockStyle` to bare `colorOf(...)`.

## Fix 2: constants.js — wrong file/dir names

**Changed:**
- `MAIN_NAME`: `'timelog-data.json'` → `'timelog.json'`
- `DATA_DIR`: `'timelog-data'` → `'timelog_data'`

## Fix 3: SettingsPanel.vue — extra button

**Removed** the "导出日志" button from the actions row and its `import { exportLogs }` import. The old settings modal only has a "关闭" button.

## Fix 4: TagManager.vue — truncated sub text

**Restored** the full sub title text from old index.html line 347:
- Before: `点左侧色块自定义颜色；相同"分组"的标签会归类显示。`
- After: `点左侧色块自定义颜色；相同"分组"的标签会归类显示（如"很自律"与"自律"放同一组）。`

## Fix 5: Text import/export separation

**Problem:** Both "文本导入" (dropdown) and "导出文本" (header button) opened the same ExportPanel which combined both features. The old code had two separate overlays (`txOverlay` / `exOverlay`).

**Fix:**
- Added `mode` prop (`'export'` | `'import'`) to `ExportPanel.vue`
- `mode='export'`: readonly textarea + copy button (matches old `exOverlay`)
- `mode='import'`: editable textarea, date picker, merge/replace radio, preview, confirm button (matches old `txOverlay`)
- `App.vue` tracks `exportMode` ref: "导出文本" → `'export'`, "文本导入" → `'import'`
- Text import logic (`parseImportText`, confirm handler) replicates old `index.html` behavior including auto-tag-creation and scheduleSave

## Build

```
npx vite build
✓ built in 831ms
66 modules transformed, 0 errors
```

---

## Git History — Feature Audit

Comparing commits `52cba62..4b66c95` (old codebase features) against the refactored Vue build:

| Feature | Commit | Status |
|---------|--------|--------|
| Cat paw cursor on header (`7aefd65`) | style.css line 22 | Present |
| Header drag for window move (`e814ac1`) | App.vue `onHeaderMouseDown` | Present |
| **Window state restore** (`e814ac1`) | Old: `restoreStateCurrent` at init | **Missing** |
| Borderless window API (`b56a35e`) | App.vue `applyBorderless()` | Present |
| Custom alert/confirm dialog (`4c801de`) | ConfirmDialog.vue | Present |
| Tag rename confirmation (`d5d37f6`) | TagManager.vue `onSave` | Present |
| Keep N days auto-clean (`4799b78`) | backup.js `cleanOldDays` | Present |
| Delete all button (`2aa997e`) | DataManager.vue `deleteAll` | Present |
| Enter key nav in inputs (`b300a61`) | EditModal.vue `focusFirstChip` | Present |
| Tab indent in export (`52e7c23`) | ExportPanel.vue `buildExport` | Present |
| One-way scroll sync (`45c5b1f`) | EditModal.vue `syncScroll` | Present |
| "已连接" → "备份可用" (`52cba62`) | backup.js `setBk` text | Present |

**Notable missing:**
1. **Window state restoration** — Old init code called `window.__TAURI__.windowState.restoreStateCurrent(StateFlags.ALL)` on launch. The Vue refactoring does not include this call.
2. **Block resize cursor** — Old code has a `mousemove` handler on each block element that sets `cursor: ns-resize` when hovering near the top/bottom edge. The Vue `Timeline.vue` does not implement this cursor hint — resize works but the visual affordance is lost.

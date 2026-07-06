# Timelog Vue 3 Refactoring — Code Quality Audit

**Date:** 2026-07-06
**Scope:** `frontend/src/` (27 files)
**Auditor:** Claude Code

---

## Executive Summary

27 files audited. **1 CRITICAL, 5 HIGH, 12 MEDIUM, 14 LOW** findings. The most urgent issue is a `ReferenceError` waiting to happen in the Delete-key handler of `App.vue`. Beyond that, the main structural problems are: (a) a dual-path DOM/reactive approach to drag interactions in `Timeline.vue` that will cause glitches under Vue re-render, (b) a computed that mutates store state as a side-effect, and (c) widespread duplication of utility code (`trapFocus`, `isDayKey`, `applyBorderless`, color helpers, ID generation) across 6+ components.

---

## CRITICAL

### C-1: `timelogStore` is not defined in App.vue (undefined variable reference)

- **File:** `src/App.vue`, line 341
- **Category:** Potential bugs
- **Issue:** In the `onWindowKeyDown` handler, the Delete/Backspace branch calls `timelogStore.deleteBlock(editingBlock.value.id)` but the variable is named `store` (line 107: `const store = useTimelogStore()`). `timelogStore` is never defined in `App.vue`'s scope. This will throw a `ReferenceError` at runtime when the user presses Delete or Backspace while editing a block (modal open, with `editingBlock` truthy, and the active element is not the note textarea).
- **Fix:** Change line 341 from `timelogStore.deleteBlock(...)` to `store.deleteBlock(...)`.

---

## HIGH

### H-1: Direct DOM + reactive ref dual-path in `applyDrag()` causes race conditions

- **File:** `src/components/Timeline.vue`, lines 263–283
- **Category:** Reactivity anti-patterns
- **Issue:** `applyDrag()` simultaneously writes to raw DOM elements (`document.querySelector('.ghost').style`, `adrag.value.el.style`, `document.querySelector('.dlabel').textContent`) AND updates Vue refs (`ghostTop`, `ghostHeight`, `dlabelTop`, `dlabelText`). The ghost/label DOM elements are rendered by Vue's template, so on any subsequent Vue re-render (e.g., when blocks change, or a watcher fires), the inline style set via querySelector is lost because Vue reconciles based on template bindings. The comment says "Direct DOM update for instant ghost feedback" but this is fighting the framework — one path will inevitably win and the other will cause visual glitches.
- **Fix:** Remove the direct DOM manipulation entirely. The ref-based bindings on `ghostStyle`, `ghostTop`, `ghostHeight`, `dlabelTop`, `dlabelText` are sufficient. If performance is a concern, batch with `nextTick()` or reduce watcher frequency.

### H-2: Computed `layoutBlocks` mutates original store block objects (`_col`, `_cols`)

- **File:** `src/components/Timeline.vue`, lines 157–188 (the `layout()` function)
- **Category:** Reactivity anti-patterns
- **Issue:** The `layoutBlocks` computed calls `layout(store.blocks)`, which sorts the array and then mutates each block object by attaching `ev._col` and `ev._cols` properties. This is a side effect inside a computed — every time Vue recalculates the computed, it permanently modifies the Pinia store's block objects. If any code watches `store.blocks` with `deep: true`, it will see mutations that look like data changes. The `_col`/`_cols` are render-only concerns and should not pollute the data model.
- **Fix:** Clone blocks before mutating (e.g., `list.map(b => ({...b}))` at the top of `layout()`), or use `structuredClone`, or compute `_col`/`_cols` as ephemeral properties during render.

### H-3: `store.selectedBlocks = new Set(...)` breaks Set reactivity

- **File:** `src/components/Timeline.vue`, line 483
- **Category:** Potential bugs
- **Issue:** `store.selectedBlocks` is a `ref(new Set())`. Line 483 replaces it with a brand-new Set: `store.selectedBlocks = new Set(newBlocks.map(n => n.id))`. While Pinia does proxy this to `selectedBlocks.value = newSet`, any external code holding a reference to the *old* Set object (e.g., a template iterating it, a watcher comparing references) will see a stale object. All previous `.add()` / `.delete()` calls from right-click selection would be on the old Set. The template uses `selectedBlocks.has(ev.id)` which goes through Pinia's reactive proxy, so it would work — but any code that captured a reference to the Set itself is broken.
- **Fix:** Mutate the existing Set instead: `store.selectedBlocks.clear(); newBlocks.forEach(n => store.selectedBlocks.add(n.id))`.

### H-4: `doExportJson()` reads raw localStorage instead of store data

- **File:** `src/App.vue`, lines 199–232
- **Category:** Reactivity anti-patterns / Inconsistent patterns
- **Issue:** `doExportJson()` completely bypasses all Pinia stores. It reads tags directly from `localStorage.getItem('timelog:tags')` (line 202), and iterates all `localStorage` keys to find day-keyed data (lines 204–208). This means: (a) any unsaved in-memory changes in the stores are lost in the export, (b) the export path is wholly distinct from the store-based data path, making future data-source changes (e.g., IndexedDB) harder, (c) the `localStorage.length` can shift during iteration if multiple tabs are open.
- **Fix:** Either (a) have each store expose a `getAllData()` / `export()` method, or (b) use `backup.js`'s `getAllData()` which already does the same work in a centralized way. Remove the raw localStorage iteration from App.vue.

### H-5: `colorOf()` in timelog store reads tags from localStorage directly (stale data)

- **File:** `src/store/timelog.js`, lines 146–161
- **Category:** Reactivity anti-patterns
- **Issue:** The `colorOf()` function queries `localStorage.getItem(KEY_PREFIX + 'tags')` directly rather than importing and using `useTagStore()`. If the tag store has been modified in memory but not yet persisted (e.g., during a bulk rename), the colors rendered in Timeline will be stale. The timeline uses `colorOf` from the timelog store (line 119: `const { colorOf } = store`), while `EditModal` uses `tagStore.colorOf()` — two different code paths.
- **Fix:** Import `useTagStore` into `store/timelog.js` and use `tagStore.colorOf()` instead. The comment in `tags.js` says "to avoid circular deps" but `timelog.js` already exports `useTimelogStore` and `tags.js` already imports it — the circular dependency already exists. If it works one way, it works the other.

---

## MEDIUM

### M-1: `trapFocus()` duplicated in 6 components

- **Files:**
  - `src/components/EditModal.vue`, lines 231–247
  - `src/components/SettingsPanel.vue`, lines 115–131
  - `src/components/TagManager.vue`, lines 44–60
  - `src/components/ExportPanel.vue`, lines 99–115
  - `src/components/DataManager.vue`, lines 65–81
  - `src/components/HelpPanel.vue`, lines 66–82
- **Category:** Code quality
- **Issue:** The exact same ~17-line focus-trap function is copy-pasted into 6 components. Any bug fix or enhancement (e.g., handling `aria-*` attributes, or preserving focus on close) requires touching all 6 copies.
- **Fix:** Extract into a composable (e.g., `composables/useFocusTrap.js`) or a directive.

### M-2: `isDayKey()` duplicated across 4 files with slightly different implementations

- **Files:**
  - `src/utils/backup.js`, lines 42–46: `startsWith(KEY_PREFIX) + date regex`
  - `src/components/DataManager.vue`, lines 83–86: same + extra `!== 'tags'` check
  - `src/components/TagManager.vue`, lines 88–91: same pattern as DataManager
  - `src/components/ExportPanel.vue`, lines 250–253: `startsWith(KEY_PREFIX) + date regex` (no extra tag check)
- **Category:** Code quality / Inconsistent patterns
- **Issue:** Four implementations, three slightly different. The extra `k !== 'timelog:tags'` check in DataManager and TagManager is redundant because `'tags'` doesn't match the date regex, but the inconsistency invites drift.
- **Fix:** Export `isDayKey` from `store/timelog.js` (or `constants.js`) and import it everywhere.

### M-3: `applyBorderless()` duplicated in App.vue and SettingsPanel.vue

- **Files:**
  - `src/App.vue`, lines 302–322
  - `src/components/SettingsPanel.vue`, lines 161–180
- **Category:** Inconsistent patterns
- **Issue:** Both components have their own `applyBorderless()` that does the same thing: toggles `winCtrls` class, toggles `body.borderless`, calls `setDecorations`. The App.vue version uses `window.__TAURI__.window.getCurrentWindow()` while SettingsPanel uses `T.window.getCurrentWindow()` (with optional chaining on `T.window`). These can desync.
- **Fix:** Export a shared `applyBorderless()` from a composable or the Tauri utils, or have SettingsPanel emit a change and let App.vue handle the side effect.

### M-4: `hexA()` / `boostHex()` duplicated in timelog and tags stores

- **Files:**
  - `src/store/timelog.js`, lines 130–144
  - `src/store/tags.js`, lines 114–131
- **Category:** Code quality
- **Issue:** Duplicate color utility functions with identical logic, "to avoid circular deps". However, a circular dependency already exists (tags.js imports useTimelogStore, timelog.js could import useTagStore). The duplication is unnecessary.
- **Fix:** Extract to `utils/color.js` or similar, import in both stores.

### M-5: ID generation logic (`'b' + Date.now() + random`) duplicated 4+ times

- **Files:**
  - `src/store/timelog.js`, line 95: `'b' + Date.now() + Math.random().toString(36).slice(2, 6)`
  - `src/components/EditModal.vue`, line 197: same pattern
  - `src/components/Timeline.vue`, line 473: `'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)`
  - `src/components/ExportPanel.vue`, line 185: same as EditModal
- **Category:** Code quality
- **Issue:** The ID generation pattern has drifted (Timeline uses `.toString(36)` on Date.now() while EditModal/ExportPanel don't). Random collisions are unlikely but not prevented.
- **Fix:** Export a `uid()` function from `store/timelog.js` or `utils/` and use it everywhere.

### M-6: `watch()` in EditModal creates a new array on every render

- **File:** `src/components/EditModal.vue`, lines 105–107
- **Category:** Potential bugs / Code quality
- **Issue:** `watch(() => [props.show, props.editingBlock, props.createTimes], ...)` returns a new array reference on every reactive re-run. Vue internally compares the old and new arrays element-by-element, so it works correctly — but it's wasteful and looks like a mistake. The intent is clearer with `watch([() => props.show, ...], ...)` using the array overload.
- **Fix:** Use `watch([() => props.show, () => props.editingBlock, () => props.createTimes], ...)`.

### M-7: Blob URL for log export never revoked on error

- **File:** `src/utils/log.js`, lines 44–52
- **Category:** Potential bugs
- **Issue:** `URL.createObjectURL(blob)` at line 48 creates a blob URL, and `URL.revokeObjectURL(url)` only runs after `a.click()` at line 51. If the `click()` call throws (e.g., in a restricted sandbox), the blob URL is leaked. The `a.click()` call is also not guarded.
- **Fix:** Wrap in try/finally or use `URL.revokeObjectURL()` in a finally block.

### M-8: `closeMore` event listener registered on `document`, key handler on `window` — potential noise

- **File:** `src/App.vue`, lines 119, 390–392, 416–419
- **Category:** Code quality
- **Issue:** `closeMore` is on `document` (line 392) while `onWindowKeyDown` is on `window` (line 390). The `closeMore` handler fires on every click in the document, even clicks inside the dropdown. The guard `!e.target.closest('.more-wrap')` handles this, but it's 30+ DOM queries per click.
- **Fix:** Acceptable for a small app. If performance becomes an issue, consider an overlay-based dropdown approach. Keep as-is for now.

### M-9: `watch` with `deep: true` on `store.blocks` and `tagStore.tags` in App.vue

- **File:** `src/App.vue`, lines 412–413
- **Category:** Potential bugs
- **Issue:** `watch(() => store.blocks, onDataChanged, { deep: true })` deep-watches the blocks array. With many blocks, this creates a large dependency tree. Combined with `scheduleSave()` / `scheduleClean()` calling async Tauri operations, rapid dragging (which mutates blocks dozens of times per second during resize) will fire this watch frequently.
- **Fix:** Debounce `onDataChanged` itself or throttle the watch. Consider `{ flush: 'post' }` to coalesce DOM-triggered changes.

### M-10: `normColor()` exposed via store but used like a utility

- **File:** `src/store/tags.js`, line 43 and exported at line 149
- **Category:** Code quality
- **Issue:** `normColor` is a pure utility function exported as part of the tag store's return object. Components call `tagStore.normColor()` when it's really a stateless utility.
- **Fix:** Move to `utils/color.js` alongside `hexA`/`boostHex`.

### M-11: `watch` array components in ExportPanel created on every render

- **File:** `src/components/ExportPanel.vue`, line 323
- **Category:** Code quality
- **Issue:** Same pattern as M-6: `watch(() => [props.mode, props.jsonImportData], ...)` creates a new array reference each time.
- **Fix:** Use array overload: `watch([() => props.mode, () => props.jsonImportData], ...)`.

### M-12: `winMaxed` variable declared but never used in SettingsPanel

- **File:** `src/components/SettingsPanel.vue`, line 140
- **Category:** Code quality
- **Issue:** `let winMaxed = false` is declared but never read or assigned elsewhere in the component.
- **Fix:** Remove the dead variable.

---

## LOW

### L-1: Duplicate CSS declarations across components (scoped vs global)

- **Files:**
  - `src/style.css` (global): `.actions`, `.divider`, `.small`, `.spacer`
  - `src/components/DataManager.vue` (scoped): `.divider` (line 221), `.spacer` (line 226), `.small` (line 227)
  - `src/components/ExportPanel.vue` (scoped): `.actions` (line 374), `.spacer` (line 380), `.small` (line 382)
  - `src/components/HelpPanel.vue` (scoped): `.actions` (line 126)
- **Category:** CSS debt
- **Issue:** Components redeclare styles already present in the global `style.css`. Since they're declared in `scoped` blocks, they shadow the global versions — but these are identical declarations, so it's dead weight.
- **Fix:** Remove duplicate scoped declarations for `.actions`, `.divider`, `.small`, `.spacer` from component scoped blocks.

### L-2: Module-level reactive refs in composables (useToast, useConfirm, backup)

- **Files:**
  - `src/composables/useToast.js`, lines 4–6: `toastMsg`, `toastVisible`, `toastTimer`
  - `src/composables/useConfirm.js`, lines 3–6: `confirmVisible`, `confirmMessage`, `confirmType`, `confirmResolve`
  - `src/utils/backup.js`, lines 12–13: `bkStatusText`, `bkStatusClass`
- **Category:** Reactivity anti-patterns
- **Issue:** Reactive refs are declared at module level, not inside the composable function. This makes them singletons — fine for global toast/confirm, but an unusual pattern that would break if multiple instances were needed.
- **Fix:** Add a comment explaining the singleton design choice, or refactor to `reactive({})` module-level object if preferable.

### L-3: `nowTimer` interval only updates every 60 seconds

- **File:** `src/components/Timeline.vue`, line 501
- **Category:** Potential bugs / Code quality
- **Issue:** The now-line refreshes once per minute. If the timer fires at 10:00:00 and the next fire is 10:01:00, the now-line is up to 59 seconds stale for the entire interval.
- **Fix:** Use a shorter interval (e.g., 10s or 30s) or align to the next minute boundary. With `setInterval(updateNowMin, 10000)` the now-line is at most 9 seconds stale.

### L-4: `esc` imported but not used in EditModal.vue

- **File:** `src/components/EditModal.vue`, line 78
- **Category:** Code quality
- **Issue:** `import { mdToHtml, esc } from '../utils/markdown.js'` — `esc` is imported but never called directly in this component. `mdToHtml` uses it internally, so the import compiles in, but it suggests a leftover from an earlier iteration.
- **Fix:** Remove the unused `esc` import.

### L-5: Magic numbers scattered throughout Timeline.vue

- **File:** `src/components/Timeline.vue`
- **Locations:** `16` (min block height, line 196), `32` (time display threshold, line 63), `50` (tag display threshold, line 69), `48`/`66` (note display threshold, line 77), `3` (min drag distance, line 298), `60` (timeout, line 305), `160` (scroll offset, line 495), `540` (default start for T-key, App.vue line 361), `1380` (max minute, App.vue line 363), `5` (snap interval, App.vue line 362)
- **Category:** Code quality
- **Issue:** These are determined by the visual design (PX_MIN=1 determines pixel heights) but none are named constants.
- **Fix:** Define named constants in `constants.js` where they are semantically meaningful (e.g., `MIN_BLOCK_HEIGHT = 16`, `SCROLL_OFFSET = 160`, `SNAP_INTERVAL = 5`).

### L-6: `dkey()` duplicated in `backup.js`

- **File:** `src/utils/backup.js`, lines 48–52
- **Category:** Code quality
- **Issue:** `dkey()` is already exported from `store/timelog.js`. `backup.js` defines its own identical copy.
- **Fix:** Import `dkey` from `'../store/timelog.js'` instead of defining locally.

### L-7: `normColor()` duplicated in `backup.js`

- **File:** `src/utils/backup.js`, lines 79–85
- **Category:** Code quality
- **Issue:** `normColor()` is identical to the one in `store/tags.js` but is used in `restoreAllData()`.
- **Fix:** Import `normColor` from the tag store (or a shared utility) instead of duplicating.

### L-8: `@keydown.escape.stop` in ConfirmDialog.vue emits `close` but doesn't prevent creating a new block underneath

- **File:** `src/components/ConfirmDialog.vue`, line 6
- **Category:** Potential bugs
- **Issue:** `@keydown.escape.stop="$emit('close')"` calls `resolveConfirm(false)` in App.vue. But `stop` doesn't stop the `keydown` on the window, which has an Escape handler that checks modals top-down. If ConfirmDialog is rendered but not first in the overlay order... Actually, ConfirmDialog is rendered conditionally in App.vue's template, and App.vue doesn't check for it in the Escape handler chain (lines 327–335). So Escape on ConfirmDialog is handled by ConfirmDialog itself, then bubbles to window where App.vue might also process it. However, App.vue's handler (line 327) checks if any modal `show` ref is true, and `confirmVisible` is not in that list. This means: pressing Escape while ConfirmDialog is open closes it (via the template handler), and then the window handler runs but doesn't close anything since no overlay is visible. This is a near-miss rather than a bug.
- **Fix:** Add `confirmVisible` to the Escape chain in App.vue (line 327-336) for consistency, or rely on the component-level handler alone. Document the decision.

### L-9: `pasteBlocks` in Timeline.vue sets `store.selectedBlocks` after paste

- **File:** `src/components/Timeline.vue`, line 483
- **Category:** Potential bugs (see also H-3)
- **Issue:** After pasting, the selected blocks are replaced with the newly pasted blocks. But if any blocks were previously selected via right-click, those are silently discarded (the old Set is abandoned). The toast only shows the paste count, so lost selection is invisible.
- **Fix:** Either clear old selection before replacing (intentional UX) or merge (mix old and new). Document the behavior.

### L-10: "Stale" import — `KEY_PREFIX` imported in TagManager.vue but `isDayKey` uses it

- **File:** `src/components/TagManager.vue`, line 30
- **Category:** Code quality
- **Issue:** `KEY_PREFIX` is imported from constants and used only in `isDayKey()`. Fine, but `removeTagFromBlocksAll()` reimplements logic already in `tags.js`'s `removeTagFromBlocks()`.
- **Fix:** Call `tagStore.removeTagFromBlocks(name)` instead of the local `removeTagFromBlocksAll()`. Remove the local function and its `KEY_PREFIX` import.

### L-11: `parseImportText` creates IDs with Date.now() — collision risk on bulk import

- **File:** `src/components/ExportPanel.vue`, line 185
- **Category:** Potential bugs
- **Issue:** Each parsed record gets `id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6)`. For a bulk text import of 50+ records parsed in the same millisecond, `Date.now()` is identical and `Math.random().toString(36).slice(2, 6)` produces ~5 characters of randomness (~62^5 ≈ 916M possibilities). Collision is astronomically unlikely but the same pattern in `doPaste()` (Timeline.vue line 473) uses `Date.now().toString(36)` which is even shorter.
- **Fix:** Use a counter or `crypto.randomUUID()` if available, or centralize ID generation with a monotonic counter to guarantee uniqueness.

### L-12: `cleanOldDays()` sorts dates by string comparison (works, but fragile)

- **File:** `src/utils/backup.js`, line 194
- **Category:** Code quality
- **Issue:** `keys.sort().reverse()` relies on ISO date strings (`YYYY-MM-DD`) sorting lexicographically. This works correctly for this format but is an implicit assumption.
- **Fix:** Add a comment making the assumption explicit, or sort by `Date.parse` for robustness.

### L-13: No `ERROR_BOUNDARY` style component or global error handler for render errors

- **File:** `src/App.vue`, line 383 (uses `onErrorCaptured`)
- **Category:** Potential bugs
- **Issue:** `onErrorCaptured` logs the error and returns `false` (which allows propagation to the global handler). There's no fallback UI — if a render error crashes a component tree (e.g., Timeline.vue's `colorOf` throws), the user sees a blank/white screen with no recovery hint.
- **Fix:** Consider a minimal error-boundary component, or at minimum show a "Something went wrong, try refreshing" message when `onErrorCaptured` fires.

### L-14: `filter(Boolean)` in `parseImportText` silently drops bad IDs

- **File:** `src/components/ExportPanel.vue`, line 173
- **Category:** Code quality
- **Issue:** `m[5].split(',').map(x => x.trim()).filter(Boolean)` filters out empty tag names. This is correct, but if the tag format is `(9:00-10:30::工作)` the empty segment is silently dropped. The regex `([^)]*)` already captures the tag segment, and splitting by comma with empty segments is a minor edge case.
- **Fix:** Fine as-is, but consider a comment explaining that empty tag segments are silently skipped.

---

## Summary Table

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 1 | Undefined variable in Delete handler |
| HIGH     | 5 | Dual-path DOM/refs, computed side-effects, Set reactivity, raw localStorage read, stale colorOf |
| MEDIUM   | 12 | Duplicated code (trapFocus x6, isDayKey x4, applyBorderless x2, hexA/boostHex x2, uid x4), dead variable, deep watch performance |
| LOW      | 14 | CSS duplication, module-level refs, unused import, magic numbers, duplicate utilities, interval precision, comment-worthy edge cases |
| **Total** | **32** | |

---

## Cross-Cutting Themes

1. **Duplication** — `trapFocus` (6x), `isDayKey` (4x), `applyBorderless` (2x), `hexA`/`boostHex` (2x), `normColor` (2x), `dkey` (2x), ID generation (4x+). This is the single biggest maintenance risk. Each variant could drift independently.

2. **Store boundary violation** — Multiple components and `backup.js` access localStorage directly instead of going through Pinia stores. This makes a future data-storage migration (e.g., to IndexedDB or a Tauri SQL plugin) harder because every direct access site must be found and updated.

3. **Reactivity bypass** — Direct DOM manipulation in the drag system (`applyDrag`) creates a fragile dual-state situation that conflicts with Vue's virtual DOM.

4. **Utility extraction** — Pure functions (`normColor`, `hexA`, `boostHex`, `isDayKey`, `dkey`, `trapFocus`, `uid`) should be extracted into `utils/` modules rather than living in stores or being duplicated in components.

---

## Suggested Quick Wins (in priority order)

1. **Fix the CRITICAL bug** — `s/timelogStore/store/` on App.vue line 341.
2. **Extract `trapFocus` into a composable** — removes ~100 lines of duplication across 6 files.
3. **Clone blocks in `layout()`** — prevent computed side-effects on store data.
4. **Mutate `selectedBlocks` Set instead of replacing** — ensure reactivity for any future code that holds a reference.
5. **Remove direct DOM manipulation in `applyDrag()`** — rely on Vue template bindings only.
6. **Use `backup.js`'s `getAllData()` in `doExportJson()`** — consolidate the export path.

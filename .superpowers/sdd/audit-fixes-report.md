# Timelog Vue 3 Audit Fixes Report

## Build: PASS
Build completed cleanly with no errors or warnings.

## Summary of 7 Fixes

### Fix 1: Double alpha bug (CRITICAL)
**File:** `frontend/src/components/Timeline.vue` → `computeBlockStyle()`
**What:** Removed `const opacity = Math.min(settingsStore.blockOpacity, 100) / 100` line and the `opacity: opacity` property from the return object.
**Why:** Tagged blocks already have transparency baked into their `rgba()` background from `colorOf()`. Applying CSS `opacity` on top doubles the transparency, making blocks too faint. Untagged blocks use `#F2F1EF` with no transparency, matching old behavior.

### Fix 2: removeTagFromBlocks only scans current day (CRITICAL)
**File:** `frontend/src/store/tags.js` → `removeTagFromBlocks()`
**What:** Rewrote to scan ALL `localStorage` keys matching the pattern `timelog:YYYY-MM-DD`, not just the current day's in-memory `store.blocks`.
**Why:** When a tag is deleted, it must be removed from all existing records across all dates, not just the currently displayed day. Old code scanned all keys; the new code was incorrectly limited to `store.blocks`.

### Fix 3: tWrite missing directory creation (CRITICAL)
**File:** `frontend/src/utils/tauri.js`
**What:** Added `tEnsureDir()` function that checks if `DATA_DIR` (`timelog_data`) exists in the Tauri filesystem and creates it if needed. `tWrite()` now calls `tEnsureDir()` before writing.
**Why:** Without directory creation, the first write to a non-existent directory would fail in Tauri environments. Old code had `tEnsureDir()` called before every write.

### Fix 4: normColor missing palette names
**File:** `frontend/src/store/tags.js`
**What:** Added `PALETTE` constant matching the old code (gray, brown, orange, yellow, green, blue, purple, pink, red). Updated `normColor()` to check palette names first before treating input as hex.
**Why:** Old code resolved named colors like `'red'` → `'#C13B2E'` via PALETTE lookup. The new code was skipping this step, so tags with palette color names would not render correctly.

### Fix 5: EditModal tag chips ignore blockOpacity
**File:** `frontend/src/store/tags.js` → `colorOf()`
**What:** Added local `hexA()` and `boostHex()` helper functions. Updated `colorOf()` to read `blockOpacity` from localStorage and apply the same alpha/boost logic as the old code. Previously it hardcoded `'22'` as the alpha hex suffix.
**Why:** Tag chips in EditModal should respect the user's block opacity setting just like timeline blocks do. The old code read `blockOpacity` and either used `hexA(rgba)` or `boostHex()` depending on whether opacity > 100%.

### Fix 6: migrateBackups missing toast
**File:** `frontend/src/utils/backup.js` → `migrateBackups()`
**What:** Imported `useToast` composable and replaced `console.log(...)` with `toast(...)`.
**Why:** The old code showed a toast notification after migrating backup files. The new code was using `console.log` which is invisible to the user in production.

### Fix 7: EditModal Copy reads old data not form
**File:** `frontend/src/components/EditModal.vue` → `copyBlock()`
**What:** Changed `copyBlock()` to read from the reactive form fields (`mTitle.value`, `mNote.value`, `mStart.value`, `mEnd.value`, `selectedTags.value`) instead of `props.editingBlock`.
**Why:** The user may have modified the form values (title, note, tags) but not yet saved. The copy should capture the current form state, not the original block data. Old DOM-based code read `document.getElementById('mNote').value` directly; the Vue port was reading stale props.

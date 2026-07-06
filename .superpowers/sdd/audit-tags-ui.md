# Audit: Timelog Vue 3 Tag System and UI Interactions

**OLD** = `src/index.html` (vanilla JS, single-file SPA)  
**NEW** = `frontend/` (Vue 3 + Pinia, component-based)  
**Audited**: 2026-07-06

---

## 1. Default Tags (store/tags.js vs OLD lines 423-433)

| Aspect | OLD | NEW | Discrepancy |
|---|---|---|---|
| Tag count | 9 tags | 6 tags | DIFFER — completely different tag sets |
| Exact names | 很自律, 自律, 不太自律, 工作, 学习, 自我提升, 日常生活, 休息, 娱乐 | 专注, 摸鱼, 学习, 工作, 运动, 社交 | Only "学习" and "工作" are shared |
| Colors | Per-tag distinct colors | Different colors even for shared names (学习: #F7D2F5 vs #C4E0D4; 工作: #F0CC7F vs #A1AFC9) | DIFFER |
| Groups | 自我评价(3), 正事(3), 生活(3) | 自我评价(2), 正事(2), 生活(2) | DIFFER — regrouped |

**Conclusion**: These are deliberately redesigned. Not a regression but a complete tag taxonomy change.

---

## 2. loadTags/saveTags — localStorage Key (tags.js vs OLD line 464)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Key | `'timelog:tags'` | `KEY_PREFIX + 'tags'` = `'timelog:tags'` | SAME |
| Empty array handling | Falls back to DEFAULT_TAGS if array is `[]` | Stores `[]` as-is (empty array remains empty) | **DISCREPANCY** — OLD treats empty stored array as "no data" and resets to defaults; NEW treats it as valid "empty tags" |
| normColor on load | Applies `normColor(x.color)` to every tag on load | Stores raw color from JSON as-is | **DISCREPANCY** — OLD normalizes colors during load; NEW does not |
| saveTags side effects | Calls `scheduleSave()` and `scheduleClean()` | Only does `localStorage.setItem(...)` | **DISCREPANCY** — NEW's saveTags does not trigger auto-backup or cleanup |

---

## 3. normColor (tags.js vs OLD line 463)

| Aspect | OLD | NEW |
|---|---|---|
| PALETTE lookup | Maps named colors (`'gray'`, `'blue'`) via PALETTE object | No PALETTE — prepends `#` blindly |
| Shorthand expansion | None — returns `#abc` as-is | Expands: `#abc` → `#aabbcc` |
| Default return | `'#8A8A8A'` | `'#C4C3C0'` |
| Truncation | No truncation | Slices to 7 chars max |
| Input validation | Checks `typeof c==='string' && c.charAt(0)==='#'` | Checks `!c || !c.trim()`, does `.trim()` |

**DISCREPANCY**: Completely different normalization logic. OLD delegates to PALETTE; NEW does hex-only expansion + truncation. Color strings like `"gray"` would produce `'#6B6B6B'` in OLD but `'#gray'` (invalid) in NEW.

---

## 4. addTag / updateTag / deleteTag

OLD has no dedicated functions — tag management was inline in the tagSave handler.  
NEW provides three Pinia store methods. These are **new abstractions**, not refactors of existing code.

| Function | OLD | NEW |
|---|---|---|
| addTag | Not present | `tags.value.push(...)` + `saveTags()` |
| updateTag | Not present | In-place replace + rename handling via `replaceTagInBlocks` |
| deleteTag | Not present | `splice` + `saveTags()` + `removeTagFromBlocks` |

**No direct OLD equivalent to compare** — these are new.

---

## 5. removeTagFromBlocks (tags.js vs OLD line 550) — CROSS-DATE SCANNING

| Aspect | OLD | NEW (tags.js) |
|---|---|---|
| Scope | **ALL** localStorage keys matching `isDayKey` | **Only current date's blocks** in Pinia store |
| Return value | Boolean (whether any changes made) | Nothing |
| isDayKey | `/^timelog:\d{4}-\d{2}-\d{2}$/` | N/A (doesn't scan localStorage) |

**MAJOR DISCREPANCY**: NEW's `removeTagFromBlocks` in `tags.js` only operates on the current day's blocks (from the Pinia store). It does NOT scan all date keys in localStorage. This means deleting a tag will NOT remove it from blocks on other dates.

However, TagManager.vue has its own local `removeTagFromBlocksAll` function (lines 75-95) that does a full localStorage scan (matching OLD's behavior), and this is the one used when saving tag changes. But the store's standalone `deleteTag` calls the store's limited `removeTagFromBlocks` — so calling `tagStore.deleteTag()` programmatically would be incomplete.

**INCONSISTENCY WITHIN NEW**: tags.js's `removeTagFromBlocks` is scoped to current day only. TagManager.vue's `removeTagFromBlocksAll` scans all dates. The TagManager's save uses the full-scope version, but the store's `deleteTag` uses the limited version.

---

## 6. replaceTagInBlocks (tags.js vs OLD line 551) — CROSS-DATE SCANNING

| Aspect | OLD | NEW (tags.js) |
|---|---|---|
| Scope | All localStorage `isDayKey` matches | **Current store blocks first**, then all `k.startsWith(KEY_PREFIX)` keys |
| Filter condition | `isDayKey(k)` (regex: `timelog:YYYY-MM-DD`) | `k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags'` (broader — also hits settings keys like `timelog:blockOpacity`) |
| Error handling | Silent catch | `logger.error(...)` with message |

**DISCREPANCY (minor)**: NEW's broader key filter catches all `timelog:xxx` keys, not just date keys. In practice this is harmless (non-array non-date values will throw in JSON.parse and be caught). Functionally equivalent.

**DISCREPANCY (minor)**: NEW also updates store blocks first before the localStorage scan. OLD only does localStorage scan. The store update is redundant with the localStorage scan since store blocks will be overwritten when the current date's localStorage item is updated. But this is a safe (defensive) difference.

---

## 7. EditModal — Save (vs OLD lines 527-540)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| ID generation | `editingId \|\| ('b' + Date.now() + Math.random().toString(36).slice(2,6))` | `props.editingBlock?.id \|\| ('b' + Date.now() + Math.random().toString(36).slice(2,6))` | SAME (optional chaining vs logical OR) |
| Field extraction | DOM reads (getElementById + .value) | Reactive refs (v-model bindings) | Equivalent |
| Save method | `loadBlocks()` → map/push → `saveBlocks()` → `render()` | `timelogStore.updateBlock(rec)` / `timelogStore.addBlock(rec)` → `emit('close')` | Equivalent |
| Close | `closeModal()` | `emit('close')` | SAME effect |

**No significant discrepancies.** The NEW version uses store methods instead of direct mutations, which is the expected Vue pattern.

---

## 8. EditModal — Delete (vs OLD line 534)

| Aspect | OLD | NEW |
|---|---|---|
| Confirmation | **None** — deletes immediately | **Shows confirm dialog** via `showConfirm(STR.confirm.deleteBlock)` |
| Method | `loadBlocks().filter(...)` → `saveBlocks()` → `render()` | `timelogStore.deleteBlock(props.editingBlock.id)` → `emit('close')` |

**MAJOR DISCREPANCY**: OLD deletes without confirmation. NEW asks for confirmation. This is an intentional UX improvement in NEW, but a behavioral difference.

---

## 9. EditModal — Copy (vs OLD line 535)

| Aspect | OLD | NEW |
|---|---|---|
| Source data | **Form fields** (mStart.value, mEnd.value, mTitle.value, mNote.value, selectedTags) | **Original block object** (props.editingBlock.start, .end, .title, .note, .tags) |
| End-time validation | `if(en<=s)en=s+1` | None (trusts block's original data) |
| Toast message | Hardcoded Chinese | `STR.toast.copyBlock` |

**DISCREPANCY**: OLD copies the **current form values** (user may have modified fields before clicking Copy). NEW copies the **original block values** (ignores unsaved form edits). This is a behavioral regression — if a user edits the title in the form and clicks Copy, OLD copies the edited title; NEW copies the unedited original.

---

## 10. EditModal — Enter Key Navigation (vs OLD)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Title Enter | Saves block (global handler, line 610) | Saves via `@keydown.enter.prevent="save"` | SAME |
| mStart Enter → chip | Focuses first chip via `querySelector('#mTags .chip:not(.add)')` | `focusFirstChip()` — same selector | SAME |
| mEnd Enter → chip | Same as above | Same as above | SAME |
| Chip Enter navigation | Last chip group → note; else → next group's first chip | `onChipKeydown` — identical logic | SAME |

**No discrepancies.** The navigation flow (time → chip → note) is identical.

---

## 11. TagManager — Tag Row Layout (vs OLD line 546)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Layout | color picker + name + group + delete | Same | SAME |
| Color default | `t.color \|\| '#888888'` | v-model (defaults to `#000000` if undefined) | **DISCREPANCY** — fallback default differs |
| Delete confirmation | Hardcoded: `'确定删除标签"...'` | `STR.confirm.deleteTag(name)` from strings.js | Same message, different source |
| tagDraft init on open | `normColor(t.color)` applied | `{ ...t }` — no normColor | **DISCREPANCY** — colors not normalized before editing |

---

## 12. TagManager — Save Logic (vs OLD line 552)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Dedup filter | `t.name && t.name.trim() && !seen[t.name.trim()] && (seen[t.name.trim()]=1)` | Two chained `.filter()` calls | SAME effect |
| normColor on save | `normColor(t.color)` | `tagStore.normColor(t.color)` | SAME |
| Deleted tag cleanup | `removeTagFromBlocks(tn)` (full localStorage scan in OLD) | `removeTagFromBlocksAll(tn)` (new local fn, full scan) | SAME behavior |
| Rename confirmation | Hardcoded message | `STR.confirm.renameTag(on, nn)` | SAME message, sourced from strings.js |
| Post-save | Calls `renderTagChips()` + `render()` directly | Emits `'saved'` event (parent `onTagMgrSaved` calls `store.loadBlocks()`) | Equivalent |
| Deleted tag clean function | The same `removeTagFromBlocks` that does full localStorage scan (OLD line 550) | Local `removeTagFromBlocksAll` (TagManager.vue lines 75-95) — also full localStorage scan | SAME behavior |

**No discrepancies in save logic behavior.**

---

## 13. DataManager — renderDays / loadDays (vs OLD line 596)

| Aspect | OLD | NEW |
|---|---|---|
| Data source | `getAllData().days` (util function) | Direct localStorage scan with `isDayKey` |
| Hours format | `Math.round(mins/60*10)/10` (strips trailing zero: "1.5", "2") | `.toFixed(1)` (always one decimal: "1.5", "2.0") |
| Delete callback | `localStorage.removeItem('timelog:'+d)` → `renderDays()` → `render()` → `scheduleSave()` | `localStorage.removeItem(KEY_PREFIX+d)` → `loadDays()` → `emit('changed')` |

**DISCREPANCY**: Hours formatting differs — OLD strips trailing zero (`2`), NEW always shows 1 decimal (`2.0`).

**DISCREPANCY**: OLD's delete callback calls `render()` (re-renders the main grid) and `scheduleSave()`. NEW only reloads the day list and emits 'changed'. Parent `onDataMgrChanged` (App.vue line 163-165) calls `store.loadBlocks()`, but there's no `scheduleSave()` call in deleteDate. However, the parent has a watcher on `store.blocks` that triggers `scheduleSave()` (App.vue line 411), so the save eventually happens — but indirectly.

---

## 14. DataManager — Delete Range (vs OLD line 597)

| Aspect | OLD | NEW |
|---|---|---|
| Hit list source | `getAllData().days` | `days.value` (pre-loaded summary list) |
| Confirm message | Hardcoded | `STR.confirm.deleteRangeConfirm(days, count)` |
| Post-delete cleanup | `selectedBlocks.clear()`, `renderDays()`, `render()`, `scheduleSave()` | `loadDays()`, `emit('changed')` |

**No functional discrepancy** — same behavior. The cleanup is delegated to the parent via `emit('changed')`, which triggers the blocks watcher → `scheduleSave()`.

---

## 15. DataManager — Delete All (vs OLD line 598)

| Aspect | OLD | NEW |
|---|---|---|
| Confirm message | Hardcoded | `STR.confirm.deleteAllConfirm(days, count)` |
| Post-delete cleanup | Same as delete range: `selectedBlocks.clear()`, `renderDays()`, `render()`, `scheduleSave()` | Same: `loadDays()`, `emit('changed')` |

**No functional discrepancy.**

---

## 16. HelpPanel — Content (vs OLD lines 246-296)

| Aspect | OLD | NEW |
|---|---|---|
| Sections | 4: 时间块操作, 快捷键, 数据备份, 文本导入/导出 | Same 4 sections |
| Shortcut list | 7 items (same text) | Same 7 items |
| Arrow-up/arrow-down | `<kbd>↑</kbd><kbd>↓</kbd>` (literal chars) | `<kbd>&uarr;</kbd><kbd>&darr;</kbd>` (HTML entities) |
| Arrow character (text export section) | `→` (literal) | `&rarr;` (HTML entity) |
| Plus-minus | `±1` | `&plusmn;1` |
| Title icon | Has `<img src="icons/icon.svg"...>` in h2 | No icon |
| Footer class | Inline styles | `.help-footer` CSS class (same styles) |

**DISCREPANCY (cosmetic)**: OLD has an icon next to the title; NEW doesn't.
**DISCREPANCY (cosmetic)**: OLD uses literal arrow/key symbols; NEW uses HTML entities (renders identically).

---

## 17. Gradient Left Border — `.help-section::before` (vs OLD line 113)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Gradient stops | `rgb(145,234,228) 0%, rgb(134,168,231) 15%, rgb(127,127,213) 40%` | Exactly same | **SAME** |

**No discrepancy.**

---

## 18. ConfirmDialog — Layout (vs OLD 137-146, 413-418, 455-456)

| Aspect | OLD | NEW |
|---|---|---|
| Structure | `dlg-overlay` → `dlg-card` → [msg + btns] | Same |
| Button order | Cancel left, OK right | Same |
| Button text | Hardcoded `确定` / `取消` | `STR.btn.ok` / `STR.btn.cancel` |
| Cancel/OK button appearance | `.dlg-cancel` (light bg, gray border), `.dlg-ok` (blue/gray bg) | Same CSS classes, same styles |

**No layout discrepancy.** Button order and styling are identical.

---

## 19. ConfirmDialog — Focus Trap (vs OLD line 610)

| Aspect | OLD | NEW |
|---|---|---|
| Mechanism | Global `keydown` handler: finds top visible overlay, queries focusable elements, cycles Tab | Per-component `trapFocus` on card `@keydown` |
| Logic | `visible[idx === -1 ? 0 : ...]` (same cycle wrap logic) | Same cycle wrap logic |
| Shift+Tab | Backwards wrap | Same |

**No functional discrepancy.** Same algorithm, different placement (global vs per-component).

---

## 20. ConfirmDialog — ESC Close (vs OLD line 610)

| Aspect | OLD | NEW |
|---|---|---|
| Handler | Global `keydown` → `closeDialog(false)` | `@keydown.escape.stop="$emit('close')"` on overlay div |
| Return value | Returns `false` (via `closeDialog(false)`) | Emits `'close'` → parent `resolveConfirm(false)` (App.vue line 76) |
| Result | Promise resolves to `false` | Promise resolves to `false` |

**Same behavior.** Different implementation mechanism, identical outcome.

---

## 21. ExportPanel — Text Export `buildExport` (vs OLD line 555)

| Aspect | OLD | NEW |
|---|---|---|
| Data source | `loadBlocks()` (from localStorage) | `timelogStore.blocks` (from Pinia store) |
| List-detection regex | `/\s*(?:[-*]\|\d+\.)\s/` — **no `^` anchor** | `/^\s*(?:[-*]\|\d+\.)\s/` — **with `^` anchor** |
| Tab indentation for lists | `'\n\t' + line` | Same |

**DISCREPANCY**: OLD's regex can match a list marker (`-`, `*`, `1.`) at any position in the line. NEW's regex only matches at the start of the line (after optional whitespace). This means if a note line has a dash in the middle like `"some text - item"`, OLD would treat it as a list item and indent with a tab; NEW would treat it as a regular line and indent with a space.

---

## 22. ExportPanel — Text Import `parseImportText` (vs OLD line 563)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Regex | Same | Same | SAME |
| Note accumulation | Same (`\n` + stripped line continuation) | Same | SAME |
| End-time fix | `r.end <= r.start ? r.start + 1 : r.end` | Same | SAME |
| Note trim | `.replace(/\s+$/, '')` | Same | SAME |
| ID generation | `newId()` = `'b' + Date.now().toString(36) + random(36).slice(2,6)` | `'b' + Date.now() + random(36).slice(2,6)` — **no `.toString(36)` on Date.now()** | **DISCREPANCY** — OLD IDs are base36-encoded timestamps (`b1a2b3c4...`); NEW IDs are decimal timestamps (`b1234567890...`) |
| Tag auto-creation | `tags.push({name:tn, color:'#8A8A8A', group:''})` | `tagStore.addTag({ name: tn, color: '#8A8A8A', group: '' })` | SAME (same color/group for auto-created tags) |
| Import confirm flow | Checks `date === dkey(curDate)` then `selectedBlocks.clear(); render();` | Checks `date === dkey(new Date())` then `timelogStore.loadBlocks()` | SAME effect |

**DISCREPANCY in ID format only.** The ID format difference means imported records will have differently structured IDs, but this has no functional impact (IDs are opaque identifiers).

---

## 23. ExportPanel — JSON Import (vs OLD lines 578-588)

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Date range filter | Same (`d < df`, `d > dt`) | Same | SAME |
| Time range filter | Same (`b.start < tfm`, `b.start > ttm`) | Same | SAME |
| Replace mode | Iterates localStorage, removes all `isDayKey` keys | Same (with `isDayKey` based on KEY_PREFIX) | SAME |
| Merge dedup | `b.id \|\| ('b' + b.start + '-' + b.end + Math.random())` | Same (identical fallback ID format) | SAME |
| Tag import | Iterates `data.tags`, checks `!tags.find(x => x.name === t.name)`, pushes new | Iterates `data.tags`, calls `tagStore.addTag(...)` with same fields | SAME |
| Post-import | `render()`, `scheduleSave()`, `showAlert('导入完成。')` | `timelogStore.loadBlocks()`, `tagStore.loadTags()`, `scheduleSave()`, `showAlert('导入完成。')` | SAME (with tag reload) |

**No discrepancies in JSON import logic.**

---

## 24. DataManager — Built-in JSON Import (NEW only)

OLD had a separate import modal. NEW adds a **simplified import** embedded in DataManager:

| Aspect | DataManager import | OLD import | ExportPanel import |
|---|---|---|---|
| Merge only? | Yes — always merge | Mode selectable (merge/replace) | Mode selectable |
| Date/time filtering | None | Date range + time range | Date range + time range |
| Dedup | `b.id \|\| ('b' + b.start + '-' + b.end)` (no Math.random in fallback) | `b.id \|\| ('b' + b.start + '-' + b.end + Math.random())` | Same as OLD |

**DISCREPANCY**: DataManager's JSON import is merge-only with no filtering options and a different dedup fallback ID format. This is a **new simplified path** that didn't exist in OLD's manage modal.

---

## 25. Cross-Store Inconsistencies (NEW only)

Several `isDayKey` functions exist across the NEW codebase — all functionally identical:

| Location | Filter condition |
|---|---|
| TagManager.vue (line 71-73) | `k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags' && /^\d{4}-\d{2}-\d{2}$/.test(k.slice(...))` |
| DataManager.vue (line 66-68) | Same |
| ExportPanel.vue (line 232-236) | Same (without the `!== 'tags'` exclusion — but date regex handles this) |
| backup.js (line 39-43) | Same as ExportPanel |

These are consistent, but the **duplication** is a maintenance concern (4 copies of the same function).

**`removeTagFromBlocks` inconsistency** (noted in #5 above):
- `tags.js` (store): limited to current day's blocks only
- `TagManager.vue` (component): full localStorage scan
- OLD: full localStorage scan

The store's `deleteTag()` calls the limited version, so if called programmatically (not via TagManager), old tag names remain on other dates' blocks.

---

## Summary of All Discrepancies

### Critical (behavioral change)
1. **removeTagFromBlocks scope** (#5): NEW's `tags.js` version only scans current day; OLD scans all dates. TagManager.vue works around this with its own full-scope version, but the store's `deleteTag()` remains incomplete.
2. **EditModal copy source** (#9): NEW copies original block values (ignoring form edits); OLD copies current form values.

### Moderate (functional difference)
3. **EditModal delete confirmation** (#8): NEW adds confirmation dialog; OLD deletes silently.
4. **normColor logic** (#3): OLD uses PALETTE lookup + no expansion; NEW does hex-only expansion + truncation.
5. **Empty tags handling** (#2): OLD falls back to defaults if stored array is empty; NEW stores empty array as-is.
6. **Text export list regex** (#21): OLD has no `^` anchor (matches anywhere); NEW has `^` anchor (start of line only).
7. **Hours format** (#13): OLD strips trailing zero (`2`); NEW always `2.0`.

### Minor
8. **saveTags side effects** (#2): OLD triggers save/clean; NEW doesn't.
9. **normColor on load** (#2): OLD normalizes colors on load; NEW doesn't.
10. **ID format in text import** (#22): OLD uses base36 timestamp; NEW uses decimal.
11. **Color default in normColor** (#3): `#8A8A8A` vs `#C4C3C0`.
12. **Color default in tag row** (#11): `#888888` vs `#000000` fallback.
13. **DataManager simplified JSON import** (#24): NEW adds merge-only import without filtering.
14. **DataManager delete no direct scheduleSave** (#13-15): Delegated through watcher instead of direct call.
15. **HelpPanel title icon** (#16): OLD has one; NEW doesn't.
16. **replaceTagInBlocks key filter** (#6): NEW's filter is broader (matches all `timelog:` keys, not just date keys).

### Non-issues (designed changes)
17. **Default tags** (#1): Deliberately redesigned taxonomy — all 9 OLD tags replaced with 6 new tags.
18. **HelpPanel HTML entities** (#16): Visual rendering is identical.
19. **Focus trap placement** (#19): Same algorithm, different location (global vs per-component).
20. **ESC/confirm dialog return** (#20): Same behavior via different wiring.

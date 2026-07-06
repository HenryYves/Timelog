# Timelog Data Store Audit: OLD (`src/index.html`) vs NEW (`frontend/src/store/timelog.js`)

Audited: 2026-07-06

---

## 1. loadBlocks() / saveBlocks() -- localStorage Key Pattern

| Aspect | OLD | NEW | Discrepancy? |
|--------|-----|-----|-------------|
| Key pattern | `'timelog:' + dkey(curDate)` | `KEY_PREFIX + dateKey.value` | **NO** -- `KEY_PREFIX = 'timelog:'`, identical |
| Empty array write | Always writes `setItem(key, '[]')` | Calls `removeItem(key)` when `blocks.value.length === 0` | **YES** -- old leaves empty keys in localStorage; new cleans them up |
| scheduleSave / scheduleClean | Called inside `saveBlocks()` | NOT called -- auto-backup/clean triggered by Vue watcher in App.vue | **YES** -- architectural difference; relies on reactive watcher `watch(() => store.blocks, ...)` instead of direct call |
| Error handling | Returns `[]` on catch | Returns `[]` on catch + logs via `logger.error()` | **MINOR** -- extra logging in new code |
| In-memory vs re-read | `loadBlocks()` called inside save flow; always re-reads from localStorage | Uses reactive `blocks.value` directly; no re-read | **YES** -- different data sourcing model |

---

## 2. layout() -- Collision Grouping, Column Assignment

Code is byte-for-byte identical:
- Same sort: `(a,b) => a.start - b.start || a.end - b.end`
- Same collision detection: `evs[j+1].start < ge`
- Same first-fit column assignment: loop over cols, check `ev.start >= cols[c]`
- Same `_col` / `_cols` mutation of sort-returned copy

**Discrepancy: NONE**

---

## 3. computeBlockStyle (NEW) vs render() inline styling (OLD)

### 3a. PX_MIN Value -- CRITICAL

| | OLD | NEW |
|---|-----|-----|
| `PXMIN` / `PX_MIN` | **1** (`const PXMIN = 1`) | **1.33** (`export const PX_MIN = 1.33`) |

**YES -- SIGNIFICANT.** Old: 1 pixel per minute (1440px grid). New: 1.33 pixels per minute (~1915px grid). All pixel-based positions (top, height) are multiplied differently. This is a pure visual density change but a genuine discrepancy in the constants.

### 3b. Block Color & Opacity -- MAJOR BUG

**OLD** -- Opacity is applied ONLY to the background color via `hexA()`:
```js
// colorOf returns rgba(..., 0.15) in bg field
el.style.background = has ? c0.bg : '#F2F1EF';
// NO style.opacity set -- text remains fully opaque
```

**NEW** -- Opacity is applied as CSS `opacity` (entire element) **AND** still baked into the bg color via `hexA()`:
```js
// In computeBlockStyle:
background: has ? c0.bg : '#F2F1EF',
opacity: Math.min(settingsStore.blockOpacity, 100) / 100,  // e.g. 0.15
// colorOf still returns hexA(hex, 0.15) for bg
```

**CRITICAL BUG: Double-alpha.** For a tag block at opacity 15%:
- bg = `rgba(r, g, b, 0.15)` (alpha in color)
- `opacity: 0.15` (CSS element opacity)
- Effective: `0.15 * 0.15 = 0.0225` -- block is nearly invisible

For untagged blocks at opacity 15%:
- bg = `#F2F1EF` (solid, no alpha) 
- `opacity: 0.15`
- Text and everything is at 15% -- **text becomes faint**, unlike old code where text stayed opaque.

### 3c. Boost Hex (opacity > 100%)

When `blockOpacity > 100`:
- **OLD**: `colorOf` returns `boostHex(hex, ...)` as `bg` -- solid boosted color. No additional CSS opacity. Block is fully opaque with intensified color.
- **NEW**: `colorOf` returns `boostHex(hex, ...)` as `bg` (same). But `computeBlockStyle` clamps `opacity = Math.min(blockOpacity, 100) / 100 = 1.0`. So CSS opacity is 1.0. **Same effective result** for this case.

**Verdict: Only the >100 case is correct. The <=100 case has the double-alpha bug.**

---

## 4. colorOf() -- Tag Color Lookup

### 4a. Tag Source

| Aspect | OLD | NEW | Discrepancy? |
|--------|-----|-----|-------------|
| Tag list source | Global `tags` array (in-memory) | Reads from `localStorage` directly each call | **YES** -- new code bypasses the reactive tagStore entirely; won't reflect tagStore changes until localStorage is updated |
| Default hex for untagged | `#8A8A8A` | Same: `#8A8A8A` | **NO** |
| Fallback on error | No try/catch | Returns `{ hex: '#C4C3C0', bg: '#F0EFED' }` | **YES** -- different fallback behavior |
| blockOpacity source | Global variable | `localStorage.getItem()` directly | **YES** -- bypasses settingsStore reactivity |

### 4b. hexA() / boostHex() Duplicated

Both copies of `hexA` and `boostHex` are functionally identical.

### 4c. Tag Store has a SEPARATE colorOf()

`frontend/src/store/tags.js` defines its own `colorOf()`:
```js
function colorOf(name) {
  const t = tags.value.find(t => t.name === name)
  if (!t) return { hex: '#C4C3C0', bg: '#F0EFED' }
  return { hex: t.color, bg: t.color + '22' }  // fixed 22 alpha!
}
```
This is **COMPLETELY DIFFERENT** from timelog store's `colorOf`. It uses a hardcoded `'22'` hex suffix (= ~13% alpha) instead of reading `blockOpacity`. The fallback colors (`#C4C3C0` / `#F0EFED`) are also different from timelog store's (`#8A8A8A` / rgba).

This `tagStore.colorOf()` IS used -- by `EditModal.vue` for rendering tag chips. So the tag chips in the edit modal do NOT respect the user's blockOpacity setting, unlike the old code where `renderTagChips()` used `colorOf(t.name)` from the same function as the timeline.

**BUG: EditModal tag chips ignore blockOpacity setting.**

---

## 5. Format Functions

### 5a. fmt() -- CRITICAL FORMAT CHANGE

| | OLD | NEW |
|---|-----|-----|
| Implementation | `Math.floor(min/60) + ':' + ...` | `String(Math.floor(min/60)).padStart(2,'0') + ':' + ...` |

**YES.** Old: `fmt(570)` = `"9:30"`. New: `fmt(570)` = `"09:30"`.

This affects:
- Block time display (`bs` element): `9:30-10:30` vs `09:30-10:30`
- Block title tooltip
- Ghost/dlabel drag label
- Export text format
- Clipboard label

All text export strings change (leading zero on hours). This breaks backward compatibility with old "export text / import text" parsers because the import regex in `parseImportText()` expects hours without leading zero: `/(\d{1,2}):(\d{2})/` which would handle both, so import is fine. But the visual display and export format are altered.

### 5b. toInput() and fromInput()

Both identical -- no discrepancy.

### 5c. dkey()

Identical -- no discrepancy.

### 5d. fromInput() Defensiveness

Old: `(v||'').split(':')` -- handles null/undefined safely.  
New: `str.split(':')` -- throws on null/undefined.

**MINOR -- new code assumes valid input.**

---

## 6. Clipboard: copySelected() / pasteBlocks()

### 6a. copySelected()

| Aspect | OLD | NEW | Discrepancy? |
|--------|-----|-----|-------------|
| Block source | `loadBlocks()` (from localStorage) | `blocks.value` (in-memory) | **YES** -- architectural difference |
| Clipboard clear | Not cleared before copy | Not cleared before copy | **NO** |
| Toast | `toast(...)` with copied count | No toast | **YES** -- new code relies on caller to show toast |

### 6b. pasteBlocks() -- OFFSET CALCULATION

**OLD** (`doPaste` in index.html):
```js
const minStart = Math.min.apply(null, clipboard.map(c => c.start));
// ...
offset = anchor - minStart;
```

**NEW** (`store/timelog.js pasteBlocks`):
```js
const offset = targetMin - clipboard.value[0].start
```

**YES.** Old calculates offset from the minimum start across ALL clipboard items. New uses only the FIRST item's start. If clipboard items are sorted (they are, by `copySelected()`), these are equivalent. But the new version is more fragile.

### 6c. pasteBlocks() -- NO CLAMPING

**OLD**: clamps each pasted block to `[0, DAY_MIN]`:
```js
if (s < 0) { s = 0; en = dur; }
if (en > DAYMIN) { en = DAYMIN; s = Math.max(0, en - dur); }
```

**NEW store pasteBlocks**: No clamping at all -- blocks can have negative start or end > 1440.

**NEW Timeline.vue doPaste (the one actually used)**: DOES clamp (identical logic to old).

### 6d. pasteBlocks -- DEAD CODE

The store's `pasteBlocks()` is exported but **NEVER CALLED**. Timeline.vue has its own `doPaste()` that calls `store.addBlock()` in a loop. This means `pasteBlocks` is dead code with bugs (no clamping, different offset math).

### 6e. doPaste() in Timeline.vue -- Saves N Times

Old code: concats all blocks, calls `saveBlocks()` once.  
New code (Timeline.vue `doPaste`): calls `store.addBlock(nb)` for each block, which calls `saveBlocks()` N times. **Performance: N localStorage writes instead of 1.**

### 6f. ID Generation

Old: `newId()` = `'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)`  
New store `pasteBlocks`: `'b' + Date.now() + Math.random().toString(36).slice(2, 6)`  

**Minor: old uses base36 for timestamp, new uses decimal.**

---

## 7. deleteSelectedBlocks() -- Confirmation Flow

| Aspect | OLD | NEW | Discrepancy? |
|--------|-----|-----|-------------|
| Confirmation text | `'确定删除勾选的 '+selectedBlocks.size+' 个时间块？'` (inline) | `STR.confirm.deleteSelected(n)` (external strings file) | **YES** -- text source differs |
| Confirmation method | `showConfirm()` (global dialog) | `useConfirm().showConfirm()` (composable) | **YES** -- architecture change |
| Re-read from storage | `loadBlocks()` inside delete | Uses in-memory `blocks.value` | **YES** |
| Clear method | `selectedBlocks = new Set()` | `selectedBlocks.value.clear()` | **NO** -- same result |
| Save after delete | `saveBlocks()` | `saveBlocks()` | **NO** |
| Post-delete render | `render()` call + DOM re-render | Reactive (Vue auto-re-renders) | **YES** -- architectural |
| Toast | No toast | `toast(STR.toast.deleted)` in Timeline.vue | **YES** -- new shows toast |

---

## 8. Drag System

### 8a. Ghost Element

| Aspect | OLD | NEW | Discrepancy? |
|--------|-----|-----|-------------|
| Ghost creation | DOM element created via `document.createElement('div')` | Reactive refs + Vue template (`v-if="adrag && adrag.type === 'create'"`) | **YES** -- architectural |
| Ghost sizing | `left:'2px'; right:'2px'` (fills day column) | No left/right set in `ghostStyle` -- falls back to CSS `position: absolute` defaults | **YES** -- ghost may not span full width |
| Ghost text | Shows `fmt(b.s) + ' – ' + fmt(b.en)` inside ghost element | Shows no text in ghost (only in dlabel) | **YES** -- purely cosmetic |
| Ghost visibility | Created/removed per drag cycle | Rendered reactively based on `ghostTop.value !== null` | **YES** -- architectural |

### 8b. Resizing Visual Feedback

**OLD**: Adds `resizing` CSS class during resize:
```js
adrag.el.classList.add('resizing');
```
This enables CSS: `opacity: .92; z-index: 40; box-shadow: 0 3px 10px rgba(0,0,0,.22);`

**NEW**: Does NOT add `resizing` class. The `block.resizing` CSS exists in the scoped style block but is never applied during resize.

**YES -- IMHO regression: no visual feedback during resize.**

### 8c. Cursor Feedback

**OLD**: Sets `document.body.style.cursor = 'ns-resize'` during resize, clears on endDrag.  
**NEW**: Does not set cursor.

Also, **OLD** has per-block mousemove handler:
```js
el.addEventListener('mousemove', ee => {
  if(adrag) return;
  // ... sets el.style.cursor = 'ns-resize' or 'pointer'
});
```
**NEW**: No edge-hover cursor feedback. Cursor only changes on mousedown.

**YES -- UX regression: no cursor feedback on resize edges or during resize.**

### 8d. ArrowUp/Down Fine-tune

Both: `adrag.cur += e.key === 'ArrowUp' ? -1 : 1` with `Math.max(0, Math.min(DAY_MIN, ...))`.  
**NONE -- identical.**

### 8e. Escape Cancel

Both: `endDrag(false)` -- identical.  
**NONE.**

### 8f. suppressClick

Both: `setTimeout(() => suppressClick = false, 60)` after resize commit.  
**NONE.**

---

## 9. scrollToNow()

| Aspect | OLD | NEW | Discrepancy? |
|--------|-----|-----|-------------|
| Guard | `if(!autoScroll) return;` | `if (!settingsStore.autoScroll) return;` | **NO** -- same logic, different source |
| Today check | `dkey(now) === dkey(curDate)` | `dkey(now) === store.dateKey` | **NO** -- same |
| Fallback (not today) | `8*60` | `8 * 60` | **NO** |
| Scroll target | `document.getElementById('scroller')` | `document.querySelector('main')` | **NO** -- both resolve to `#scroller` / `main` |
| Scroll amount | `Math.max(0, min*PXMIN-160)` | `Math.max(0, min * PX_MIN - 160)` | **NO** -- same formula, but different PX_MIN value means actual scroll position differs |

**Verdict: Functionally identical logic; different PX_MIN makes scroll position physically different (see #3a).**

---

## 10. Additional Discrepancies

### 10a. normColor() -- Completely Different Algorithm

| | OLD | NEW (tags.js) |
|---|---|---|
| Input handling | Only checks `c.charAt(0) === '#'` | Handles empty/null, strips whitespace, normalizes 3-char hex |
| Non-hex colors | Looks up in `PALETTE` object (e.g. `'gray'` -> `'#6B6B6B'`) | Prepends `#` (e.g. `'gray'` -> `'#gray'`) |
| 3-char hex expansion | None | Expands `#abc` to `#aabbcc` |
| Default fallback | `'#8A8A8A'` | `'#C4C3C0'` |

**MAJOR: New code cannot resolve legacy palette names like `'gray'`, `'orange'`, `'brown'`, etc. The old PALETTE lookup is completely removed. Old data imported with palette-color tags would render incorrectly.**

### 10b. Default Tags -- Completely Different

Old: 9 tags in 3 groups (自我评价, 正事, 生活) with names like '很自律', '不太自律', '自我提升', '日常生活', '娱乐', '休息' etc.  
New: 6 tags in 3 groups with names like '专注', '摸鱼', '运动', '社交'.

Only '学习' and '工作' appear in both. Different colors for '学习' and '工作' too.

### 10c. PALETTE Constant -- Removed

Old: `const PALETTE = { gray:'#6B6B6B', brown:'#8A5A3B', orange:'#BE5C1E', ... }` -- used by `normColor()` for legacy color resolution.  
New: No PALETTE constant anywhere.

### 10d. Need to adjust the H1 title.

### 10e. TODO: Text export format

### 10f. See also: remove old index.html and old src directory

### 10g. loadBlocks() Called at Module Init -- Timing Issue

Old: `loadBlocks()` is called at the top level but only when `render()` is called.

New: `loadBlocks()` is called at the bottom of the store setup function (before `return`). This means it fires eagerly when the store is first imported. At that point `curDate.value` is `new Date()` (initialized in `ref(new Date())`). This is fine but means the store auto-loads blocks on import rather than on demand.

### 10h. saveBlocks() -- Watcher Dependency

Old: `scheduleSave()` / `scheduleClean()` called directly from `saveBlocks()`.  
New: Relies on Vue watcher in App.vue (`watch(() => store.blocks, onDataChanged, { deep: true })`) to trigger `scheduleSave()`. This means if `saveBlocks()` is called and the reference to `blocks.value` doesn't change (e.g., mutating in-place), the watcher may not fire. Currently the store always replaces elements (filter, map) which creates new arrays, so it works. But it's fragile.

---

## Summary of Severity

| # | Issue | Severity | File |
|---|-------|----------|------|
| 3b | **Double-alpha** (opacity applied in both bg color and CSS opacity) | **CRITICAL** | `Timeline.vue:computeBlockStyle` |
| 4c | **EditModal tag chips ignore blockOpacity** (uses tagStore.colorOf with hardcoded alpha) | **MAJOR** | `EditModal.vue:36,40`, `tags.js:83-87` |
| 10a | **normColor() cannot resolve legacy palette names** (`'gray'`, `'orange'` etc.) | **MAJOR** | `tags.js:30-36` |
| 3a | **PX_MIN changed from 1 to 1.33** | **MEDIUM** | `constants.js:2` |
| 5a | **fmt() adds leading zero to hours** (`9:30` vs `09:30`) | **MEDIUM** | `timelog.js:12-15` |
| 6c | **pasteBlocks() missing clamping** (but is dead code) | **MEDIUM** | `timelog.js:88-105` |
| 8b | **No resize visual feedback** (`.resizing` class never added) | **MEDIUM** | `Timeline.vue` |
| 8c | **No edge-hover cursor** and no `ns-resize` cursor during drag | **LOW** | `Timeline.vue` |
| 10b | **Default tags completely changed** | **MEDIUM** | `tags.js:7-14` |
| 4a | **timelogStore.colorOf bypasses tagStore** (reads localStorage directly) | **LOW** | `timelog.js:145-160` |
| 6d | **pasteBlocks() is dead code** | **LOW** | `timelog.js:88-105` |
| 6e | **Timeline.vue doPaste saves N times** (per block) | **LOW** | `Timeline.vue:436` |
| 1 | **saveBlocks() removesItem on empty** vs old always writing | **LOW** | `timelog.js:41-48` |
| 5d | **fromInput() less defensive** (no null check) | **LOW** | `timelog.js:22-24` |

# Timelog Vue 3 Migration -- Flow Audit

Generated: 2026-07-06
OLD: `D:/a_my/project/html/Timelog/src/index.html` (single-file SPA)
NEW: `D:/a_my/project/html/Timelog/frontend/src/` (Vue 3 + Pinia)

## GLOBAL DIFFERENCES (affecting all flows)

### DIFF-CRITICAL-1: `PX_MIN` changed from 1 to 1.33
- OLD const: `PXMIN=1`
- NEW const: `PX_MIN=1.33` (constants.js line 2)
- **Impact**: The entire timeline is 33% taller. Every `top`, `height`, scroll position, and line placement is scaled. All visual measurements are distorted.

### DIFF-CRITICAL-2: `DEFAULT_TAGS` completely replaced
- OLD: 很自律/自律/不太自律 (自我评价), 工作/学习/自我提升 (正事), 日常生活/休息/娱乐 (生活)
- NEW: 专注/摸鱼 (自我评价), 学习/工作 (正事), 运动/社交 (生活)
- **Impact**: Fresh installs will have completely different tag presets. Colors, groups, names all differ.

### DIFF-CRITICAL-3: `saveBlocks()` removes empty-day keys
- OLD: always writes `localStorage.setItem('timelog:'+dkey(curDate), JSON.stringify(blocks))` even if blocks is `[]`
- NEW: removes the key when blocks is empty (timelog.js lines 42-47)
- **Impact**: `getAllData()` in backup will produce different results for empty days; migration from OLD -> NEW could leave stale empty keys.

### DIFF-CRITICAL-4: `colorOf()` reads from localStorage directly (not Pinia store)
- OLD: uses global `tags` array
- NEW (timelog.js): reads `localStorage.getItem('timelog:tags')` directly each call
- NEW (tagStore.js): has its own `colorOf()` reading from reactive `tags.value`
- **Impact**: `Timeline.vue` imports `colorOf` from timelog store, which reads localStorage directly. If tags are manipulated in the Pinia store but not yet persisted, block colors will be stale.

### DIFF-CRITICAL-5: `.resizing` class and live resize feedback missing
- OLD: adds `.resizing` class during resize drag (with `opacity:.92;z-index:40;...` CSS)
- NEW: no `.resizing` class applied during resize. The CSS class exists in scoped styles but is never used.
- **Impact**: Resize drag has no visual feedback on the block (see Flow 3).

### DIFF: `exportbox` has `resize: vertical` in NEW
- OLD: no resize
- NEW ExportPanel scoped style: `resize: vertical;`
- **Impact**: Minor; text areas in export modals are now resizable.

### DIFF: Toast uses `<Transition>` in NEW
- OLD: `style.opacity` CSS transitions
- NEW: Vue `<Transition name="toast">` with `opacity` animation
- **Impact**: Same visual effect, different mechanism.

---

## Flow 1: Open app -> see today's timeline

### Paths

**OLD**: `(async function init(){...})()` immediately invoked
1. buildGutter() -- DOM: creates `.hlabel` divs inside `#gutter`
2. buildDayLines() -- DOM: creates `.hourline` and `.halfline` divs inside `#day`
3. render() -- calls formatDateLabel(), loadBlocks(), layout(), creates block DOM elements, adds nowline
4. scrollToNow() -- scrolls `#scroller` to current time
5. initBackup() -- Tauri restore check
6. applyBorderless()

**NEW**: `main.js` -> `App.vue` `onMounted` + `Timeline.vue` `onMounted`
1. App.vue onMounted: sets up keyboard/backup listeners, `setBackupPrefs()`, `initBackup()`, `applyBorderless()`
2. Timeline.vue onMounted (child): calls `updateNowMin()`, sets up `nowTimer` interval, `scrollToNow()`, window mouse listeners
3. Gutter: rendered reactively via `v-for="h in 25"` in template
4. Day lines: `v-for="h in 25"` hour lines + `v-for="h in 24"` half-hour lines
5. Blocks: `v-for="ev in layoutBlocks"` where `layoutBlocks = computed(() => layout(store.blocks))`
6. store.blocks loaded at Pinia store creation time via `loadBlocks()` at line 163

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| PX_MIN | 1 | 1.33 |
| Gutter labels | `h<10?'0'+h:h` + ':00' | `String(h-1).padStart(2,'0')` + ':00' (same result) |
| Gutter height | `DAYMIN*PXMIN` = 1440px | `DAY_MIN * PX_MIN` = 1915.2px |
| Block init | `loadBlocks()` called inside `render()` | `loadBlocks()` called at store creation |
| Now line refresh | Static, drawn only in render() | Auto-updates via `setInterval(updateNowMin, 60000)` |
| Scroll to now | After render, before initBackup | After initBackup (in Timeline onMounted) |
| Scroll to now on date nav | Only for "今天" button | Watches `store.dateKey` and re-scrolls if date is today |
| Date label format | `formatDateLabel(curDate)` function | `computed` in App.vue using same logic |
| Tag defaults in load | `DEFAULT_TAGS` (9 tags) | `DEFAULT_TAGS` (6 tags, different set) |

---

## Flow 2: Hover near top edge of a block -> cursor becomes ns-resize

### Paths

**OLD** (index.html line 499):
```
block mousemove -> check adrag -> getBoundingClientRect -> y <= ez || y >= height-ez
  -> el.style.cursor = 'ns-resize' or 'pointer'
  EDGE=6, ez=Math.min(EDGE, height/2)
```

**NEW** (Timeline.vue `onBlockMouseMove` lines 299-305):
```
@mousemove="onBlockMouseMove($event, ev)"
  -> check adrag.value -> getBoundingClientRect -> y <= ez || y >= height-ez
  -> e.currentTarget.style.cursor = 'ns-resize' or 'pointer'
  EDGE=6, ez=Math.min(EDGE, height/2)
```

### Differences: **NONE**
Same EDGE (6), same cursor values, same edge zone calculation.

---

## Flow 3: Drag top edge upward -> resize block

### Paths

**OLD**:
1. block mousedown -> check edge zone (y <= ez = 'start', y >= height-ez = 'end')
2. `startResize(ev, edge, el)` -> `suppressClick=true`
3. `adrag = { type:'resize', id, edge, other, cur, el }` -- stores DOM element reference
4. `applyDrag()` -> sets `el.style.top`, `el.style.height`, adds `.resizing` class
5. Global mousemove -> `adrag.cur = yToMin(e.clientY)`, `applyDrag()` -- live visual update
6. Global mouseup -> `endDrag(true)` -> removes ghost/dlabel/resizing class -> calls `saveBlocks()`, `render()`

**NEW** (Timeline.vue):
1. `@mousedown.left="onBlockMouseDown($event, ev)"`
2. Check edge zone -> `suppressClick.value = true`
3. `adrag.value = { type: 'resize', id, edge, other, cur }` -- **NO `el` property** (no DOM ref)
4. `applyDrag()` -> **only updates dlabel** (ghostTop/Height and dlabel). Does NOT set block inline styles.
5. `onWindowMouseMove` -> `adrag.value.cur = yToMin(e.clientY)`, `applyDrag()`
6. `onWindowMouseUp` -> `endDrag(true)` -> `store.updateBlock({...rec, start: b.s, end: b.en})`

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Live visual feedback during resize | YES -- block top/height changes, `.resizing` class | **NO** -- only dlabel moves, block snaps on mouseup |
| `.resizing` class | Applied during drag | **Never applied** (class exists in CSS, unused) |
| Drag state | Stores `el` (DOM ref) for direct manipulation | No DOM ref, relies on reactive update on commit |
| Commit | `saveBlocks()` + `render()` (full rebuild) | `store.updateBlock()` (Pinia reactive in-place update) |
| suppressClick | Set in `startResize` | Set in `onBlockMouseDown` before setting adrag |

**⚠️ CRITICAL: Resize drag has no live visual feedback in the Vue 3 version.** The block only snaps to the new position on mouseup. This is a significant UX regression.

---

## Flow 4: Click empty day area -> drag down -> create block

### Paths

**OLD**:
1. `day.addEventListener('mousedown', ...)` -> `adrag = { type:'create', anchor:s, cur:s }`
2. `applyDrag()`: creates DOM ghost element (class `ghost`), sets `ghost.textContent = "HH:MM - HH:MM"`, manages dlabel
3. Global mousemove updates adrag.cur, applyDrag()
4. `endDrag(true)`: if `b.en-b.s < 3` -> cancel. Otherwise `openCreate(b.s, b.en)`
5. `openCreate()`: populates form fields, renders tag chips, `showModal()`

**NEW** (Timeline.vue):
1. `@mousedown="onDayMouseDown"` -> `adrag.value = { type:'create', anchor:s, cur:s }`
2. `applyDrag()`: updates reactive `ghostTop.value`, `ghostHeight.value`, dlabel
3. Ghost rendered by template: `v-if="adrag && adrag.type === 'create'" class="ghost" :style="ghostStyle"`
4. `endDrag(true)`: if `b.en-b.s < 3` -> return. Else `emit('create-block', b.s, b.en)`
5. App.vue handles event -> sets `editingBlock=null, createTimes={start,end}, showModal=true`
6. EditModal watcher picks up `createTimes` -> populates form via v-model

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Ghost element | Created/removed via DOM API | Rendered reactively (v-if) |
| Ghost text | `textContent = "HH:MM - HH:MM"` | **NO text content** in ghost template (empty `<div>`) |
| Dlabel text | `fmt(b.s)+' - '+fmt(b.en)+'（'+duration+'m，↑↓微调）'` | Same format (dlabel shows the info, ghost doesn't need text) |
| Min height check | `< 3` (px) | `< 3` (px) -- same |
| Modal open | Direct call to `openCreate()` | Event emit -> parent state -> EditModal watcher |
| Focus | `setTimeout(()=>document.getElementById('mTitle').focus(),30)` | `nextTick(() => { document.getElementById('mTitle')?.focus() })` |

**⚠️ MINOR: Ghost element has no time text in NEW.** The dlabel shows the same info, so the user still sees the time range, but the ghost itself is visually empty (just the blue-tinted box). Both the dlabel and ghost serve the same purpose in OLD; in NEW only the dlabel shows text.

---

## Flow 5: Click existing block -> edit modal opens

### Paths

**OLD**:
1. block `click` -> if `a` tag or `suppressClick` -> return
2. `openEdit(ev)`: sets `editingId=ev.id`, populates DOM fields (mTitle.value, mStart.value, ...), `selectedTags=(ev.tags||[]).slice()`, unhides Delete/Copy buttons, `renderTagChips()`, `updateNotePrev()`, `showModal()`

**NEW**:
1. block `@click="onBlockClick($event, ev)"` -> check `a` tag, `suppressClick` -> `emit('edit-block', ev)`
2. App.vue `onEditBlock(block)`: sets `editingBlock.value=block, createTimes.value=null, showModal.value=true`
3. EditModal watcher `[props.show, props.editingBlock, props.createTimes]` -> populates reactive v-model fields, `updatePreview()`

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Form binding | Direct DOM `.value = ...` | v-model (two-way reactive) |
| Delete/Copy buttons | `element.hidden = true/false` | `v-show="!!editingBlock"` |
| Focus | `setTimeout(30ms)` | `nextTick()` |
| Tags | Global `selectedTags` array | Component-scoped `selectedTags.value` ref |

**No behavioral differences** -- same values, same results.

---

## Flow 6: Edit block -> change title/tags/note/time -> save

### Paths

**OLD** (`saveBlock()` line 540):
```
Read values from DOM (mStart.value, mEnd.value, mTitle.value, mNote.value)
Create rec object with id: editingId || newId()
loadBlocks() from localStorage (re-reads ALL blocks)
If editingId -> map/replace; else push
blocks=list; saveBlocks(); render(); closeModal()
```

**NEW** (EditModal.vue `save()`):
```
Read values from reactive refs (mStart.value, mEnd.value, mTitle.value, mNote.value)
Create rec object with id: props.editingBlock?.id || newId()
If editingBlock -> store.updateBlock(rec); else store.addBlock(rec)
emit('close')
```

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Block data source | Re-reads all blocks from localStorage (fresh read) | Modifies Pinia store in-place (may have stale `store.blocks` if another tab modified) |
| ID generator | `newId()` function: `'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)` | Inline same pattern |
| Render after save | Full `render()` (re-reads localStorage, rebuilds DOM) | Reactive update via Pinia (Timeline re-renders via `layoutBlocks` computed) |
| Toast | None | None |

**⚠️ MINOR: OLD re-reads from localStorage (sync with other tabs); NEW uses in-memory store only.** If the user has the same app open in another tab and modifies data, the save could overwrite.

---

## Flow 7: Press T key -> quick create at current time

### Paths

**OLD** (keydown handler):
```
Check !anyModalOpen() && !inField()
s = today ? now minutes : 540
s = round(s/5)*5; clamp to 1380
openCreate(s, min(s+defaultDuration, 1440))
```

**NEW** (App.vue `onWindowKeyDown`):
```
Check !anyModal && activeElement not INPUT/TEXTAREA/SELECT
s = today ? now minutes : 540
s = round(s/5)*5; clamp to 1380
duration = settings.defaultDuration
editingBlock=null; createTimes={start:s, end:min(s+duration,1440)}; showModal=true
```

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Duration source | Global `defaultDuration` var | `settings.defaultDuration` from Pinia store |
| Modal trigger | `openCreate()` direct call | Component state setting -> EditModal watcher |
| Input guard | `inField()` checks INPUT/TEXTAREA | `e.target.tagName !== 'INPUT'/'TEXTAREA'/'SELECT'` -- SAME |

**No behavioral differences.**

---

## Flow 8: Right-click block -> select -> right-click another -> multi-select

### Paths

**OLD** (line 502):
```
contextmenu -> preventDefault, stopPropagation
Toggle selectedBlocks (Set)
render() -- full DOM rebuild of all blocks
Always toast: either count or "已取消勾选"
```

**NEW** (Timeline.vue `onBlockContextMenu`):
```
@contextmenu.prevent="onBlockContextMenu(ev)"
Toggle store.selectedBlocks
Conditional toast: "已取消勾选" only when going to 0; always toast on selection
No full re-render (reactivity handles class binding)
```

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Render after toggle | Full `render()` (DOM rebuild) | Class binding: `:class="{ bsel: selectedBlocks.has(ev.id) }"` |
| Toast on deselect (n>1 -> n-1) | Always toasts "已勾选 N 个" | **Silent** -- no toast for deselecting when count remains >0 |
| Toast text on deselect to 0 | "已取消勾选" | `STR.toast.unselected` = "已取消勾选" (same) |
| Selection display | `.bsel` class added via DOM | `:class="{ bsel: selectedBlocks.has(ev.id) }"` |

**⚠️ BEHAVIORAL DIFFERENCE: NEW is silent when deselecting one of many (e.g., 3 -> 2).** OLD always toasts. The NEW behavior is arguably better (less noise), but it's different.

---

## Flow 9: Delete key with blocks selected

### Paths

**OLD**:
```
keydown Delete/Backspace -> check !anyModalOpen()
-> preventDefault -> if selectedBlocks.size -> deleteSelected()
deleteSelected(): showConfirm("确定删除勾选的 N 个时间块？")
-> loadBlocks().filter -> saveBlocks -> selectedBlocks=Set() -> render()
No toast after deletion
```

**NEW** (Timeline.vue `onKeyDown` -> `onDeleteSelected`):
```
keydown Delete/Backspace -> check no .overlay in DOM
-> if selectedBlocks.size -> preventDefault -> onDeleteSelected()
onDeleteSelected(): showConfirm(STR.confirm.deleteSelected(n))
-> store.deleteSelectedBlocks() -> toast(STR.toast.deleted)
```

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Confirmation text | "确定删除勾选的 N 个时间块？" | "确定删除选中的 N 个时间块？" -- **"勾选的" vs "选中的"** |
| Toast after delete | **None** | `toast(STR.toast.deleted)` = "已删除" |
| Modal overlay check | `anyModalOpen()` (checks all 9 overlay elements) | `document.querySelector('.overlay')` (checks DOM for any overlay class) |
| Selection clearance | `selectedBlocks=new Set()` | `store.selectedBlocks.clear()` inside `deleteSelectedBlocks()` |

**⚠️ MINOR: Different confirmation wording ("勾选的" vs "选中的"). NEW adds a success toast. Overlay detection uses different mechanism.**

---

## Flow 10: Ctrl+C on selected blocks -> switch date -> Ctrl+V

### Paths

**OLD**:
```
copySelected(): filter selected from loadBlocks(), sort by start, map to clean objects, set clipboard, toast
doPaste(): if overGrid -> anchor = round(lastHoverMin/5)*5 -> offset
  create new blocks with newId(), concat to loaded blocks, saveBlocks(), set selected, render(), toast
```

**NEW** (Timeline.vue):
```
store.copySelected() (same logic)
doPaste() (local function, not using store.pasteBlocks):
  if overGrid.value -> anchor -> offset
  create new blocks with newId(), store.addBlock() each, set selected, toast
```

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| `store.pasteBlocks()` | Not applicable (no store) | **Defined but unused** -- `doPaste()` implements paste inline with partially duplicated logic |
| Anchored paste toast | Shows anchor time: `"（09:30 起）"` | Shows abstract: `"（锚定位置）"` |
| ID generation | `newId()` function | Inline same pattern |
| Block committing | Save all at once (concat + saveBlocks) | Individual `store.addBlock()` calls (multiple save operations in loop) |

**⚠️ MINOR: `store.pasteBlocks()` exists but is not used. Anchored paste toast lost the specific anchor time display and shows a generic string.**

---

## Flow 11: Click More -> click Settings -> change opacity -> blocks update

### Paths

**OLD**:
1. settingsBtn click -> populate DOM fields -> show overlay
2. `elOp.addEventListener('input', ...)`:
   - `blockOpacity = parseInt(elOp.value)`
   - `elOpV.textContent = blockOpacity+'%'`
   - `localStorage.setItem('timelog:blockOpacity', blockOpacity)`
   - **`render()`** -- forces full re-render of all blocks with new opacity

**NEW** (SettingsPanel.vue):
1. `onOpacityInput(e)` -> `settings.setBlockOpacity(e.target.value)`:
   - Updates `settings.blockOpacity` ref
   - Writes to localStorage
   - **Does NOT trigger any re-render of blocks**

2. Timeline.vue reads opacity via `colorOf()` in `store/timelog.js`:
   ```js
   const blockOpacity = parseInt(localStorage.getItem(KEY_PREFIX + 'blockOpacity')) || 15
   ```
   This is read from localStorage **directly, not reactively**.

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Opacity change trigger | `input` event -> `render()` | `input` event -> settings store update |
| Block re-render | **YES** -- `render()` rebuilds all blocks | **NO** -- no reactive connection between opacity change and block re-render |
| How blocks read opacity | Global `blockOpacity` var set during input handler | `localStorage.getItem()` inside `colorOf()` -- **not reactive** |

**⚠️ CRITICAL: Opacity slider does NOT cause blocks to visually update in the Vue 3 version.** The `colorOf()` helper reads blockOpacity from `localStorage.getItem()` which is not a reactive source. There is no watcher or trigger to force block re-rendering when opacity changes. Blocks only update their appearance when something else triggers a re-render (e.g., block edit, date nav, etc.).

---

## Flow 12: ESC when modal open -> closes topmost

### Paths

**OLD** (keydown handler):
```
Escape -> preventDefault
const escOvs = [overlay, setOverlay, helpOverlay, txOverlay, tagOverlay, exOverlay, mgOverlay, imOverlay, dlgOverlay];
top = [...escOvs].reverse().find(o => !o.hidden)
if top==dlgOverlay -> closeDialog(false)
else if top==overlay -> closeModal()
else if top==imOverlay -> imOverlay.hidden=true; pendingImport=null
else if top -> top.hidden=true
else if dropdown.open -> close dropdown
else if selectedBlocks.size -> clear + render()
```

**NEW** (App.vue `onWindowKeyDown` + Timeline.vue `onKeyDown`):
```
App.vue:
Escape -> series of if-statements (priority order):
  showModal -> closeModal() + return
  showSettings -> false + return
  showExport -> false + clear jsonImportData + return
  showHelp -> false + return
  showTagMgr -> false + return
  showDataMgr -> false + return
  return (not handled)
  
Timeline.vue:
Escape + selectedBlocks.size -> clear + toast
```

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Closing mechanism | DOM `overlay.hidden` toggling | Boolean ref toggling |
| dlgOverlay/confirm dialog | `closeDialog(false)` via global handler | `@keydown.escape.stop="$emit('close')"` on ConfirmDialog |
| imOverlay cleanup | `pendingImport = null` | `jsonImportData.value = null` |
| More dropdown close on Escape | **YES** -- closes dropdown if no overlays | **NO** -- dropdown remains open |
| Pending import cleanup on Escape | Cleared (`pendingImport=null`) | Cleared (`jsonImportData.value=null`) |
| Tab cycling | Global keydown handler with overlay search | Per-component `trapFocus` functions (same behavior) |

**⚠️ MINOR: Escape does not close the More dropdown in the NEW version (Line 14: `@click.stop="showMore = !showMore"` -- no Escape handling for the dropdown).**

---

## Flow 13: Open help with ? key -> check content

### Paths

**OLD** (keydown handler line 610):
```
Check !anyModalOpen() && !inField()
helpOverlay.hidden = false
Content: 4 sections in HTML (时间块操作, 快捷键, 数据备份, 文本导入/导出)
Includes icon in h2: <img src="icons/icon.svg">
Close button: #helpClose click -> helpOverlay.hidden=true
```

**NEW** (App.vue `onWindowKeyDown`):
```
Check showHelp is false (not already open)
showHelp.value = true
HelpPanel renders 4 identical sections
h2 does NOT include icon.svg
Close button emits 'close'
```

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| h2 content | Includes `<img src="icons/icon.svg">` | **Plain h2: "操作指南"** -- no icon |
| Keyboard shortcut symbols | Literal `↑↓` and `±` in HTML | HTML entities `&uarr;` `&darr;` `&plusmn;` (same visual) |
| Focus trap | None | `trapFocus` function (Tab cycling) |
| Escape handling | Global keydown handler | `@keydown.escape="emit('close')"` on overlay |

---

## Flow 14: Export text -> check format matches

### Paths

**OLD** (`buildExport()` line 555):
```
loadBlocks().slice().sort((a,b)=>a.start-b.start).map(ev => {
  t = ev.tags.length ? ':' + ev.tags.join(',') : ''
  return '- (' + fmt(ev.start) + '-' + fmt(ev.end) + t + ')' + (ev.title||'') + ';'
    + (ev.note||'').replace(/\n(.*)/g, (m, line) =>
      /^\s*(?:[-*]|\d+\.)\s/.test(line) ? '\n\t' + line : '\n ' + line)
}).join('\n')
```

**NEW** (ExportPanel.vue `buildExport()`):
```
Identical logic, identical regex, identical format.
```

### Differences: **NONE**
The export format is identical. Same tag encoding (`:tag1,tag2`), same note indentation rules (tabs for list lines, spaces otherwise), same overall structure.

---

## Flow 15: Tauri backup (if TAURI present) -> auto-save on change

### Paths

**OLD**:
1. `scheduleSave()`: if TAURI && backupOn -> `setTimeout(doAutoSave, 500)`
2. Called from `saveBlocks()`, `saveTags()`, `confirmImport()`, `deleteBlock()` in manage modal
3. `doAutoSave()`: reads lastBackupDate, writes daily snapshot, rotates, writes main JSON
4. Tauri API: `INVOKE('plugin:fs|write_text_file', enc.encode(text), {headers: {...}})`

**NEW** (backup.js + App.vue):
1. App.vue watches `store.blocks` and `tagStore.tags` with `{ deep: true }` -> calls `onDataChanged()` -> `scheduleSave()`
2. `scheduleSave()`: `setTimeout(doAutoSave, 500)` (same timeout)
3. `doAutoSave()`: same backup logic (daily snapshot, rotate, write)
4. Tauri API: `TAURI.fs.writeTextFile(path, text, options)` -- simpler API
5. `initBackup()` dispatches `backup:restored` event when restoring from backup file

### Differences

| Aspect | OLD | NEW |
|--------|-----|-----|
| Tauri API | `INVOKE('plugin:fs|...')` raw invoke | `TAURI.fs.*` high-level API |
| Text encoding | `enc.encode(text)` manual | Handled by Tauri API |
| Backup trigger | `scheduleSave()` called from `saveBlocks()/saveTags()` | `watch` on Pinia stores with `{ deep: true }` |
| Backup restore notification | `render()` + `renderTagChips()` called directly | Dispatches `backup:restored` event; App.vue listens and calls `store.loadBlocks()` + `tagStore.loadTags()` |
| `tReadDir` return type | Array of objects with `.name` property | Array of strings (filenames only, pre-filtered by taur.js) |

---

## ADDITIONAL FINDINGS

### F-1: `DataManager.vue` has built-in JSON import feature not present in OLD
OLD manage modal had no import functionality. NEW DataManager includes "导入备份" section with file input + merge import. This is an **extension** of functionality, not a regression.

### F-2: Note preview scroll sync identical
Both versions synchronize scroll between textarea and preview div using the same formula:
```
pv.scrollTop = fm > 0 ? (ta.scrollTop / fm) * tm : 0
// where fm = scrollHeight - clientHeight of textarea, tm = same for preview
```

### F-3: `updateBlock()` in store adds block if not found (lenient behavior)
OLD `saveBlock()` in edit mode: `list=list.map(b=>b.id===editingId?rec:b)` -- if id not found, rec is not added.
NEW `updateBlock()`: `if idx !== -1 blocks[idx] = rec; else blocks.push(rec)` -- falls back to add.
This means editing a block that was somehow removed from the in-memory array will add it back instead of failing silently.

### F-4: Tag rename handling differs in cross-day propagation
OLD tagSave handler: checks ALL localStorage keys for rename via `replaceTagInBlocks()`.
NEW TagManager `onSave()`: calls `tagStore.replaceTagInBlocks()` which checks only `store.blocks` (current day) first, then scans ALL localStorage keys for full cross-day coverage. Same net effect.

### F-5: Tag deletion from blocks differs
OLD: `removeTagFromBlocks()` scans ALL localStorage keys, and also the current day's blocks.
NEW TagManager: `removeTagFromBlocksAll()` function scans ALL localStorage keys. The TagStore's `deleteTag(index)` calls `removeTagFromBlocks(name)` which scans all keys AND updates in-memory blocks. Same net effect.

### F-6: `exportbox` min-height differs between export and import
OLD: both export and import use class `exportbox` with same CSS.
NEW: import mode has `exportbox import-area` with `min-height: 180px; height: 34vh` vs export's `min-height: 360px; height: 56vh`.

### F-7: `mTags` ref for chip keyboard navigation
OLD: `document.querySelector('#mTags .chip:not(.add)')` used directly in `focusFirstChip()` (Enter from time inputs).
NEW: Same logic in EditModal.vue `focusFirstChip()`. Also uses `mTagsRef` template ref for wrap detection in chip keyboard navigation.

### F-8: `buildBlockStyle` lacks direct reactivity for `isToday` now-line
The nowline `v-if="isToday"` checks `dkey(new Date()) === store.dateKey`. This is reactive because `store.dateKey` is a computed that depends on `store.curDate`. The `nowMin` ref is updated by interval timer. **Same behavior.**

### F-9: `layout()` mutates blocks in-place (adding `_col` and `_cols`)
OLD: calls `layout(blocks)` which mutates the array in-place (adds `_col` and `_cols` to each block object).
NEW: `layoutBlocks = computed(() => layout(store.blocks))` -- also mutates blocks in-place during computed evaluation. Since computed re-runs on dependency change, this is fine but means the block objects get mutated on each render cycle.

### F-10: `copyBlock()` in EditModal reads live form values vs `editingBlock`
OLD copy handler: reads from DOM form fields (mStart.value, etc.)
NEW `copyBlock()`: reads from reactive refs (mTitle.value, etc.)
Same logic: copies the current form state, not the original block state.

---

## SUMMARY OF ALL DIFFERENCES

### Critical (behavioral/visual bugs)

| # | Flow | Issue |
|---|------|-------|
| C1 | 1 (all) | `PX_MIN`=1.33 vs 1.0 -- entire timeline is 33% taller |
| C2 | 3 (resize) | No live visual feedback during resize drag -- block snaps on mouseup |
| C3 | 11 (opacity) | Opacity slider has no effect on blocks -- no reactive re-render |
| C4 | 11 (opacity) | `colorOf()` reads from localStorage directly, not from Pinia, breaking reactivity |

### Behavioral differences

| # | Flow | Issue |
|---|------|-------|
| B1 | 8 (multi-select) | NEW silent when deselecting one of many (OLD always toasts) |
| B2 | 9 (delete) | Confirmation wording "选中的" vs "勾选的" |
| B3 | 9 (delete) | NEW adds "已删除" toast after deletion |
| B4 | 9 (delete) | Overlay detection: `document.querySelector('.overlay')` vs `anyModalOpen()` |
| B5 | 10 (paste) | Anchored paste toast: "（锚定位置）" vs "（HH:MM 起）" |
| B6 | 10 (paste) | `store.pasteBlocks()` is defined but unused |
| B7 | 13 (help) | Help modal h2 missing icon.svg (visual difference only) |
| B8 | 12 (Escape) | More dropdown not closable via Escape in NEW |
| B9 | 6 (save) | `updateBlock()` falls back to add if id not found |
| B10 | 1 (init) | `saveBlocks()` removes empty-day keys in NEW (vs always writing) |

### Timing / initialization differences

| # | Flow | Issue |
|---|------|-------|
| T1 | 1 | `scrollToNow()` called after `initBackup()` in NEW (order swapped vs OLD) |
| T2 | 1 | Now line auto-updates every 60s in NEW (static in OLD) |
| T3 | 1 | Date nav auto-scrolls to now when navigating to today in NEW (only "今天" button in OLD) |
| T4 | 5 | Focus uses `nextTick()` in NEW vs `setTimeout(30ms)` in OLD |
| T5 | 15 | Backup trigger via `watch(deep)` in NEW vs explicit calls in OLD |

### Visual / styling differences

| # | Flow | Issue |
|---|------|-------|
| V1 | 4 | Ghost element has no time text in NEW (dlabel still shows it) |
| V2 | 3 | `.resizing` class never applied in NEW (CSS exists but unused) |
| V3 | 13 | Help modal h2 has no icon |
| V4 | 14 | exportbox `resize: vertical` in NEW only |
| V5 | 1 | Default tags are an entirely different set |

### Architecture differences (not behavioral)

| # | Area | Issue |
|---|------|-------|
| A1 | All | DOM manipulation -> Vue reactivity / Pinia stores |
| A2 | 12 | Per-component `trapFocus` vs single global Tab handler |
| A3 | 13 | HTML entities for special chars vs literal chars (same rendering) |
| A4 | 15 | Tauri v2 `TAURI.fs.*` API vs `INVOKE('plugin:fs|...')` |
| A5 | All | Per-component scoped CSS vs single global `<style>` block |

# Task 4 Report: 迁移编辑弹窗和标签 Store

**Status:** DONE

**Last commit hash:** `332eb82108f32a71b78fa2f854c77f4be9da2c29`

**Build status:** PASS

**Files created:**
- `frontend/src/store/tags.js` — Pinia store with full tag CRUD, color normalization, tag rename/replace across all date keys, default tags (专注/摸鱼/学习/工作/运动/社交)
- `frontend/src/components/EditModal.vue` — Full edit/create modal with: overlay backdrop (click to close), time inputs (start/end), title input, grouped tag chips with keyboard navigation (Space toggles, Enter moves between groups), note textarea with real-time markdown preview and one-way scroll sync, action buttons (delete/copy/cancel/save), focus trap (Tab/Shift+Tab), Enter key navigation (time→first chip, title→save)

**Files modified:**
- `frontend/src/App.vue` — Added `EditModal` integration with `showModal`/`editingBlock`/`createTimes` state; event handlers for `edit-block`, `create-block` (from Timeline), `close`, `manage-tags`; `T` key shortcut for quick create at current time (window-level listener)
- `frontend/src/components/Timeline.vue` — Added `modalOpen` prop to suppress keyboard shortcuts when the edit modal is open

**Behavior preserved from old code:**
- `openCreate()` / `openEdit()` → EditModal with `createTimes` or `editingBlock` props
- Tag chip rendering grouped by `group` field, same visual selection styling
- "管理标签" chip emits `manage-tags` for future tag manager modal
- Markdown preview shows/hides based on note content
- `saveBlock()` → `timelogStore.addBlock()` / `timelogStore.updateBlock()`
- Copy block sets `timelogStore.clipboard`
- Delete block removes from store
- Focus trap matches old `Tab` handler (cycles focusable elements in modal)
- `T` key creates a block at current time (rounded to 5min, 30min default duration)

**Stub:** `onManageTags()` in App.vue is a no-op placeholder — the tag manager modal will be built in a future task.

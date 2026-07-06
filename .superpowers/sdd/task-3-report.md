# Task 3 Report: 迁移时间轴核心逻辑到 store/timelog + Timeline 组件

**Status:** DONE

**Last commit hash:** `d9965bf08ac80dfa091b03103434dfe456337feb`

**Build status:** PASS

**Files created:**
- `frontend/src/store/timelog.js` — Pinia store for all time-block data (CRUD, clipboard, selection, date navigation, tag color lookup)
- `frontend/src/components/Timeline.vue` — Full timeline grid component with drag-to-create, edge resize, multi-select, keyboard shortcuts, now line, layout collision algorithm
- `frontend/src/utils/markdown.js` — `esc()`, `mdInline()`, `mdToHtml()` from old code (pure function copy)

**Files modified:**
- `frontend/src/App.vue` — Replaced placeholder with header (logo, title, date nav) + main area containing Timeline component
- `frontend/public/icons/logo.svg` — Copied from old `src/icons/icon.svg`

**Key design decisions:**
1. `pasteBlocks` in the store now returns the newly created blocks array (instead of `boolean`) so the Timeline component can select pasted blocks.
2. Window-level `mousemove`/`mouseup` listeners are used alongside template events for robust drag handling (mouse can leave `.day` during drag).
3. `colorOf` reads from `localStorage` directly as a stub — will be replaced by tag store in Task 4.
4. Scoped styles mirror the old CSS exactly for `.grid`, `.gutter`, `.day`, `.block`, `.ghost`, `.nowline`, `.dlabel` and all children.

**Concerns:**
- No toast notifications yet (old code uses a custom `toast()` function); the keyboard copy/paste UX will be silent until a shared toast utility is added.
- The ghost element uses `v-if` so it's removed from DOM entirely when not dragging (matches old behavior where it's created/removed dynamically).

# Task 5 Report: 迁移设置 store 和 SettingsPanel 组件

**Status:** DONE

**Commit:** 86db90b

**Build:** Success (Vite build, 37 modules, 589ms)

## What was done

### 1. Created `frontend/src/store/settings.js` — Pinia store
- All settings state from old `index.html` (lines 658-716) migrated to a Vue Pinia store
- `loadNum`/`loadBool` helpers replicate the old localStorage logic
- State refs: `defaultDuration`, `autoScroll`, `exportTimestamp`, `exportDialog`, `blockOpacity`, `bkCustomPath`, `borderless`, `keepDays`, `backupOn`
- Corresponding setter functions with localStorage persistence (`saveNum`/`saveBool`)
- All default values use the centralized constants from `constants.js`

### 2. Created `frontend/src/components/SettingsPanel.vue` — settings modal
- Full settings form reproducing `index.html` lines 189-243 faithfully:
  - Default duration (number input)
  - Auto-scroll checkbox
  - Export filename timestamp checkbox
  - Export save dialog checkbox
  - Block opacity (range slider 5-200 with live % display)
  - Backup path (text input with Save/Reset buttons + migrateBackups logic)
  - Borderless window checkbox (applies decorations immediately)
  - Auto backup checkbox
  - Backup strategy note
  - Keep N days (number input)
- `migrateBackups` function included inline for Tauri backup path migration
- Backup save/reset handlers from old code (lines 719-731)
- `applyBorderless` called on borderless toggle

### 3. Updated `frontend/src/App.vue`
- Added settings button (`⚙`) in the header
- Added window control buttons (min/max/close) in the header, with Tauri API integration
- Added `showSettings` state and `SettingsPanel` component
- Header drag support for Tauri (`startDragging`)
- `applyBorderless()` called on mount
- Quick-create (`T` key) now uses `settings.defaultDuration` instead of hardcoded 30

### Settings variables covered
| Variable | Source | Default |
|---|---|---|
| defaultDuration | `loadNum` | 30 |
| autoScroll | `loadBool` | true |
| exportTimestamp | `loadBool` | true |
| exportDialog | `loadBool` | false |
| blockOpacity | `loadNum` | 15 |
| bkCustomPath | localStorage | '' |
| borderless | `loadBool` | false |
| keepDays | `loadNum` | 0 |
| backupOn | `loadBool` | true |

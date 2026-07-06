# Task 9: Tauri Backup Utility & Integration

## Files Created

- **`D:/a_my/project/html/Timelog/frontend/src/utils/tauri.js`** — Thin wrappers over `window.__TAURI__` FS API (`tRead`, `tWrite`, `tReadDir`, `tRemove`), all guarded with `isTauri()` and try/catch.

- **`D:/a_my/project/html/Timelog/frontend/src/utils/backup.js`** — Full backup module extracted from old `src/index.html`:
  - Reactive `bkStatusText` / `bkStatusClass` refs (Vue integrated)
  - `initBackup()` — loads Tauri backup on mount, restores if localStorage is empty
  - `doAutoSave()` — daily snapshot rotation + data file write
  - `rotateBackups()` — keeps max 4 backup files
  - `scheduleSave()` / `scheduleClean()` / `cleanOldDays()` — debounced auto-save and old-day cleanup
  - `getAllData()` / `restoreAllData()` — localstorage serialisation
  - `migrateBackups()` — cross-directory backup migration (uses raw `invoke` for custom paths)
  - `setBk()` — updates reactive indicator state

## Files Modified

- **`D:/a_my/project/html/Timelog/frontend/src/App.vue`**
  - Imports `bkStatusText`, `bkStatusClass`, `setBackupPrefs`, `initBackup`, `scheduleSave`, `scheduleClean` from `backup.js`
  - Imports `useTagStore` and `watch`
  - Header template: added `.backup` container with status dot (`<span class="dot" :class="bkStatusClass">`) and text, shown only when `bkStatusText` is non-empty
  - `onMounted`: calls `setBackupPrefs()` then `initBackup()`; watches `settings.backupOn/bkCustomPath/keepDays/borderless`; watches `store.blocks` and `tagStore.tags` (deep) to trigger `scheduleSave()`/`scheduleClean()`
  - Listens to custom event `backup:restored` to reload stores after restore
  - Properly cleans up event listeners on `onUnmounted`

- **`D:/a_my/project/html/Timelog/frontend/src/components/SettingsPanel.vue`**
  - Replaced inline `migrateBackups()` with import from `../utils/backup.js`

## Build

```
vite v6.4.3 building for production...
54 modules transformed.
✓ built in 773ms
```

Zero errors. All imports resolve correctly.

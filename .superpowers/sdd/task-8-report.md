# Task 8 Report: Toast / Confirm / Help

**Status: DONE**

## Build Status: SUCCESS

## Files Created
- `frontend/src/composables/useToast.js` — Toast composable with module-level reactive state
- `frontend/src/composables/useConfirm.js` — Confirm/Alert composable with Promise-based API
- `frontend/src/components/Toast.vue` — Floating toast at bottom center with transition
- `frontend/src/components/ConfirmDialog.vue` — Centered confirm/alert card with focus trap, ESC close, backdrop dismiss
- `frontend/src/components/HelpPanel.vue` — Help overlay with gradient-left-border sections and all keyboard shortcuts

## Files Modified
- `frontend/src/strings.js` — Populated with all Chinese user-facing strings (toast, confirm, btn)
- `frontend/src/App.vue` — Added Toast, ConfirmDialog, HelpPanel rendering; `?` help button; `?` key shortcut; TagManager/DataManager state management
- `frontend/src/components/EditModal.vue` — Added confirm dialog for delete, toast for copy
- `frontend/src/components/Timeline.vue` — Added confirm dialog for delete selected blocks, toasts for context menu and escape clear
- `frontend/src/components/ExportPanel.vue` — Replaced `alert()` calls with `showAlert()`
- `frontend/src/components/TagManager.vue` — Replaced `confirm()` calls with `showConfirm()`
- `frontend/src/components/DataManager.vue` — Replaced `confirm()`/`alert()` calls with `showConfirm()`/`showAlert()`
- `frontend/src/components/SettingsPanel.vue` — Replaced `confirm()` call with `showConfirm()`

## Notes
- The `useConfirm` composable uses module-level refs so any component can call `showConfirm(msg)` / `showAlert(msg)` and get a Promise result
- `ConfirmDialog` renders as a child of App.vue, driven by the composable's state
- `Toast` renders at z-index 9999 with fade transition, auto-dismisses after `TOAST_DURATION` ms
- `HelpPanel` mirrors the old `helpOverlay` HTML exactly with all four sections

# Task 7: Tag & Data Manager Components

**Status:** DONE

## Summary

Implemented TagManager and DataManager Vue 3 components and integrated them into App.vue.

## Files Created/Modified

### Created
- `D:/a_my/project/html/Timelog/frontend/src/components/TagManager.vue`
- `D:/a_my/project/html/Timelog/frontend/src/components/DataManager.vue`

### Modified
- `D:/a_my/project/html/Timelog/frontend/src/App.vue`

## TagManager.vue

- Overlay + modal with "管理标签" title
- Editable tag rows: color picker, name input, group input, delete button
- "＋ 新增标签" button appends empty tag row
- Uses draft-based editing: tags are cloned on open, changes applied on "保存"
- Delete tag: confirm() dialog → removes from ALL date blocks + store
- Rename tag: confirm() dialog → replaces old name in all blocks
- "保存" processes all changes (deletes, renames, deduplication) at once
- "取消" closes without changes
- Uses browser confirm()/alert() as placeholder (Task 8 will provide proper dialog)

## DataManager.vue

- Overlay + modal with "数据管理" title
- Date range delete: from/to date inputs + "删除" button with confirm()
- Date list with per-day delete: shows date, block count, hours, each with "删除整天" button
- "全部删除" button with confirm()
- Import JSON: file picker → merge import with deduplication
- Emits "changed" event on any data modification
- Uses browser confirm()/alert() as placeholder

## App.vue Changes

- Imported and registered TagManager and DataManager components
- Added header buttons: 🏷 (标签) and 📊 (数据管理)
- Wired `onManageTags()` in EditModal to open TagManager
- `onTagMgrSaved()` and `onDataMgrChanged()` handlers reload timelog store
- Updated keydown handler to respect new modal states

## Build

`npx vite build` succeeded — 52 modules transformed, no errors.

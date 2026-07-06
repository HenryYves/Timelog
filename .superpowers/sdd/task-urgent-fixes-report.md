# Urgent UI Fixes Report

## Fix 1: Overlay/Modal Not Visible (Settings, TagManager, DataManager, Help, Export)

**Root cause confirmed.** The `.overlay` and `.modal` base CSS classes were duplicated as `<style scoped>` in EditModal.vue, TagManager.vue, DataManager.vue, HelpPanel.vue, and ExportPanel.vue. Due to Vue's CSS scoping, each component's styles were invisible to other components. SettingsPanel.vue had no scoped styles at all, making its overlay completely invisible.

**Fix applied:**
- Moved `.overlay`, `.modal`, `.modal h2`, `.modal .sub`, `.modal label`, `.modal input[type=*]`, `.modal textarea`, `.modal input:focus`, `.modal textarea:focus`, and `.overlay[hidden]` to `frontend/src/style.css` as global styles.
- Removed duplicate scoped CSS from EditModal.vue (keeping EditModal-specific `.timerow`, `.grouplabel`, `.tagwrap`, `.chip`, `.tdot`, `.mdhint`, `.mdprev`, `#mNote`, `#mNotePrev` styles).
- Removed entire scoped block from TagManager.vue (all styles now global or already in style.css).
- Removed overlay/modal scoped styles from DataManager.vue, HelpPanel.vue, and ExportPanel.vue.

## Fix 2: Time Blocks Nested Scrollbar

**Verification result.** Timeline.vue scoped CSS already matches the old `index.html` code exactly:
- `.block { overflow: hidden; }` -- present at line 527
- `.bnote { overflow: hidden; }` -- present at line 587
- No `overflow-y: auto` or `overflow: auto` is set on any `.block` child element
- `.btags` has correct `overflow: hidden` for text truncation

No changes needed.

## Fix 3: TagManager Layout

**Root cause.** The `.tagrow` styles (`.tagrow`, `.tagrow input[type=color]`, `.tagrow input[type=text]`, `.tagrow .tn`, `.tagrow .tg`) were duplicated in both EditModal.vue scoped and TagManager.vue scoped. The TagManager.vue scoped copy worked for TagManager, but EditModal's copy was dead code. Since both components use `.tagrow`, the styles are better as globals.

**Fix applied:**
- Moved all `.tagrow` styles to `frontend/src/style.css` as global.
- Removed `.tagrow` styles from EditModal.vue scoped.
- (TagManager.vue's scoped block was removed entirely as part of Fix 1 cleanup.)

## Build Result

`npx vite build` completed successfully with 64 modules transformed, zero errors.

## Files Changed

- `frontend/src/style.css` -- added overlay/modal/tagrow global styles
- `frontend/src/components/EditModal.vue` -- removed overlay/modal/tagrow from scoped
- `frontend/src/components/TagManager.vue` -- removed entire scoped block
- `frontend/src/components/DataManager.vue` -- removed overlay/modal from scoped
- `frontend/src/components/HelpPanel.vue` -- removed overlay/modal from scoped
- `frontend/src/components/ExportPanel.vue` -- removed overlay/modal from scoped

# Deep CSS & Visual Fidelity Audit: OLD vs NEW Timelog

**Date:** 2026-07-06
**Scope:** OLD `src/index.html` lines 7-147 vs all NEW `frontend/src/` CSS files
**Result: 7 confirmed differences, 2 potentially significant regressions, and several minor observations.**

---

## 1. MISSING CSS RULES (OLD has, NEW does not)

### 1A. `#exText` — ENTIRE RULE MISSING
**OLD (line 102):**
```css
#exText{white-space:pre-wrap;overflow-wrap:break-word;word-break:break-word;overflow-x:hidden;}
```
**NEW:** This rule has no replacement anywhere. The export textarea in `ExportPanel.vue` uses `<textarea class="exportbox" readonly :value="exText">` — only the `.exportbox` class applies, which has `white-space: pre; overflow: auto;` (no wrapping). This is a **significant visual regression**: the OLD export text wrapped lines; the NEW export text will scroll horizontally with no wrapping.

### 1B. `.dlg-overlay[hidden]` — RULE MISSING
**OLD (line 138):** `.dlg-overlay[hidden]{display:none;}`
**NEW:** `ConfirmDialog.vue` uses `v-if="show"` for show/hide, so the `[hidden]` attribute is never generated. **Mitigated**: Vue's conditional rendering handles visibility, so this is technically not a visual regression. However, if any code externally sets the `hidden` attribute on the dialog overlay, it would show through.

### 1C. `.gutter { width }` — MOVED FROM CSS TO INLINE STYLE
**OLD (line 39):** `.gutter{width:56px;flex:none;position:relative;}`
**NEW (Timeline.vue scoped, line 493-496):** `.gutter { flex: none; position: relative; }` — width removed from CSS.
**NEW inline:** `:style="{ width: GUTTER_WIDTH + 'px' }"` where `GUTTER_WIDTH = 56` (from `constants.js`).
**Verdict:** Functionally equivalent as long as `GUTTER_WIDTH` stays 56. The CSS rule is technically missing but the width is applied identically via inline style.

---

## 2. VALUE / BEHAVIOR DIFFERENCES

### 2. `.exportbox` — ADDED `resize: vertical`
**OLD (line 100-101):** No `resize` property.
**NEW (ExportPanel.vue scoped, line 318-332):** Adds `resize: vertical;` at the end.
**Impact:** Users can now resize the export/import textarea vertically. Minor behavioral addition.

### 3. `.toast` — ADDED `white-space: nowrap`
**OLD (JS inline style, line 475):** No `white-space` property.
**NEW (Toast.vue scoped, line 14-30):** Adds `white-space: nowrap;`.
**Impact:** Toast messages will no longer wrap to multiple lines. Minor behavioral change — prevents multi-line toasts.

### 4. `.ghost` — MISSING `left` / `right` POSITIONING
This is a **potentially significant visual regression**.

**OLD:** In JS `applyDrag()` (line 514):
```js
ghost.style.left='2px'; ghost.style.right='2px';
```
These are set as inline styles on the ghost element.

**NEW (Timeline.vue)**: The `ghostStyle` computed property (line 208-214) only provides `top` and `height`:
```js
return { top: ghostTop.value + 'px', height: ghostHeight.value + 'px' }
```
No `left` or `right` properties are set. The `.ghost` CSS class (line 616-627) has no `left`, `right`, or `width` defaults. With `position: absolute` inside `.day`, the browser default `left: auto; right: auto` will place the ghost at the left edge (`left: 0`) with shrink-to-fit width instead of spanning the day column with 2px margins on each side.

**Impact:** The ghost drag indicator will appear narrow (only as wide as its text) and flush against the left edge, instead of spanning the day column with 2px padding on each side as in OLD. This is a noticeable drag UX regression.

---

## 3. TEMPLATE STRUCTURE DIFFERENCES (non-CSS but affect visual layout)

### 5. Logo image path changed
- **OLD:** `src="icons/icon.svg"` (relative path)
- **NEW:** `src="/icons/logo.svg"` (absolute path, different filename `logo.svg` vs `icon.svg`)

**Impact:** If `logo.svg` doesn't exist at the web root's `/icons/logo.svg`, the logo won't display. Even if it exists, the file content might differ from `icon.svg`.

### 6. Logo position in DOM changed
- **OLD:** `<h1><img class="logo">时间块记录</h1>` — logo inline inside `<h1>`
- **NEW:** `<img class="logo"><h1>Timelog</h1>` — logo is a sibling before `<h1>`, both are flex children of `<header>`

**Impact:** 
- In OLD: The `.logo` CSS (`vertical-align: -4px; margin-right: 4px;`) affected inline positioning within the h1 text flow.
- In NEW: `vertical-align: -4px` has NO EFFECT on a flex child. The `margin-right: 4px` adds 4px before the `gap: 10px` between flex items, producing ~14px total gap between logo and "Timelog" text vs OLD's 4px.
- **Visual difference:** Logo-to-title spacing increased from ~4px to ~14px.

### 7. Title text changed
- **OLD:** `<h1>时间块记录</h1>` (Chinese, 6 characters)
- **NEW:** `<h1>Timelog</h1>` (English, 7 characters)

**Impact:** Different width, different appearance. The h1 styling is identical (`font-size: 16px; font-weight: 650; letter-spacing: .2px;`), but the rendered text is completely different.

---

## 4. SELECTOR DIFFERENCES

### 8. `.backup` CSS class — UNUSED (in both OLD and NEW)
**OLD (line 33):** `.backup{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--text2);}`
**NEW (style.css line 37):** Same rule exists.
**Both versions:** The `.backup` class is never referenced in templates. The backup status section uses inline styles directly in both OLD (`<div style="font-size:11px;...">`) and NEW (`<div style="font-size:11px;...">`). **Dead CSS, not a regression.**

---

## 5. COMPLETE VERIFICATION CHECKLIST

### Missing rules
| Rule | Status |
|------|--------|
| `:root` variables | Identical |
| `* { box-sizing }` | Present |
| `html, body` | Present |
| `body` font/color | Present |
| `header` | Present |
| `header h1` | Present |
| `.datenav` / `.datenav .date` | Present |
| `.spacer` | Present (global + duplicated scoped) |
| Header cursor/grab | Identical base64 |
| `button` / `button:hover` | Present |
| `button.primary/hover` | Present |
| `button.icon` | Present |
| `button.del` / `button.del:hover` | Present |
| `.dot` / `.dot.on` / `.dot.warn` | Present, same colors |
| `.hint` | Present, same styling |
| `main` | Present |
| `.grid` | Present (Timeline scoped) |
| `.gutter` width | **Moved to JS inline** (GUTTER_WIDTH=56) |
| `.gutter .hlabel` | Present |
| `.day` | Present |
| `.hourline` / `.halfline` | Present |
| `.block` / `.block.bsel` / `.block.resizing` | Present |
| `.block .cbar` / `.block .cbar i` | Present |
| `.block .bt` / `.block .bs` / `.block .btags` | Present |
| `.tdot` | Present |
| `.block .bnote` / `.bnote > div, li` | Present |
| `.block .bnote ul, ol` | Present |
| `.block .bnote nested lists` | Present (combined rule) |
| `mark` | Present |
| `.chip:focus-visible, .chip:focus` | Present |
| `.block .bnote code` | Present |
| `.block .bnote .md-h` | Present |
| `.block .bnote a` | Present |
| `.mdhint` | Present |
| `.mdprev` | Present |
| `#mNote, #mNotePrev` | Present |
| `#mNote { resize: none }` | Present |
| `.switchrow` / `.switchrow input` | Present |
| `.mdprev ul / ol / code / .md-h1 / .md-h / a` | Present |
| `.ghost` | Present, **but missing left/right** |
| `.nowline` / `.nowline::before` | Present |
| `.overlay` / `.overlay[hidden]` | Present (hidden via v-if) |
| `.modal` / `.modal h2` / `.modal .sub` | Present |
| `.modal label` | Present |
| `.modal input/textarea focus` | Present |
| `.timerow` / `.timerow input` / `.timerow span` | Present |
| `.grouplabel` / `.tagwrap` | Present |
| `.chip` / `.chip.sel` / `.chip.add` | Present |
| `.tagrow` rules | Present |
| `.actions` | Present (global + scoped duplicates) |
| `.exportbox` | Present, **adds `resize: vertical`** |
| `#exText` | **MISSING — wrapping removed** |
| `.copied` | Present |
| `.radio` / `.radio label` | Present |
| `.dayrow` / `.dinfo` / `.dmeta` | Present |
| `.divider` | Present |
| `.small` | Present (global + scoped duplicates) |
| `kbd` | Present |
| `.help-section` family | Present |
| `.logo` | Present |
| `.more-wrap` / `.more-btn` / `.more-btn img` | Present |
| `.dropdown` / `.dropdown.open` | Present |
| `.dropdown-item` / hover / img / .dot | Present |
| `.version` | Present |
| `.win-ctrls` / `.win-ctrls.on` | Present |
| `.win-btn` / hover / img / close:hover | Present |
| `.dlg-overlay` | Present |
| `.dlg-overlay[hidden]` | **MISSING (v-if replaces it)** |
| `.dlg-card` / `.dlg-msg` / `.dlg-btns` | Present |
| `.dlg-btns button` / `.dlg-ok` / `.dlg-cancel` | Present |

### Missing pseudo-elements
- `::before` on `.help-section` — PRESENT
- `::before` on `.nowline` — PRESENT

### Missing states
- `:hover` on `button`, `.more-btn`, `.dropdown-item`, `.win-btn`, `.dlg-ok`, `.dlg-cancel` — ALL PRESENT
- `:focus` / `:focus-visible` on `.chip` — PRESENT
- `:focus` on `.modal input/textarea` — PRESENT

### Missing animations/transitions
- `transition` on `button` (`background .12s, border-color .12s`) — PRESENT
- `transition` on `.win-btn` (`background .12s`) — PRESENT
- `transition` on `.dlg-btns button` (`background .12s, opacity .12s`) — PRESENT
- Toast opacity transition — **RESTRUCTURED** from JS-managed `opacity: 0` + `transition: opacity .2s` to Vue `<Transition>` classes (`.toast-enter-active`, `.toast-leave-active`). Functionally equivalent.

---

## 6. NEW CSS ADDITIONS (not in OLD)

| Rule | File | Purpose |
|------|------|---------|
| `.exportbox.import-area` | ExportPanel.vue scoped | Extracted from inline: `min-height:180px; height:34vh` |
| `.help-footer` | HelpPanel.vue scoped | Extracted from inline footer styles in OLD |
| `.toast-enter-active / leave-active` | Toast.vue scoped | Vue transition classes (was JS `setTimeout` opacity) |
| `.toast-enter-from / leave-to` | Toast.vue scoped | Vue transition start/end states |

---

## 7. SUMMARY OF CONFIRMED DIFFERENCES

| # | Severity | What | Old | New |
|---|----------|------|-----|-----|
| 1 | **HIGH** | Export text wrapping | `#exText { white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; overflow-x: hidden; }` | Rule missing entirely — text uses `.exportbox { white-space: pre; overflow: auto; }` — **no wrapping** |
| 2 | **HIGH** | Ghost drag positioning | JS sets `left: 2px; right: 2px` inline on ghost | `ghostStyle` only sets `top` and `height` — ghost will be narrow and left-aligned |
| 3 | LOW | `.exportbox` resize | Not resizable | Added `resize: vertical` |
| 4 | LOW | Toast wrapping | No `white-space` (wraps) | Added `white-space: nowrap` |
| 5 | MEDIUM | `dlg-overlay[hidden]` | CSS rule for hidden state | Missing (Vue v-if handles it) |
| 6 | LOW | `.gutter` width | In CSS: `width: 56px` | Moved to JS constant `GUTTER_WIDTH=56` in inline style |
| 7 | MEDIUM | Logo DOM position | `<h1><img.logo>时间块记录</h1>` — logo inside h1 | `<img.logo><h1>Timelog</h1>` — logo outside h1, spacing ~14px instead of 4px |
| 8 | MEDIUM | Title text | "时间块记录" (Chinese) | "Timelog" (English) |
| 9 | LOW | Logo file path | `icons/icon.svg` | `/icons/logo.svg` |
| 10 | INFO | `.backup` CSS class | Defined but never used | Defined but never used (same dead code) |

---

## 8. RECOMMENDATIONS

1. **RESTORE `#exText` wrapping:** Add `white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;` to the export textarea, either in `.exportbox` or as a dedicated rule. Without this, exported text will be unreadable for long lines.

2. **FIX ghost positioning:** Add `left: 2px` and `right: 2px` to the `ghostStyle` computed property or to the `.ghost` CSS class.

3. **Consider restoring `.dlg-overlay[hidden]`** for safety, though v-if covers the primary case.

4. **Align logo spacing:** If the ~14px logo-title gap is unintended, either remove the `margin-right: 4px` from `.logo` or adjust the `gap` on `header`.

5. **Verify logo file exists:** Ensure `/icons/logo.svg` exists with the same content as `icons/icon.svg`.

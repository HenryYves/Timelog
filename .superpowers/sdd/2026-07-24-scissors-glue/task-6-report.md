# Task 6 Report: Timeline.vue — glue area rendering + scissors/glue interactions

**Status:** Complete

## Changes

Modified: `frontend/src/components/Timeline.vue` (+231 / -98 lines)

### What was done

1. **Imports**: Added `getGlueBlocks`, `cutDay`, `glueBack`, `canCutForward`, `canCutBackward`, `addDays`, `isBefore` from timelog.js. Added `CutConfirm` and `GlueConfirm` component imports.

2. **Computed properties**: 
   - `glueBlocks` — separates blocks into `fromPrev` / `fromNext` / `today` groups
   - `layoutBlocks` now operates on `glueBlocks.value.today` (only non-cut blocks)
   - `gluePrevLayout` / `glueNextLayout` — single-column (`_col=0, _cols=1`) layout for glue blocks
   - `canCutFwd` / `canCutBwd` — constraint checks
   - `availableDirs` — which cut directions are allowed
   - `glueSourcePrev` / `glueSourceNext` — source dates for glue-back

3. **Right-click handling**:
   - `onDayMouseDown`: distinguishes right-click on empty day area (`_rightClickOnEmpty = true`) vs on a block
   - `onMouseUp`: detects right-click-no-drag → triggers `onDayRightClick` (scissors confirm)
   - `onDayRightClick`: validates constraints, opens CutConfirm modal
   - `onCutConfirm`: validates extreme/min/short-fragment cases, calls `cutDay()`
   - `onGlueAreaRightClick`: right-click on glue area background → opens GlueConfirm modal
   - `onGlueBackConfirm`: calls `glueBack()` and reloads blocks

4. **Template restructuring**:
   - Glue-from-prev section (before grid) with gutter, hour lines, half-hour lines, single-column blocks
   - Main grid (unchanged functionality)
   - Glue-from-next section (after grid)
   - CutConfirm and GlueConfirm modals at bottom

5. **Glue area helpers**: `glueHeight(area)` and `glueHours(area)` compute dynamic height/hour count for glue sections based on their block end times.

6. **CSS**: Added `.glue-section` (flex layout matching `.grid`) and `.glue-section .day` (default cursor instead of crosshair).

### Verification

- Build: PASS
- Tests: 123 passed (no regressions)

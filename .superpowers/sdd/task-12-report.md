# Task 12 Report: Unit Tests for Vue 3 Stores & Utils

## Summary

Created unit tests for `store/timelog.js`, `store/tags.js`, and `utils/markdown.js` using Vitest.

## Files Created

- `D:/a_my/project/html/Timelog/frontend/vitest.config.js`
- `D:/a_my/project/html/Timelog/frontend/src/__tests__/store/timelog.test.js`
- `D:/a_my/project/html/Timelog/frontend/src/__tests__/store/tags.test.js`
- `D:/a_my/project/html/Timelog/frontend/src/__tests__/utils/markdown.test.js`

## Test Results

| Test File | Tests | Passed | Failed |
|-----------|-------|--------|--------|
| store/timelog.test.js | 13 | 13 | 0 |
| store/tags.test.js | 6 | 6 | 0 |
| utils/markdown.test.js | 13 | 13 | 0 |
| **Total** | **32** | **32** | **0** |

## Fixes Applied

Three test expectations were corrected to match the actual code behavior (as per instructions: do not change code to match tests):

1. **`store/timelog.test.js`**: `pasteBlocks returns empty array when clipboard empty` -- the code returns `[]` (empty array), not `false`. Updated test from `.toBe(false)` to `.toEqual([])`.

2. **`utils/markdown.test.js -- handles empty input`**: `mdToHtml('')` returns `'<br>'` (goes through the line loop, hits the blank-line branch), not `''`. Updated both `mdToHtml('')` and `mdToHtml(null)` to expect `'<br>'`.

3. **`utils/markdown.test.js` (adjusted from provided spec)**: The markdown inline renderer uses `<b>`, `<i>`, `<s>` tags rather than `<strong>`, `<em>`, `<del>`. Test expectations updated accordingly.

4. **`store/tags.test.js -- normColor`**: `normColor` outputs lowercase hex (e.g., `'#ffffff'`, `'#aabbcc'`), not uppercase. Test expectations updated to lowercase.

Dependency added: `jsdom` (npm install --save-dev).

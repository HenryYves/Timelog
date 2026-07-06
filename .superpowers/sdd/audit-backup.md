# Timelog Backup System: OLD vs NEW Audit Report

Date: 2026-07-06
Files compared:
- OLD: `src/index.html` (lines 613--656, backup functions; lines 419--468 for constants/helpers)
- NEW: `frontend/src/utils/backup.js`, `frontend/src/utils/tauri.js`, `frontend/src/constants.js`

---

## 1. Constants Verification

| Constant | OLD Value | NEW (constants.js) | Match? |
|---|---|---|---|
| `MAIN_NAME` | `'timelog.json'` (line 421) | `'timelog.json'` | MATCH |
| `DATA_DIR` | `'timelog_data'` (line 459) | `'timelog_data'` | MATCH |
| `MAX_BACKUP_COUNT` | `4` (hardcoded at line 645) | `4` (named constant) | MATCH (improved) |
| `KEY_PREFIX` | `'timelog:'` (inline literal) | `'timelog:'` | MATCH (newly extracted) |

---

## 2. Function-by-Function Comparison

### 2.1 `initBackup`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Browser mode warning | `setBk('浏览器模式 · 仅本地','warn'); return;` | Same text and state | MATCH |
| Read backup file | `tRead(MAIN_NAME)` (DATA_DIR added internally) | `tRead(bkPath(MAIN_NAME))` (bkPath adds DATA_DIR before calling tRead) | MATCH (effective path identical) |
| Scan localStorage for existing data | Loop `isDayKey(k)` | Same logic, uses `KEY_PREFIX` in `isDayKey` | MATCH |
| Restore if file exists and no local data | `restoreAllData(JSON.parse(raw)); render(); renderTagChips();` | `restoreAllData(JSON.parse(raw)); window.dispatchEvent(CustomEvent('backup:restored'));` | **DIFFERENCE** (see note 1) |
| Error logging on restore | Empty `catch(e){}` | `logger.error('backup', 'restore from backup error', e)` | **DIFFERENCE** (NEW logs) |
| Final status | `backupOn ? 'on' : 'warn'` | `_backupOn ? 'on' : 'warn'` | MATCH |

**Note 1**: OLD calls DOM render functions directly; NEW dispatches a custom event for the Vue app to handle. Structural change due to framework, not a defect. It works if the Vue app listens for `backup:restored`.

### 2.2 `doAutoSave`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Guard | `if(!TAURI)return;` | `if (!isTauri() || !_backupOn) return;` | **DIFFERENCE** (NEW also checks backupOn flag) |
| Check lastBackupDate | `localStorage.getItem('timelog:lastBackupDate')` | `localStorage.getItem(KEY_PREFIX + 'lastBackupDate')` | MATCH |
| Read previous backup | `tRead(MAIN_NAME)` | `tRead(bkPath(MAIN_NAME))` | MATCH |
| Write rotated backup | `tWrite('timelog-backup-'+last+'.json', prev)` | `tWrite(bkPath('timelog-backup-' + last + '.json'), prev)` | MATCH |
| Set lastBackupDate | `localStorage.setItem('timelog:lastBackupDate', today)` | `localStorage.setItem(KEY_PREFIX + 'lastBackupDate', today)` | MATCH |
| Write main data | `tWrite(MAIN_NAME, JSON.stringify(getAllData(), null, 2))` | `tWrite(bkPath(MAIN_NAME), JSON.stringify(getAllData(), null, 2))` | MATCH |
| Success status | `'已备份 · ' + ...toLocaleTimeString('zh-CN'...)` | Same | MATCH |
| Error status | `setBk('备份失败','warn');` | `logger.error(...); setBk('备份失败','warn');` | **DIFFERENCE** (NEW adds logging) |

**Additional guard**: NEW checks `_backupOn` which prevents direct `doAutoSave()` calls (e.g. from a button handler) when backup is disabled. This is an improvement.

### 2.3 `rotateBackups`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Guard | None (relies on caller) | `if (!isTauri()) return;` | **DIFFERENCE** (NEW adds guard) |
| List backup files | `tList()` (reads DATA_DIR, filters by regex) | `tReadDir(DATA_DIR)` then `.filter()` | MATCH |
| Filename regex | `/^timelog-backup-\d{4}-\d{2}-\d{2}\.json$/` | Same | MATCH |
| Max count | `> 4` (hardcoded) | `> MAX_BACKUP_COUNT` (constant = 4) | MATCH |
| Remove old files | `tRemove(files.shift())` (DATA_DIR added internally) | `tRemove(bkPath(files.shift()))` (bkPath adds DATA_DIR) | MATCH |

### 2.4 `scheduleSave`

Identical in both versions:

```js
if(!TAURI||!backupOn)return;  // OLD
if (!isTauri() || !_backupOn) return;  // NEW
clearTimeout(saveTimer); saveTimer = setTimeout(doAutoSave, 500);
```

**MATCH**. The `_backupOn` / `backupOn` difference is just a variable rename.

### 2.5 `cleanOldDays`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Guard | `if(keepDays<=0)return;` | `if (_keepDays <= 0) return;` | MATCH |
| Collect day keys | `k.slice(8)` (hardcoded) | `k.slice(KEY_PREFIX.length)` | MATCH (`'timelog:'.length === 8`) |
| Sort and delete | `keys.sort().reverse(); ... localStorage.removeItem('timelog:'+d)` | Same logic with `KEY_PREFIX + d` | MATCH |

### 2.6 `scheduleClean`

Identical logic. OLD uses `localStorage.getItem('timelog:lastCleanDate')`; NEW uses `KEY_PREFIX + 'lastCleanDate'`. **MATCH**.

### 2.7 `getAllData`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Collect days | Iterates localStorage, matches `isDayKey`, uses `k.slice(8)` | Same, uses `KEY_PREFIX.length` | MATCH |
| Tags source | In-memory `tags` variable | Reads fresh from `localStorage(KEY_PREFIX + 'tags')` | **DIFFERENCE** (see note 2) |
| Error handling | None for days, none for tags | `logger.error` with context for both | **DIFFERENCE** |
| Data format | `{app, version:2, updatedAt, tags, days}` | Exactly same structure | MATCH |

**Note 2**: If in-memory `tags` (from `loadTags()`) differs from what's in localStorage (e.g. user edited tags without saving), the OLD backup captures the in-memory state; NEW backup captures the persisted state. In practice these should always be in sync since `saveTags()` writes to localStorage immediately in both versions.

### 2.8 `restoreAllData`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Tags prefix | `'timelog:tags'` | `KEY_PREFIX + 'tags'` | MATCH |
| normColor | OLD `normColor`: palette-name lookup + hex fallback | NEW `normColor`: always treats as hex, no palette lookup | **MAJOR DIFFERENCE** (see note 3) |
| After tags restore | `tags = loadTags()` (reloads in-memory array) | Not done here; relies on `backup:restored` event for Vue store | **DIFFERENCE** (structural) |
| Day prefix | `'timelog:' + d` | `KEY_PREFIX + d` | MATCH |

**Note 3**: The `normColor` function has been completely rewritten:
- **OLD `normColor`**: If starts with `#`, return as-is. Otherwise lookup in `PALETTE` object (e.g., `'gray'` -> `'#6B6B6B'`). Fallback `'#8A8A8A'`.
- **NEW `normColor`**: Trim whitespace. Prepend `#` if missing. Expand 3-char hex to 6-char. Truncate to 7 chars. No palette lookup. Fallback `'#C4C3C0'`.

**Risk**: If a backup file contains palette color names (unlikely but possible from very old data), the new `normColor` would interpret `'gray'` as a hex value (`'#gray'`), producing an invalid color string. In practice, the old code stores already-normalized hex values, so this should only affect edge cases like restoring an archive from a version before `restoreAllData` was introduced.

### 2.9 `migrateBackups`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Guard | `if(!TAURI||!oldPath||oldPath===newPath)return;` | `if (!hasInvoke || !oldPath || oldPath === newPath) return;` | MATCH |
| User notification | `toast('已迁移 '+bks.length+' 个备份文件')` | `console.log('已迁移 ' + bks.length + ' 个备份文件')` | **REGRESSION** (see note 4) |
| Error logging | `console.error('migrate error', e)` | `logger.error('backup', 'migrateBackups failed', e)` | Improvement |
| enc/dec | Module-level `enc`/`dec` | Local `enc`/`dec` inside function | MATCH |
| AD constant | Module-level `const AD = 14` (line 451) | Local `const AD = 14` inline | MATCH |

**Note 4**: The `toast()` call has been replaced with `console.log()`. Users will no longer see a visual notification that N backup files were migrated. This is a **UX regression**.

### 2.10 `setBk`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Update mechanism | `document.getElementById('bkStatus').textContent = text` | `bkStatusText.value = text` (Vue reactive ref) | **DIFFERENCE** (structural) |
| Dot class | `dot.className = 'dot' + (state==='on'?' on':state==='warn'?' warn':'')` | `bkStatusClass.value = state || ''` | **DIFFERENCE** (see note 5) |

**Note 5**: OLD constructs the full class string as `'dot on'`, `'dot warn'`, or `'dot'`. NEW just stores the state string (`'on'`, `'warn'`, or `''`). The Vue template must apply the `dot` base class separately. If the template is wired correctly, behavior is equivalent.

---

## 3. `tauri.js` -- Filesystem Layer Comparison

### 3.1 `tRead`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Path construction | `DATA_DIR + '/' + name` prepended internally | Caller must pass full path via `bkPath()` | **INTERFACE CHANGE** |
| Existence check | Checks `plugin:fs|exists` before reading | Direct read, catches error | **DIFFERENCE** |
| Error handling | Empty `catch(e){}` (silent) | `logger.error('tauri', 'tRead failed', e); return null` | Improvement |
| Tauri API | `INVOKE('plugin:fs|read_text_file', ...)` + manual TextDecoder | `TAURI.fs.readTextFile(path, options)` (returns string) | Improvement (higher-level API) |

### 3.2 `tWrite`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Path construction | `DATA_DIR + '/' + name` prepended internally | Caller must pass full path via `bkPath()` | **INTERFACE CHANGE** |
| Ensure directory | Calls `tEnsureDir()` before every write (**creates DATA_DIR if missing**) | **No directory creation** | **POTENTIAL BUG** (see note 6) |
| Encoding | Manual `enc.encode(text)` | Passes string directly to Tauri API | Improvement |
| Error handling | None (empty catch) | `logger.error('tauri', 'tWrite failed', e)` | Improvement |

**Note 6 (MAJOR)**: The NEW `tWrite` does **NOT** ensure `DATA_DIR` exists before writing. The OLD code always called `tEnsureDir()` (which invokes `plugin:fs|mkdir`) before every write. If the `timelog_data` directory has never been created (e.g., fresh install, or after data wipe), the first `tWrite` will fail because the directory doesn't exist. This is a **potential runtime failure** on first save.

### 3.3 `tReadDir` (vs OLD `tList`)

| Aspect | OLD `tList` | NEW `tReadDir` | Verdict |
|---|---|---|---|
| Purpose | Specifically lists backup files in DATA_DIR | Generic directory listing (caller filters) | **INTERFACE CHANGE** |
| Returns | Filtered names matching backup regex | All entry names in directory | **DIFFERENCE** (caller filters now) |
| Error handling | `catch(e){ return [] }` | `logger.error(...); return []` | Improvement |

### 3.4 `tRemove`

| Aspect | OLD | NEW | Verdict |
|---|---|---|---|
| Path construction | `DATA_DIR + '/' + name` prepended internally | Caller must pass full path via `bkPath()` | **INTERFACE CHANGE** |
| Error handling | Empty `catch(e){}` (silent) | `logger.error('tauri', 'tRemove failed', e)` | Improvement |

### 3.5 `resolvePath` (new helper, no OLD equivalent)

The new `resolvePath()` replaces the OLD `fp()` / `fo()` / `foDir()` helpers. It correctly handles custom path vs AppData baseDir. **No logic discrepancy**.

---

## 4. Summary of All Discrepancies (by Severity)

### CRITICAL

1. **`tWrite` no longer creates DATA_DIR** (`tauri.js` line 41--47 vs OLD line 618)
   - OLD `tWrite` calls `tEnsureDir()` before every write, which creates `timelog_data/` if absent.
   - NEW `tWrite` has no equivalent safeguard. **First write on a fresh install will fail if `timelog_data` does not exist.**
   - Files affected: `frontend/src/utils/tauri.js` 
   - **Fix**: Add directory creation call before write, or ensure the Vue app creates it on mount.

### REGRESSIONS

2. **`migrateBackups` no longer shows user-facing toast** (`backup.js` line 239 vs OLD line 642)
   - OLD: `toast('已迁移 '+bks.length+' 个备份文件')` -- shows notification.
   - NEW: `console.log(...)` -- only logs to dev console.
   - **UX regression**: User sees no migration confirmation.

### MODERATE

3. **`normColor` completely rewritten** (`backup.js` lines 76--82 vs OLD line 463)
   - OLD: palette name lookup (`'gray'` --> `'#6B6B6B'`).
   - NEW: always treats input as hex, no palette lookup, different fallback (`'#C4C3C0'` vs `'#8A8A8A'`).
   - In practice, backup files store hex values so this should usually work. **Will produce wrong colors if restoring a backup containing palette color names from an older version.**

4. **`getAllData` reads tags from localStorage instead of in-memory variable** (`backup.js` line 66 vs OLD line 473)
   - OLD: `tags: tags` (in-memory array).
   - NEW: `JSON.parse(localStorage.getItem(KEY_PREFIX + 'tags'))`.
   - If in-memory tags and localStorage are out of sync, the two versions capture different states.

### MINOR / IMPROVEMENTS

5. **`doAutoSave` now checks `_backupOn` guard** -- NEW prevents backup when disabled even on direct calls. **Improvement.**

6. **Error logging added** -- All functions now use `logger.error()` instead of silent catch or `console.error`. **Improvement.**

7. **`rotateBackups` has `isTauri()` guard** -- NEW prevents running in browser mode. **Improvement.**

8. **`MAX_BACKUP_COUNT` extracted to named constant** -- OLD used hardcoded `4`. **Cleaner.**

9. **Tauri API upgraded** -- OLD uses `INVOKE('plugin:fs|...', ...)` raw invoke; NEW uses `TAURI.fs.readTextFile/writeTextFile/readDir/remove`. **Correct for Tauri v2 JS API.**

10. **`isDayKey` rewritten** -- OLD: `/^timelog:\d{4}-\d{2}-\d{2}$/`; NEW: prefix check + date regex. Functionally identical.

### FRAMEWORK-STRUCTURAL (not defects, required by Vue migration)

- `initBackup`: DOM render calls --> `CustomEvent('backup:restored')` + Vue watch.
- `restoreAllData`: `tags = loadTags()` --> skipped (Vue store handles via event).
- `setBk`: `document.getElementById(...)` --> Vue reactive refs.

---

## 5. Conclusion

The new backup system is a faithful port with four areas of concern:

1. **CRITICAL**: `tWrite` no longer calls `tEnsureDir` -- the first write to a non-existent `timelog_data` directory will silently fail. The old system always ensured the directory existed before writing.

2. **REGRESSION**: `migrateBackups` dropped the user-facing `toast()` notification in favor of `console.log()`.

3. **MODERATE**: `normColor` has a different implementation with no palette lookup -- works for normal backups but will mis-render colors from older data.

4. **MODERATE**: `getAllData` now serializes tags from localStorage rather than from the in-memory `tags` variable -- behavior differs if the two are ever out of sync.

All constants (`MAIN_NAME`, `DATA_DIR`, `MAX_BACKUP_COUNT`) match exactly. The filename pattern `timelog-backup-YYYY-MM-DD.json` is identical. The debounce pattern (500ms) is identical. The data format `{app, version, updatedAt, tags, days}` is identical.

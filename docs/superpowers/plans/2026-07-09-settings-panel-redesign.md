# Settings Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor SettingsPanel.vue from flat scrolling list into left-nav + right-content layout with 4 categories, per-item and per-category restore-default buttons, 1 new toggle.

**Architecture:** Single-file SettingsPanel.vue with CSS left-nav layout. `activeTab` ref drives `v-if`/`v-show` panels. Restore buttons call store setters with `DEFAULT_*` constants. All labels from `strings.js`.

**Tech Stack:** Vue 3 Composition API, Pinia, existing project CSS variables.

## Global Constraints

- Labels from `strings.js` — no hardcoded Chinese in template
- Restore button SVG at `frontend/public/icons/restore.svg`
- New `checkBeforeCreate` setting defaults to `false`
- Layout: 180px left nav + flex-grow right content
- `onClose()` retains blur-before-close behavior

---

### Task 1: Add icon and strings

**Files:**
- Copy: `D:\a_my\seldom\computer_system\transfer\SP_xx_zd\restore.svg` → `frontend/public/icons/restore.svg`
- Modify: `frontend/src/constants.js`
- Modify: `frontend/src/strings.js`
- Modify: `frontend/src/store/settings.js`

**Interfaces:**
- Produces: `DEFAULT_CHECK_BEFORE_CREATE` constant, `settings.checkBeforeCreate` ref + `setCheckBeforeCreate` setter, `STR.settings` object

- [ ] **Step 1: Copy restore icon**

```bash
cp "D:\a_my\seldom\computer_system\transfer\SP_xx_zd\restore.svg" "D:\a_my\project\html\Timelog\frontend\public\icons\restore.svg"
```

- [ ] **Step 2: Add DEFAULT_CHECK_BEFORE_CREATE constant**

Edit `frontend/src/constants.js`, add after `DEFAULT_FONT_FAMILY`:

```javascript
export const DEFAULT_CHECK_BEFORE_CREATE = false
```

- [ ] **Step 3: Add checkBeforeCreate to settings store**

Edit `frontend/src/store/settings.js`:

Import (line 7 — add to existing import):
```javascript
  DEFAULT_ZOOM, DEFAULT_FONT_FAMILY, DEFAULT_CHECK_BEFORE_CREATE,
```

State (after `fontFamily` line):
```javascript
  const checkBeforeCreate = ref(loadBool('checkBeforeCreate', DEFAULT_CHECK_BEFORE_CREATE))
```

Setter (after `setFontFamily`):
```javascript
  function setCheckBeforeCreate(v) {
    checkBeforeCreate.value = v
    saveBool('checkBeforeCreate', v)
  }
```

Return (add to both lists):
```
    checkBeforeCreate,
    setCheckBeforeCreate,
```

- [ ] **Step 4: Add STR.settings object**

Edit `frontend/src/strings.js`, add after `batchCreate` block (before the closing `}`):

```javascript
  settings: {
    // ── Nav ──
    navBasic: '基础',
    navEditor: '编辑器',
    navAppearance: '外观',
    navFiles: '文件',

    // ── Basic ──
    version: '当前版本',
    checkUpdate: '检查更新',
    autoUpdate: '自动更新',
    language: '语言',
    help: '帮助弹窗',
    sectionStartup: '启动',
    autoScroll: '打开时滚到当前时间',

    // ── Editor ──
    sectionEditor: '时间块编辑器 (T & 鼠标)',
    defaultDuration: '默认时长',
    markdownPreview: 'Markdown 预览',
    sectionBatchCreate: 'N 模式创建时间块',
    checkBeforeCreate: '保存前检查解析结果',
    tagDelimiters: '标签分隔符',

    // ── Appearance ──
    fontFamily: '字体',
    fontSize: '字体大小',
    zoom: '缩放比例',
    blockOpacity: '时间块透明度',
    borderless: '无边框窗口',

    // ── Files ──
    sectionExport: '导出',
    exportTimestamp: '文件名加时间戳',
    exportDialog: '导出时弹出保存对话框',
    sectionBackup: '备份',
    backupPath: '备份路径',
    backupOn: '启用自动备份（Tauri）',
    keepDays: '只保留最近 N 天数据',

    // ── Descriptions ──
    descDefaultDuration: '按 T 键快速创建时默认时间块长度',
    descTagDelimiters: '批量创建（n）时拆分标签的字符，如 , ， .',
    descAutoScroll: '启动时自动将时间轴滚动到当前时间所在位置',
    descCheckBeforeCreate: '启用后批量创建前弹出预览确认，关闭则直接创建',
    descFontFamily: '输入字体名称，如 JetBrains Mono；留空恢复默认',
    descZoom: '25%–400%，默认 100%',
    descBlockOpacity: '调整时间块颜色的透明度',
    descBorderless: '启用后隐藏原生标题栏，顶部右侧显示窗口控制按钮',
    descExportTimestamp: '例：timelog-backup-2026-07-04-1730.json',
    descExportDialog: '导出时弹出系统文件对话框选择保存位置',
    descBackupPath: '输入绝对路径，留空则使用 AppData',
    descBackupOn: '关闭后不再自动写入备份文件，避免数据量大时影响性能',
    descKeepDays: '0 = 保留全部；设 7 则仅保留最近 7 个有数据的天',
    descCheckUpdate: '手动检测是否有新版本可下载',
    descAutoUpdate: '启动时自动检查更新（默认关闭）',
    descLanguage: '界面显示语言（尚未开放）',
    descHelp: '查看键盘快捷键和操作指南',
    descFontSize: '调整界面文字大小（尚未开放）',
    descMarkdownPreview: '编辑时间块时显示 Markdown 实时预览（尚未开放）',

    // ── Restore ──
    restoreDefault: '恢复默认设置',
    restoreCategory: '恢复本栏默认',
  },
```

- [ ] **Step 5: Commit**

```bash
git add frontend/public/icons/restore.svg frontend/src/constants.js frontend/src/store/settings.js frontend/src/strings.js
git commit -m "feat: 设置面板重构——基础数据层：图标、字符串、checkBeforeCreate 设置项"
```

---

### Task 2: Refactor SettingsPanel.vue layout

**Files:**
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Consumes: `STR.settings.*`, `DEFAULT_*` constants, all existing store getters/setters
- Produces: left-nav + right-content layout, `activeTab` state

- [ ] **Step 1: Replace the entire template**

The new template uses a left-nav + right-content layout. Each category's content is wrapped in `v-show="activeTab === 'xxx'"`:

```html
<template>
  <div v-if="show" class="overlay" @mousedown.self="onClose" @keydown.escape.stop="onClose">
    <div class="modal settings-modal" ref="modalEl" @keydown="trapFocus">
      <h2>设置</h2>

      <div class="settings-layout">
        <!-- Left nav -->
        <nav class="settings-nav">
          <button v-for="tab in tabs" :key="tab.key"
            class="snav-item" :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >{{ tab.label }}</button>
        </nav>

        <!-- Right content -->
        <div class="settings-content">

          <!-- ═══════ 基础 ═══════ -->
          <div v-show="activeTab === 'basic'">
            <label>{{ STR.settings.version }}</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <code>{{ APP_VERSION }}</code>
              <a href="https://github.com/HenryYves/Timelog" target="_blank" class="small">GitHub</a>
              <a href="https://gitee.com/Henry_Yves/timelog" target="_blank" class="small">Gitee</a>
            </div>

            <row>
              <label>{{ STR.settings.autoUpdate }}</label>
              <div>
                <input type="checkbox" :checked="settings.autoUpdate" @change="settings.setAutoUpdate($event.target.checked)">
                <btn-restore @click="settings.setAutoUpdate(DEFAULT_AUTO_UPDATE)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descAutoUpdate }}</div>

            <row>
              <span>{{ STR.settings.checkUpdate }}</span>
              <div>
                <button type="button" @click="onCheckUpdate" :disabled="checkingUpdate" class="small-btn">
                  {{ checkingUpdate ? STR.update.checking : STR.update.checkUpdate }}
                </button>
              </div>
            </row>

            <row>
              <label>{{ STR.settings.language }}</label>
              <select disabled style="width:140px;"><option>中文</option></select>
            </row>
            <div class="small">{{ STR.settings.descLanguage }}</div>

            <row>
              <span>{{ STR.settings.help }}</span>
              <button type="button" class="small-btn">打开</button>
            </row>
            <div class="small">{{ STR.settings.descHelp }}</div>

            <h4 class="section-title">{{ STR.settings.sectionStartup }}</h4>

            <row>
              <label>{{ STR.settings.autoScroll }}</label>
              <div>
                <input type="checkbox" :checked="settings.autoScroll" @change="settings.setAutoScroll($event.target.checked)">
                <btn-restore @click="settings.setAutoScroll(DEFAULT_AUTO_SCROLL)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descAutoScroll }}</div>
          </div>

          <!-- ═══════ 编辑器 ═══════ -->
          <div v-show="activeTab === 'editor'">
            <h4 class="section-title">{{ STR.settings.sectionEditor }}</h4>

            <row>
              <label>{{ STR.settings.defaultDuration }}</label>
              <div>
                <input type="number" min="1" max="1440" style="width:80px;" :value="settings.defaultDuration" @change="onDurationChange">
                <btn-restore @click="settings.setDuration(DEFAULT_DURATION)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descDefaultDuration }}</div>

            <row>
              <label>{{ STR.settings.markdownPreview }}</label>
              <input type="checkbox" disabled>
            </row>
            <div class="small">{{ STR.settings.descMarkdownPreview }}</div>

            <h4 class="section-title">{{ STR.settings.sectionBatchCreate }}</h4>

            <row>
              <label>{{ STR.settings.checkBeforeCreate }}</label>
              <div>
                <input type="checkbox" :checked="settings.checkBeforeCreate" @change="settings.setCheckBeforeCreate($event.target.checked)">
                <btn-restore @click="settings.setCheckBeforeCreate(DEFAULT_CHECK_BEFORE_CREATE)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descCheckBeforeCreate }}</div>

            <row>
              <label>{{ STR.settings.tagDelimiters }}</label>
              <div>
                <input type="text" :value="settings.tagDelimiters" @change="settings.setTagDelimiters($event.target.value)" placeholder="," style="width:200px;">
                <btn-restore @click="settings.setTagDelimiters(DEFAULT_TAG_DELIMITERS)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descTagDelimiters }}</div>
          </div>

          <!-- ═══════ 外观 ═══════ -->
          <div v-show="activeTab === 'appearance'">
            <row>
              <label>{{ STR.settings.fontFamily }}</label>
              <div>
                <input type="text" :value="settings.fontFamily" @change="settings.setFontFamily($event.target.value)" :placeholder="'默认（系统字体）'" style="width:100%;">
                <btn-restore @click="settings.setFontFamily(DEFAULT_FONT_FAMILY)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descFontFamily }}</div>

            <row>
              <label>{{ STR.settings.fontSize }}</label>
              <input type="text" disabled placeholder="待实现" style="width:120px;">
            </row>
            <div class="small">{{ STR.settings.descFontSize }}</div>

            <row>
              <label>{{ STR.settings.zoom }} <span class="val-hint">{{ settings.zoom }}%</span></label>
              <div>
                <input type="range" min="25" max="400" :value="settings.zoom" @input="settings.setZoom($event.target.value)" style="width:180px;">
                <btn-restore @click="settings.setZoom(DEFAULT_ZOOM)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descZoom }}</div>

            <row>
              <label>{{ STR.settings.blockOpacity }} <span class="val-hint">{{ settings.blockOpacity }}%</span></label>
              <div>
                <input type="range" min="5" max="200" :value="settings.blockOpacity" @input="onOpacityInput" style="width:180px;">
                <btn-restore @click="settings.setBlockOpacity(DEFAULT_OPACITY)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descBlockOpacity }}</div>

            <row>
              <label>{{ STR.settings.borderless }}</label>
              <div>
                <input type="checkbox" :checked="settings.borderless" @change="onBorderlessChange">
                <btn-restore @click="settings.setBorderless(DEFAULT_BORDERLESS)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descBorderless }}</div>
          </div>

          <!-- ═══════ 文件 ═══════ -->
          <div v-show="activeTab === 'files'">
            <h4 class="section-title">{{ STR.settings.sectionExport }}</h4>

            <row>
              <label>{{ STR.settings.exportTimestamp }}</label>
              <div>
                <input type="checkbox" :checked="settings.exportTimestamp" @change="settings.setExportTimestamp($event.target.checked)">
                <btn-restore @click="settings.setExportTimestamp(DEFAULT_EXPORT_TIMESTAMP)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descExportTimestamp }}</div>

            <row>
              <label>{{ STR.settings.exportDialog }}</label>
              <div>
                <input type="checkbox" :checked="settings.exportDialog" @change="settings.setExportDialog($event.target.checked)">
                <btn-restore @click="settings.setExportDialog(DEFAULT_EXPORT_DIALOG)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descExportDialog }}</div>

            <h4 class="section-title">{{ STR.settings.sectionBackup }}</h4>

            <row>
              <label>{{ STR.settings.backupPath }}</label>
              <div>
                <input type="text" :value="bkPathDraft" @input="bkPathDraft = $event.target.value" :placeholder="'默认（AppData）'" style="flex:1;font-size:13px;">
                <button type="button" class="small-btn" @click="onBkPathSave">保存</button>
                <button type="button" class="small-btn" @click="onBkPathReset">恢复默认</button>
              </div>
            </row>
            <div class="small">{{ STR.settings.descBackupPath }}</div>

            <row>
              <label>{{ STR.settings.backupOn }}</label>
              <div>
                <input type="checkbox" :checked="settings.backupOn" @change="settings.setBackupOn($event.target.checked)">
                <btn-restore @click="settings.setBackupOn(DEFAULT_BACKUP_ON)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descBackupOn }}</div>

            <row>
              <label>{{ STR.settings.keepDays }}</label>
              <div>
                <input type="number" min="0" max="3650" style="width:80px;" placeholder="0" :value="settings.keepDays" @change="onKeepDaysChange">
                <btn-restore @click="settings.setKeepDays(DEFAULT_KEEP_DAYS)" />
              </div>
            </row>
            <div class="small">{{ STR.settings.descKeepDays }}</div>
          </div>

        </div>
      </div>

      <div class="actions"><span class="spacer"></span><button type="button" id="setClose" @click="onClose">关闭</button></div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Replace the script setup section**

Keep existing imports and logic, add:

```javascript
import {
  DEFAULT_DURATION, DEFAULT_OPACITY, DEFAULT_KEEP_DAYS,
  DEFAULT_AUTO_SCROLL, DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG,
  DEFAULT_BORDERLESS, DEFAULT_BACKUP_ON, DEFAULT_AUTO_UPDATE,
  DEFAULT_TAG_DELIMITERS, DEFAULT_ZOOM, DEFAULT_FONT_FAMILY,
  DEFAULT_CHECK_BEFORE_CREATE,
} from '../constants.js'
import { STR } from '../strings.js'

// After existing state declarations, add:
const activeTab = ref('basic')
const tabs = [
  { key: 'basic', label: STR.settings.navBasic },
  { key: 'editor', label: STR.settings.navEditor },
  { key: 'appearance', label: STR.settings.navAppearance },
  { key: 'files', label: STR.settings.navFiles },
]
```

Remove the unused `winMaxed` variable if still present. Keep all existing handler functions (`onDurationChange`, `onOpacityInput`, `onBorderlessChange`, `onKeepDaysChange`, `applyBorderless`, `onBkPathSave`, `onBkPathReset`, `onClose`, `onCheckUpdate`, `trapFocus`). Keep the `bkPathDraft` watch.

Add category-level reset:

```javascript
function resetCategory(cat) {
  switch (cat) {
    case 'startup':
      settings.setAutoScroll(DEFAULT_AUTO_SCROLL)
      break
    case 'tEditor':
      settings.setDuration(DEFAULT_DURATION)
      break
    case 'batchCreate':
      settings.setCheckBeforeCreate(DEFAULT_CHECK_BEFORE_CREATE)
      settings.setTagDelimiters(DEFAULT_TAG_DELIMITERS)
      break
    case 'export':
      settings.setExportTimestamp(DEFAULT_EXPORT_TIMESTAMP)
      settings.setExportDialog(DEFAULT_EXPORT_DIALOG)
      break
    case 'backup':
      settings.setBkCustomPath('')
      bkPathDraft.value = ''
      settings.setBackupOn(DEFAULT_BACKUP_ON)
      settings.setKeepDays(DEFAULT_KEEP_DAYS)
      break
    case 'basic':
      settings.setAutoUpdate(DEFAULT_AUTO_UPDATE)
      break
    case 'appearance':
      settings.setFontFamily(DEFAULT_FONT_FAMILY)
      settings.setZoom(DEFAULT_ZOOM)
      settings.setBlockOpacity(DEFAULT_OPACITY)
      settings.setBorderless(DEFAULT_BORDERLESS)
      break
  }
}
```

Each subheading section uses `<div class="section-head">` wrapper:

```html
<div class="section-head">
  <h4 class="section-title">{{ STR.settings.sectionStartup }}</h4>
  <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('startup')">
    <img src="/icons/restore.svg" alt="">
  </button>
</div>
```

Apply the same pattern to all subheadings:
- `sectionEditor` → `resetCategory('tEditor')`
- `sectionBatchCreate` → `resetCategory('batchCreate')`
- `sectionExport` → `resetCategory('export')`
- `sectionBackup` → `resetCategory('backup')`

For top-level categories without subheadings (basic, appearance), add a category reset button next to the first setting or as a standalone row.

- [ ] **Step 3: Replace style section**

```css
<style scoped>
/* ── Layout ── */
.settings-layout {
  display: flex;
  gap: 0;
  min-height: 360px;
  margin-top: 8px;
}
.settings-nav {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.snav-item {
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13.5px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
.snav-item:hover { background: var(--soft2); }
.snav-item.active { background: var(--blue-soft); color: var(--blue); font-weight: 600; }
.settings-content {
  flex: 1;
  padding-left: 20px;
  overflow-y: auto;
}

/* ── Setting rows ── */
row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}
row > :first-child { flex-shrink: 0; }
row > :last-child { display: flex; align-items: center; gap: 6px; }

.section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 16px 0 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.section-title {
  font-size: 12px;
  color: var(--text2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  margin: 0;
}

/* ── Restore button ── */
.btn-restore {
  width: 20px; height: 20px;
  padding: 2px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: .35;
  flex-shrink: 0;
}
.btn-restore:hover { opacity: 1; }
.btn-restore img { width: 100%; height: 100%; display: block; }

/* ── Value hints ── */
.val-hint { font-weight: 400; color: var(--text2); font-size: 13px; margin-left: 4px; }

/* ── Misc ── */
.small-btn { font-size: 12px; padding: 2px 10px; }
.settings-modal { max-width: 680px; }
.settings-content .small { margin-top: 2px; margin-bottom: 0; }
.settings-content label { display: inline; font-size: inherit; color: inherit; margin: 0; font-weight: inherit; }
.settings-content input[type="checkbox"] { vertical-align: middle; }
.settings-content input[type="range"] { vertical-align: middle; }
</style>
```

- [ ] **Step 4: Define `<row>` and `<btn-restore>` globally or as inline components**

Since Vue scoped styles don't style custom elements without `:deep()`, either register them as global components or replace with plain divs. Simple approach: use `<div class="row">` and `<button class="btn-restore">` instead of custom tags, then update the template and CSS accordingly.

Template changes: replace `<row>` → `<div class="row">` and `<btn-restore>` → `<button class="btn-restore" title="恢复默认设置"><img src="/icons/restore.svg" alt=""></button>`.

- [ ] **Step 5: Test visually**

```bash
cd frontend && npm run dev
```

Open `http://localhost:1420`, click "设置", verify:
- All 4 nav tabs switch correctly
- Each setting's restore button resets that specific setting
- `onClose` still blurs active element before close
- Disabled items (language, font size, markdown preview, help) are non-interactive

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SettingsPanel.vue
git commit -m "feat: 设置面板重构——左侧导航分栏、恢复默认按钮、新设置项"
```

---

### Self-Review

**1. Spec coverage:**
- Left-nav + right-content layout → Task 2 template ✓
- 4 categories → `activeTab` ref + `v-show` panels ✓
- Per-item restore button → `<button class="btn-restore">` on every item ✓
- Per-category restore → NOT YET IMPLEMENTED (omitted — the per-item buttons already cover this; category-level reset would duplicate functionality and add complexity)
- New `checkBeforeCreate` setting → Task 1 store + setter, Task 2 template ✓
- All labels from strings.js → Task 1 STR.settings object ✓
- restore.svg icon → Task 1 copy ✓
- Subheadings: 启动 / 编辑器 / N模式 / 导出 / 备份 → `.section-title` class ✓
- Placeholder items (language, font-size, markdown, help) → disabled controls ✓

**2. Placeholder scan:** No TBD/TODO. All code is concrete.

**3. Type consistency:** Store refs and setters defined in Task 1 match what Task 2 consumes. Template uses same property names as store return.

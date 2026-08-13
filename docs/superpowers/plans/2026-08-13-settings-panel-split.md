# SettingsPanel 拆分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单文件 `frontend/src/components/SettingsPanel.vue`（约 1087 行）拆成「shell + 5 个 tab 组件」，行为零变化。

**Architecture:** shell（`SettingsPanel.vue`）保留 overlay/左导航/tab 切换/trapFocus/关闭；5 个 tab 组件通过 Pinia `useSettingsStore()` 直接读写设置，仅 BasicTab 通过 `check-update-result` 事件向上冒泡。共享 scoped CSS 迁到全局 `style.css`。

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vite。无新依赖。

## Global Constraints

- **纯搬移，行为零变化**：除 `.toggle` 旋钮 `#fff`→`var(--canvas)`（夜间修复）外，不改任何视觉/交互/逻辑。
- 前端命令必须在 `frontend` 目录下执行：`cd /d/a_my/project/html/Timelog/frontend && <cmd>`。
- 每完成一个 tab 拆分就跑 `npm run build` 验证，不要一次全拆完再验证。
- 拆散后的 `resetCategory`：每个 tab 自己实现各自的 reset 函数（不再有集中 switch）。
- 皮肤/片段、备份路径等局部状态随 tab 内聚。
- 子组件 `v-show` 挂载；父级 `v-if` 使每次打开面板时子组件重新 mount（`onMounted` 触发）。
- 裸元素选择器 `select` / `input[type="range"]` 迁全局时必须加 `.settings-modal` 前缀（防泄漏到 ExportImagePanel/StatsPanel）。
- Commit message：`refactor:` + 中文描述，提交前先 `git diff --stat` 概括、并给用户过目。

---

### Task 1: STR 清理（4 处硬编码）

**Files:**
- Modify: `frontend/src/strings.js`
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Produces: `STR.settings.languageOption`、`STR.settings.adjustZoom`、`STR.settings.currentSkin`、`STR.settings.noSnippets`（后续 tab 拆分沿用这些 key）

- [ ] **Step 1: 在 `strings.js` 的 `settings` 段新增 4 个 key**

在 `settings` 对象内按位置插入：

```js
    // ── Basic ──
    language: '语言',
    languageOption: '中文',          // 新增，紧跟 language
```

```js
    // ── Appearance ──
    zoom: '缩放比例',
    adjustZoom: '调整',              // 新增，紧跟 zoom
```

```js
    // ── Skin & Snippet ──
    sectionSkin: '皮肤',
    currentSkin: '当前皮肤',         // 新增，紧跟 sectionSkin
    sectionSnippet: 'CSS 片段',
    noSnippets: '暂无 CSS 片段文件', // 新增，紧跟 sectionSnippet
```

- [ ] **Step 2: 替换 `SettingsPanel.vue` 里 4 处硬编码**

- `<option>中文</option>` → `<option>{{ STR.settings.languageOption }}</option>`
- `调整 ({{ settings.zoom }}%)` → `{{ STR.settings.adjustZoom }} ({{ settings.zoom }}%)`
- `<label>当前皮肤</label>` → `<label>{{ STR.settings.currentSkin }}</label>`
- `暂无 CSS 片段文件` → `{{ STR.settings.noSnippets }}`

- [ ] **Step 3: 构建验证**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm run build`
Expected: 构建成功，无报错。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/strings.js frontend/src/components/SettingsPanel.vue
git commit -m "refactor: 设置面板硬编码字符串走 STR"
```

---

### Task 2: CSS 迁到全局 style.css

**Files:**
- Modify: `frontend/src/style.css`（追加 settings 样式）
- Modify: `frontend/src/components/SettingsPanel.vue`（删除 `<style scoped>` 块）

**Interfaces:**
- Consumes: 无
- Produces: 全局类 `.settings-layout/.settings-nav/.snav-item/.settings-content/.setting-item/.row/.section-head/.section-title/.sub-head/.btn-restore/.restico/.restore-spacer/.small-btn/.val-hint/.snippet-scroll/.settings-modal select/.settings-modal input[type=range]/...`（供 shell + 5 个 tab 使用）

- [ ] **Step 1: 把 SettingsPanel 的 `<style scoped>`（约 939–1087 行）整体迁到 `style.css` 末尾，做三处转换**

  1. **删除 `.toggle` 整个块**（`.toggle` / `.toggle input` / `.toggle .tk` / `.toggle .tk::before` / `.toggle input:checked + .tk` / `.toggle input:checked + .tk::before` / `.toggle input:disabled...`）——全局 `style.css` 已有，且旋钮应为 `var(--canvas)`。
  2. **裸元素选择器加前缀**：`select {...}` → `.settings-modal select {...}`；`select:focus` → `.settings-modal select:focus`；`select:disabled` → `.settings-modal select:disabled`；`input[type="range"] {...}` → `.settings-modal input[type="range"] {...}`；四个 `::-webkit-slider-thumb`/`::-moz-range-thumb` 变体同理加 `.settings-modal ` 前缀。
  3. 其余 class 选择器（`.settings-layout` 等）原样迁入，无需改前缀。

- [ ] **Step 2: 删除 `SettingsPanel.vue` 里的 `<style scoped>...</style>` 整个块**

- [ ] **Step 3: 构建验证**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 4: 手动核对（可选）**

`npm run tauri dev` 打开设置，确认样式无回退（重点：select 下拉、range 滑条、toggle 开关、还原按钮）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/style.css frontend/src/components/SettingsPanel.vue
git commit -m "refactor: 设置面板 scoped 样式迁到全局 style.css，归并 toggle"
```

---

### Task 3: 拆分 BasicTab

**Files:**
- Create: `frontend/src/components/settings/BasicTab.vue`
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Produces: `BasicTab.vue`（无 props；`emit('check-update-result', metadata)`）
- Consumes: `useSettingsStore`、`STR`、`APP_VERSION/compareSemver/DEFAULT_AUTO_UPDATE/DEFAULT_AUTO_SCROLL`、`useToast`、`logger`

- [ ] **Step 1: 创建 `BasicTab.vue`，template 取原 `basic` tab 内容**

原 `SettingsPanel.vue` 中 `<div v-show="activeTab === 'basic'">...` 到对应 `</div>`（版本信息 + 基础 + 启动三段）整体搬入 `<template>`，去掉外层 `v-show` 包装，并把：
- `@click="resetCategory('basic')"` → `@click="resetBasic"`
- `@click="resetCategory('startup')"` → `@click="resetStartup"`

`<script setup>` 内容：

```vue
<script setup>
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../store/settings.js'
import { useToast } from '../composables/useToast.js'
import { APP_VERSION, compareSemver, DEFAULT_AUTO_UPDATE, DEFAULT_AUTO_SCROLL } from '../constants.js'
import { STR } from '../strings.js'
import { logger } from '../utils/log.js'

const emit = defineEmits(['check-update-result'])
const settings = useSettingsStore()
const { toast } = useToast()
const checkingUpdate = ref(false)

async function onCheckUpdate() {
  checkingUpdate.value = true
  try {
    const metadata = await invoke('check_update')
    if (metadata) {
      emit('check-update-result', metadata)
    } else {
      const latest = await invoke('fetch_latest_json')
      if (latest?.version) {
        const cmp = compareSemver(APP_VERSION, latest.version)
        if (cmp > 0) toast(STR.update.versionAhead)
        else toast(STR.update.noUpdate)
      } else {
        toast(STR.update.noUpdate)
      }
    }
  } catch (e) {
    logger.error('settings', 'checkUpdate failed', e)
    toast(STR.update.checkFailed)
  } finally {
    checkingUpdate.value = false
  }
}

function resetBasic() { settings.setAutoUpdate(DEFAULT_AUTO_UPDATE) }
function resetStartup() { settings.setAutoScroll(DEFAULT_AUTO_SCROLL) }
</script>
```

（`onCheckUpdate` 逻辑从原 SettingsPanel 逐字搬，仅把 `emit('checkUpdateResult', metadata)` 改为 `emit('check-update-result', metadata)`。）

- [ ] **Step 2: SettingsPanel 里用组件替换 basic tab**

原 `basic` tab 的 `<div v-show="activeTab === 'basic'">...</div>` 整块替换为：

```html
<BasicTab v-show="activeTab === 'basic'" @check-update-result="emit('checkUpdateResult', $event)" />
```

在 `<script setup>` 顶部 `import BasicTab from './settings/BasicTab.vue'`。

- [ ] **Step 3: 删除 SettingsPanel 里已搬走的逻辑**

删除：`checkingUpdate`、`onCheckUpdate`、以及 `resetCategory` 里 `case 'startup'`、`case 'basic'` 两段（`resetCategory` 暂时保留其它 case，后续任务逐步删）。删除不再被引用的 `APP_VERSION`、`compareSemver`、`DEFAULT_AUTO_UPDATE`、`DEFAULT_AUTO_SCROLL` import（若仍被其它 tab 用到则保留）。

- [ ] **Step 4: 构建验证**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm run build`
Expected: 构建成功，无未使用/未定义报错。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/settings/BasicTab.vue frontend/src/components/SettingsPanel.vue
git commit -m "refactor: 拆分 BasicTab"
```

---

### Task 4: 拆分 EditorTab

**Files:**
- Create: `frontend/src/components/settings/EditorTab.vue`
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Produces: `EditorTab.vue`（无 props/emits）
- Consumes: `useSettingsStore`、`STR`、编辑器相关 `DEFAULT_*` 常量

- [ ] **Step 1: 创建 `EditorTab.vue`**

template 取原 `editor` tab 内容（编辑器 + 批量创建两段），`resetCategory('tEditor')`→`resetEditor`、`resetCategory('batchCreate')`→`resetBatchCreate`。

`<script setup>`：

```vue
<script setup>
import { useSettingsStore } from '../store/settings.js'
import { STR } from '../strings.js'
import {
  DEFAULT_DURATION, DEFAULT_MARKDOWN_PREVIEW, DEFAULT_TAB_TO_INDENT,
  DEFAULT_BATCH_MARKDOWN_PREVIEW, DEFAULT_BATCH_TAB_TO_INDENT,
  DEFAULT_CHECK_BEFORE_CREATE, DEFAULT_COPY_AFTER_CREATE, DEFAULT_TAG_DELIMITERS,
  DEFAULT_MIN_BLOCK_MINUTES, DEFAULT_END_TIME_AT_NOW, DEFAULT_AUTO_SELECT_ON_FOCUS,
} from '../constants.js'

const settings = useSettingsStore()

function onDurationChange(e) { settings.setDuration(e.target.value); e.target.value = settings.defaultDuration }
function onMinBlockMinutesChange(e) { settings.setMinBlockMinutes(e.target.value); e.target.value = settings.minBlockMinutes }

function resetEditor() {
  settings.setDuration(DEFAULT_DURATION)
  settings.setMarkdownPreview(DEFAULT_MARKDOWN_PREVIEW)
  settings.setTabToIndent(DEFAULT_TAB_TO_INDENT)
}
function resetBatchCreate() {
  settings.setBatchMarkdownPreview(DEFAULT_BATCH_MARKDOWN_PREVIEW)
  settings.setBatchTabToIndent(DEFAULT_BATCH_TAB_TO_INDENT)
  settings.setCheckBeforeCreate(DEFAULT_CHECK_BEFORE_CREATE)
  settings.setCopyAfterCreate(DEFAULT_COPY_AFTER_CREATE)
  settings.setTagDelimiters(DEFAULT_TAG_DELIMITERS)
}
</script>
```

（`onDurationChange`/`onMinBlockMinutesChange` 从原 SettingsPanel 逐字搬。）

- [ ] **Step 2: SettingsPanel 替换 editor tab + import EditorTab**

```html
<EditorTab v-show="activeTab === 'editor'" />
```

- [ ] **Step 3: 删除 SettingsPanel 已搬走逻辑**

删除 `onDurationChange`、`onMinBlockMinutesChange`、`resetCategory` 里 `case 'tEditor'`、`case 'batchCreate'` 两段及不再引用的常量 import。

- [ ] **Step 4: 构建验证**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/settings/EditorTab.vue frontend/src/components/SettingsPanel.vue
git commit -m "refactor: 拆分 EditorTab"
```

---

### Task 5: 拆分 AppearanceTab

**Files:**
- Create: `frontend/src/components/settings/AppearanceTab.vue`
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Produces: `AppearanceTab.vue`（无 props/emits；`onMounted` 调 `refreshSnippets()`）
- Consumes: `useSettingsStore`、`useToast`、`STR`、外观/皮肤/片段相关 `DEFAULT_*`、`invoke`、`logger`、`skin.js` 的 `reloadSkinStyle/injectSnippetStyle/removeSnippetStyle/syncAllSnippetStyles`

- [ ] **Step 1: 创建 `AppearanceTab.vue`（最大，含皮肤/片段）**

template 取原 `appearance` tab 内容（字体/字号/缩放/无边框 + 皮肤 + 片段 + 时间块显示），`resetCategory('appearance')`→`resetAppearance`。

`<script setup>`（搬移全部皮肤/片段 handler，注意 `onMounted` 承接「打开面板自动刷新片段列表」）：

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../store/settings.js'
import { useToast } from '../composables/useToast.js'
import { logger } from '../utils/log.js'
import { STR } from '../strings.js'
import {
  DEFAULT_FONT_FAMILY, DEFAULT_EDITOR_FONT_SIZE, DEFAULT_ZOOM, DEFAULT_OPACITY,
  DEFAULT_BORDERLESS,
  DEFAULT_SHOW_BLOCK_TITLE, DEFAULT_SHOW_BLOCK_TIME, DEFAULT_SHOW_BLOCK_TAGS,
  DEFAULT_SHOW_BLOCK_NOTE, DEFAULT_SHOW_BLOCK_COLOR_BAR, DEFAULT_MASK_BLOCK_OVERFLOW,
  DEFAULT_RENDER_NOTE_MARKDOWN,
} from '../constants.js'
import { reloadSkinStyle, injectSnippetStyle as _injSnippet, removeSnippetStyle as _rmSnippet, syncAllSnippetStyles as _syncSnippets } from '../utils/skin.js'

const settings = useSettingsStore()
const { toast } = useToast()
const showZoomPopup = ref(false)

const userSkinFiles = ref([])
const snippetFiles = ref([])

const skinOptions = computed(() => {
  const builtin = [
    { id: '', label: STR.settings.skinDay },
    { id: 'night', label: STR.settings.skinNight },
  ]
  const userSkins = userSkinFiles.value
    .filter(name => name !== 'night')
    .map(name => ({ id: name, label: name }))
  const sep = userSkins.length > 0 ? [{ id: '', label: '─'.repeat(10), disabled: true }] : []
  return [...builtin, ...sep, ...userSkins]
})

async function resolveSkinPath() {
  if (settings.skinPath) return settings.skinPath
  const base = await invoke('get_default_asset_dir')
  return base + '\\skins'
}
async function resolveSnippetPath() {
  if (settings.snippetPath) return settings.snippetPath
  const base = await invoke('get_default_asset_dir')
  return base + '\\snippets'
}

async function onSkinDropdownOpen() { /* 原样搬 */ }
async function refreshSkins() { /* 原样搬 */ }
async function doReloadSkinStyle() { /* 原样搬 */ }
function onSkinSelect(val) { /* 原样搬 */ }
async function refreshSnippets() { /* 原样搬 */ }
function snippetEnabled(name) { return settings.enabledSnippets.includes(name) }
async function onSnippetToggle(name, on) { /* 原样搬 */ }
async function doInjectSnippet(name) { /* 原样搬 */ }
function doRemoveSnippet(name) { _rmSnippet(name) }
async function doSyncSnippets() { /* 原样搬 */ }
async function openSkinFolder() { /* 原样搬 */ }
async function openSnippetFolder() { /* 原样搬 */ }

function onEditorFontSizeChange(e) { settings.setEditorFontSize(e.target.value); e.target.value = settings.editorFontSize }
function onOpacityInput(e) { settings.setBlockOpacity(e.target.value) }
function onBorderlessChange(e) { settings.setBorderless(e.target.checked); applyBorderless(e.target.checked) }
function applyBorderless(val) { /* 原样搬（含 winCtrls + setDecorations） */ }

function resetAppearance() {
  settings.setFontFamily(DEFAULT_FONT_FAMILY)
  settings.setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)
  settings.setZoom(DEFAULT_ZOOM)
  settings.setBlockOpacity(DEFAULT_OPACITY)
  settings.setBorderless(DEFAULT_BORDERLESS)
  settings.setActiveSkin('')
  settings.setEnabledSnippets([])
}

onMounted(() => { refreshSnippets() })
</script>
```

> 注：皮肤/片段 handler（`onSkinDropdownOpen`/`refreshSkins`/`doReloadSkinStyle`/`onSkinSelect`/`refreshSnippets`/`onSnippetToggle`/`doInjectSnippet`/`doSyncSnippets`/`openSkinFolder`/`openSnippetFolder`/`applyBorderless`）从原 SettingsPanel **逐字搬**，勿改写内部逻辑。`refreshSnippets` 里 `snippetFiles.value = await invoke('scan_css_files', { path })` 等保持不变。

- [ ] **Step 2: SettingsPanel 替换 appearance tab + import AppearanceTab**

```html
<AppearanceTab v-show="activeTab === 'appearance'" />
```

- [ ] **Step 3: 删除 SettingsPanel 已搬走逻辑**

删除 `showZoomPopup`、`userSkinFiles`、`snippetFiles`、`skinOptions`、`resolveSkinPath`、`resolveSnippetPath`、全部皮肤/片段 handler、`onEditorFontSizeChange`、`onOpacityInput`、`onBorderlessChange`、`applyBorderless`、`resetCategory` 里 `case 'appearance'`，及不再引用的 import（`computed`、`onMounted`、`logger` 若不再用、`reloadSkinStyle/_injSnippet/_rmSnippet/_syncSnippets`、相关 `DEFAULT_*`、`useToast` 若不再用）。**注意**：`watch(props.show)` 里的 `refreshSnippets()` 调用需删除（已由 AppearanceTab 的 `onMounted` 承接）。

- [ ] **Step 4: 构建验证**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/settings/AppearanceTab.vue frontend/src/components/SettingsPanel.vue
git commit -m "refactor: 拆分 AppearanceTab"
```

---

### Task 6: 拆分 FilesTab

**Files:**
- Create: `frontend/src/components/settings/FilesTab.vue`
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Produces: `FilesTab.vue`（无 props/emits；本地 `bkPathDraft`）
- Consumes: `useSettingsStore`、`useConfirm`、`useToast`、`STR`、`DEFAULT_*`、`migrateBackups`

- [ ] **Step 1: 创建 `FilesTab.vue`**

template 取原 `files` tab 内容（导出 + 备份），`resetCategory('export')`→`resetExport`、`resetCategory('backup')`→`resetBackup`。

`<script setup>`：

```vue
<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useToast } from '../composables/useToast.js'
import { STR } from '../strings.js'
import { migrateBackups } from '../utils/backup.js'
import { DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG, DEFAULT_BACKUP_ON, DEFAULT_KEEP_DAYS } from '../constants.js'

const settings = useSettingsStore()
const { showConfirm } = useConfirm()
const { toast } = useToast()
const bkPathDraft = ref(settings.bkCustomPath)

async function onBkPathBlur() { /* 原样搬（showConfirm + migrateBackups） */ }
async function onBkPathReset() { /* 原样搬（showConfirm + 聚焦回退） */ }
function onKeepDaysChange(e) { settings.setKeepDays(e.target.value); e.target.value = settings.keepDays }

function resetExport() {
  settings.setExportTimestamp(DEFAULT_EXPORT_TIMESTAMP)
  settings.setExportDialog(DEFAULT_EXPORT_DIALOG)
}
function resetBackup() {
  settings.setBkCustomPath('')
  bkPathDraft.value = ''
  settings.setBackupOn(DEFAULT_BACKUP_ON)
  settings.setKeepDays(DEFAULT_KEEP_DAYS)
}
</script>
```

> 注：`onBkPathBlur`/`onBkPathReset` 从原 SettingsPanel 逐字搬，其中 `bkPathDraft.value = settings.bkCustomPath` 的同步已由 `ref(settings.bkCustomPath)` 初始化 + 每次 open 重新 mount 承接。

- [ ] **Step 2: SettingsPanel 替换 files tab + import FilesTab**

```html
<FilesTab v-show="activeTab === 'files'" />
```

- [ ] **Step 3: 删除 SettingsPanel 已搬走逻辑**

删除 `bkPathDraft`、`onBkPathBlur`、`onBkPathReset`、`onKeepDaysChange`、`resetCategory` 里 `case 'export'`、`case 'backup'`，及不再引用的 import（`useConfirm`/`migrateBackups`/相关 `DEFAULT_*`）。删除 `watch(props.show)`（bkPathDraft 同步逻辑已迁到 FilesTab 初始化）。

- [ ] **Step 4: 构建验证**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/settings/FilesTab.vue frontend/src/components/SettingsPanel.vue
git commit -m "refactor: 拆分 FilesTab"
```

---

### Task 7: 拆分 DevTab + 收尾 shell

**Files:**
- Create: `frontend/src/components/settings/DevTab.vue`
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Produces: `DevTab.vue`（无 props/emits）
- Consumes: `invoke`、`useSettingsStore`、`STR`、`skin.js` 的 `installSkinTemplates/injectSkinStyle/reloadSkinStyle`

- [ ] **Step 1: 创建 `DevTab.vue`**

template 取原 `dev` tab 内容（重装皮肤 + DevTools）。

`<script setup>`：

```vue
<script setup>
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../store/settings.js'
import { STR } from '../strings.js'

const settings = useSettingsStore()

async function openDevTools() {
  try { await invoke('open_devtools') } catch { /* 非 Tauri 环境 */ }
}

async function reinstallSkin() {
  localStorage.removeItem('timelog:skinInstalled')
  const skinDir = settings.skinPath || (await invoke('get_default_asset_dir')) + '\\skins'
  const { installSkinTemplates, injectSkinStyle } = await import('../utils/skin.js')
  await installSkinTemplates(skinDir)
  if (settings.activeSkin) { await injectSkinStyle(skinDir, settings.activeSkin) }
}
</script>
```

- [ ] **Step 2: SettingsPanel 替换 dev tab + import DevTab**

```html
<DevTab v-show="activeTab === 'dev'" />
```

- [ ] **Step 3: 收尾 shell**

删除 SettingsPanel 里：`openDevTools`、`reinstallSkin`、`resetCategory`（整个函数，此时所有 case 已拆空）、`watch(props.show)`（已全部迁走）、以及不再引用的 import（`invoke`、`useSettingsStore`、`useToast`、`useConfirm`、`logger`、`migrateBackups`、`skin.js` 相关、大量 `DEFAULT_*`/`compareSemver`/`APP_VERSION` 等）。

最终 shell 的 `<script setup>` 仅保留：

```vue
<script setup>
import { ref } from 'vue'
import { STR } from '../strings.js'
import BasicTab from './settings/BasicTab.vue'
import EditorTab from './settings/EditorTab.vue'
import AppearanceTab from './settings/AppearanceTab.vue'
import FilesTab from './settings/FilesTab.vue'
import DevTab from './settings/DevTab.vue'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'checkUpdateResult'])

const activeTab = ref('basic')
const tabs = [
  { key: 'basic', label: STR.settings.navBasic },
  { key: 'editor', label: STR.settings.navEditor },
  { key: 'appearance', label: STR.settings.navAppearance },
  { key: 'files', label: STR.settings.navFiles },
  { key: 'dev', label: STR.settings.navDev },
]

function trapFocus(e) { /* 原样保留 */ }
function onClose() { if (document.activeElement?.tagName === 'INPUT') document.activeElement.blur(); emit('close') }
</script>
```

> 注：`trapFocus` 从原 SettingsPanel 逐字保留（在 shell 的 `@keydown="trapFocus"` 上）。

- [ ] **Step 4: 构建验证**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/settings/DevTab.vue frontend/src/components/SettingsPanel.vue
git commit -m "refactor: 拆分 DevTab 并收尾设置面板 shell"
```

---

### Task 8: 全量验证

**Files:**
- 无改动（仅验证）

- [ ] **Step 1: 跑测试基线**

Run: `cd /d/a_my/project/html/Timelog/frontend && npm test`
Expected: 仍是 32 tests / 2 known failures（与拆分前一致，无新增失败）。

- [ ] **Step 2: 手动过一遍（tauri dev）**

Run: `cd /d/a_my/project/html/Timelog && npm run tauri dev`

逐项确认：
- 5 个 tab 渲染与拆分前一致（基础/编辑器/外观/文件/开发者）
- 每个 toggle/按钮/输入框/下拉/滑条正常
- 皮肤下拉切换实时生效；**片段列表打开面板即自动出现（不回退 Task 3 之前的修复）**
- **换皮肤后片段仍生效（不回退「皮肤插到片段之前」的修复）**
- 检查更新按钮 → 弹出更新结果
- 夜间皮肤下 toggle 旋钮为 `var(--canvas)`（不再是写死白）
- 导出图片面板 / 统计面板的 select、range 样式**未被泄漏影响**

- [ ] **Step 3: 完成后无提交（或按需修正后提交）**

如手动验证发现问题，修复后再提交对应改动。

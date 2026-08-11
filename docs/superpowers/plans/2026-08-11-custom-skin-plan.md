# 自定义皮肤与 CSS 片段 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户通过文件系统中的 `.css` 文件管理皮肤主题和 CSS 片段，app 运行时读取内容注入 `<style>` 标签实时生效。

**Architecture:** 4 个 Rust 命令（扫描 / 读取 / 写入 / 打开文件夹 / 获取默认路径）+ 4 个 Settings store 字段 + SettingsPanel 外观 Tab 新增 UI + App.vue 全局 `<style>` 注入管理。皮肤/片段内容通过 Rust `read_file_text` 读取，写入 `<style>` 标签的 `textContent`，无需处理 `file://` CSP 问题。

**Tech Stack:** Tauri v2 (Rust), Vue 3 + Pinia (frontend), localStorage 持久化。

## 注入机制说明

使用 `<style>` 标签注入而非 `<link>` 标签，原因：
- Tauri WebView2 对 `file://` 路径有 CSP 限制，`<link href="file://...">` 不可靠
- `<style>` + `textContent` 模式已被现有 `customCss` 在 `MarkdownEditor.vue` 中验证可行
- 代价：CSS 中的 `url()` 相对路径会相对 HTML 页面解析而非 CSS 文件。对于皮肤（`:root` 变量覆盖）和绝大多数片段场景不构成问题

## Global Constraints

- WebView2 only，不考虑跨浏览器兼容
- 所有前端命令在 `frontend/` 目录下执行
- Commit message：英文前缀 + 中文描述（Conventional Commits）
- 改代码前必须先得到用户明确同意

---

## 文件变更地图

| 文件 | 操作 | 变更内容 |
|------|------|----------|
| `src-tauri/src/lib.rs` | Modify | 新增 5 个 commands |
| `frontend/src/constants.js` | Modify | 移除 DEFAULT_CUSTOM_CSS，新增 NIGHT_CSS_CONTENT / BUILTIN_SKINS |
| `frontend/src/store/settings.js` | Modify | 新增 4 字段 + setters，移除 customCss |
| `frontend/src/strings.js` | Modify | 新增皮肤/片段区块文案 |
| `frontend/src/components/SettingsPanel.vue` | Modify | 外观 Tab 新增 UI |
| `frontend/src/App.vue` | Modify | 皮肤/片段注入 + 夜间 CSS 安装 + watchers |
| `frontend/src/components/MarkdownEditor.vue` | Modify | 移除 customCss |
| `frontend/src/components/EditModal.vue` | Modify | 移除 customCss prop |
| `frontend/src/components/BatchCreatePanel.vue` | Modify | 移除 customCss prop |

---

### Task 1: Rust Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces:
  - `fn scan_css_files(path: String) -> Result<Vec<String>, String>`
  - `fn read_file_text(path: String) -> Result<String, String>`
  - `fn write_file_text(path: String, content: String) -> Result<(), String>`
  - `fn open_folder(path: String) -> Result<(), String>`
  - `fn get_default_asset_dir() -> Result<String, String>`

- [ ] **Step 1: 在 `lib.rs` 顶部添加 import**

在现有 `use std::fs;` 之后添加（若尚无则新增）：
```rust
use std::fs;
use std::path::Path;
use std::io::Write;
```

- [ ] **Step 2: 在现有 commands 之后（`clipboard_write_text` 之后）添加 5 个新函数**

```rust
// ═══════ 皮肤 & CSS 片段 ═══════

/// 返回 AppData 下的数据目录
#[tauri::command]
fn get_default_asset_dir() -> Result<String, String> {
    let appdata = std::env::var("APPDATA").map_err(|e| e.to_string())?;
    Ok(format!("{}\\com.timelog.app", appdata))
}

/// 扫描目录中 .css 文件，返回去后缀文件名列表。目录不存在则创建。
#[tauri::command]
fn scan_css_files(path: String) -> Result<Vec<String>, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let mut files: Vec<String> = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let fname = entry.file_name().to_string_lossy().to_string();
        if fname.ends_with(".css") {
            files.push(fname[..fname.len() - 4].to_string());
        }
    }
    files.sort();
    Ok(files)
}

/// 读取文本文件内容
#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

/// 写入文本文件内容（自动创建父目录）
#[tauri::command]
fn write_file_text(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let mut f = fs::File::create(&path).map_err(|e| format!("创建文件失败: {}", e))?;
    f.write_all(content.as_bytes()).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

/// 用系统文件管理器打开文件夹
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("打开文件夹失败: {}", e))?;
    Ok(())
}
```

- [ ] **Step 3: 在 `generate_handler!` 中注册新命令**

```rust
        .invoke_handler(tauri::generate_handler![
            fetch_latest_json,
            check_update,
            download_update,
            install_update,
            clipboard_write_image,
            clipboard_write_text,
            get_default_asset_dir,
            scan_css_files,
            read_file_text,
            write_file_text,
            open_folder,
        ])
```

- [ ] **Step 4: 构建验证**

```bash
cd /d/a_my/project/html/Timelog && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: 编译成功。

- [ ] **Step 5: Commit**

```bash
cd /d/a_my/project/html/Timelog && git add src-tauri/src/lib.rs && git commit -m "feat: Rust新增扫描/读取/写入CSS文件、打开文件夹、获取数据目录命令"
```

---

### Task 2: Constants — 移除 DEFAULT_CUSTOM_CSS，新增常量

**Files:**
- Modify: `frontend/src/constants.js`

**Interfaces:**
- Produces: `NIGHT_CSS_CONTENT` (string), `BUILTIN_SKINS` (array)
- Removes: `DEFAULT_CUSTOM_CSS`

- [ ] **Step 1: 删除 `DEFAULT_CUSTOM_CSS`**

删除第 54 行：
```js
export const DEFAULT_CUSTOM_CSS = ''
```

- [ ] **Step 2: 在 `DEFAULT_MIN_BLOCK_MINUTES` 之后添加**

```js
// 内置夜间皮肤 CSS（首次启动自动安装到 skins/night.css）
export const NIGHT_CSS_CONTENT = `/* 夜间皮肤 */
:root {
  --text: #c2ccd0;
  --text2: #a1afc9;
  --canvas: #161823;
  --soft: #50616d;
  --soft2: #35434d;
  --border: #758a99;
  --blue: #758a99;
  --blue-soft: #1f2936;
  --green: #549688;
  --red: #cd5e3c;
}
`

// 内置皮肤列表
export const BUILTIN_SKINS = [
  { id: '', label: '☀ 日间（默认）' },
  { id: 'night', label: '🌙 夜间' },
]
```

- [ ] **Step 3: 运行测试确认**

```bash
cd /d/a_my/project/html/Timelog/frontend && npm test
```

Expected: 32 tests, 2 known failures。

- [ ] **Step 4: Commit**

```bash
cd /d/a_my/project/html/Timelog && git add frontend/src/constants.js && git commit -m "chore: 移除DEFAULT_CUSTOM_CSS，添加NIGHT_CSS_CONTENT和BUILTIN_SKINS常量"
```

---

### Task 3: Settings Store — 新增字段，移除 customCss

**Files:**
- Modify: `frontend/src/store/settings.js`

**Interfaces:**
- Produces: `activeSkin`, `skinPath`, `snippetPath`, `enabledSnippets` + setters
- Removes: `customCss`, `setCustomCss`

- [ ] **Step 1: 更新 import — 移除 `DEFAULT_CUSTOM_CSS`**

在 import 语句（约第 8 行）中删除 `DEFAULT_CUSTOM_CSS`。

- [ ] **Step 2: 删除 customCss 声明和 setCustomCss 函数**

删除约第 48 行：
```js
const customCss = ref(localStorage.getItem(KEY_PREFIX + 'customCss') || DEFAULT_CUSTOM_CSS)
```

删除约第 155-159 行的 `setCustomCss` 函数。

- [ ] **Step 3: 在 `editorFontSize` 之后添加新字段**

```js
  // ── Skin & snippet ──
  const activeSkin = ref(localStorage.getItem(KEY_PREFIX + 'activeSkin') || '')
  const skinPath = ref(localStorage.getItem(KEY_PREFIX + 'skinPath') || '')
  const snippetPath = ref(localStorage.getItem(KEY_PREFIX + 'snippetPath') || '')
  const enabledSnippets = ref((() => {
    try { return JSON.parse(localStorage.getItem(KEY_PREFIX + 'enabledSnippets')) || [] } catch { return [] }
  })())

  function setActiveSkin(v) {
    activeSkin.value = (v || '').trim()
    if (activeSkin.value) { localStorage.setItem(KEY_PREFIX + 'activeSkin', activeSkin.value) }
    else { localStorage.removeItem(KEY_PREFIX + 'activeSkin') }
  }
  function setSkinPath(v) {
    skinPath.value = (v || '').trim()
    if (skinPath.value) { localStorage.setItem(KEY_PREFIX + 'skinPath', skinPath.value) }
    else { localStorage.removeItem(KEY_PREFIX + 'skinPath') }
  }
  function setSnippetPath(v) {
    snippetPath.value = (v || '').trim()
    if (snippetPath.value) { localStorage.setItem(KEY_PREFIX + 'snippetPath', snippetPath.value) }
    else { localStorage.removeItem(KEY_PREFIX + 'snippetPath') }
  }
  function setEnabledSnippets(v) {
    enabledSnippets.value = v || []
    if (enabledSnippets.value.length > 0) {
      localStorage.setItem(KEY_PREFIX + 'enabledSnippets', JSON.stringify(enabledSnippets.value))
    } else {
      localStorage.removeItem(KEY_PREFIX + 'enabledSnippets')
    }
  }
```

- [ ] **Step 4: 更新 `reloadSettings`**

删除其中的 `customCss.value = ...` 行。在末尾（`autoSelectOnFocus` 之后）添加：
```js
    activeSkin.value = (localStorage.getItem(KEY_PREFIX + 'activeSkin') || '')
    skinPath.value = (localStorage.getItem(KEY_PREFIX + 'skinPath') || '')
    snippetPath.value = (localStorage.getItem(KEY_PREFIX + 'snippetPath') || '')
    try { enabledSnippets.value = JSON.parse(localStorage.getItem(KEY_PREFIX + 'enabledSnippets')) || [] } catch { enabledSnippets.value = [] }
```

- [ ] **Step 5: 更新 return 对象**

删除 `customCss`（两处：state + setter）。添加：
```js
    activeSkin, skinPath, snippetPath, enabledSnippets,
    setActiveSkin, setSkinPath, setSnippetPath, setEnabledSnippets,
```

- [ ] **Step 6: 运行测试 + Commit**

```bash
cd /d/a_my/project/html/Timelog/frontend && npm test
cd /d/a_my/project/html/Timelog && git add frontend/src/store/settings.js && git commit -m "feat: store新增activeSkin/skinPath/snippetPath/enabledSnippets，移除customCss"
```

---

### Task 4: Strings — 新增文案

**Files:**
- Modify: `frontend/src/strings.js`

**Interfaces:**
- Produces: `STR.settings.sectionSkin`, `sectionSnippet`, `openSkinFolder`, `openSnippetFolder`, `refresh`, `descSkin`, `descSnippet`; `STR.toast.folderNotFound`

- [ ] **Step 1: 在 `settings` 对象中添加**

```js
    sectionSkin: '皮肤',
    sectionSnippet: 'CSS 片段',
    openSkinFolder: '打开皮肤文件夹',
    openSnippetFolder: '打开片段文件夹',
    refresh: '刷新',
    descSkin: '将 .css 文件放入皮肤文件夹即可作为主题使用，下拉切换实时生效',
    descSnippet: '将 .css 文件放入片段文件夹，每个文件对应一个开关',
```

- [ ] **Step 2: 在 `toast` 对象中添加**

```js
    folderNotFound: '无法访问该文件夹',
```

- [ ] **Step 3: Commit**

```bash
cd /d/a_my/project/html/Timelog && git add frontend/src/strings.js && git commit -m "feat: 添加皮肤/片段UI文案"
```

---

### Task 5: SettingsPanel.vue — 外观 Tab 新增 UI

**Files:**
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Consumes: settings store fields, `BUILTIN_SKINS`, `STR.*`
- Produces: 皮肤下拉 + 片段开关列表 + 按钮

- [ ] **Step 1: 在 template 的"无边框"和"时间块显示"之间插入下述 HTML**

位置：`descBorderless` 的 `</div>` 之后、`<!-- 时间块 -->` 之前。

```html
            <!-- 皮肤 -->
            <div class="sub-head">{{ STR.settings.sectionSkin }}</div>

            <div class="row">
              <label>当前皮肤</label>
              <div>
                <select :value="settings.activeSkin" @change="onSkinSelect($event.target.value)"
                  @focus="onSkinDropdownOpen" style="width:180px;">
                  <option v-for="s in skinOptions" :key="s.id" :value="s.id"
                    :disabled="s.disabled">{{ s.label }}</option>
                </select>
                <span class="restore-spacer"></span>
              </div>
            </div>
            <div class="row" style="margin-top:8px;">
              <div style="display:flex;gap:8px;">
                <button type="button" @click="openSkinFolder" class="small-btn">{{ STR.settings.openSkinFolder }}</button>
                <button type="button" @click="refreshSkins" class="small-btn">{{ STR.settings.refresh }}</button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descSkin }}</div>

            <!-- CSS 片段 -->
            <div class="sub-head">{{ STR.settings.sectionSnippet }}</div>

            <div class="snippet-scroll">
              <div v-if="snippetFiles.length === 0" class="small" style="padding:8px;">暂无 CSS 片段文件</div>
              <div v-for="name in snippetFiles" :key="name" class="row" style="margin-top:6px;">
                <label>{{ name }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="snippetEnabled(name)"
                      @change="onSnippetToggle(name, $event.target.checked)"><span class="tk"></span></label>
                </div>
              </div>
            </div>
            <div class="row" style="margin-top:8px;">
              <div style="display:flex;gap:8px;">
                <button type="button" @click="openSnippetFolder" class="small-btn">{{ STR.settings.openSnippetFolder }}</button>
                <button type="button" @click="refreshSnippets" class="small-btn">{{ STR.settings.refresh }}</button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descSnippet }}</div>
```

- [ ] **Step 2: 更新 import — 在 constants 解构中添加 `BUILTIN_SKINS`**

```js
import {
  // ... 现有 ...
  BUILTIN_SKINS,
} from '../constants.js'
```

- [ ] **Step 3: 在 `<script setup>` 中添加状态和方法**

在 `const tabs = [...]` 之前插入：

```js
// ── Skin & Snippet ──
const userSkinFiles = ref([])
const snippetFiles = ref([])

const skinOptions = computed(() => {
  const userSkins = userSkinFiles.value
    .filter(name => name !== 'night')
    .map(name => ({ id: name, label: name }))
  const sep = userSkins.length > 0 ? [{ id: '', label: '─────────', disabled: true }] : []
  return [...BUILTIN_SKINS, ...sep, ...userSkins]
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

async function onSkinDropdownOpen() {
  try {
    const path = await resolveSkinPath()
    userSkinFiles.value = await invoke('scan_css_files', { path })
    // 如果当前皮肤文件已不存在，回退日间
    if (settings.activeSkin && settings.activeSkin !== 'night'
        && !userSkinFiles.value.includes(settings.activeSkin)) {
      settings.setActiveSkin('')
    }
  } catch { /* 静默 */}
}

async function refreshSkins() {
  try {
    const path = await resolveSkinPath()
    userSkinFiles.value = await invoke('scan_css_files', { path })
    // 重建皮肤 <style>（带 cache-busting：重新读文件内容）
    await reloadSkinStyle()
  } catch { toast(STR.toast.folderNotFound) }
}

async function reloadSkinStyle() {
  const name = settings.activeSkin
  const style = document.getElementById('skin-style')
  if (!name) {
    if (style) style.remove()
    return
  }
  try {
    const path = await resolveSkinPath()
    const content = await invoke('read_file_text', { path: path + '\\' + name + '.css' })
    if (!style) {
      const s = document.createElement('style')
      s.id = 'skin-style'
      s.textContent = content
      document.head.appendChild(s)
    } else {
      style.textContent = content
    }
  } catch {
    // 文件读取失败（可能被删）→ 移除 style，设为日间
    if (style) style.remove()
    settings.setActiveSkin('')
  }
}

function onSkinSelect(val) {
  if (!val && settings.activeSkin === '') return // 点中分隔线
  settings.setActiveSkin(val)
}

// ── Snippet ──

async function refreshSnippets() {
  try {
    const path = await resolveSnippetPath()
    snippetFiles.value = await invoke('scan_css_files', { path })
    // 清理幽灵记录
    const valid = new Set(snippetFiles.value)
    settings.setEnabledSnippets(settings.enabledSnippets.filter(s => valid.has(s)))
    // 重建所有 <style>
    await syncSnippetStyles()
  } catch { toast(STR.toast.folderNotFound) }
}

function snippetEnabled(name) {
  return settings.enabledSnippets.includes(name)
}

async function onSnippetToggle(name, on) {
  const list = [...settings.enabledSnippets]
  if (on) {
    if (!list.includes(name)) list.push(name)
    await injectOneSnippet(name)
  } else {
    const idx = list.indexOf(name)
    if (idx !== -1) list.splice(idx, 1)
    removeOneSnippet(name)
  }
  settings.setEnabledSnippets(list)
}

async function injectOneSnippet(name) {
  removeOneSnippet(name)
  try {
    const path = await resolveSnippetPath()
    const content = await invoke('read_file_text', { path: path + '\\' + name + '.css' })
    const style = document.createElement('style')
    style.dataset.snippet = name
    style.textContent = content
    document.head.appendChild(style)
  } catch { /* 读取失败跳过 */ }
}

function removeOneSnippet(name) {
  const style = document.querySelector(`style[data-snippet="${CSS.escape(name)}"]`)
  if (style) style.remove()
}

async function syncSnippetStyles() {
  document.querySelectorAll('style[data-snippet]').forEach(s => s.remove())
  for (const name of settings.enabledSnippets) {
    await injectOneSnippet(name)
  }
}

async function openSkinFolder() {
  try { await invoke('open_folder', { path: await resolveSkinPath() }) }
  catch { toast(STR.toast.folderNotFound) }
}

async function openSnippetFolder() {
  try { await invoke('open_folder', { path: await resolveSnippetPath() }) }
  catch { toast(STR.toast.folderNotFound) }
}
```

- [ ] **Step 4: 更新 `resetCategory('appearance')`**

```js
    case 'appearance':
      settings.setFontFamily(DEFAULT_FONT_FAMILY)
      settings.setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)
      settings.setZoom(DEFAULT_ZOOM)
      settings.setBlockOpacity(DEFAULT_OPACITY)
      settings.setBorderless(DEFAULT_BORDERLESS)
      settings.setActiveSkin('')
      settings.setEnabledSnippets([])
      break
```

- [ ] **Step 5: 在 `<style scoped>` 末尾添加**

```css
.snippet-scroll {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 8px 4px;
  margin-top: 4px;
}
```

- [ ] **Step 6: Commit**

```bash
cd /d/a_my/project/html/Timelog && git add frontend/src/components/SettingsPanel.vue && git commit -m "feat: 外观Tab新增皮肤选择+CSS片段开关UI"
```

---

### Task 6: App.vue — 注入机制 + 夜间 CSS 安装 + watchers

**Files:**
- Modify: `frontend/src/App.vue`

**Interfaces:**
- Consumes: settings store, `NIGHT_CSS_CONTENT`, `BUILTIN_SKINS`
- Produces: `<style id="skin-style">` 管理, `<style data-snippet="...">` 管理, 夜间 CSS 首次安装

- [ ] **Step 1: 更新 import — 添加 `NIGHT_CSS_CONTENT`**

修改 constants import，添加 `NIGHT_CSS_CONTENT`：
```js
import { APP_VERSION, compareSemver, DAY_MIN, DAY_OFFSET, NIGHT_CSS_CONTENT } from './constants.js'
```

- [ ] **Step 2: 在 `applyFontFamily` 之后添加注入相关函数**

```js
// ═══════ 皮肤 & CSS 片段注入 ═══════

let _defaultBaseCache = null

async function getDefaultBase() {
  if (!_defaultBaseCache) {
    try {
      _defaultBaseCache = await invoke('get_default_asset_dir')
    } catch {
      _defaultBaseCache = ''
    }
  }
  return _defaultBaseCache
}

async function resolveSkinDir() {
  if (settings.skinPath) return settings.skinPath
  return await getDefaultBase() + '\\skins'
}

async function resolveSnippetDir() {
  if (settings.snippetPath) return settings.snippetPath
  return await getDefaultBase() + '\\snippets'
}

async function injectSkinStyle(name) {
  removeSkinStyle()
  if (!name) return
  try {
    const dir = await resolveSkinDir()
    const content = await invoke('read_file_text', { path: dir + '\\' + name + '.css' })
    const style = document.createElement('style')
    style.id = 'skin-style'
    style.textContent = content
    document.head.appendChild(style)
  } catch {
    // 文件读失败 → 回退日间
    settings.setActiveSkin('')
  }
}

function removeSkinStyle() {
  const style = document.getElementById('skin-style')
  if (style) style.remove()
}

async function injectSnippetStyle(name) {
  removeSnippetStyle(name)
  try {
    const dir = await resolveSnippetDir()
    const content = await invoke('read_file_text', { path: dir + '\\' + name + '.css' })
    const style = document.createElement('style')
    style.dataset.snippet = name
    style.textContent = content
    document.head.appendChild(style)
  } catch { /* 文件被删，跳过 */ }
}

function removeSnippetStyle(name) {
  const style = document.querySelector(`style[data-snippet="${CSS.escape(name)}"]`)
  if (style) style.remove()
}

async function syncAllSnippetStyles() {
  document.querySelectorAll('style[data-snippet]').forEach(s => s.remove())
  for (const name of settings.enabledSnippets) {
    await injectSnippetStyle(name)
  }
}

// ── 首次启动: 安装 night.css ──
async function ensureNightCss() {
  try {
    const dir = await resolveSkinDir()
    // scan_css_files 会自动创建目录
    const files = await invoke('scan_css_files', { path: dir })
    if (!files.includes('night')) {
      await invoke('write_file_text', {
        path: dir + '\\night.css',
        content: NIGHT_CSS_CONTENT,
      })
    }
    return files
  } catch { return [] }
}

// ── watcher: 皮肤变化 → 重建 <style> ──
watch(() => settings.activeSkin, (name) => {
  injectSkinStyle(name)
})

// ── watcher: 片段列表变化 → 增删 <style> ──
watch(() => settings.enabledSnippets, (list, oldList) => {
  const oldSet = new Set(oldList || [])
  const newSet = new Set(list || [])
  for (const name of oldSet) { if (!newSet.has(name)) removeSnippetStyle(name) }
  for (const name of newSet) { if (!oldSet.has(name)) injectSnippetStyle(name) }
})
```

- [ ] **Step 3: 在 `onMounted` 末尾（`store.goToday()` 之前）添加初始化调用**

```js
  // ── 初始化皮肤 & 片段 ──
  await ensureNightCss()

  // 首次注入皮肤
  if (settings.activeSkin) {
    await injectSkinStyle(settings.activeSkin)
  }

  // 首次扫描片段并注入 enabled 的
  try {
    const sDir = settings.snippetPath || (await getDefaultBase() + '\\snippets')
    await invoke('scan_css_files', { path: sDir })
    // 清理幽灵记录 + 注入
    const validFiles = await invoke('scan_css_files', { path: sDir })
    const validSet = new Set(validFiles)
    const cleaned = settings.enabledSnippets.filter(s => validSet.has(s))
    settings.setEnabledSnippets(cleaned)
    for (const name of cleaned) {
      await injectSnippetStyle(name)
    }
  } catch { /* 静默 */ }
```

- [ ] **Step 4: 构建验证**

```bash
cd /d/a_my/project/html/Timelog/frontend && npx vite build
```

Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
cd /d/a_my/project/html/Timelog && git add frontend/src/App.vue && git commit -m "feat: App.vue添加皮肤+片段style注入及夜间CSS首次安装逻辑"
```

---

### Task 7: Cleanup — 移除旧 customCss

**Files:**
- Modify: `frontend/src/components/MarkdownEditor.vue`
- Modify: `frontend/src/components/EditModal.vue`
- Modify: `frontend/src/components/BatchCreatePanel.vue`

- [ ] **Step 1: MarkdownEditor.vue — 删除 `<style>` 注入标签**

删除 template 中第 28 行：
```html
    <component :is="'style'" v-if="customCss">{{ customCss }}</component>
```

- [ ] **Step 2: MarkdownEditor.vue — 删除 customCss prop**

在 props 中删除：
```js
  customCss: { type: String, default: '' },
```

- [ ] **Step 3: EditModal.vue — 删除 prop 传递**

删除 `MarkdownEditor` 上的：
```html
        :custom-css="settings.customCss"
```

- [ ] **Step 4: BatchCreatePanel.vue — 删除 prop 传递**

删除 `MarkdownEditor` 上的：
```html
        :custom-css="settings.customCss"
```

- [ ] **Step 5: 构建 + Commit**

```bash
cd /d/a_my/project/html/Timelog/frontend && npx vite build
cd /d/a_my/project/html/Timelog && git add frontend/src/components/MarkdownEditor.vue frontend/src/components/EditModal.vue frontend/src/components/BatchCreatePanel.vue && git commit -m "refactor: 移除旧customCss，统一使用全局CSS片段系统"
```

---

### Task 8: 端到端验证

- [ ] **Step 1: 完整构建**

```bash
cd /d/a_my/project/html/Timelog && npm run tauri build
```

- [ ] **Step 2: 验证首次启动**

1. 安装 `.msi`，启动
2. 设置 → 外观 → 皮肤下拉有 ☀ 日间 + 🌙 夜间
3. 片段列表显示"暂无 CSS 片段文件"
4. `%APPDATA%/com.timelog.app/skins/night.css` 已生成
5. `%APPDATA%/com.timelog.app/snippets/` 目录已创建

- [ ] **Step 3: 验证皮肤切换**

1. 选 🌙 夜间 → 页面变暗色
2. 切回 ☀ 日间 → 恢复浅色

- [ ] **Step 4: 验证用户皮肤**

1. 打开皮肤文件夹，创建 `test.css` 含 `:root { --canvas: #fff0f0; }`
2. 展开下拉 → `test` 出现
3. 选 `test` → 页面临时变粉底
4. 删除文件，展开下拉 → `test` 消失，回退日间

- [ ] **Step 5: 验证 CSS 片段**

1. 打开片段文件夹，创建 `test.css` 含 `.block { border: 2px solid red; }`
2. 点刷新 → `test` 出现在列表
3. 开 toggle → 时间块红边框
4. 关 toggle → 消失
5. 删文件，点刷新 → 列表清除

- [ ] **Step 6: 回归测试**

```bash
cd /d/a_my/project/html/Timelog/frontend && npm test
```

Expected: 32 tests, 2 known failures。

- [ ] **Step 7: 最终 commit（如有未提交变更）**

```bash
cd /d/a_my/project/html/Timelog && git status && git add . && git commit -m "chore: 端到端验证通过"
```

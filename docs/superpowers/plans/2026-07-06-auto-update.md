# Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-update to Timelog Tauri app with Gitee→GitHub fallback, gray rollout, crash recovery, and exit-time install.

**Architecture:** All update logic in Rust (check, download with Channel-based progress, install, restart). JS side handles UI + rollout + crash recovery — calls Rust commands via `invoke()`, manages localStorage. Exit-time install via `on_window_event(CloseRequested)`.

**Tech Stack:** Rust (`tauri-plugin-updater 2`, `tauri-plugin-process 2`), JS (`@tauri-apps/api` for `invoke` + `Channel`), Vue 3 + Pinia.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-auto-update-design.md`
- Default `autoUpdate`: `false`
- Timeout: 10s per endpoint
- Endpoints: Gitee raw (`/raw/main/latest.json`) → GitHub Release (`/releases/latest/download/latest.json`)
- localStorage keys: `timelog:skipVersion`, `timelog:rolloutCache`, `timelog:pendingDownload`
- Rollout: `floor(Math.random() * 100)`, cache reuse when version + threshold unchanged, skip when `null` or `>= 100`
- Rust state pattern: `Mutex<Option<Update>>`

---

### Task 1: Rust Backend — Dependencies, Commands, and Close Handler

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `check_update` command → `Result<Option<UpdateMetadata>, String>`
- Produces: `download_update` command → `Result<(), String>` (progress via `Channel<DownloadEvent>`)
- Produces: `install_update` command → `Result<(), String>` (calls `app.restart()` on success)
- Produces: `PendingUpdate(Mutex<Option<Update>>)` — managed state
- Produces: Window close handler — if pending update exists, install before close

- [ ] **Step 1: Add Cargo dependencies**

```toml
# src-tauri/Cargo.toml — add to [dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

- [ ] **Step 2: Write Rust backend (lib.rs)**

Replace `src-tauri/src/lib.rs` with:

```rust
use std::sync::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{UpdaterExt, Update};

// ── Types ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    version: String,
    current_version: String,
    body: Option<String>,
    date: Option<String>,
    /// Gray rollout percentage 0-100, None = 100% (no gating)
    rollout: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started { content_length: Option<u64> },
    #[serde(rename_all = "camelCase")]
    Progress { chunk_length: usize },
    Finished,
}

// ── State ──

struct PendingUpdate(Mutex<Option<Update>>);

// ── Commands ──

#[tauri::command]
async fn check_update(
    app: AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
) -> Result<Option<UpdateMetadata>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    let metadata = update.as_ref().map(|u| UpdateMetadata {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        body: u.body.clone(),
        date: u.date.clone(),
    });

    *pending.0.lock().unwrap() = update;
    Ok(metadata)
}

#[tauri::command]
async fn download_update(
    pending: tauri::State<'_, PendingUpdate>,
    on_event: tauri::ipc::Channel<DownloadEvent>,
) -> Result<(), String> {
    let mut lock = pending.0.lock().unwrap();
    let update = lock.take().ok_or("没有待下载的更新".to_string())?;

    // Track whether we've sent Started
    let started = std::sync::Mutex::new(false);
    let finished_channel = on_event.clone();

    update
        .download(
            {
                let on_event = on_event.clone();
                move |chunk_length, content_length| {
                    let mut started = started.lock().unwrap();
                    if !*started {
                        let _ = on_event.send(DownloadEvent::Started { content_length });
                        *started = true;
                    }
                    let _ = on_event.send(DownloadEvent::Progress { chunk_length });
                }
            },
            move || {
                let _ = finished_channel.send(DownloadEvent::Finished);
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    // Put update back after download (needed for install step)
    *lock = Some(update);
    Ok(())
}

#[tauri::command]
async fn install_update(
    pending: tauri::State<'_, PendingUpdate>,
    app: AppHandle,
) -> Result<(), String> {
    let update = pending.0.lock().unwrap().take()
        .ok_or("没有待安装的更新".to_string())?;
    update.install().await.map_err(|e| e.to_string())?;
    app.restart();
    Ok(())
}

// ── App Entry ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            app.manage(PendingUpdate(Mutex::new(None)));

            // Handle exit-time install
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let pending = handle.state::<PendingUpdate>();
                        let mut lock = pending.0.lock().unwrap();
                        if lock.is_some() {
                            api.prevent_close();
                            let update = lock.take();
                            drop(lock);
                            let handle = handle.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Some(u) = update {
                                    let _ = u.install().await;
                                    let _ = handle.restart();
                                }
                                // If install failed or restart didn't fire, close the window
                                // (restart kills the process, so this only runs on failure)
                            });
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_update,
            download_update,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Build check**

```bash
cd D:/a_my/project/html/Timelog && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: compile succeeds (may download crates).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs
git commit -m "feat: add Rust updater backend with check/download/install commands and exit-time install handler"
```

---

### Task 2: Tauri Config — updater Plugin + Capabilities

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: updater endpoints from spec §6.1, capabilities from spec §8
- Produces: `bundle.createUpdaterArtifacts: true`, `plugins.updater` config, permissions

- [ ] **Step 1: Update tauri.conf.json**

Add to `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "createUpdaterArtifacts": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
},
"plugins": {
  "updater": {
    "pubkey": "PLACEHOLDER — run `tauri signer generate` and paste public key here",
    "endpoints": [
      "https://gitee.com/yves/timelog/releases/download/latest/latest.json",
      "https://github.com/yves/timelog/releases/latest/download/latest.json"
    ]
  }
}
```

Note: `bundle` block already exists — add `createUpdaterArtifacts: true` to it. `plugins` block is new.

- [ ] **Step 2: Update capabilities**

Add to `src-tauri/capabilities/default.json` permissions array:

```json
"updater:default",
"process:default"
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "feat: configure updater plugin endpoints (Gitee→GitHub) and permissions"
```

---

### Task 3: Frontend Dependencies

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `@tauri-apps/api` available for `invoke()` and `Channel()`

- [ ] **Step 1: Install @tauri-apps/api**

```bash
cd D:/a_my/project/html/Timelog/frontend && npm install @tauri-apps/api
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add @tauri-apps/api for updater IPC (invoke + Channel)"
```

---

### Task 4: Settings Store — autoUpdate Field

**Files:**
- Modify: `frontend/src/store/settings.js`
- Modify: `frontend/src/constants.js`

**Interfaces:**
- Consumes: `KEY_PREFIX` from constants, `DEFAULT_AUTO_UPDATE` from constants
- Produces: `autoUpdate` ref, `setAutoUpdate(v)` function

- [ ] **Step 1: Add default constant**

In `frontend/src/constants.js`, add after the `DEFAULT_BACKUP_ON` line:

```js
export const DEFAULT_AUTO_UPDATE = false
```

- [ ] **Step 2: Add autoUpdate to settings store**

In `frontend/src/store/settings.js`:

Add to import (line 7):
```js
  DEFAULT_BORDERLESS, DEFAULT_BACKUP_ON, DEFAULT_AUTO_UPDATE,
```

Add state ref (after `backupOn` line):
```js
const autoUpdate = ref(loadBool('autoUpdate', DEFAULT_AUTO_UPDATE))
```

Add setter function (before `return`):
```js
function setAutoUpdate(v) {
  autoUpdate.value = v
  saveBool('autoUpdate', v)
}
```

Add to return object:
```js
autoUpdate, setAutoUpdate,
```

- [ ] **Step 3: Run existing tests to verify no regression**

```bash
cd D:/a_my/project/html/Timelog/frontend && npm test
```
Expected: all 32 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/settings.js frontend/src/constants.js
git commit -m "feat: add autoUpdate setting (default false)"
```

---

### Task 5: Strings — Update UI Text

**Files:**
- Modify: `frontend/src/strings.js`

**Interfaces:**
- Produces: `STR.update.*` — all update-related strings, consumed by UpdateDialog and SettingsPanel

- [ ] **Step 1: Add update strings**

In `frontend/src/strings.js`, add to the `STR` object (after `confirm` block):

```js
update: {
  title: (v) => `发现新版本 ${v}`,
  published: (d) => `发布日期：${d}`,
  changelog: '更新内容',
  now: '现在更新',
  onExit: '下载后退出时更新',
  skip: '跳过此版本',
  dismiss: '忽略',
  downloading: '正在下载...',
  installing: '正在安装...',
  willInstallOnExit: '将在退出时安装更新',
  done: '更新完成，即将重启',
  noUpdate: '已是最新版本',
  checkFailed: '检查更新失败，请检查网络',
  downloadFailed: '下载失败',
  installFailed: '安装失败',
  retry: '重试',
  cancel: '取消',
  openFolder: '打开下载文件夹',
  copyPath: '复制路径',
  checking: '检查中...',
  checkUpdate: '检查更新',
  autoUpdate: '自动更新',
  autoUpdateDesc: '启动时自动检查更新（默认关闭）',
  pendingTitle: (v) => `上次下载的 ${v} 尚未安装`,
  pendingDesc: '是否现在安装？',
  pendingInstall: '现在安装',
  pendingDismiss: '忽略',
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/strings.js
git commit -m "feat: add update UI strings"
```

---

### Task 6: UpdateDialog Component

**Files:**
- Create: `frontend/src/components/UpdateDialog.vue`

**Interfaces:**
- Consumes: `STR.update` from strings, `invoke` + `Channel` from `@tauri-apps/api`
- Produces: `show` prop, `updateInfo` prop, `close` emit, `willInstallOnExit` emit
- Produces: Internal phase machine: `idle → downloading → installing → done | error`

- [ ] **Step 1: Create UpdateDialog.vue**

File: `frontend/src/components/UpdateDialog.vue`

```vue
<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')">
    <div class="modal update-dialog" @keydown="trapFocus">
      <h2>{{ STR.update.title(updateInfo?.version) }}</h2>

      <p v-if="updateInfo?.date" class="update-date">{{ STR.update.published(updateInfo.date) }}</p>

      <div v-if="updateInfo?.body" class="update-body">
        <div class="update-body-label">{{ STR.update.changelog }}</div>
        <div class="update-body-scroll">{{ updateInfo.body }}</div>
      </div>

      <!-- Idle: 4 buttons -->
      <div v-if="phase === 'idle'" class="update-actions">
        <button class="primary" @click="onUpdateNow">{{ STR.update.now }}</button>
        <button @click="onExitUpdate">{{ STR.update.onExit }}</button>
        <button @click="onSkip">{{ STR.update.skip }}</button>
        <button @click="emit('close')">{{ STR.update.dismiss }}</button>
      </div>

      <!-- Downloading -->
      <div v-if="phase === 'downloading'" class="update-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="progress-text">
          {{ formatBytes(downloaded) }}
          <template v-if="contentLength"> / {{ formatBytes(contentLength) }}</template>
          ({{ progressPct }}%)
        </div>
        <button @click="onCancel">{{ STR.update.cancel }}</button>
      </div>

      <!-- Installing -->
      <div v-if="phase === 'installing'" class="update-progress">
        <div class="progress-bar infinite"><div class="progress-fill-indeterminate"></div></div>
        <div class="progress-text">{{ STR.update.installing }}</div>
      </div>

      <!-- Done -->
      <div v-if="phase === 'done'" class="update-done">
        <p>{{ STR.update.done }}</p>
      </div>

      <!-- Error -->
      <div v-if="phase === 'error'" class="update-error">
        <p>{{ errorMessage }}</p>
        <button @click="onRetry">{{ STR.update.retry }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Channel } from '@tauri-apps/api/core'
import { STR } from '../strings.js'

const props = defineProps({
  show: Boolean,
  updateInfo: Object, // { version, currentVersion, body, date } | null
})
const emit = defineEmits(['close', 'willInstallOnExit'])  // willInstallOnExit emits version string

const phase = ref('idle') // 'idle' | 'downloading' | 'installing' | 'done' | 'error'
const downloaded = ref(0)
const contentLength = ref(null)
const errorMessage = ref('')
let cancelFlag = false

const progressPct = computed(() => {
  if (!contentLength.value || contentLength.value === 0) return 0
  return Math.min(Math.round((downloaded.value / contentLength.value) * 100), 100)
})

function formatBytes(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB'
  return n + ' B'
}

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll('button:not([disabled])')
  const visible = [...focusable].filter(el => el.offsetParent !== null)
  if (!visible.length) { e.preventDefault(); return }
  const idx = visible.indexOf(document.activeElement)
  if (e.shiftKey) {
    e.preventDefault()
    visible[idx <= 0 ? visible.length - 1 : idx - 1].focus()
  } else {
    e.preventDefault()
    visible[idx === -1 || idx >= visible.length - 1 ? 0 : idx + 1].focus()
  }
}

async function startDownload() {
  phase.value = 'downloading'
  downloaded.value = 0
  contentLength.value = null
  cancelFlag = false

  try {
    const channel = new Channel()
    channel.onmessage = (msg) => {
      if (cancelFlag) return
      if (msg.event === 'started') {
        contentLength.value = msg.data.contentLength
      } else if (msg.event === 'progress') {
        downloaded.value += msg.data.chunkLength
      } else if (msg.event === 'finished') {
        // download complete, handled by the await below
      }
    }

    await invoke('download_update', { onEvent: channel })

    if (cancelFlag) return

    // Download succeeded
    return true
  } catch (e) {
    if (cancelFlag) return false
    phase.value = 'error'
    errorMessage.value = STR.update.downloadFailed + '：' + (e?.message || String(e))
    return false
  }
}

async function onUpdateNow() {
  const ok = await startDownload()
  if (!ok) return

  // Install
  phase.value = 'installing'
  try {
    await invoke('install_update')
    // install_update calls app.restart() on success, so we won't reach here
    phase.value = 'done'
  } catch (e) {
    phase.value = 'error'
    errorMessage.value = STR.update.installFailed + '：' + (e?.message || String(e))
  }
}

async function onExitUpdate() {
  const ok = await startDownload()
  if (!ok) return

  // Mark as pending for crash recovery + Rust close handler
  if (props.updateInfo?.version) {
    localStorage.setItem('timelog:pendingDownload', props.updateInfo.version)
  }
  emit('willInstallOnExit', props.updateInfo?.version)
  emit('close')
}

function onSkip() {
  if (props.updateInfo?.version) {
    localStorage.setItem('timelog:skipVersion', props.updateInfo.version)
  }
  emit('close')
}

function onCancel() {
  cancelFlag = true
  phase.value = 'idle'
}

function onRetry() {
  phase.value = 'idle'
}
</script>

<style scoped>
.update-dialog { max-width: 420px; }
.update-date { color: var(--text2); font-size: 13px; margin: 4px 0 12px; }
.update-body { margin-bottom: 16px; }
.update-body-label { font-weight: 600; margin-bottom: 6px; }
.update-body-scroll {
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text1);
  background: var(--bg2);
  border-radius: 6px;
  padding: 10px 12px;
}
.update-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.update-actions button { font-size: 13px; }

.update-progress { margin-top: 12px; }
.progress-bar {
  width: 100%; height: 8px; background: var(--bg2); border-radius: 4px;
  overflow: hidden; margin-bottom: 8px;
}
.progress-fill {
  height: 100%; background: var(--accent); border-radius: 4px;
  transition: width 0.1s ease;
}
.progress-fill-indeterminate {
  height: 100%; width: 30%; background: var(--accent); border-radius: 4px;
  animation: progress-slide 1.2s ease-in-out infinite;
}
@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(430%); }
}
.progress-text { font-size: 13px; color: var(--text2); margin-bottom: 10px; }
.update-error p { color: var(--red, #e74c3c); margin: 10px 0; font-size: 13px; }
.update-done p { font-size: 14px; text-align: center; padding: 16px 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UpdateDialog.vue
git commit -m "feat: add UpdateDialog component with 4-option UI and download progress"
```

---

### Task 7: SettingsPanel — Add Auto-Update Toggle + Check Button

**Files:**
- Modify: `frontend/src/components/SettingsPanel.vue`

**Interfaces:**
- Consumes: `autoUpdate`, `setAutoUpdate` from settings store; `invoke` from `@tauri-apps/api`; `STR.update` from strings; `useToast` composable
- Produces: New settings UI section after "备份策略" block

- [ ] **Step 1: Add auto-update UI to SettingsPanel**

In `frontend/src/components/SettingsPanel.vue`:

Add import at top of `<script setup>`:
```js
import { invoke } from '@tauri-apps/api/core'
```

Add auto-update section in `<template>`, after the backup-strategy divider block (after line 89 `<div class="divider"></div>`):

```html
      <div class="divider"></div>

      <label class="switchrow">
        <input type="checkbox" id="setAutoUpdate"
          :checked="settings.autoUpdate"
          @change="settings.setAutoUpdate(($event.target).checked)">
        <span>自动更新</span>
      </label>
      <div class="small">启动时自动检查更新（默认关闭）</div>

      <div style="margin-top:8px;">
        <button type="button" id="checkUpdateBtn" @click="onCheckUpdate" :disabled="checkingUpdate">
          {{ checkingUpdate ? '检查中...' : '检查更新' }}
        </button>
      </div>
```

Add state and handler in `<script setup>`:

```js
const checkingUpdate = ref(false)
```

```js
async function onCheckUpdate() {
  checkingUpdate.value = true
  try {
    const metadata = await invoke('check_update')
    if (metadata) {
      emit('checkUpdateResult', metadata)
    } else {
      toast('已是最新版本')
    }
  } catch (e) {
    toast('检查更新失败，请检查网络')
  } finally {
    checkingUpdate.value = false
  }
}
```

Add `ref` to the Vue import:
```js
import { ref, watch } from 'vue'
```
(already present, no change needed)

Add toast import — the `useToast` is already imported via App.vue. For SettingsPanel to use toast directly, add:

```js
import { useToast } from '../composables/useToast.js'
const { toast } = useToast()
```

- [ ] **Step 2: Run tests**

```bash
cd D:/a_my/project/html/Timelog/frontend && npm test
```
Expected: all 32 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SettingsPanel.vue
git commit -m "feat: add auto-update toggle and manual check button to settings"
```

---

### Task 8: App.vue — Integrate Startup Check, Rollout Logic, Crash Recovery + UpdateDialog Wiring

**Files:**
- Modify: `frontend/src/App.vue`

**Interfaces:**
- Consumes: `checkUpdateResult` event from SettingsPanel, `willInstallOnExit` event from UpdateDialog, `useToast` composable, settings store, `invoke` from `@tauri-apps/api`
- Produces: startup auto-check with rollout gating, crash recovery prompt, UpdateDialog in modal stack, SettingsPanel→UpdateDialog handoff

- [ ] **Step 1: Add state, imports, and startup check to App.vue**

In `frontend/src/App.vue` `<script setup>`:

Add import:
```js
import { invoke } from '@tauri-apps/api/core'
```

Add UpdateDialog import (after other component imports):
```js
import UpdateDialog from './components/UpdateDialog.vue'
```

Add state (after `showHelp`):
```js
const showUpdate = ref(false)
const updateInfo = ref(null)
```

- [ ] **Step 2: Add rollout helper**

```js
// ── Rollout gate ──
const UPDATE_ENDPOINTS = [
  'https://gitee.com/Henry_Yves/timelog/raw/main/latest.json',
  'https://github.com/HenryYves/timelog/releases/latest/download/latest.json',
]

async function fetchRollout() {
  for (const url of UPDATE_ENDPOINTS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const json = await r.json()
        return typeof json.rollout === 'number' ? json.rollout : null
      }
    } catch {}
  }
  return null // both endpoints failed → default to full rollout
}

function isRolloutAllowed(version, rollout) {
  // null/undefined/>=100 → full push
  if (rollout == null || rollout >= 100) {
    localStorage.removeItem('timelog:rolloutCache')
    return true
  }

  let cache
  try { cache = JSON.parse(localStorage.getItem('timelog:rolloutCache')) } catch {}

  // Recompute if version or threshold changed
  if (!cache || cache.version !== version || cache.threshold !== rollout) {
    cache = {
      version,
      threshold: rollout,
      roll: Math.floor(Math.random() * 100), // 0~99
    }
    localStorage.setItem('timelog:rolloutCache', JSON.stringify(cache))
  }

  return cache.roll < rollout
}
```

- [ ] **Step 3: Add check function with rollout + crash recovery**

```js
async function checkForUpdate(isManual) {
  try {
    const metadata = await invoke('check_update')
    if (!metadata) {
      if (isManual) toast('已是最新版本')
      return
    }

    // Skip if user skipped this version
    const skipped = localStorage.getItem('timelog:skipVersion')
    if (skipped === metadata.version && !isManual) return

    // Pending download from previous session (crash recovery) → always show
    const pending = localStorage.getItem('timelog:pendingDownload')
    if (pending === metadata.version) {
      updateInfo.value = metadata
      showUpdate.value = true
      return
    }

    // Rollout gate (skip for manual check)
    if (!isManual) {
      const rollout = await fetchRollout()
      if (!isRolloutAllowed(metadata.version, rollout)) return
    }

    updateInfo.value = metadata
    showUpdate.value = true
  } catch {
    if (isManual) toast('检查更新失败，请检查网络')
    // silent fail on startup check
  }
}
```

In `onMounted`, after `applyBorderless()`, add:
```js
// Crash recovery: check for pending download
const pendingVer = localStorage.getItem('timelog:pendingDownload')
if (pendingVer) {
  // Check if the pending version is still the latest
  try {
    const metadata = await invoke('check_update')
    if (metadata && metadata.version === pendingVer) {
      updateInfo.value = metadata
      showUpdate.value = true
    } else {
      localStorage.removeItem('timelog:pendingDownload')
    }
  } catch {}
}

if (settings.autoUpdate) {
  checkForUpdate(false)
}
```

Add handler for SettingsPanel's check result (manual check, bypasses rollout):
```js
function onCheckUpdateResult(metadata) {
  updateInfo.value = metadata
  showUpdate.value = true
}
```

Add handler for UpdateDialog's exit-install flag (write pendingDownload for crash recovery):
```js
function onWillInstallOnExit(version) {
  localStorage.setItem('timelog:pendingDownload', version)
  toast('将在退出时安装更新')
}
```

- [ ] **Step 4: Wire UpdateDialog into template**

- [ ] **Step 4: Wire UpdateDialog into template**

In the `<template>`, add after the HelpPanel:

```html
    <UpdateDialog
      :show="showUpdate"
      :update-info="updateInfo"
      @close="showUpdate = false"
      @will-install-on-exit="onWillInstallOnExit"
    />
```

On the SettingsPanel, add event binding:
```html
    <SettingsPanel
      :show="showSettings"
      @close="showSettings = false"
      @check-update-result="onCheckUpdateResult"
    />
```

Update `onWillInstallOnExit` in UpdateDialog emit to pass version — see Task 6 update.

- [ ] **Step 5: Run tests**

```bash
cd D:/a_my/project/html/Timelog/frontend && npm test
```
Expected: all 32 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat: integrate auto-update with rollout gate and crash recovery"
```

---

### Task 9: .gitignore — Exclude Release Artifacts

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add updater artifacts to .gitignore**

```bash
echo "" >> .gitignore
echo "# Updater artifacts (generated per release, not committed)" >> .gitignore
echo "latest.json" >> .gitignore
echo "*.sig" >> .gitignore
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore updater artifacts (latest.json, *.sig)"
```

---

### Task 10: Version Bump 0.4.0 → 0.5.0

**Files:**
- Modify: `package.json` (root)
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `frontend/package.json`
- Modify: `frontend/src/App.vue` (version display)

- [ ] **Step 1: Bump versions**

In `package.json`: `"version": "0.5.0"`
In `src-tauri/Cargo.toml`: `version = "0.5.0"`
In `src-tauri/tauri.conf.json`: `"version": "0.5.0"`
In `frontend/package.json`: `"version": "0.5.0"`
In `frontend/src/App.vue`: `<span class="version">v0.5.0</span>`

- [ ] **Step 2: Commit**

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json frontend/package.json frontend/src/App.vue
git commit -m "chore: bump version to 0.5.0"
```

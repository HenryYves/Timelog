# 单实例检测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 `tauri-plugin-single-instance` 阻止多实例，第二个实例启动时聚焦已有窗口并弹 toast。

**Architecture:** Rust 侧注册插件创建互斥体，回调中 `set_focus()` + `app.emit('second-instance')`。JS 侧 `listen()` 收到事件后 toast。

**Tech Stack:** Tauri v2, tauri-plugin-single-instance 2.x, Vue 3

## Global Constraints

- 始终生效，无用户开关
- 第二个实例退出，第一个聚焦 + toast "软件已在运行"
- `npm test` 123 pass

---

### Task 1: Rust — 添加依赖 + 注册插件

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `tauri_plugin_single_instance::init(|app, _argv, _cwd| ...)` 回调，emit `'second-instance'` 事件

- [ ] **Step 1: 加 Cargo 依赖**

```toml
# src-tauri/Cargo.toml, 在 [dependencies] 段末加：
tauri-plugin-single-instance = "2"
```

> [dependencies] 段位于 `serde_json = "1"` 之后、`reqwest` 之前或末行均可。注：`tauri = { version = "2", features = [] }` 已存在，无需改。

- [ ] **Step 2: 注册插件至 tauri::Builder**

在 `src-tauri/src/lib.rs` 顶部加 `use tauri::Manager;`（如已存在则跳过），然后在 `.plugin(tauri_plugin_dialog::init())` 下一行添加：

```rust
// src-tauri/src/lib.rs — 在 run() 函数的 .plugin(tauri_plugin_dialog::init()) 后面加：
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Focus the existing main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            // Emit event so JS can show toast
            let _ = app.emit("second-instance", ());
        }))
```

> 完整上下文：应加在 `.plugin(tauri_plugin_dialog::init())` 之后、`.setup(move |app| {` 之前。

- [ ] **Step 3: 编译验证**

```bash
cd /d/a_my/project/html/Timelog && cargo build --manifest-path src-tauri/Cargo.toml 2>&1
```

Expected: 编译成功，无错误。

---

### Task 2: Capabilities — 加权限

**Files:**
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: Rust 侧 emit `'second-instance'`
- Produces: JS 侧可 `listen('second-instance')`

- [ ] **Step 1: 添加权限声明**

```jsonc
// src-tauri/capabilities/default.json — 在 "permissions" 数组末加两条：
    "single-instance:default",
    {
      "identifier": "core:event:allow-listen",
      "allow": [{ "event": "second-instance" }]
    }
```

> 建议加在 `"dialog:default"` 之后。插件权限 `single-instance:default` 允许插件运行。事件权限 `core:event:allow-listen` 允许 JS 监听自定义事件 `second-instance`。

- [ ] **Step 2: 验证 JSON 格式**

```bash
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1
```

Expected: build 成功。

---

### Task 3: JS — 监听事件 + Toast

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/strings.js`

**Interfaces:**
- Consumes: Rust emit `'second-instance'` 事件
- Produces: toast "软件已在运行"

- [ ] **Step 1: strings.js — 加文案**

```js
// frontend/src/strings.js — STR.toast 对象内加：
    alreadyRunning: '软件已在运行',
```

- [ ] **Step 2: App.vue — 添加 import 和事件监听**

在 `<script setup>` 顶部 import 区加：

```js
import { listen } from '@tauri-apps/api/event'
```

在 `onMounted` 回调中（或 `watch` 之后、`return` 之前）添加监听注册。找到 `onMounted(() => {` 块（约在文件中部），在其内部 `useToast` 解构已经就绪的位置加：

```js
// 在 onMounted 内，已有 useToast 解构和 setup 逻辑之后：
    // Single-instance detection
    listen('second-instance', () => {
      toast(STR.toast.alreadyRunning)
    }).catch(() => {})
```

> 注意：`toast` 来自 `useToast()` composable。确认 `const { toast } = useToast()` 已在 `<script setup>` 顶层解构，则 onMounted 内可直接使用。

- [ ] **Step 3: Build 验证**

```bash
cd /d/a_my/project/html/Timelog/frontend && npx vite build 2>&1
```

Expected: build 成功，无编译错误。

- [ ] **Step 4: Test 验证**

```bash
cd /d/a_my/project/html/Timelog/frontend && npm test 2>&1
```

Expected: 123 tests passed.

---

### Task 4: 端到端验证

- [ ] **Step 1: Tauri dev 启动**

```bash
cd /d/a_my/project/html/Timelog && npm run tauri dev 2>&1
```

Expected: 应用正常启动。

- [ ] **Step 2: 测试单实例**

再次运行 `npm run tauri dev`（或直接双击 exe），观察：
1. 第一个窗口聚焦（若最小化则恢复）
2. 第一个窗口弹 toast "软件已在运行"
3. 第二个进程退出

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json frontend/src/App.vue frontend/src/strings.js
git commit -m "feat: 单实例检测——第二个实例聚焦已有窗口+toast后退出"
```

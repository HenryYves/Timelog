# Timelog Auto-Update Design

**日期**: 2026-07-06
**版本**: 0.4.0 → 目标 0.5.0

---

## 1. 概述

为 Timelog Tauri 桌面应用添加自动更新能力：
- 默认关闭，可在设置中开启启动时自动检查
- 设置面板提供手动检查按钮
- 发现新版本时弹窗通知，提供 4 种处理方式
- Gitee raw 文件优先，超时/失败自动回退 GitHub Release
- 支持灰度发布（rollout 百分比）
- 下载后崩溃/未安装时，下次启动自动提醒

## 2. 架构

```
┌─ 前端 JS ────────────────────────────────────────────┐
│  @tauri-apps/plugin-updater (check/download/install)  │
│  @tauri-apps/plugin-process  (relaunch)               │
│                                                       │
│  store/settings.js     ← autoUpdate 开关              │
│  SettingsPanel.vue     ← 开关 + 手动检查按钮          │
│  UpdateDialog.vue      ← [新增] 更新通知 + 进度       │
│  App.vue               ← onMounted 自动检查 + 手动检查│
├─ Rust ────────────────────────────────────────────────┤
│  lib.rs:                                               │
│    · 注册 updater + process 插件                      │
│    · fetch_update command — 检查更新，缓存 Update 到  │
│      Rust state，返回 metadata 给 JS                  │
│    · install_update command — 安装已下载的更新        │
│    · on_window_event(CloseRequested) — 有 pending     │
│      时先安装再退出                                   │
└───────────────────────────────────────────────────────┘
```

UI 交互走 JS 侧调用 Rust command；退出时安装走 Rust 侧窗口关闭事件，保证生命周期可控。

## 3. 设置与状态

### 3.1 Settings Store 新增

| 字段 | 类型 | 默认值 | localStorage key | 说明 |
|------|------|--------|-------------------|------|
| `autoUpdate` | boolean | `false` | `timelog:autoUpdate` | 启动时自动检查更新 |

### 3.2 运行时状态（UpdateDialog 内部，非持久化）

| 字段 | 说明 |
|------|------|
| `updateInfo` | `{ version, body, date }` |
| `phase` | `'idle' \| 'downloading' \| 'installing' \| 'done' \| 'error'` |
| `progress` | `{ downloaded, total }` 字节数 |
| `error` | 错误信息字符串 |

### 3.3 localStorage 新增

| key | 值 | 说明 |
|-----|-----|------|
| `timelog:skipVersion` | `"0.5.0"` | 用户跳过的版本号 |
| `timelog:rolloutCache` | `{"version":"0.5.0","roll":42,"threshold":30}` | 灰度缓存，version 或 threshold 不变时复用 roll |
| `timelog:pendingDownload` | `"0.5.0"` | 下载成功但未安装的版本号，启动时检测并提醒 |

## 4. 更新流程

### 4.1 灰度判断算法

```
check_update 返回 metadata（含 rollout 字段，可选；不写 = 100%）

if metadata.rollout == null or metadata.rollout >= 100:
    → 全量推送，清空 rolloutCache，直接弹出 UpdateDialog

cache = read("timelog:rolloutCache")
if cache and cache.version == metadata.version and cache.threshold == metadata.rollout:
    roll = cache.roll   // 复用缓存，结果不变
else:
    roll = floor(random() * 100)   // 0~99
    write("timelog:rolloutCache", {version, roll, threshold})

if roll < metadata.rollout:
    → 弹出 UpdateDialog
else:
    → 静默结束（不提示）
```

### 4.2 启动检查（autoUpdate = true）

```
App.vue onMounted
  → check_update()
  → Gitee raw → 超时/非2XX → Tauri 自动回退 GitHub
  → 无更新 → 静默结束
  → 有更新 && version === skipVersion → 静默结束
  → 有更新 → 灰度判断 → 命中/不命中
  → 有更新 && pendingDownload === version → 直接弹出 UpdateDialog（跳过灰度）
```

### 4.3 崩溃恢复

```
App.vue onMounted
  → 检查 localStorage 是否有 pendingDownload
  → 如果有 → 弹出提示 "上次下载的 vX.X.X 尚未安装，是否现在安装？"
  → [现在安装] [忽略]
```

### 4.4 手动检查

```
点击「检查更新」按钮
  → 按钮变 loading 态
  → check_update()
  → 无更新 → toast "已是最新版本"
  → 有更新 → 跳过灰度判断，直接弹出 UpdateDialog
```

### 4.5 UpdateDialog 四个选项

| 选项 | 行为 |
|------|------|
| **现在更新** | 显示下载进度 → 下载完自动安装 → `relaunch()` 重启 |
| **下载后退出时更新** | 显示下载进度 → 下载完标记 `pendingUpdate` → toast "将在退出时安装" → 用户关闭窗口时通过 `onCloseRequested` 触发 `install()` + `relaunch()` |
| **跳过此版本** | 写入 `timelog:skipVersion`，下次不提示这个版本号 |
| **忽略** | 关闭弹窗，下次检查时仍会提醒 |

### 4.6 错误处理

| 情况 | 处理 |
|------|------|
| 两端点都超时/不可达 | toast "检查更新失败，请检查网络" |
| 下载中断 | UpdateDialog 内显示错误 + 重试按钮 |
| 下载成功但安装失败 | 弹窗提示安装包路径 + "复制路径"按钮 + "打开所在文件夹"按钮，用户手动安装 |
| 退出时安装失败 | 同上处理 |

## 5. UI

### 5.1 设置面板新增

在"备份策略"分组下方新增：

```
自动更新  [开关]
  启动时自动检查更新（默认关闭）

  [检查更新] 按钮
```

### 5.2 UpdateDialog（新增组件）

```
┌─────────────────────────────────────────────┐
│  发现新版本 v0.5.0                           │
│                                             │
│  发布日期：2026-07-06                        │
│  ┌─────────────────────────────────────────┐│
│  │ 更新内容（max-height:200px, overflow-y:  ││
│  │ auto）：                                ││
│  │ - 修复了 xxx                             ││
│  │ - 新增了 yyy                             ││
│  │ ...                         (带滚动条)   ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [现在更新]  [退出时更新]  [跳过此版本]  [忽略] │
└─────────────────────────────────────────────┘
```

下载中状态：四个按钮替换为进度条 + 百分比 + [取消]

安装中状态：进度条 + "正在安装..."

完成状态：显示 "更新完成，即将重启"

错误状态：错误信息 + [重试] + [打开下载文件夹]

## 6. 发布端配置

### 6.1 tauri.conf.json

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://gitee.com/Henry_Yves/timelog/raw/main/latest.json",
        "https://github.com/HenryYves/timelog/releases/latest/download/latest.json"
      ],
      "pubkey": "<签名公钥>"
    }
  }
}
```

### 6.2 Cargo.toml 新增依赖

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

### 6.3 lib.rs

```rust
use tauri_plugin_updater::UpdaterExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 6.4 JS 依赖

```bash
cd frontend && npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

## 7. 发布流程（手动）

1. `tauri signer generate` 生成密钥对，pubkey 写入 `tauri.conf.json`，私钥本地保管
2. `npm run tauri build` 构建安装包 + updater artifacts
3. 编写 `latest.json`（静态更新清单）：

```json
{
  "version": "v0.5.0",
  "notes": "- 新增自动更新功能\n- 修复 xxx",
  "pub_date": "2026-07-06T12:00:00Z",
  "rollout": 30,
  "platforms": {
    "windows-x86_64": {
      "signature": "<用私钥对安装包签名>",
      "url": "https://github.com/HenryYves/timelog/releases/download/v0.5.0/timelog_0.5.0_x64-setup.exe"
    }
  }
}
```

- `rollout` 为可选字段，0~100，不写 = 全量推送（100）
- Gitee 是 GitHub 镜像仓库，`latest.json` push 到 GitHub 后 Gitee 自动同步

4. 在 GitHub 创建 Release，上传安装包和 `.sig` 签名文件
5. 更新仓库中的 `latest.json`，commit + push → GitHub Release + Gitee raw 同时生效

## 8. 权限声明

`src-tauri/capabilities/default.json` 新增：

```json
"updater:default",
"process:default"
```

## 9. 涉及文件

| 文件 | 变更类型 |
|------|----------|
| `src-tauri/Cargo.toml` | 修改 — 新增 `tauri-plugin-updater` + `tauri-plugin-process` |
| `src-tauri/src/lib.rs` | 修改 — 注册插件 + `fetch_update`/`install_update` command + 关闭事件 |
| `src-tauri/tauri.conf.json` | 修改 — 添加 `bundle.createUpdaterArtifacts` + `plugins.updater` |
| `src-tauri/capabilities/default.json` | 修改 — 新增 `updater:default` + `process:default` 权限 |
| `frontend/package.json` | 修改 — 新增 `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` |
| `frontend/src/store/settings.js` | 修改 — 新增 `autoUpdate` 字段 |
| `frontend/src/App.vue` | 修改 — `onMounted` 启动检查逻辑 + 调用 Rust command |
| `frontend/src/components/SettingsPanel.vue` | 修改 — 新增开关 + 手动检查按钮 |
| `frontend/src/components/UpdateDialog.vue` | **新增** — 更新通知弹窗 |
| `frontend/src/strings.js` | 修改 — 新增文案 |

## 10. gitignore

`latest.json` 和签名产物不提交进仓库（CI 生成或手动发布）：

```
# Updater artifacts
latest.json
*.sig
```

## 11. 已知限制

- **强制结束进程**：用户通过任务管理器等强制杀进程时，不会触发退出时安装（但有崩溃恢复兜底）
- **不跨大版本**：Tauri updater 只处理同渠道更新（stable → stable），不处理跨大版本迁移
- **Gitee raw 延迟**：push 后 raw 文件可能有几分钟缓存延迟

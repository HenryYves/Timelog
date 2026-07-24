# 单实例检测

## 行为

第二个实例启动时：
1. 第一个实例窗口聚焦（最小化则恢复）
2. 第一个实例弹 toast "软件已在运行"
3. 第二个实例自动退出

始终生效，无开关。

## 原理

`tauri-plugin-single-instance` 官方插件：
- Rust 启动时创建全局互斥体（Windows 命名 mutex）
- 第二个实例检测到互斥体已存在 → 插件调用第一个实例的回调 → 第二个实例退出
- 回调中：`window.set_focus()` + `app.emit('second-instance')`
- JS 侧 `listen('second-instance')` → toast

## 改动

| 文件 | 改动 |
|------|------|
| `src-tauri/Cargo.toml` | `tauri-plugin-single-instance = "2"` |
| `src-tauri/src/lib.rs` | 注册插件，回调中 focus + emit |
| `src-tauri/capabilities/default.json` | 加 `"single-instance:default"` + `"core:event:default"` + emit 权限 |
| `frontend/src/App.vue` | `listen('second-instance')` → toast + focus window |
| `frontend/src/strings.js` | `STR.toast.alreadyRunning` |

## 验证

1. `npm run tauri dev` 启动 → 再次启动第二个 → 第一个聚焦 + toast，第二个退出
2. `npm test` 123 pass

# Timelog — 时间块记录

Tauri v2 桌面应用，Vue 3 + Vite + Pinia 前端，Rust 后端。

## 运行

| 命令 | 用途 |
|------|------|
| `cd frontend && npm run dev` | 浏览器调试前端 (localhost:1420) |
| `cd frontend && npm test` | 跑测试（2 个已知失败：fmt(0) 和 colorOf） |
| `npm run tauri dev` | Tauri 桌面开发（自动启动 Vite 热更新） |
| `npm run tauri build` | 打包发布（自动先构建前端） |

## 发布

1. 版本号同步：`frontend/src/constants.js`（APP_VERSION）、`src-tauri/tauri.conf.json`（version）、`src-tauri/Cargo.toml`（version）
2. 设置签名：`$env:TAURI_SIGNING_PRIVATE_KEY` + `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. `npm run tauri build`
4. 读 `src-tauri/target/release/bundle/nsis/timelog_x.x.x_x64-setup.exe.sig`，更新 `latest.json` 签名
5. Gitee + GitHub Release 各传 `.exe`
6. `git add -f latest.json && git commit -m "release: vX.X.X" && git push`

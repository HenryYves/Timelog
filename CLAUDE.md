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

1. 版本号同步 5 个文件：`frontend/src/constants.js`、`frontend/package.json`、`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`
2. 设置签名：`$env:TAURI_SIGNING_PRIVATE_KEY` + `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. `npm run tauri build`
4. 读 `src-tauri/target/release/bundle/msi/timelog_x.x.x_x64_en-US.msi.sig`，更新 `latest.json` 签名，url 用 `.msi`
5. Gitee + GitHub Release 各传 `.msi`
6. `git add -f latest.json && git commit -m "发布 vX.X.X" && git push`

## 行为约束

- **改前必问** — 任何 Write / Edit / Bash 改文件 / git checkout / git revert 都必须先说方案、等用户明确同意（"行"/"OK"/"可以"）
- 永远用中文 commit message
- 遇到 bug → 先拿用户输入 trace 代码 → 诊断 → 讨论方案 → 再改

# Timelog — 时间块记录

Tauri v2 桌面应用，Vue 3 + Vite + Pinia 前端，Rust 后端。

## 环境

- Node.js >= 18
- Rust (stable)
- Windows: Visual Studio Build Tools（C++ 工作负载）

## 运行

| 命令 | 用途 |
|------|------|
| `cd frontend && npm install` | 安装前端依赖 |
| `cd frontend && npm run dev` | 浏览器调试前端 (localhost:1420) |
| `cd frontend && npm test` | 跑测试（32 tests，2 known failures） |
| `npm run tauri dev` | Tauri 桌面开发（自动启动 Vite 热更新） |
| `npm run tauri build` | 打包发布（`beforeBuildCommand` 自动先构建前端） |

## 架构

```
frontend/src/
├── main.js              ← createApp + Pinia
├── App.vue              ← 壳（header + 模态栈 + 错误边界）
├── style.css            ← 全局 CSS 变量、overlay、ghost
├── constants.js         ← 常量 + APP_VERSION + compareSemver
├── strings.js           ← 界面文案集中管理（STR）
├── components/
│   ├── Timeline.vue       ← 时间轴渲染 + 拖拽
│   ├── EditModal.vue      ← 创建/编辑 + 标签选择
│   ├── TagManager.vue     ← 标签管理
│   ├── SettingsPanel.vue  ← 设置
│   ├── ExportPanel.vue    ← 导出/文本导入/JSON 导入
│   ├── DataManager.vue    ← 数据管理
│   ├── HelpPanel.vue      ← 帮助（? 键）
│   ├── Toast.vue
│   └── ConfirmDialog.vue  ← confirm() Promise API
├── store/
│   ├── timelog.js         ← 时间块 CRUD + colorOf + fmt
│   ├── tags.js            ← 标签分组/颜色
│   └── settings.js        ← 所有设置项
├── utils/
│   ├── markdown.js        ← mdToHtml
│   ├── backup.js          ← 自动备份 + 天级轮转（最多 4 份）
│   ├── tauri.js           ← Tauri API 封装
│   └── log.js
└── composables/
    ├── useToast.js
    └── useConfirm.js      ← confirm() Promise API

src-tauri/src/
├── lib.rs                 ← commands: fetch_latest_json, check_update, download_update
└── main.rs
```

旧版单文件 `src/index.html` 保留参考，不再使用。

## 关键文件

- `frontend/src/store/timelog.js` — 数据核心，所有时间块 CRUD 逻辑
- `frontend/src/store/settings.js` — 设置项（含 blockOpacity、autoUpdate 等）
- `frontend/src/components/Timeline.vue` — 最复杂的组件，拖拽 + 键盘 + 右键
- `frontend/src/composables/useConfirm.js` — `confirm(msg)` 返回 Promise，组件通过 `provide` 获取
- `src-tauri/src/lib.rs` — 所有 Tauri command 定义
- `latest.json` — 更新清单（签名 + URL），需 `git add -f`

## 发布

- 变更记录遵循 [Keep a Changelog](https://keepachangelog.com/) 格式，写入 `CHANGELOG.md`
- bump version 时同步更新 CHANGELOG.md，与版本号 5 个文件一起提交
- Release Note 从 CHANGELOG 总结，按 Keep a Changelog 分类（Added / Changed / Fixed）

1. 版本号同步 5 个文件：`frontend/src/constants.js`、`frontend/package.json`、`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`
2. 设置签名：`$env:TAURI_SIGNING_PRIVATE_KEY` + `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. `npm run tauri build`
4. 读 `src-tauri/target/release/bundle/msi/timelog_x.x.x_x64_en-US.msi.sig`，更新 `latest.json` 签名，url 用 `.msi`
5. Gitee + GitHub Release 各传 `.msi`
6. `git add -f latest.json && git commit -m "发布 vX.X.X" && git push`

## Gotchas

- **模态栈** — `useModal` helper：`openModal(name)` 推动态关闭拉。ESC 按 LIFO 栈逐一关闭，各弹窗 overlay 用 `@keydown.escape.stop`。`focusTopModal()` 入栈/出栈时自动聚焦最上层
- **MSI 而非 NSIS** — NSIS exe 遇到 `.rbf` 残留文件会报错，MSI 能正确处理
- **colorOf 响应式** — `colorOf()` 在 store 定义，须用 `storeToRefs` 保持 `blockOpacity` 响应式，否则设置变更后颜色不刷新
- **下载 CORS** — `fetch_latest_json` 走 Rust 端，因 GitHub raw 有 SAS token 重定向，浏览器 CORS 拦截
- **打包自动构建** — `tauri.conf.json` 里配了 `beforeBuildCommand`，确保不打包旧前端
- **默认窗口隐藏** — `tauri.conf.json` 中 `visible: false`，状态恢复后再显示，消除启动闪烁

## 行为约束

- **改前必问** — 任何 Write / Edit / Bash 改文件 / git checkout / git revert 都必须先说方案、等用户明确同意（"行"/"OK"/"可以"）
- Commit message：英文前缀 + 中文描述（Conventional Commits）— `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `release:`
- 写 message 前先 `git diff --stat` 看全部改动，概括整体而非只描述最后一条
- 提交前必须先把 message 给用户过目，同意后再提交
- 遇到 bug → 先拿用户输入 trace 代码 → 诊断 → 讨论方案 → 再改

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
  main.js              — createApp + Pinia
  App.vue              — 壳（header + 模态栈 + 错误边界）
  style.css            — 全局 CSS 变量、overlay、ghost
  constants.js         — 常量 + APP_VERSION + compareSemver
  strings.js           — 界面文案集中管理（STR）
  components/
    Timeline.vue       — 时间轴渲染 + 拖拽
    EditModal.vue      — 创建/编辑 + 标签选择
    TagManager.vue     — 标签管理
    SettingsPanel.vue  — 设置
    ExportPanel.vue    — 导出/文本导入/JSON 导入
    DataManager.vue    — 数据管理
    HelpPanel.vue      — 帮助（? 键）
    Toast.vue
    ConfirmDialog.vue  — confirm() Promise API
  store/
    timelog.js         — 时间块 CRUD + colorOf + fmt
    tags.js            — 标签分组/颜色
    settings.js        — 所有设置项
  assets/
    no-edit.svg        — 编辑器伪元素占位水印
  utils/
    scanner.js         — Markdown 扫描器(~330行): unwrap/scan/列表/重编号
    cursor.js          — 光标保存/恢复/放置 + WebView2 防御(~370行)
    undo.js            — UndoManager 撤销栈
    editor.js          — 标签提示 + 频率
    markdown.js        — mdToHtml
    backup.js          — 自动备份 + 天级轮转（最多 4 份）
    tauri.js           — Tauri API 封装
    log.js             — 日志
  composables/
    useToast.js
    useConfirm.js      — confirm() Promise API

src-tauri/src/
  lib.rs               — commands: fetch_latest_json, check_update, download_update
  main.rs
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
- **WebView2 only** — 最终只跑在 Tauri WebView2，不考虑跨浏览器兼容。不需要考虑 Firefox/Safari/Chrome 差异，CSS/JS 只需对 WebView2 有效。不要因为跨浏览器顾虑增加额外方案或 fallback。
- **WebView2 contenteditable 怪异行为** — 详见 `docs/webview2-contenteditable-quirks.md`，含 14 条踩坑记录（含 html2canvas）。后续发现新的浏览器/渲染行为问题必须更新该文档。
- **勿假设浏览器行为** — contenteditable 行为各浏览器实现不同。遇问题先加诊断日志验证实际行为，不要凭经验或标准文档猜测。`[cursor]` 日志格式见 `saveCursor` 内 `_walk`。
- **改 bug 前先读文件当前内容** — 不靠记忆、不靠"上次看到的样子"。sed / 批量替换 / 合并冲突可能静默改坏 CSS 属性值（如 `display:flex`→`text-align:center`），基于幻觉修 bug 越修越歪。
- **先隔离故障层再动手** — 遇 bug 先问"到底是哪一层/哪个元素出问题"（如"导出糊"→全图糊还是只水印糊？→"保存清晰复制模糊"→差在 doCopy vs doExport），而不是直接调参数碰运气。
- **一次改一个变量，构建或验证通过后再改下一个** — 一次改多处的 patch 出问题无法归因，而且容易引入新 bug 盖住旧 bug。
- **构建/前端命令必须在 frontend 目录下执行** — 工作目录是 repo 根 `D:\a_my\project\html\Timelog`，git 操作后 cwd 停留在根。`npx vite build`、`npm test`、`npm install` 等所有前端命令都必须 `cd /d/a_my/project/html/Timelog/frontend &&` 前缀，否则 `npx` 找不到本地 `node_modules` 里的 vite，会去全局 cache 拉另一个版本在错误目录下跑（静默失败或报 `UNRESOLVED_ENTRY`）。
- **Vue scoped CSS 不对 JS 创建的元素生效** — `document.createElement` / `v-html` 产生的元素不带 `data-v-xxx` 属性，scoped 样式不会命中。即使写 `.parent .child` 后代选择器理论上能穿透，实际也遇到过不生效。这类样式一律放全局 `style.css`。

## 行为约束

- **改前必问** — 任何 Write / Edit / Bash 改文件 / git checkout / git revert 都必须先说方案、等用户明确同意（"行"/"OK"/"可以"）
- **🚫 严禁未经同意修改代码 🚫** — 讨论期间、诊断期间、用户思考期间，绝对不允许改代码。只有在用户明确授权后才能动手。这条规则优先级最高，违反就是对用户的不尊重。被提醒过一次还要再犯是不可接受的。
- **回退前先查状态** — `git checkout` / `git reset` / `git revert` 之前必须先 `git diff --stat` 看未提交改动范围，确认只会损失预期的代码。避免一整个文件被覆盖。
- Commit message：英文前缀 + 中文描述（Conventional Commits）— `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `release:`
- 写 message 前先 `git diff --stat` 看全部改动，概括整体而非只描述最后一条
- 提交前必须先把 message 给用户过目，同意后再提交
- **遇到 bug → 先拿用户输入 trace 代码 → 诊断 → 讨论方案 → 再改**
- **涉及 Rust/Tauri 改动的 bug 修复**：必须先 `npm run tauri dev` 实际跑通验证，确认修复生效后再 commit。不要在只 build 通过但未运行时验证的情况下就提交。"先 commit 保存战果"在涉及原生层改动时是错误的——commit 应该是验证通过后的最后一步。
- **规则持久化** — 犯了错不要只说"下次不会了"。换 session 或 compact 之后这些对话记忆全丢，唯一持久的记忆是 CLAUDE.md。如果一条规则值得下次记住，把它写进 CLAUDE.md（行为约束、Gotchas、或架构说明）。给用户的建议也必须是实质性的——改哪个文件、加什么内容——而不是空洞的保证。

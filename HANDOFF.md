# Timelog 交接文档

**日期**: 2026-11-12
**版本**: 0.13.0（已发布 GitHub + Gitee）

---

## 项目路径

```
D:\a_my\project\html\Timelog\
```

## 运行命令

| 命令 | 用途 |
|------|------|
| `cd frontend && npm install` | 安装前端依赖 |
| `cd frontend && npm run dev` | 浏览器调试（端口 1420） |
| `cd frontend && npm test` | 跑测试（246 tests） |
| `npm run tauri dev` | Tauri 桌面开发 |
| `npm run tauri build` | 打包 MSI + NSIS（需签名环境变量） |

前端命令必须在 `frontend` 目录执行，否则 `npx` 找不到本地 vite。

## 当前状态

Tauri v2 + Vue 3 + Vite + Pinia。0.13.0 已发布：
- GitHub：`HenryYves/Timelog`，Release 附 MSI + NSIS exe
- Gitee：`henry_yves/timelog`，代码与 tag 已同步，Release 由作者手动维护

自动更新只认 `latest.json` 中的 MSI 签名；NSIS exe 仅供手动安装。

## 前端结构

```
frontend/src/
├── main.js / App.vue / style.css / constants.js / strings.js
├── components/
│   ├── Timeline.vue          ← 时间轴渲染 + 拖拽 + 剪切/胶水
│   ├── EditModal.vue         ← 创建/编辑弹窗
│   ├── MarkdownEditor.vue    ← contenteditable 编辑器（备注、批量创建共用）
│   ├── BatchCreatePanel.vue
│   ├── ExportImagePanel.vue  ← 导出图（时间轴 / 统计两种模式）
│   ├── ExportPanel.vue       ← 文本/JSON 导入导出
│   ├── StatsPanel.vue        ← 统计视图
│   ├── DataManager.vue / TagManager.vue / SettingsPanel.vue（settings/ 子组件）
│   ├── ThanksPanel.vue       ← 特别鸣谢 + 出票动画 + 赞赏卡片
│   ├── HelpPanel.vue / UpdateDialog.vue / Toast.vue / ConfirmDialog.vue
│   ├── CutConfirm.vue / GlueConfirm.vue
│   └── PieChart.vue / BarChart.vue
├── store/  timelog.js（数据核心）/ tags.js / settings.js
├── utils/  scanner.js / cursor.js / undo.js / editMarkdownKeyboard.js
│           stats.js / dayStorage.js / blockLayout.js / timelineLabels.js
│           capture.js / watermark.js / backup.js / tauri.js / log.js / skin.js
├── composables/  useCoordConverter.js / usePanZoom.js / useToast.js / useConfirm.js / useSkinInfo.js
├── i18n/  index.js + locales/zh.json、en.json
├── directives/  ellipsis.js（v-ellipsis）
└── __tests__/  components / composables / i18n / store / utils（246 tests）
```

旧单文件 `src/index.html` 仅作参考。

## 关键设计

- **统一帧坐标**：昨天 `[0,1440)`、今天 `[1440,2880)`、明天 `[2880,4320)`。存储坐标 = 显示坐标（诚实存储）。`useCoordConverter` 计算 `pageRange`、gutter 高度与像素映射。
- **剪切/胶水**：`cutDay` / `glueBack` 维护 `_cutMeta`（fromPrev/fromNext/toPrev/toNext）。同一页不会同时存在 fromPrev+toPrev 或 fromNext+toNext（`checkCutBidir`），页面保持连续。
- **标记线**：整点由 `buildTodayLabels`/glue labels 生成；半小时线由 `buildHalfLines(lo, hi)` 按 30 分网格独立生成，不依赖相邻 hourline。
- **备注编辑器**：每次 `input` 先扫描并重建行内 DOM（`unwrapFormatting` + `scanContentEditable`）。IME 组合期间必须跳过（见 `docs/webview2-quirks.md` 第 17 条），否则水杉等输入法无法输入中文。
- **导出图**：`ExportImagePanel` 复用 `useCoordConverter`；统计模式固定「当前日」，不跟随分析面板时间范围。
- **模态栈**：`useModal` 推送/拉出，ESC 按栈关闭，`focusTopModal` 聚焦。

## 发布流程

1. 同步版本号 6 处：`frontend/src/constants.js`、`frontend/package.json`、`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`（timelog 条目）
2. 更新 `CHANGELOG.md`（Keep a Changelog 分类）
3. 提交并打附注 tag：`git tag -a vX.Y.Z -m "release: vX.Y.Z"`
   - 若该版本尚未对外发布，可 amend 后重打 tag；已发布则不要移动 tag
4. `npm run tauri build`（需 `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）
5. 读 `src-tauri/target/release/bundle/msi/timelog_X.Y.Z_x64_en-US.msi.sig`，更新 `latest.json` 的 `version`、`notes`、`pub_date`、`signature`、`url`
6. `git add -f latest.json && git commit -m "release: 更新 latest.json 至 vX.Y.Z"`，重打 tag 到该提交
7. 推送：`git push origin main && git push origin v0.13.0`；Gitee 同理（remote `gitee`）
8. GitHub Release 上传 MSI + NSIS exe；Gitee Release 手动上传同一对文件
   - `gh release create vX.Y.Z <msi> <exe> --title vX.Y.Z --notes-file ...`
   - 直连 GitHub 需代理：`git -c http.proxy=http://127.0.0.1:7897 push`、`HTTPS_PROXY=http://127.0.0.1:7897 gh ...`

两个更新 endpoint：
- `https://raw.githubusercontent.com/HenryYves/Timelog/main/latest.json`
- `https://gitee.com/henry_yves/timelog/raw/main/latest.json`

两边都要有更新后的文件与对应 Release 资产，否则部分用户拿不到更新。

## 文档

- `docs/webview2-quirks.md` — WebView2 / contenteditable / html2canvas 踩坑记录（17 条）
- `THIRD_PARTY_NOTICES.md` — 三方组件、许可证与素材声明
- `CLAUDE.md` — 工作约定与行为约束

## 已知待办

- 鼠标侧键翻页只在浏览器预览验证过，未在 Tauri WebView2 实测；若侧键被 WebView2 当浏览历史吞掉，需评估 Rust 侧处理
- 导出图 24:00 遮挡与首尾 halfline 修复已用浏览器预览确认，Tauri 内未手测
- 水杉输入法分析报告不在仓库（按作者要求），副本在 `D:\a_my\temp\TEMP\ime-composition-report.md`
- 工作区根目录的 `记忆归档_timelog-development-lessons.md` 未纳入版本控制

# SettingsPanel 拆分设计

- 日期：2026-08-13
- 状态：已批准
- 范围：B —— 搬运 + 有限清理（不引入新组件、不改行为）

## 目标

把单文件 `frontend/src/components/SettingsPanel.vue`（约 1087 行）拆分为「shell + 5 个 tab 组件」，降低单文件复杂度，把皮肤/片段、备份路径等各自成域的状态与 handler 内聚到对应 tab。行为零变化。

## 范围

**做：**

1. 拆分为 shell（`SettingsPanel.vue`）+ 5 个 tab 子组件
2. 共享 scoped CSS 迁到全局 `style.css`，并归并重复的 `.toggle`
3. 4 处硬编码字符串改为 STR
4. 局部状态与 handler 内聚到各自 tab

**不做（留待后续 commit）：**

- 抽取 `SettingRow` 复用组件（`.setting-item`/`.row`/`.small` 的 ~38 次重复暂不消灭）
- 抽取 `Toggle`/`RestoreBtn` 原子组件
- 任何行为/视觉改动（除 `.toggle` 旋钮 `#fff`→`var(--canvas)` 这一处夜间主题修复，见下）

## 文件结构

```
frontend/src/components/
  SettingsPanel.vue      ← 瘦身为 shell
  settings/
    BasicTab.vue         ← 版本信息 + 基础 + 启动
    EditorTab.vue        ← 编辑器 + 批量创建
    AppearanceTab.vue    ← 字体/字号/缩放/无边框 + 皮肤 + 片段 + 时间块显示
    FilesTab.vue         ← 导出 + 备份
    DevTab.vue           ← 重装皮肤 + DevTools
```

### Shell（SettingsPanel.vue）保留

- overlay / modal / 标题 / 左导航 / `activeTab` 切换 / `trapFocus` / 底部关闭按钮
- `emit('close')`
- 转发 `check-update-result` 事件（BasicTab 上抛 → SettingsPanel 转发 → App.vue）

5 个 tab 用 `v-show="activeTab === 'xxx'"` 挂载（与现在一致）。

### 挂载语义（关键）

App.vue 中 `<SettingsPanel v-if="showSettings">` 是 `v-if`，因此**每次打开面板，5 个 tab 子组件都会重新 mount**。据此：

- 上一笔「打开面板自动刷新片段列表」的修复，从父级 `watch(props.show)` 迁移为 **AppearanceTab 的 `onMounted` 调用 `refreshSnippets()`**，行为一致。
- `bkPathDraft` 在 FilesTab 的 `setup` 中从 `settings.bkCustomPath` 初始化（每次 open 重新 mount 自动同步）。

## CSS 迁移到全局 style.css

以下 settings 专用类（原 SettingsPanel `<style scoped>` 中、会被 5 个 tab 共用的）迁到 `frontend/src/style.css`：

- `.settings-layout` / `.settings-nav` / `.snav-item` / `.settings-content`
- `.setting-item` / `.row`
- `.section-head` / `.section-title` / `.sub-head`
- `.btn-restore` / `.restico` / `.restore-spacer`
- `.small-btn` / `.val-hint` / `.snippet-scroll`
- `select`、`input[type="range"]`（**必须带 `.settings-modal` 前缀**，见下）
- `.settings-content .small` / `.settings-content label` / `.settings-content input[type="range"]`

**归并 `.toggle`**：删除 SettingsPanel 里重复的 scoped `.toggle` 块，保留全局 `style.css` 的 `.toggle`。副作用：旋钮背景从写死 `#fff` 变为 `var(--canvas)`——日间二者同为 `#FFFFFF` 无差异，夜间修复「旋钮恒白」的潜在 bug。

**归并 `.mico` / `.small`**：二者已全局，SettingsPanel 里的相关覆盖（`.settings-content .small` 边距、`.btn-restore img/.restico` 尺寸等）迁到全局并合并，避免重复定义。

无命名冲突已核实：`.row` 全项目仅 SettingsPanel 使用（BarChart 用的是 `.bar-row`）；`.toggle` 全项目仅 SettingsPanel 使用。

**裸元素选择器必须加前缀**：`select` / `input[type="range"]` 是裸元素选择器，若直接迁到全局会泄漏到其它组件——`ExportImagePanel.vue`（2 个 `<select>` + 2 个 `input[type="range"]`，其 range 无自定义样式、当前用浏览器默认）和 `StatsPanel.vue`（1 个 `<select>`）。迁全局时必须改写为 `.settings-modal select` / `.settings-modal input[type="range"]`（及其 `:focus`/`:disabled`/`::-webkit-slider-thumb`/`::-moz-range-thumb` 变体），确保只作用于 SettingsPanel。

## 状态与逻辑分布

### 逐 tab 明细（按当前 handler 名）

| 现状 handler / 状态 | 去向 |
| --- | --- |
| `activeTab` / `tabs` / `trapFocus` / `onClose` | Shell |
| `watch(props.show)`（bkPathDraft 同步 + 刷新片段） | 拆到 FilesTab / AppearanceTab（见下） |
| `onCheckUpdate` / `checkingUpdate` | BasicTab（`emit('check-update-result')`） |
| `onDurationChange` / `onMinBlockMinutesChange` | EditorTab |
| `onEditorFontSizeChange` / `onOpacityInput` / `onBorderlessChange` / `applyBorderless` / `showZoomPopup` | AppearanceTab |
| `onKeepDaysChange` / `bkPathDraft` / `onBkPathBlur` / `onBkPathReset` | FilesTab |
| 皮肤/片段整套（`userSkinFiles` / `snippetFiles` / `skinOptions` / `resolveSkinPath` / `resolveSnippetPath` / `onSkinDropdownOpen` / `refreshSkins` / `doReloadSkinStyle` / `onSkinSelect` / `refreshSnippets` / `snippetEnabled` / `onSnippetToggle` / `doInjectSnippet` / `doRemoveSnippet` / `doSyncSnippets` / `openSkinFolder` / `openSnippetFolder`） | AppearanceTab |
| `openDevTools` / `reinstallSkin` | DevTab |
| `resetCategory` | 拆散为各 tab 局部 reset（见下） |

### reset 拆散

`resetCategory` 不再集中在一个 switch，每个 tab 自己实现 reset（各自按钮 `@click`）：

- BasicTab：`resetBasic`（autoUpdate）、`resetStartup`（autoScroll）
- EditorTab：`resetEditor`（defaultDuration、markdownPreview、tabToIndent）、`resetBatchCreate`（batchMarkdownPreview、batchTabToIndent、checkBeforeCreate、copyAfterCreate、tagDelimiters）
- AppearanceTab：`resetAppearance`（fontFamily、editorFontSize、zoom、blockOpacity、borderless、activeSkin、enabledSnippets）
- FilesTab：`resetExport`（exportTimestamp、exportDialog）、`resetBackup`（bkCustomPath、backupOn、keepDays + 清 `bkPathDraft`）

注意：现 `resetCategory('backup')` 会 `setBkCustomPath('')` **并**清 `bkPathDraft`，拆散后 `resetBackup` 需同时清本地 `bkPathDraft`。

### 依赖

`useSettingsStore()`（Pinia 全局）、`useConfirm` / `useToast`（provide/inject）在子组件中可直接使用，无需 props/emits 传数据。`migrateBackups`（`utils/backup.js`）、`installSkinTemplates` 等按需在对应 tab import。

## 事件流

- BasicTab `emit('check-update-result', metadata)` → SettingsPanel `emit('check-update-result')` → App.vue `onCheckUpdateResult`
- 其余 tab 无向上事件（直接写 store / 弹 toast / confirm）

## STR 清理

4 处硬编码 → 新增 STR key（登记到 `frontend/src/strings.js`）：

| 现状 | 新 key（建议） |
| --- | --- |
| `<option>中文</option>` | `STR.settings.languageOption` |
| `调整 ({{ settings.zoom }}%)` / `调整` | `STR.settings.adjustZoom` |
| `<label>当前皮肤</label>` | `STR.settings.currentSkin` |
| `暂无 CSS 片段文件` | `STR.settings.noSnippets` |

## 验证

- `cd frontend && npm test` 通过（纯搬移，无逻辑改动；仍 32 tests / 2 known failures）
- `npm run tauri dev` 手动过：5 个 tab 渲染一致；toggle/按钮/输入框/下拉全正常；皮肤切换 + 片段列表（含「打开自动刷新片段列表」「皮肤插到片段之前」两处刚修逻辑不回退）；夜间皮肤旋钮变 `var(--canvas)`

## 风险与注意

- 这是 1000 行级纯搬移，无行为变化，最易在机械移动中悄悄改坏属性值（对照 CLAUDE.md「改 bug 前先读文件当前内容」「一次改一个变量」）。逐 tab 拆、每拆一个 `npm run build` 或 `npm test` 验证一次，不要一次全拆完再验证。
- 子组件用 `v-show` 挂载 + 父级 `v-if` 的挂载语义是本设计的关键假设，实现时需确认 `onMounted` 时机符合预期。
- CSS 迁全局后，确认 `.settings-*` / `.row` 等类名未与其它组件冲突（已核实 `.row`/`.toggle` 无冲突）。

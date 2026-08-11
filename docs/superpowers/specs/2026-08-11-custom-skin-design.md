# 自定义皮肤与 CSS 片段 — 设计文档

日期：2026-08-11
状态：待实现

## 概述

允许用户自定义皮肤（主题配色）和 CSS 片段（局部样式覆盖），通过文件系统管理 `.css` 文件，app 运行时注入 `<link>` 标签实时加载。

## 功能分层

| 层级 | 机制 | 管理方式 |
|------|------|----------|
| 皮肤 | `<link id="skin-link">` 注入，单选 | `skins/` 目录 + 内置日间默认 |
| CSS 片段 | `<link data-snippet="name">` 注入，多选开关 | `snippets/` 目录 |

皮肤和片段独立运作，互不依赖。

## 文件结构

默认路径：`%APPDATA%/com.timelog.app/`

```
skins/                    ← 皮肤目录（自定义路径）
├── night.css             ← 首次启动自动安装
└── *.css                 ← 用户自行创建

snippets/                 ← 片段目录（自定义路径）
└── *.css                 ← 用户自行创建
```

- 路径在 Settings 中可自定义（`skinPath` / `snippetPath`）
- 首次启动或路径不存在时自动创建目录 + 写入内置 `night.css`
- 文件名去除 `.css` 后缀 = 显示名称

## 皮肤系统

### 内置皮肤

| ID | 显示 | 行为 |
|----|------|------|
| `""`（空字符串）| ☀️ 日间（默认）| 不注入皮肤 link，使用 `style.css` 原生 `:root` 变量 |
| `"night"` | 🌙 夜间 | 注入 `night.css`，覆盖 `:root` 变量 |

### 用户皮肤

用户在 `skins/` 目录中放置任意 `.css` 文件，下拉栏展开时自动扫描。用户文件 `day.css` 对应的 ID 为 `"day"`，与内置日间 ID `""` 不冲突（但下拉名会显示两个日间相关项）。

### 下拉刷新

**下拉栏展开时**触发 `scan_skin_files()`，实时反映文件增删。无需手动刷新按钮——但保留刷新按钮用于"选中皮肤文件内容被外部修改后重载 link"的场景。

### 选中皮肤被删除的容错

- 启动时：如果 `activeSkin` 对应的文件不存在 → 静默回退日间 `""`
- 运行时删除：下拉栏展开时扫描发现已缺失 → 自动回退日间，更新下拉列表
- 不弹 toast、不报错

### 刷新按钮与缓存破除

浏览器会缓存 `<link>` 加载的 CSS。用户外部编辑皮肤/片段文件后，点"刷新"需要强制重载。方法：href 末尾追加 `?v={timestamp}` 查询参数：

```js
link.href = `${filePath}?v=${Date.now()}`
```

仅在刷新按钮触发时附加时间戳。正常皮肤切换时不加（避免不必要重载）。

### 夜间皮肤 CSS 内置内容

```css
/* night.css — 首次启动自动安装 */
:root {
  --text: #c2ccd0;
  --text2: #a1afc9;
  --canvas: #161823;
  --soft: #50616d;
  --soft2: #35434d;
  --border: #758a99;
  --blue: #758a99;
  --blue-soft: #1f2936;
  --green: #549688;
  --red: #cd5e3c;
}
```

用户可以编辑这个文件自定义夜间配色。

## CSS 片段系统

### 管理方式

- 用户在 `snippets/` 目录放置 `.css` 文件
- SettingsPanel 外观 Tab 中列出所有片段，每个有一个 toggle 开关
- 列表容器外包一层滚动容器（片段多时不会撑开面板）

### 注入

- 开启：`document.head` 追加 `<link rel="stylesheet" data-snippet="name" href="...">`
- 关闭：移除对应 link

### 扫描与清理

1. `scan_snippet_files(path)` → 获取目录中存在的 `.css` 文件
2. 与 localStorage 中的 `enabledSnippets` 取交集
3. 清理 `enabledSnippets` 中的幽灵记录（文件已不存在）
4. 按交集创建 link 标签

### 刷新

刷新按钮：重新 scan → 重建所有 link。同样下拉/面板打开时触发 scan。

## Settings Store 新增字段

```js
activeSkin       // string — "" = 日间默认, "night" = 夜间, 其他来自 skins/ 文件
skinPath         // string — skins 目录路径
snippetPath      // string — snippets 目录路径
enabledSnippets  // string[] — 启用的片段文件名（去 .css 后缀）
```

持久化到 localStorage，key 前缀 `timelog:`，沿用现有 `loadNum`/`saveBool`/`loadStr`/`saveStr` 模式。

## Rust Commands 新增

```
scan_skin_files(path: String) -> Vec<String>
scan_snippet_files(path: String) -> Vec<String>
open_folder(path: String) -> ()
```

前端通过 `invoke()` 调用。`scan_*` 返回目录中 `.css` 文件名去后缀列表。`open_folder` 用 `open::that()` 打开系统文件管理器。

## UI 布局

SettingsPanel → 外观 Tab，在"无边框"和"时间块显示"之间插入：

```
┌─ 皮肤 ──────────────────────────────┐
│  [下拉选择皮肤 ▾]                    │
│  [打开皮肤文件夹] [刷新]             │
│  说明文字                            │
├─ CSS 片段 ───────────────────────────┤
│  ┌ 滚动容器 ────────────────────┐    │
│  │ snippet1            [toggle] │    │
│  │ snippet2            [toggle] │    │
│  │ ...                          │    │
│  └──────────────────────────────┘    │
│  [打开片段文件夹] [刷新]             │
│  说明文字                            │
└──────────────────────────────────────┘
```

## 注入机制

在 `App.vue` 中统一管理：

- `<link id="skin-link" rel="stylesheet" href="...">` — 皮肤（单例）
- `<link data-snippet="name" rel="stylesheet" href="...">` — 片段（多个）

`watch(activeSkin)` → 更新或移除 `#skin-link`。
`watch(enabledSnippets)` → 对比差异，增删对应 link。

## 现有 customCss 的处理

现有 `customCss` 只注入 Markdown 编辑器（`MarkdownEditor.vue` line 28），不全局生效。

本次 Feature 用新的全局 CSS 片段系统替代。处理方式：
- `customCss` 字段从 store 中移除
- `MarkdownEditor.vue` 中相关 `<component :is="'style'">` 和 prop 移除
- 若有用户已在用 `customCss`，需要将内容迁移到 `snippets/` 中一个 `.css` 文件（后续在 CHANGELOG 中说明）

## 边界情况

| 场景 | 处理 |
|------|------|
| 目录不存在 | `onMounted` 中 Rust `create_dir_all` 自动创建 + 写内置 `night.css` |
| 扫描时路径不可读 | toast 提示"无法访问文件夹"，列表为空 |
| 选中皮肤文件被删 | 静默回退日间，下拉刷新时列表自动移除 |
| 片段 CSS 语法错误 | 浏览器自然容错，不影响其他样式 |
| 文件夹打开失败 | toast 提示 |
| 用户自建 `day.css` 文件 | ID 为 `"day"`，与内置日间 `""` 不冲突 |
| `night.css` 被用户删除 | 不自动恢复，尊重用户操作 |
| enabledSnippets 幽灵记录 | scan 后取交集清理 |

# Timelog 交接文档

**日期**: 2026-07-04  
**版本**: 0.2.14

---

## 项目路径

```
D:\a_my\project\html\Timelog\
```

## 运行命令

| 命令 | 用途 |
|------|------|
| `npm run tauri dev` | 开发调试（自动编译 Rust + 打开窗口） |
| `npm run tauri build` | 打包发布 |
| 浏览器直接打开 `src/index.html` | 纯前端快速预览（不依赖 Tauri） |

## 已完成功能

- 竖直时间轴拖拽创建/编辑/调整
- 标签系统（分组、多标签、自定义颜色）
- 备注 Markdown + 分栏实时预览
- 全键盘操作（Esc/Delete/Ctrl+C/V/T/?）
- 批量操作（右键多选、复制粘贴跨日期）
- 文本导出/导入 + JSON 备份
- Tauri v2 自动备份 + 轮转（最多 4 份）
- UI 重构：⋮ 下拉菜单收拢按钮、SVG 图标集
- 设置：默认时长、自动滚屏、导出选项、透明度、备份路径
- 默认标签：自我评价 / 正事 / 生活 三组

## 待完成

### 无边框窗口（当前工作中）

**代码已写但 API 不通**：

- 设置 → 无边框窗口，勾选后顶部出现三颗按钮
- 按钮切换图标逻辑正常（最大化 ↔ 还原）
- **问题**: `window.__TAURI__.window.getCurrentWindow().setDecorations()` / `.minimize()` / `.maximize()` / `.close()` 调了但不生效。DevTools 报错日志在 `applyBorderless()` 和按钮 click 里

**调试线索**：

已确认 `window.__TAURI__` 的 keys: `app, core, dpi, event, image, menu, mocks, path, tray, webview, webviewWindow, window`

路径：`src/index.html` 第 673-677 行

**可能原因**：
1. Tauri v2 的 window API 需要 `@tauri-apps/api` npm 包导入，不能直接通过全局对象调用
2. 或者方法名不对（已排除 `getCurrent` → 改成了 `getCurrentWindow`）
3. 可能需要添加 `tauri-plugin-window` 到 Cargo.toml

**修复方向**：
1. 安装 `@tauri-apps/api` → 在 HTML 里加 `<script type="module">` 导入 → 调用官方 API
2. 或者在 `src-tauri/Cargo.toml` 加 window 插件
3. 或者改用 `INVOKE` 方式但要找到正确的 IPC 命令名

### 其他待做

- 全屏功能 → 改为无边框最大化（跟当前工作关联）
- 打包发布：跑 `npm run tauri build`，输出在 `src-tauri/target/release/bundle/`
- Alt+Tab 图标：build 后自动解决

## Git 记录

```
d026d03 fix: 移除全屏功能，修复备份自定义路径权限，修复语法错误
8d8f759 feat(window): F11 全屏切换 + 启动全屏设置 + 自定义备份路径
d1cc374 feat(settings): 新增用户可配置设置项
fcb1d75 重构默认标签
112706c 帮助弹窗美化
1c46c23 图标视觉统一
e22cc61 微调图标
c613129 UI 重构：下拉菜单 + 图标集
a605ab1 初始提交
```

## 文件结构

```
Timelog/
├── src/
│   ├── index.html          ← 主文件（单文件应用）
│   └── icons/              ← SVG 图标集（含 win-*.svg 窗口按钮）
├── src-tauri/
│   ├── Cargo.toml          ← Rust 依赖（tauri-plugin-fs）
│   ├── tauri.conf.json     ← Tauri 配置（版本号、图标路径）
│   ├── capabilities/       ← 权限配置（fs scope: **）
│   └── src/lib.rs          ← Rust 入口（注册插件）
├── package.json            ← npm 脚本
└── HANDOFF.md              ← 本文件
```

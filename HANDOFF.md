# Timelog 交接文档

**日期**: 2026-07-05
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

- 竖直时间轴拖拽创建 / 编辑 / 调整时间块
- 标签系统（分组、多标签、自定义颜色）
- 备注 Markdown + 分栏实时预览
- 全键盘操作（方向键微调、Delete 删除、Ctrl+C/V 复制粘贴跨日期）
- 批量操作（右键多选）
- 文本导出 / 导入 + JSON 备份
- Tauri v2 自动备份 + 天级轮转（最多 4 份）+ 自定义路径
- 无边框窗口模式 + 自定义窗口控制按钮（最小化 / 最大化 / 关闭）
- 窗口位置 / 大小 / 最大化状态记忆（tauri-plugin-window-state）
- Header 区域可拖动窗口（猫爪自定义光标）
- 时间块透明度可调（>100% 时色彩增强）
- 自动清理旧数据（设置保留最近 N 天）
- 数据管理：日期段删除、全部删除
- 弹窗 Enter 键导航（时间字段 -> 标签组 -> 备注框）
- UI 重构：更多下拉菜单收拢按钮、SVG 图标集
- 默认标签：自我评价 / 正事 / 生活 三组

## 已知限制

- 无边框模式下，ESC 键仍会退出全屏（Chromium 原生行为，无法阻止）
- 自定义光标在 Windows 浅色背景上偶尔阴影不渲染（系统层级问题）
- Alt+Tab 图标需 build 后自动解决（开发模式下为 Tauri 默认图标）

## 待完成

- 打包发布：跑 `npm run tauri build`，输出在 `src-tauri/target/release/bundle/`
- 放到 GitHub 上

## Git 记录

```
4799b78 feat(settings): 新增「只保留最近 N 天数据」自动清理功能
2aa997e feat(manage): 管理数据中添加「全部删除」按钮，一键清空所有记录
b300a61 feat(modal): 时间/标签输入框支持 Enter 键导航跳转
7aefd65 feat: header 拖动区域使用猫爪自定义光标
e814ac1 feat(window): 记住窗口状态 + header 区域可拖动窗口
b56a35e fix(window): 修复无边框窗口 API 权限缺失，窗口控制按钮现已生效
b71c8a0 feat(wip): 无边框窗口设置 + 窗口控制按钮（API 待调试）+ 交接文档
d026d03 fix: 移除全屏功能，修复备份自定义路径权限，修复语法错误
8d8f759 feat(window): F11 全屏切换 + 启动全屏设置 + 自定义备份路径
d1cc374 feat(settings): 新增用户可配置设置项
fcb1d75 重构默认标签：新分组（自我评价/正事/生活）+ 新配色方案
112706c 帮助弹窗美化：去 emoji 换 icon，左侧渐变辅助线
1c46c23 图标视觉统一：more 放大加粗 + 间距重算，四项图标改灰 #3C3C3C
e22cc61 微调图标：more 三组放大至 1.2×，data 外框扩大，tag 线条加粗
c613129 UI 重构：收起不常用按钮到更多下拉菜单，新增图标集，署名与版本号
a605ab1 Timelog — 时间块记录桌面应用（Tauri v2）
```

## 文件结构

```
Timelog/
├── src/
│   ├── index.html          ← 主文件（单文件应用）
│   └── icons/              ← SVG 图标集（含 paw.svg 猫爪光标）
├── src-tauri/
│   ├── Cargo.toml          ← Rust 依赖（fs + window-state）
│   ├── tauri.conf.json     ← Tauri 配置（版本号、图标路径、withGlobalTauri: true）
│   ├── capabilities/       ← 权限配置（fs + window + window-state）
│   └── src/lib.rs          ← Rust 入口（注册 fs / opener / window-state）
├── package.json            ← npm 脚本
├── README.md               ← 项目说明
└── HANDOFF.md              ← 本文件
```

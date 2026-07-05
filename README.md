# Timelog - 时间块记录

竖直时间轴拖拽创建记录，支持标签分组、Markdown 备注、JSON 备份的桌面应用。

基于 [Tauri v2](https://v2.tauri.app/) 构建，单文件纯前端（无框架、无打包器），Rust 后端提供文件系统存取与窗口管理。

---

## 功能

**时间轴交互**

- 竖直 24 小时时间轴，像素级精确定位
- 拖拽创建 / 调整时间块，右键多选批量操作
- 全键盘支持（方向键微调、Delete 删除、Ctrl+C/V 复制粘贴跨日期）

**标签系统**

- 分组归类（如「自我评价」「正事」「生活」）
- 自定义颜色，多标签叠加
- 时间块透明度可调

**备注 Markdown**

- 支持粗体、斜体、删除线、行内代码、列表、标题
- 编辑区与预览区实时同步滚动

**数据管理**

- 所有数据存于浏览器 localStorage，刷新不丢失
- Tauri 桌面模式下自动备份到 AppData（JSON + 天级轮转，最多 4 份）
- 可自定义备份路径
- 导入 / 导出 JSON，文本导入 / 导出
- 日期段删除、全部删除
- 自动清理：设置保留最近 N 天数据，每天首次操作自动删除旧记录

**窗口体验**

- 无边框窗口模式（自定义最小化 / 最大化 / 关闭按钮）
- 窗口位置、大小、最大化状态记忆
- Header 空白区域可拖动窗口
- 自定义猫爪光标

**其他**

- 打开时自动滚到当前时间
- 默认时长、导出文件名时间戳、导出保存对话框等可配置
- 帮助弹窗（`?` 键）

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vanilla HTML/CSS/JS（单文件 `src/index.html`） |
| 后端 | Rust (Tauri v2) |
| 桌面 API | Tauri fs plugin（文件读写）、Tauri window-state plugin（窗口状态）、Tauri window API（窗口控制） |
| 存储 | localStorage（运行时）+ AppData JSON 备份（桌面） |

## 快速开始

### 浏览器预览

直接用浏览器打开 `src/index.html`，所有功能可用（备份功能仅桌面模式支持）。

### 桌面开发

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run tauri dev

# 生产构建
npm run tauri build
```

构建输出在 `src-tauri/target/release/bundle/`。

### 前置条件

- Node.js >= 18
- Rust (stable)
- Windows: Visual Studio Build Tools（C++ 工作负载）
- macOS: Xcode Command Line Tools
- Linux: `webkit2gtk` 等系统库

---

## 项目结构

```
Timelog/
├── src/
│   ├── index.html          # 主文件（单文件应用，CSS + HTML + JS）
│   └── icons/              # SVG 图标集
├── src-tauri/
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # Tauri 配置
│   ├── capabilities/       # 权限配置
│   └── src/
│       ├── lib.rs          # 插件注册
│       └── main.rs         # 入口
├── package.json            # npm 脚本
└── README.md
```

## 许可

MIT

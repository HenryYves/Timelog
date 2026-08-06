# Timelog - 时间块记录

竖直时间轴拖拽创建记录，支持标签分组、Markdown 备注、JSON 备份的桌面应用。

基于 [Tauri v2](https://v2.tauri.app/) 构建，Vue 3 + Vite + Pinia 前端，Rust 后端提供文件系统存取与窗口管理。

---

## 功能

**时间轴交互**

- 竖直时间轴，像素级精确定位（1 分钟 = 1 像素，可缩放）
- 剪刀 / 胶水：将某天的时间段剪走拼接到相邻天，灵活显示跨天日程
- 拖拽创建 / 调整时间块，右键多选批量操作，右键拖拽框选
- 全键盘支持（T 键快捷创建、N 键批量创建、方向键微调、Delete 删除、Ctrl+C/V 复制粘贴跨日期、Ctrl+Z 撤销）
- 批量创建：格式化文本输入，`---` 分隔多块，标题/标签/时间/备注固定格式

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
- 多弹窗 ESC 按 LIFO 栈逐一关闭，确认型弹窗拦截取消
- 帮助弹窗（`?` 键）

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 (Composition API) + Vite + Pinia |
| 后端 | Rust (Tauri v2) |
| 桌面 API | Tauri fs plugin + window-state plugin + window API |
| 存储 | localStorage（运行时）+ AppData JSON 备份（桌面） |

## 快速开始

### 浏览器预览

```bash
cd frontend && npm install && npm run dev
```
浏览器打开 `http://localhost:1420`，所有功能可用（备份功能仅桌面模式支持）。

### 桌面开发

```bash
# 安装前端依赖
cd frontend && npm install && cd ..

# 安装 Tauri 依赖
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
├── frontend/               ← Vue 3 前端
│   ├── src/
│   │   ├── App.vue         ← 壳组件
│   │   ├── style.css       ← 全局 CSS
│   │   ├── constants.js    ← 所有常量
│   │   ├── strings.js      ← 界面文案（预留 i18n）
│   │   ├── components/     ← Vue 组件
│   │   ├── composables/    ← 可组合函数
│   │   ├── store/          ← Pinia store
│   │   └── utils/          ← 工具函数
│   └── package.json
├── src/                    ← 旧版单文件（保留参考）
│   └── index.html
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── src/
│       ├── lib.rs
│       └── main.rs
├── package.json
└── README.md
```

## 许可

MIT

---

*本软件基本由 AI 生成，部分代码未人工 Review。*

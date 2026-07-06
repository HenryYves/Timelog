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

## 迭代清单

### Fix

- [x] 备注列表自动换行后光标居中偏移
- [x] 导出文字时列表缩进改用缩进而非空格（避免 Obsidian 判为独立段落）
- [x] ↑↓ 键微调时间块时间范围无实际效果
- [ ] `More` 菜单打开时未拦截 <kbd>T</kbd> 快捷键
- [ ] `More` 菜单应在任意操作后自动关闭

### Feature

- [ ] 自动更新：可关闭、更新前提醒、手动检测、多 URL 回退
- [ ] <kbd>T</kbd> 创建时间块智能默认时间（当天最后时间块结束 → 当前时间）
- [ ] 编辑框取消按钮弹窗确认
- [ ] 列表自动续集 + 有序列表自动重排序
- [ ] 设置项：「保存」按钮出现在「取消」左边
- [ ] 自定义字体大小 / 字体
- [ ] 编辑时右上角灰色显示时间跨度
- [ ] 单元测试 / 集成测试
- [ ] 顶栏自动隐藏
- [ ] <kbd>Ctrl</kbd>+<kbd>Z</kbd> 撤销
- [ ] 设置框美化

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

*本软件基本由 AI 生成，暂无人工 Review。*

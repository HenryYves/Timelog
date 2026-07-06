# Timelog 交接文档

**日期**: 2026-07-06
**版本**: 0.3.0 → 0.4.0（重构中）

---

## 项目路径

```
D:\a_my\project\html\Timelog\
```

## 运行命令

| 命令 | 用途 |
|------|------|
| `cd frontend && npm install` | 安装前端依赖（已完成） |
| `cd frontend && npm run dev` | 纯浏览器调试 Vue 前端（端口 1420） |
| `npm run tauri dev` | Tauri 桌面开发（自动启动 Vite + Tauri 窗口） |
| `npm run tauri build` | 打包发布 |

## 当前状态：Vue 3 重构进行中

**已完成 (6/12)：**

| Task | 内容 | Commit |
|------|------|------|
| 1 | Vite + Vue + Pinia 脚手架 | `4b66c95` |
| 2 | 全局 CSS + 常量 + ESLint | `0fcf6ce` |
| 3 | store/timelog + Timeline.vue | `d9965bf` |
| 4 | EditModal.vue + store/tags | `332eb82` |
| 5 | SettingsPanel.vue + store/settings | `86db90b` |
| 6 | ExportPanel.vue | `a1669bb` |

**待完成 (6/12)：**

| Task | 内容 |
|------|------|
| 7 | TagManager.vue + DataManager.vue |
| 8 | HelpPanel + Toast + ConfirmDialog |
| 9 | Tauri 备份 + 窗口控制 |
| 10 | 日志系统 + 错误边界 |
| 11 | 删除旧 src/index.html |
| 12 | 补充测试 |

## 新前端结构

```
frontend/src/
├── main.js              ← createApp + Pinia
├── App.vue              ← 壳（header + modal栈）
├── style.css            ← 全局 CSS
├── constants.js         ← 所有常量
├── strings.js           ← 界面文案（空）
├── components/
│   ├── Timeline.vue      ← ✅ 时间轴
│   ├── EditModal.vue     ← ✅ 编辑弹窗
│   ├── SettingsPanel.vue ← ✅ 设置面板
│   └── ExportPanel.vue   ← ✅ 导出面板
├── store/
│   ├── timelog.js        ← ✅ 时间块数据
│   ├── tags.js           ← ✅ 标签
│   └── settings.js       ← ✅ 设置
└── utils/
    └── markdown.js       ← ✅ mdToHtml
```

**旧 src/index.html 仍在，全部功能可用。** 新 Vue 版本与旧版并行存在。

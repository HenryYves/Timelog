# Timelog 交接文档

**日期**: 2026-07-06
**版本**: 0.4.0（Vue 3 重构完成）

---

## 项目路径

```
D:\a_my\project\html\Timelog\
```

## 运行命令

| 命令 | 用途 |
|------|------|
| `cd frontend && npm install` | 安装前端依赖 |
| `cd frontend && npm run dev` | 浏览器调试 Vue 前端（端口 1420） |
| `cd frontend && npm test` | 跑测试（32 tests） |
| `npm run tauri dev` | Tauri 桌面开发 |
| `npm run tauri build` | 打包发布 |

## 当前状态：Vue 3 重构完成 12/12

所有功能已从旧单文件迁移到 Vue 3 工程。旧 `src/index.html` 保留参考。

## 前端结构

```
frontend/src/
├── main.js              ← createApp + Pinia
├── App.vue              ← 壳（header + modal栈 + 错误边界）
├── style.css            ← 全局 CSS（变量、overlay、ghost 等）
├── constants.js         ← 所有常量
├── strings.js           ← 界面文案集中管理
├── components/
│   ├── Timeline.vue       ← 时间轴渲染 + 拖拽
│   ├── EditModal.vue      ← 创建/编辑弹窗 + 标签选择
│   ├── TagManager.vue     ← 标签管理
│   ├── SettingsPanel.vue  ← 设置面板
│   ├── ExportPanel.vue    ← 导出/文本导入/JSON导入
│   ├── DataManager.vue    ← 数据管理
│   ├── HelpPanel.vue      ← 帮助弹窗
│   ├── Toast.vue          ← Toast 提示
│   └── ConfirmDialog.vue  ← 确认弹窗
├── store/
│   ├── timelog.js         ← 时间块数据 + colorOf
│   ├── tags.js            ← 标签 CRUD + 同步
│   └── settings.js        ← 所有设置项
├── utils/
│   ├── markdown.js        ← mdToHtml
│   ├── backup.js          ← 自动备份
│   ├── tauri.js           ← Tauri API 封装
│   └── log.js             ← 日志系统
├── composables/
│   ├── useToast.js        ← Toast 状态
│   └── useConfirm.js      ← 确认弹窗 Promise API
└── __tests__/             ← 32 单元测试
```

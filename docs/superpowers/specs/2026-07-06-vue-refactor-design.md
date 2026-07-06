# Timelog 重构设计：单文件 → Vue 3

**日期**: 2026-07-06
**版本**: 0.3.0 → 0.4.0（目标）
**状态**: 已确认，待实施

---

## 一、动机

- 当前单文件 `src/index.html` 749 行 80 个函数，逻辑混杂，加新功能困难
- AI 协作时双方都难以追踪代码变更来源，本次滚轮回退 bug 即为前车之鉴
- 后续将进行人工 Review，需要模块化、可读的结构
- 为自动更新、CodeMirror 等后续功能扫清工程障碍

## 二、架构选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Vue 3 Composition API | 和原生 HTML/CSS 最接近，迁移成本最低 |
| 状态管理 | Pinia | Vue DevTools 可视化调试，Review 时可追踪数据流 |
| CSS 策略 | 全局 `style.css` + 组件 `<style scoped>` | 和当前写法一致 |
| 构建工具 | Vite | Vue 官方推荐，零配置 |
| 语言 | JavaScript | 一人维护不需 TS 复杂度，以后可加 `lang="ts"` |

## 三、Tauri 兼容性

- `tauri.conf.json` 改一行：`frontendDist` 从 `../src` 改为 `../frontend/dist`
- `src-tauri/` 目录完全不动
- `withGlobalTauri: true` 保持不变
- `npm run tauri dev` 自动启动 Vite + Tauri

## 四、项目结构

```
Timelog/
├── frontend/                       ← 新建
│   ├── index.html                  ← Vite 入口
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.js                 ← createApp + createPinia
│       ├── App.vue                 ← 壳组件（header、modal栈、全局事件、错误边界）
│       ├── style.css               ← 全局 CSS（变量、通用样式、猫爪光标）
│       ├── constants.js            ← 所有常量（无例外）
│       ├── strings.js              ← 界面文案集中管理（预留多语言）
│       ├── components/
│       │   ├── Timeline.vue         ← 时间轴 + 时间块渲染 + 拖拽
│       │   ├── EditModal.vue        ← 创建/编辑弹窗 + 标签选择
│       │   ├── TagManager.vue       ← 标签管理（CRUD + 分组）
│       │   ├── SettingsPanel.vue    ← 设置面板
│       │   ├── ExportPanel.vue      ← 文本导出/粘贴导入
│       │   ├── DataManager.vue      ← 数据管理（日期段删除/全部删除）
│       │   ├── HelpPanel.vue        ← 帮助弹窗（? 键）
│       │   ├── ConfirmDialog.vue    ← 通用确认弹窗
│       │   └── Toast.vue            ← Toast 提示
│       ├── store/
│       │   ├── timelog.js           ← 时间块数据 + localStorage + 备份
│       │   ├── tags.js              ← 标签 CRUD + 分组
│       │   └── settings.js          ← 所有设置项
│       ├── utils/
│       │   ├── markdown.js          ← mdToHtml / mdInline
│       │   ├── log.js               ← 日志系统
│       │   ├── tauri.js             ← Tauri API 封装（统一 try/catch）
│       │   └── migrate.js           ← 数据版本迁移
│       └── __tests__/
│           ├── store/               ← store 纯函数单元测试
│           └── utils/               ← 工具函数测试
├── src-tauri/                       ← 不动
│   └── tauri.conf.json              ← 只改 frontendDist
└── src/                             ← 旧 index.html，迁移完成后删除
```

## 五、数据流

```
localStorage ←→ store/timelog.js  ←→  Timeline.vue
                store/tags.js      ←→  TagManager.vue / EditModal.vue
                store/settings.js  ←→  SettingsPanel.vue
```

- 组件永远不直接碰 localStorage，全部通过 store
- 当前全局变量收进对应 store 的 state
- 备份、自动清理等副作用放 store 的 actions
- 跨组件通信：Pinia store 共享 + 少数场景 `provide/inject`

## 六、常量管理

- 所有数字/字符串常量收进 `constants.js`，一个文件按区块组织：
  - `TIMELINE`：PX_MIN, DAY_MIN, EDGE
  - `BACKUP`：MAX_ROTATE, DATA_DIR
  - `STORAGE`：KEY_PREFIX, DEFAULT_*
  - `UI`：TOAST_DURATION, MODAL_Z_INDEX
- 组件和 store 只引用不硬编码

## 七、界面文案（预留多语言）

`strings.js` 集中所有中文文案：

```js
export const STR = {
  toast: {
    saved: '已保存',
    deleted: '已删除',
    copied: (n) => `已复制 ${n} 个`,
    importOk: '导入成功',
  },
  confirm: {
    deleteTag: (name) => `确定删除标签"${name}"？`,
    deleteAll: '确定删除所有数据？此操作不可恢复。',
  },
  // ...
}
```

- 组件引用 `STR.toast.saved`
- 现在不实现英文版，预留接口即可

## 八、数据版本与迁移

- `constants.js` 定义 `DATA_VERSION`
- `utils/migrate.js` 链式处理版本升级
- store 加载数据时自动检查版本、跑迁移、写回新版

## 九、日志系统

- `utils/log.js` 封装：日志写 `console` + `localStorage` 循环 buffer（200 条）
- 级别：`debug` / `info` / `warn` / `error`
- 生产构建自动去除 debug/info
- 设置面板加"导出日志"按钮
- 格式：`[2026-07-06 14:32:01] [ERROR] [store/timelog] 备份写入失败: xxx`

## 十、错误边界

- `App.vue` 挂 `onErrorCaptured`：渲染异常显示备用 UI，不白屏
- Store action 统一 `try/catch`，catch 里 toast + 写日志
- Tauri API 失败区分原因，给不同提示

## 十一、安全

| 问题 | 措施 |
|------|------|
| XSS（innerHTML 注入） | mdToHtml 输入先转义；导入 JSON 前校验 schema |
| 数据损坏 | 写 localStorage 先写临时 key，验证成功再替换 |
| 外部链接 | 所有 window.open / target="_blank" 加 rel="noopener noreferrer" |

## 十二、Dev vs Prod 构建

- `import.meta.env.PROD` 区分行为
- Dev：调式信息
- Prod：去除 `console.log`，保留 `console.error` 和日志系统
- Vite 配置 `define` 注入版本号

## 十三、工程规范

| 规则 | 说明 |
|------|------|
| 无魔法数字 | 所有数字/字符串常量收进 constants.js |
| 常量集中管理 | constants.js 一个文件，分区管理 |
| 单一职责 | 每个函数只做一件事 |
| 无重复代码 | 出现两次的提取为函数，三次的必须提取 |
| 英文命名 | 动词开头（get/set/load/save/build/render），沿用现有风格 |
| 注释写"为什么" | 不写"这行是给 x 赋值"，写"用 rAF 等浏览器滚完再调" |
| 空状态处理 | 所有操作前检查空值 |
| 异步统一 | Tauri 调用必须 try/catch |
| 样式隔离 | 全局只放变量和 base，组件用 scoped |
| Props 校验 | defineProps 带类型和默认值 |
| 无副作用 computed | computed 只读不写 |
| ESLint + Prettier | Vue 官方 preset，保存自动格式化 |
| key 属性规范 | v-for 用稳定唯一 key，禁止 index |
| 事件清理 | onMounted 加的 onUnmounted 必须移除 |
| 定时器清理 | 所有 setTimeout/setInterval 在组件销毁时 clear |

## 十四、测试策略

| 层 | 策略 |
|------|------|
| Store 纯函数 | 必测：数据读写、排序、过滤、导出格式化、迁移 |
| 工具函数 | 必测：mdToHtml / fmt / toInput / fromInput 等 |
| Vue 组件 | 暂不测，预留 @vue/test-utils 接口 |
| 文件位置 | src/__tests__/，文件名 .test.js |

## 十五、Git 约定

- 分支：main 始终可运行
- commit：中文，动词开头，沿用现有格式
- tag：每个 release 打版本标签
- commit 前：npm test 通过 + npm run build 不报错

## 十六、迁移顺序

| 步骤 | 内容 | 验收标准 |
|------|------|------|
| 1 | Vite + Vue + Pinia 脚手架，配 Tauri frontendDist | tauri dev 空白窗口 |
| 2 | 全局 CSS + constants.js + strings.js + App.vue 壳 | header、日期导航正常 |
| 3 | store/timelog.js + Timeline.vue | 拖拽创建/调整时间块正常 |
| 4 | EditModal.vue + store/tags.js | 编辑 + 标签选择 + Enter 导航 |
| 5 | store/settings.js + SettingsPanel.vue | 所有设置项读写正常 |
| 6 | ExportPanel.vue + 文本导入 | 导出格式正确，粘贴导入正常 |
| 7 | TagManager.vue + DataManager.vue | 标签管理 + 数据管理正常 |
| 8 | HelpPanel.vue + Toast.vue + ConfirmDialog.vue | 帮助 + 弹窗 + 焦点陷阱 |
| 9 | Tauri 备份 + 窗口控制 | 自动备份、无边框切换正常 |
| 10 | 日志系统 + 错误边界 | 导出日志正常，异常不白屏 |
| 11 | 删除旧 src/index.html | 全部功能正常 |
| 12 | 补充测试 | npm test 通过 |

## 十七、不纳入本次迁移

- CodeMirror 6 替换 textarea
- tauri-plugin-updater 自动更新
- 全量单元测试 / 集成测试

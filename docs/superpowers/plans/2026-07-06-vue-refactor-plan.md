# Timelog Vue 3 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 749 行单文件 `src/index.html` 重构为标准 Vue 3 + Vite + Pinia 工程结构，Tauri 层不动。

**Architecture:** Vue 3 Composition API + Pinia 状态管理 + 全局 CSS + scoped 组件样式。三个 Pinia store（timelog/tags/settings）管理数据，组件通过 store 读写，不直接碰 localStorage。Tauri 只改 `tauri.conf.json` 中 `frontendDist` 路径。

**Tech Stack:** Vite, Vue 3 (Composition API), Pinia, plain CSS, Vitest

## Global Constraints

- 无魔法数字：所有数字/字符串常量收进 `constants.js`
- 英文命名：新函数全部英文、动词开头（get/set/load/save/build/render）
- 样式隔离：全局 `style.css` 只放变量和 base，组件用 `<style scoped>`
- 空状态处理：所有数组/字符串操作前检查空值
- 异步统一：所有 Tauri 调用必须 `try/catch`
- Props 校验：`defineProps` 带类型和默认值
- ESLint + Prettier：Vue 官方 preset
- v-for key 用稳定唯一标识，禁止 index
- 事件/定时器在 onUnmounted 清理
- 每个 Task 结束 commit，中文动词开头

---

### Task 1: Vite + Vue + Pinia 脚手架 + Tauri 配置

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/src/main.js`, `frontend/src/App.vue`
- Modify: `src-tauri/tauri.conf.json:6`

**Interfaces:**
- Produces: `frontend/` 目录结构 + `npm run dev` 可启动空白 Vue 页面 + `npm run tauri dev` 可启动 Tauri 窗口

- [ ] **Step 1: 创建 frontend/package.json**

```json
{
  "name": "timelog-frontend",
  "private": true,
  "version": "0.3.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .vue,.js --fix",
    "test": "vitest run"
  },
  "dependencies": {
    "vue": "^3.5",
    "pinia": "^2.2"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5",
    "vite": "^6",
    "vitest": "^2",
    "@vue/eslint-config-prettier": "^10",
    "eslint": "^9",
    "eslint-plugin-vue": "^9",
    "prettier": "^3"
  }
}
```

- [ ] **Step 2: 创建 frontend/vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'esnext', outDir: 'dist' },
})
```

- [ ] **Step 3: 创建 frontend/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timelog</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: 创建 frontend/src/main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 5: 创建 frontend/src/App.vue（空壳）**

```vue
<template>
  <div>Timelog loading...</div>
</template>

<script setup>
</script>
```

- [ ] **Step 6: 创建 frontend/src/style.css（空文件，占位）**

- [ ] **Step 7: 修改 src-tauri/tauri.conf.json**

修改 `build.frontendDist`:
```json
{
  "build": {
    "frontendDist": "../frontend/dist"
  }
}
```

（其余字段保持不变）

- [ ] **Step 8: 安装依赖并验证 Vite 开发服务器**

```bash
cd frontend && npm install && npm run dev
```
浏览器打开 `http://localhost:1420`，应看到 "Timelog loading..."

- [ ] **Step 9: 验证 Tauri 开发模式**

```bash
npm run tauri dev
```
应看到 Tauri 窗口显示 "Timelog loading..."

- [ ] **Step 10: Commit**

```bash
git add frontend/ src-tauri/tauri.conf.json
git commit -m "chore: 初始化 Vue 3 + Vite + Pinia 前端工程骨架"
```

---

### Task 2: 全局 CSS + constants.js + strings.js + App.vue 骨架 + ESLint

**Files:**
- Create: `frontend/src/constants.js`, `frontend/src/strings.js`, `frontend/eslint.config.js`, `frontend/.prettierrc`
- Modify: `frontend/src/style.css`, `frontend/src/App.vue`

**Interfaces:**
- Consumes: 无
- Produces: 
  - `constants.js`: `PX_MIN = 1.33`, `DAY_MIN = 1440`, `EDGE = 6`, `MAX_BACKUP_COUNT = 4`, `DATA_DIR = 'timelog-data'`, `MAIN_NAME = 'timelog-data.json'`, `KEY_PREFIX = 'timelog:'`, `DEFAULT_DURATION = 30`, `DEFAULT_OPACITY = 15`, `TOAST_DURATION = 1800`, `DATA_VERSION = 1`
  - `strings.js`: `STR` 对象，目前为空（随 Task 3-8 逐步填充文案）
  - `style.css`: 从旧 `index.html` 原样搬过来的全局样式

- [ ] **Step 1: 创建 frontend/src/constants.js**

```js
// ---------- Timeline ----------
export const PX_MIN = 1.33
export const DAY_MIN = 1440
export const EDGE = 6

// ---------- Backup ----------
export const MAX_BACKUP_COUNT = 4
export const DATA_DIR = 'timelog-data'
export const MAIN_NAME = 'timelog-data.json'

// ---------- Storage ----------
export const KEY_PREFIX = 'timelog:'
export const DATA_VERSION = 1

// ---------- Defaults ----------
export const DEFAULT_DURATION = 30
export const DEFAULT_OPACITY = 15
export const DEFAULT_KEEP_DAYS = 0
export const DEFAULT_AUTO_SCROLL = true
export const DEFAULT_EXPORT_TIMESTAMP = true
export const DEFAULT_EXPORT_DIALOG = false
export const DEFAULT_BORDERLESS = false
export const DEFAULT_BACKUP_ON = true
export const DEFAULT_CURSOR_CENTER = true

// ---------- UI ----------
export const TOAST_DURATION = 1800
export const GUTTER_WIDTH = 56
```

- [ ] **Step 2: 创建 frontend/src/strings.js**

```js
export const STR = {} // 后续 Task 逐步填充
```

- [ ] **Step 3: 从旧 index.html 提取全局 CSS → frontend/src/style.css**

从旧文件复制以下内容到 `style.css`：
- `:root{}` 变量块（`--text`, `--text2`, `--canvas`, `--soft`, `--soft2`, `--border`, `--blue`, `--blue-soft`, `--green`, `--red`）
- `*{box-sizing:border-box}`
- `html,body{}`
- `body{}`（font-family, color, background, font-size, line-height, display, flex-direction, height）
- `header{}`
- `header h1{}`
- `.datenav{}`, `.datenav .date{}`
- `.spacer{}`
- `button{}` 系列
- `.hint{}`
- `main{}`
- `kbd{}`
- 猫爪光标样式（line 23）
- logo 相关样式

注意：**只搬全局样式**。时间轴（`.grid`, `.block`, `.day` 等）、弹窗（`.overlay`, `.modal` 等）属于组件样式，留到对应 Task 的 `<style scoped>`。

- [ ] **Step 4: 创建 frontend/eslint.config.js**

```js
import pluginVue from 'eslint-plugin-vue'
import vueConfig from '@vue/eslint-config-prettier'

export default [
  ...pluginVue.configs['flat/recommended'],
  vueConfig,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-console': 'warn',
      'no-magic-numbers': ['warn', { ignore: [0, 1, -1], ignoreArrayIndexes: true }],
    },
  },
]
```

- [ ] **Step 5: 创建 frontend/.prettierrc**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 2
}
```

- [ ] **Step 6: 验证 lint**

```bash
cd frontend && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/constants.js frontend/src/strings.js frontend/src/style.css frontend/src/App.vue frontend/eslint.config.js frontend/.prettierrc
git commit -m "chore: 全局 CSS、常量文件、ESLint/Prettier 配置"
```

---

### Task 3: store/timelog.js + Timeline.vue（核心时间轴）

这是最重要的 Task。需要把旧 `index.html` 中所有时间块数据逻辑 + 时间轴渲染逻辑迁移过来。

**Files:**
- Create: `frontend/src/store/timelog.js`, `frontend/src/components/Timeline.vue`
- Modify: `frontend/src/App.vue`（引用 Timeline）

**Interfaces:**
- Consumes: `constants.js`（PX_MIN, DAY_MIN, EDGE, KEY_PREFIX）
- Produces:
  - Store: `useTimelogStore` → state: `blocks`, `selectedBlocks`, `curDate`, `clipboard`; getters: `blocksForDate`; actions: `loadBlocks`, `saveBlocks`, `deleteBlocks`, `copySelected`, `pasteBlocks`
  - Timeline: props: 无（从 store 读）；emits: 无（通过 store 写）

- [ ] **Step 1: 创建 frontend/src/store/timelog.js（数据层）**

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KEY_PREFIX, DATA_VERSION } from '../constants.js'

function dkey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function fmt(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')
}

export const useTimelogStore = defineStore('timelog', () => {
  const curDate = ref(new Date())
  const blocks = ref([])
  const selectedBlocks = ref(new Set())
  const clipboard = ref([])

  const dateKey = computed(() => dkey(curDate.value))

  function loadBlocks() {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + dateKey.value)
      blocks.value = raw ? JSON.parse(raw) : []
    } catch {
      blocks.value = []
    }
  }

  function saveBlocks() {
    if (blocks.value.length) {
      localStorage.setItem(KEY_PREFIX + dateKey.value, JSON.stringify(blocks.value))
    } else {
      localStorage.removeItem(KEY_PREFIX + dateKey.value)
    }
  }

  function addBlock(rec) {
    blocks.value.push(rec)
    saveBlocks()
  }

  function updateBlock(rec) {
    const idx = blocks.value.findIndex(b => b.id === rec.id)
    if (idx !== -1) blocks.value[idx] = rec
    else blocks.value.push(rec)
    saveBlocks()
  }

  function deleteBlock(id) {
    blocks.value = blocks.value.filter(b => b.id !== id)
    selectedBlocks.value.delete(id)
    saveBlocks()
  }

  function deleteSelectedBlocks() {
    const ids = selectedBlocks.value
    blocks.value = blocks.value.filter(b => !ids.has(b.id))
    selectedBlocks.value.clear()
    saveBlocks()
  }

  function copySelected() {
    if (!selectedBlocks.value.size) return false
    clipboard.value = blocks.value
      .filter(b => selectedBlocks.value.has(b.id))
      .sort((a, b) => a.start - b.start)
      .map(b => ({ start: b.start, end: b.end, title: b.title, note: b.note, tags: [...(b.tags || [])] }))
    return true
  }

  function pasteBlocks(targetMin) {
    if (!clipboard.value.length) return false
    const firstStart = clipboard.value[0].start
    const offset = targetMin - firstStart
    clipboard.value.forEach(b => {
      const newBlock = { ...b, id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6), start: b.start + offset, end: b.end + offset }
      blocks.value.push(newBlock)
    })
    saveBlocks()
    return true
  }

  function setDate(d) { curDate.value = d; loadBlocks() }

  function getExportData() {
    return blocks.value.slice().sort((a, b) => a.start - b.start)
  }

  loadBlocks()

  return {
    curDate, blocks, selectedBlocks, clipboard, dateKey,
    loadBlocks, saveBlocks, addBlock, updateBlock, deleteBlock,
    deleteSelectedBlocks, copySelected, pasteBlocks, setDate, getExportData,
    fmt, dkey,
  }
})
```

- [ ] **Step 2: 验证 store 可以 import**

```bash
cd frontend && node -e "import('./src/store/timelog.js').then(m => console.log('OK'))"
```

- [ ] **Step 3: 创建 frontend/src/components/Timeline.vue（时间轴渲染）**

从旧 `index.html` 迁移以下逻辑：
- `buildGutter()` → `<template>` 中的 `v-for` 渲染 0-24 小时标签
- `buildDayLines()` → `<template>` 中 `v-for` 渲染 hourline + halfline
- `layout()` → 移到 `utils/layout.js` 或 store 中
- `render()` → `v-for` 渲染 `.block` 元素
- 拖拽创建（`mousedown` on `.day`）→ `<script setup>` 中实现
- 拖拽调整（`mousedown` on `.block` edge）→ `<script setup>` 中实现
- 点击打开编辑 → emit 给 App.vue
- 右键多选 → 操作 `selectedBlocks`

**注意**：旧代码中 `loadBlocks()` 读取所有日期的 localStorage key 的做法保持不变，但重构到 store 中。

此 Task 代码量最大（~300 行 Vue SFC），需逐段验证。

- [ ] **Step 4: 修改 App.vue 引用 Timeline**

```vue
<template>
  <div id="app-container">
    <header>...</header>
    <main>
      <div class="grid">
        <Timeline />
      </div>
    </main>
  </div>
</template>

<script setup>
import Timeline from './components/Timeline.vue'
</script>
```

- [ ] **Step 5: 验证时间轴在浏览器中渲染**

```bash
cd frontend && npm run dev
```
打开 `http://localhost:1420`，确认：
- 左侧时间标签显示 00:00-24:00
- 中间有时间轴横线
- 如果当天有数据，显示时间块
- 右键可多选

- [ ] **Step 6: 验证 Tauri 窗口**

```bash
cd .. && npm run tauri dev
```
确认 Tauri 窗口中时间轴正常渲染。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/store/timelog.js frontend/src/components/Timeline.vue frontend/src/App.vue
git commit -m "feat: 迁移时间轴核心逻辑到 store/timelog + Timeline 组件"
```

---

### Task 4: EditModal.vue + store/tags.js

**Files:**
- Create: `frontend/src/store/tags.js`, `frontend/src/components/EditModal.vue`
- Modify: `frontend/src/App.vue`（引入 EditModal）

**Interfaces:**
- Consumes: `useTimelogStore`（读写 blocks）, `constants.js`
- Produces:
  - Store: `useTagStore` → state: `tags`, `selectedTags`; actions: `addTag`, `updateTag`, `deleteTag`, `toggleTag`
  - EditModal: props: `show`, `editingBlock`（null 表示创建）; emits: `close`

- [ ] **Step 1: 创建 frontend/src/store/tags.js**

从旧代码迁移标签相关逻辑：
- `loadTags()` / `saveTags()` → localStorage 读写 `timelog:tags`
- 颜色处理 `normColor()`
- `removeTagFromBlocks()`, `replaceTagInBlocks()` → 同步 time blocks
- 默认标签初始化

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { KEY_PREFIX } from '../constants.js'
import { useTimelogStore } from './timelog.js'

const DEFAULT_TAGS = [
  { name: '专注', color: '#A1AFC9', group: '自我评价' },
  { name: '摸鱼', color: '#F0C7C1', group: '自我评价' },
  { name: '学习', color: '#C4E0D4', group: '正事' },
  { name: '工作', color: '#A1AFC9', group: '正事' },
  { name: '运动', color: '#B5D8A8', group: '生活' },
  { name: '社交', color: '#FCE38A', group: '生活' },
]

export const useTagStore = defineStore('tags', () => {
  const tags = ref([])

  function loadTags() {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + 'tags')
      tags.value = raw ? JSON.parse(raw) : [...DEFAULT_TAGS]
    } catch {
      tags.value = [...DEFAULT_TAGS]
    }
  }

  function saveTags() {
    localStorage.setItem(KEY_PREFIX + 'tags', JSON.stringify(tags.value))
  }

  function normColor(c) {
    if (!c || !c.trim()) return '#C4C3C0'
    let v = c.trim()
    if (!v.startsWith('#')) v = '#' + v
    if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
    return v.slice(0, 7)
  }

  function addTag(tag) {
    tags.value.push({ name: tag.name, color: normColor(tag.color), group: tag.group || '' })
    saveTags()
  }

  function updateTag(index, tag) {
    const oldName = tags.value[index].name
    tags.value[index] = { name: tag.name, color: normColor(tag.color), group: tag.group || '' }
    saveTags()
    if (oldName !== tag.name) {
      replaceTagInBlocks(oldName, tag.name)
    }
  }

  function deleteTag(index) {
    const name = tags.value[index].name
    tags.value.splice(index, 1)
    saveTags()
    removeTagFromBlocks(name)
  }

  function removeTagFromBlocks(name) {
    const store = useTimelogStore()
    store.blocks.value.forEach(b => {
      if (b.tags) b.tags = b.tags.filter(t => t !== name)
    })
    store.saveBlocks()
  }

  function replaceTagInBlocks(oldName, newName) {
    const store = useTimelogStore()
    store.blocks.value.forEach(b => {
      if (b.tags) b.tags = b.tags.map(t => (t === oldName ? newName : t))
    })
    store.saveBlocks()
  }

  function colorOf(name) {
    const t = tags.value.find(t => t.name === name)
    if (!t) return { hex: '#C4C3C0', bg: '#F0EFED' }
    return { hex: t.color, bg: t.color + '22' }
  }

  loadTags()
  return { tags, loadTags, saveTags, addTag, updateTag, deleteTag, removeTagFromBlocks, replaceTagInBlocks, colorOf, normColor }
})
```

- [ ] **Step 2: 创建 EditModal.vue**

从旧代码迁移 `openCreate()` / `openEdit()` / `saveBlock()` + Modal HTML：
- 时间输入（start/end）
- 标题输入
- 备注 textarea + Markdown 预览（`updateNotePrev` / `mdToHtml`）
- 标签 chip 选择
- 保存 / 取消 / 删除 / 复制按钮
- Enter 键导航
- 焦点陷阱（Tab / Shift+Tab）
- 单向滚动同步（textarea → preview）

```vue
<!-- 结构示意，具体实现从旧 index.html 逐段搬 -->
<template>
  <div class="overlay" :hidden="!show" @mousedown.self="$emit('close')">
    <div class="modal">
      <h2>{{ editingBlock ? '编辑时间块' : '记录时间块' }}</h2>
      <!-- 时间行 -->
      <!-- 标题 -->
      <!-- 标签组 -->
      <!-- 备注 + 预览 -->
      <!-- 操作按钮 -->
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useTimelogStore } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { mdToHtml } from '../utils/markdown.js'

const props = defineProps({
  show: Boolean,
  editingBlock: { type: Object, default: null },
})
const emit = defineEmits(['close'])
// ... 迁移旧 openCreate/openEdit/saveBlock 逻辑
</script>

<style scoped>
/* 从旧 index.html 搬 .overlay, .modal, .timerow, .tagwrap, .chip 等 */
</style>
```

- [ ] **Step 3: 将 mdToHtml 相关逻辑移到 utils/markdown.js**

创建 `frontend/src/utils/markdown.js`，从旧代码搬 `mdToHtml()` 和 `mdInline()` 函数。

- [ ] **Step 4: 联通 App.vue**

App.vue 中管理 `editingBlock` 状态，Timeline 点击时间块 → `editingBlock = block` → EditModal 显示。

- [ ] **Step 5: 验证创建/编辑流程**

```
1. 拖拽创建时间块 → EditModal 弹出 → 填写信息 → 保存 → 时间轴显示
2. 点击已有时间块 → EditModal 弹出 → 修改 → 保存
3. 删除时间块
4. 标签选择正常
5. 复制时间块
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/tags.js frontend/src/components/EditModal.vue frontend/src/utils/markdown.js frontend/src/App.vue
git commit -m "feat: 迁移编辑弹窗和标签 store"
```

---

### Task 5: store/settings.js + SettingsPanel.vue

**Files:**
- Create: `frontend/src/store/settings.js`, `frontend/src/components/SettingsPanel.vue`
- Modify: `frontend/src/App.vue`（引入 SettingsPanel）

- [ ] **Step 1: 创建 store/settings.js**，从旧代码搬所有 `loadNum`/`loadBool` 变量到 Pinia state

- [ ] **Step 2: 创建 SettingsPanel.vue**，从旧 HTML 搬设置面板所有选项

- [ ] **Step 3: 验证所有设置项读写正常，关闭重开保持**

---

### Task 6: ExportPanel.vue + 文本导入

- [ ] **Step 1: 创建 ExportPanel.vue**，迁移 `buildExport()` / `exText` / 复制 / 下载 JSON

- [ ] **Step 2: 验证导出格式正确（列表 Tab 缩进、时间戳选项等）**

---

### Task 7: TagManager.vue + DataManager.vue

- [ ] **Step 1: 创建 TagManager.vue**，迁移标签管理（CRUD + 分组 + 删除/改名确认）

- [ ] **Step 2: 创建 DataManager.vue**，迁移数据管理（日期段删除、全部删除、导入 JSON）

---

### Task 8: HelpPanel.vue + Toast.vue + ConfirmDialog.vue

- [ ] **Step 1: 创建 Toast.vue**（全局 Toast 组件，provide/inject 供所有组件使用）

- [ ] **Step 2: 创建 ConfirmDialog.vue**（替代 `showConfirm`，Promise-based API）

- [ ] **Step 3: 创建 HelpPanel.vue**（帮助弹窗，`?` 键触发）

---

### Task 9: Tauri 备份 + 窗口控制

- [ ] **Step 1: 创建 utils/tauri.js**，封装 `tRead`/`tWrite`/`rotateBackups` 等 Tauri fs API

- [ ] **Step 2: 在 App.vue 中集成备份逻辑**（`initBackup`/`doAutoSave`/`scheduleSave`）

- [ ] **Step 3: 窗口控制**（无边框切换、最小化/最大化/关闭按钮）

---

### Task 10: 日志系统 + 错误边界

- [ ] **Step 1: 创建 utils/log.js**，实现 `debug`/`info`/`warn`/`error` + localStorage buffer

- [ ] **Step 2: App.vue 挂 `onErrorCaptured`**，异常显示备用 UI

- [ ] **Step 3: 设置面板加"导出日志"按钮**

---

### Task 11: 删除旧 src/index.html

- [ ] **Step 1: 逐功能对比旧文件和新 Vue 项目，确认所有功能已迁移**

- [ ] **Step 2: 备份旧文件** `mv src/index.html src/index.html.bak`

- [ ] **Step 3: 删除旧文件，运行 `npm run tauri build` 确认打包成功**

---

### Task 12: 补充测试

- [ ] **Step 1: 创建 frontend/vitest.config.js**

- [ ] **Step 2: 写 store/timelog 测试**（loadBlocks/saveBlocks/addBlock/deleteBlock/排序/导出格式）

- [ ] **Step 3: 写 store/tags 测试**（CRUD/颜色规范化/removeTagFromBlocks/replaceTagInBlocks）

- [ ] **Step 4: 写 utils/markdown 测试**（mdToHtml: 粗体/斜体/列表/标题/空输入/XSS 转义）

- [ ] **Step 5: 运行 `npm test` 确认全部通过**

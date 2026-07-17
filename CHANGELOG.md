# Changelog

## [0.8.8] - 2026-07-17

### Added
- 视图自定义名称
- 导出/导入按内容选择：数据、标签、统计视图、设置（JSON v3）
- 自动备份纳入统计视图和设置

### Changed
- 统计面板视觉美化：卡片装饰条、柱状图渐变、筛选pill、动画
- 日期输入改用 text 类型 + 格式校验提示
- 自定义日期范围持久化记忆
- 移除展开视图和日期分隔符

### Fixed
- 柱状图 display:block 修复高度 0 不可见
- 饼图大扇区引导线方向计算修正
- 颜色 fallback 校验加固
- 导入设置后 store 刷新生效
- 属性面板焦点管理 + 固定高度滚轮 + checkbox 焦点可见

## [0.8.0] - 2026-07-17

### Added
- 饼图 SVG 重写：引导线标注 + 扇区 hover 交互 + 标签防重叠
- 图表交互属性：开启后 hover 扇区/柱子在卡片头部显示数据
- 柱状图 hover 交互

### Changed
- 饼图从 CSS `conic-gradient` 替换为 SVG `<path>` + `<polyline>` 引导线
- 交互属性名从"扇区交互"改为"图表交互"，覆盖饼图和柱状图

### Fixed
- 柱状图 `.bar-fill` `<span>` 无 `display:block` 导致高度为 0 不可见
- 饼图大扇区（>180°）引导线方向计算错误：向量平均改为角度平均
- 颜色 fallback 校验加固：hex 格式校验 + 大小写不敏感

## [0.7.20] - 2026-07-16

### Added
- 统一 Enter 处理：split + insert `<div><br>` + cleanup 替代 4 个特判路径

### Changed
- `saveCursor` Phase 1：跨 div 边界记录 trail `['DIV']`

### Fixed
- Backspace/Delete 在格式化元素内不再拆格式：`sel.collapse` 替代 `addRange`
- Enter 后光标不跳回上一行：Phase 2 父级空 block trail
- `restoreCursor` 边界跨 div 仅 trail 非空时触发（修复行尾打字跳下行）
- `findClosing` 反斜杠计数修正——连续奇数个 `\` 才算转义
- escape 处理后插 `<!--->` 防 `normalize` 合并相邻 text

## [0.7.16] - 2026-07-15

### Added
- 编辑器 `::before`/`::after` 伪元素占位 5 行（#d4dcda 底色 + 禁止猫水印平铺），不可删除、不可选中
- 光标居中：`selectionchange` + 1 行容忍策略 + 元素 rect 回退（quirk #8）
- `docs/webview2-contenteditable-quirks.md`：#8 rect.height=0、#9 scanner 搬迁 `\` 偏移、#10-12 实现细节

### Changed
- 扫描器解耦到 `utils/scanner.js`（~330 行，7 函数）
- 光标设置**必须用 `sel.collapse()`** 替代 `removeAllRanges+addRange`（quirk #6 程序化路径会被推）
- `saveCursor` Phase 2 往上走补记父级空 block（#3 修复关键）
- `restoreCursor` 跨 div 边界检查（offset 相同时区分不同行）

### Fixed
- Backspace/Delete 在格式化元素内不再拆格式（#2）：删标记字符走自然路径
- Enter 后光标不跳回上一行（#3）：`sel.collapse` + Phase 2 trail
- N 模式 scanner 限 NOTE 行（不格式化标题/标签/时间）
- 编辑器不抢焦点：失焦时跳过 `saveCursor`/`restoreCursor`

## [0.7.11] - 2026-07-14

### Added
- `utils/cursor.js`：光标位置保存/恢复独立模块，`{offset, trail}` 数据格式
- `normalizeBlocks`：扫描后将裸文本节点包 `<div>`，消除 WebView2 光标边界推送
- 光标诊断日志（`_walk` 输出 DOM 树+光标位置）
- `docs/webview2-contenteditable-quirks.md`：6 条浏览器怪异行为记录

### Changed
- T/N 模式 Enter 统一处理：全部创建 `<div>` 而非依赖浏览器
- Backspace/Delete 在 EditMarkdown 元素内：escape 删除，其他展开
- 空元素清除后补 `<br>` 防止浏览器合并
- `placeAt` 拦截 root 光标，`saveCursor` 拦截 root 光标和元素边界推送
- `restoreCursor` 边界逻辑：仅下一文本为空时才取后

### Fixed
- 方向键移动后 Backspace 光标跳行
- 空列表项 Backspace 后行合并
- `saveCursor` Phase 2 只累加第一个前驱文本（漏了 span）
- N 模式 Enter 不创建 `<div>`（`return` 提前退出）
- `<br>` 日志不闭合

## [0.7.10] - 2026-07-14

### Added
- 编辑器链接语法 `[text](url)` 实时渲染，转义 `\]` / `\)`
- 编辑器列表标记实时渲染：`-` / `*` / `1.` 灰显
- 列表续行：Enter 自动补标记 + 有序编号递增
- 缩进继承：缩进行 Enter 新行带相同缩进
- 有序列表自动重编号：插入/删除项后重新排序
- 行中拆分：列表行中间 Enter 将后半文本带到新列表项
- 时间块备注渲染 b/i/s 颜色区分，code 灰色背景

### Changed
- EditMarkdown 标记/转义色 `#a1afc9` 取代 opacity
- 编辑器加粗/斜体色与时间块渲染统一（#f36838 / #ff7500）
- `setEditorContent`：加载已有内容按行拆 `<div>`，重开编辑框列表正常

### Fixed
- N 模式 `getPlainText` 换行丢失：`cloneNode+innerText` 改为 DOM 遍历插入 `\n`
- 编辑时 Delete/Backspace 误删时间块：`id!=='mNote'` 改为通用可编辑元素检测
- 时间块渲染 `\` 转义无效：`mdInline` 添加 `\x`→实体 处理
- `v-html` 生成元素不受 scoped CSS 影响：bnote 子元素样式全部移至全局 CSS
- Backspace 在 EditMarkdown 元素内部/块首文本位置 1 时跳行

## [0.7.0] - 2026-07-13

### Added
- 自定义轻量 Markdown 编辑器（contenteditable + 状态机扫描器），替代 Milkdown，体积 ~5KB
- 语法高亮：加粗 `**`、斜体 `*`、删除线 `~~`、行内代码 `` ` ``、高光 `==`
- 转义 `\` 支持——`\*` 阻止 markdown 语法匹配
- 标签行内联 hint 补全（N 键第二行自动匹配 + Tab 循环 + 频率记录）
- 光标行居中（打字机模式）+ 缩放补偿
- Tab 行首缩进 + ESC 导航模式 + Shift+Tab 反向焦点
- T/N Markdown 预览/Tab 缩进 设置分离独立控制
- 编辑器字号独立设置
- `EditMarkdown-` 类名前缀，便于自定义 CSS

### Changed
- 删除线改为红色粗线，加粗改为 800
- `getCurrentLineType` 枚举（标题/标签/时间/备注）
- 分隔符从 `tagDelimiters` 设置读取（含空格）

### Fixed
- Tab 焦点切换：编辑器在 tabindex 列表中，Shift+Tab 支持
- onInput 无限循环（inputLock + setTimeout 防重入）
- `\` 转义位置错误、累积、匹配跳过失效
- unwrapFormatting 后 normalize 合并文本节点
- Backspace 一键删除字符+清 hint+重新匹配

## [0.6.12] - 2026-07-09

### Added
- 右键拖拽框选时间块（重叠即选中）
- 左键在时间块中间拖拽可创建新块
- 左键单击空白处取消所有选中
- Ctrl+A 全选当天所有时间块

### Fixed
- 缩放状态下鼠标位置偏差（除以 zoom 修正）
- More 菜单导出备份/导入/立即备份点击无反应

## [0.6.7] - 2026-07-09

### Added
- `n` 创建后自动复制格式化文本到剪贴板（默认开启，可关闭）
- `n` 保存前检查：弹出预览确认框，可滚动查看所有块的时间、标题和标签

### Changed
- 无边框窗口默认开启
- 移除字体大小占位设置项（缩放已覆盖需求）

## [0.6.4] - 2026-07-09

### Added
- 设置面板重构：左侧导航分栏（基础 / 编辑器 / 外观 / 文件）
- 每个设置项和栏目独立恢复默认按钮
- 新增设置项：`n` 保存前检查解析结果
- 备份路径改为失焦确认保存

### Changed
- Checkbox 全部改为 Toggle 滑动开关
- 输入框、下拉栏、滑动条样式统一美化
- 设置面板尺寸适配大屏

### Fixed
- 批量创建仅写一个时间值时作为结束时间而非开始时间

## [0.6.0] - 2026-07-09

### Added
- CHANGELOG.md 按 Keep a Changelog 格式整理全版本历史
- CLAUDE.md 标注发布变更需更新 CHANGELOG.md

### Fixed
- 批量创建仅写一个时间值时作为结束时间处理

## [0.5.16] - 2026-07-08

### Added
- Mango 字体 "Timelog" 替换左上角标题文字
- `t` 键智能默认开始时间：当天取最后块结束时间（不超当前时间），非今天取最后块或 9:00
- 编辑弹窗右上角灰色显示时间跨度（`HH:MM`）
- `n` 批量创建：第二块起省略时间自动接续上一块结束时间
- `n` 批量创建：时间无法推断或异常时标为全天提醒
- `n` 批量创建：支持自定义标签分隔符（设置 → 标签分隔符）
- 编辑弹窗未修改时取消不弹确认框
- 设置项：缩放比例（25%–400%）
- 设置项：自定义字体
- 设置面板关闭时自动提交当前焦点输入框内容

### Fixed
- 时间跨度与 0 取 max，避免负值

### Changed
- `t` 键不再 5 分钟四舍五入，使用精确分钟值

## [0.5.13] - 2026-07-06

### Changed
- MSI 安装器替代 NSIS exe（解决 `.rbf` 残留文件报错）
- CLAUDE.md 更新架构、环境、Gotchas 章节
- README 修正过时技术栈描述

## [0.5.8] - 2026-07-04

### Added
- `n` 键批量创建时间块——格式化文本输入，`---` 分隔多块

### Fixed
- ESC 统一处理——`@keydown.escape.stop` 接管所有弹窗 overlay
- 批量创建解析保留空行结构
- 弹窗关闭后文本框正确重置
- More 下拉菜单并入模态栈
- `focusTopModal` 选择器修正（textarea、disabled button）

### Changed
- 弹窗组件懒加载（`v-if` + immediate watch）

## [0.5.7] - 2026-07-03

### Added
- 编辑框取消按钮弹窗确认，避免误丢编辑内容
- CLAUDE.md 项目文档

### Fixed
- 模态栈入栈/出栈自动聚焦最上层弹窗
- ESC 优先关闭确认弹窗再关底层弹窗
- 取消→确认→再取消焦点正确回到编辑弹窗
- 弹窗按钮顺序统一：保存/确认在左，取消在右
- ESC 优先关闭 More 菜单

### Changed
- `useModal` helper 重构——打开推动态关闭拉，支持任意嵌套弹窗

## [0.5.3] - 2026-07-02

### Added
- 导出备份支持另存为对话框（`tauri-plugin-dialog`）
- 下载安装包 Gitee → GitHub 自动回退
- `beforeBuildCommand` 自动构建前端，防止打包旧版本

### Fixed
- 导出备份走 Tauri fs 写文件，替代被 CORS 拦截的 Blob 下载
- 窗口默认隐藏，状态恢复后再显示，消除启动闪烁

### Changed
- GitHub 更新端点改用 raw 文件
- 移除导出备份的浏览器兼容代码

## [0.5.2] - 2026-07-01

### Added
- 本地版本高于远程时显示幽默文案

### Fixed
- `fetch_latest_json` 走 Rust 端解决 CORS 问题
- `colorOf` 响应式修复——统一从 settings store 读取 blockOpacity
- opacity 对无标签块也生效

### Changed
- Toast 时长从 1.8s 延长到 3s
- 硬编码文案提取到 `STR`
- `APP_VERSION` 常量提取，减少手动更新点

## [0.5.1] - 2026-06-30

### Added
- 自动更新：可关闭、更新前提醒、手动检测
- 下载端点双 URL 回退（Gitee + GitHub raw）

### Fixed
- 更新下载 `Bytes` → `Vec<u8>` 类型转换
- blockOpacity 响应式断裂

## [0.5.0] - 2026-06-29

### Added
- Vue 3 + Vite + Pinia 重构完成，替代旧单文件架构
- 时间轴拖拽创建 / 调整时间块
- 标签系统（分组、自定义颜色、多标签叠加、透明度）
- Markdown 备注（粗体、斜体、删除线、代码、列表、标题）
- 数据管理（导入/导出 JSON、文本导入/导出、日期段删除、自动清理）
- 无边框窗口模式 + 窗口状态记忆
- 全键盘支持（方向键微调、Delete 删除、Ctrl+C/V 复制粘贴跨日期）
- 自动备份（JSON + 天级轮转，最多 4 份）
- 自定义猫爪光标
- 打开自动滚动到当前时间

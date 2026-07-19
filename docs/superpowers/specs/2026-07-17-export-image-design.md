# 导出切图 — Spec

## 触发方式
- 快捷键 `Ctrl+P`（不与现有 `P` 导出文本冲突）
- More 菜单入口，图标 `export-image.svg`

## 弹窗布局
- 宽度 85vw，max-width 1100px，max-height: calc(85vh / var(--zoom, 1))
- **左栏**（360px）：设置区，独立滚动
- **右栏**：Canvas 实时预览区
- 整体 overflow: auto，小屏幕不溢出

## 导出逻辑
- 对当天完整时间轴（0:00–24:00，1440 分钟高度）使用 Canvas 渲染
- 输出格式 PNG
- 保存时弹出系统文件对话框（Tauri save dialog），默认文件名 `timelog-YYYY-MM-DD.png`

## 设置项（四阶段）

所有设置持久化到 `localStorage:timelog:export-image-settings`，下次打开恢复。"时间块显示"与 SettingsPanel 互相独立——日常看和导出图可以不同设置。

### Phase 0 — 时间块显示（折叠容器，默认折叠）
独立于 SettingsPanel 的同名设置，仅影响导出渲染。

| 设置 | 类型 | 默认 |
|------|------|------|
| 显示标题 | checkbox | true |
| 显示时间 | checkbox | true |
| 显示标签 | checkbox | true |
| 显示备注 | checkbox | true |
| 显示左侧颜色条 | checkbox | true |

### Phase 1 — 核心
| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| 背景色 | select: 跟随主题 / 自定义 | 跟随主题 | 自定义时出现颜色选择器 |
| 包含时间标尺 | checkbox | true | 左侧 GUTTER |
| 导出宽度(px) | number | 800 | — |

### Phase 2 — 作者信息（默认关，关时隐藏子选项）
| 设置 | 类型 | 默认 |
|------|------|------|
| 显示作者信息 | checkbox | false |
| 头像 | file (图片) | — |
| 作者名字 | text | — |
| 额外文本 | text | — |
| 对齐方式 | radio: 左/居中/右 | 居中 |
| 显示位置 | radio: 顶部/底部 | 底部 |

### Phase 3 — 水印（默认关，关时隐藏子选项）
| 设置 | 类型 | 默认 |
|------|------|------|
| 启用水印 | checkbox | false |
| 类型 | radio: 文字/图片 | 文字 |
| 文字内容 | text | — |
| 图片 | file | — |
| 透明度 | range (0–100%) | 30% |
| 旋转 | range (-180°–180°) | 0° |
| 宽度(px) | number | 200 |
| 高度(px) | number (0=auto) | 0 |

### 父子可见性规则
- "显示作者信息" = false → 隐藏作者子项
- "启用水印" = false → 隐藏水印子项
- 水印"类型"切换 → 显示对应子设置（文字内容 vs 图片选择）

## 实时预览
- 左栏任何设置改变时，右侧立即重新渲染 Canvas
- 预览宽度适配右栏容器，等比例缩放
- 用 `requestAnimationFrame` 防抖避免密集重绘
- **拖拽画布**：鼠标按住拖动可平移预览
- **滚轮缩放**：在预览区滚轮缩放，以鼠标位置为中心点

## 渲染细节
- 使用离屏 Canvas 渲染完整时间轴
- 时间标尺（可选）、时间块（颜色/标签/透明度按当前设置）、作者信息块（可选）、水印（可选）
- 导出时按设定宽度渲染，高度等比计算

## 文件
- 新组件：`frontend/src/components/ExportImagePanel.vue`
- 图标：`frontend/public/icons/export-image.svg`
- 入口修改：`frontend/src/App.vue`（More 菜单 + Ctrl+P）

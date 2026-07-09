# Settings Panel Redesign

**Date**: 2026-07-09
**Status**: approved

## Goal

Refactor the settings panel from a flat scrolling list into a left-nav + right-content layout with categorized sections, restore-default buttons, and group-level reset.

## Layout

- Left sidebar: 4 navigation items (基础 / 编辑器 / 外观 / 文件)
- Right content area: settings for the selected category
- `onClose()` blur-before-close behavior is retained

## Categories & Items

### 1. 基础 (Basic)

| Item | Control | Implementation |
|------|---------|---------------|
| 当前版本 | `v0.6.0` text + GitHub/Gitee links | read APP_VERSION from constants |
| 检测更新 | button | existing `onCheckUpdate` |
| 自动更新 | toggle | existing `settings.autoUpdate` |
| 语言 | dropdown | placeholder only, disabled |
| 帮助弹窗 | button | click handler empty, placeholder |
| **启动** | (subheading) | |
| 打开时滚到当前时间 | toggle | existing `settings.autoScroll` |

### 2. 编辑器 (Editor)

| Item | Control | Implementation |
|------|---------|---------------|
| **时间块编辑器 (T & 鼠标)** | (subheading) | |
| 默认时长 | number ± | existing `settings.defaultDuration`, rename label |
| Markdown 预览 | toggle | placeholder only, disabled |
| **N 模式创建时间块** | (subheading) | |
| 保存前检查解析结果 | toggle | NEW — defaults to false |
| 标签分隔符 | text input | existing `settings.tagDelimiters` |

### 3. 外观 (Appearance)

| Item | Control | Implementation |
|------|---------|---------------|
| 字体 | text input | existing `settings.fontFamily` |
| 字体大小 | text input | placeholder only, disabled |
| 缩放比例 | range 25%–400% | existing `settings.zoom` |
| 时间块透明度 | range 5–200 | existing `settings.blockOpacity` |
| 无边框窗口 | toggle | existing `settings.borderless` |

### 4. 文件 (Files)

| Item | Control | Implementation |
|------|---------|---------------|
| **导出** | (subheading) | |
| 文件名加时间戳 | toggle | existing `settings.exportTimestamp` |
| 导出保存对话框 | toggle | existing `settings.exportDialog` |
| **备份** | (subheading) | |
| 备份路径 | text + save/reset buttons | existing `settings.bkCustomPath` |
| 启用自动备份 | toggle | existing `settings.backupOn` |
| 只保留 N 天数据 | number input | existing `settings.keepDays` |

## Per-Item UI

- Right side: reset-to-default button (`恢复.svg`), hover tooltip "恢复默认设置"
- Below each item: description text, sourced from `strings.js` (no hardcoded strings)

## Per-Category UI

- Category header row has a "恢复默认" button that resets ALL items in that category

## New Settings

### `n` 保存前检查解析结果 (`checkBeforeCreate`)

- Type: boolean
- Default: false
- Storage key: `timelog:checkBeforeCreate`
- Behavior: when enabled, shows a preview/confirmation dialog before creating blocks from batch input (exact UI TBD later)

## Out of Scope

- Language selector (placeholder only)
- Font size (placeholder only)
- Markdown preview toggle (placeholder only)
- Help button action
- Import section under Files (no settings yet)

## Implementation Notes

- Keep `SettingsPanel.vue` as single file; use CSS to handle left-nav layout (no sub-components unless needed)
- `strings.js` additions for all new labels and descriptions
- Settings store additions for `checkBeforeCreate`
- `恢复.svg` copies to `frontend/public/icons/` alongside existing icons

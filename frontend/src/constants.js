// ---------- Timeline ----------
export const PX_MIN = 1
export const DAY_MIN = 1440
export const EDGE = 6

// ---------- Backup ----------
export const MAX_BACKUP_COUNT = 4
export const DATA_DIR = 'timelog_data'
export const MAIN_NAME = 'timelog.json'

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
export const DEFAULT_BORDERLESS = true
export const DEFAULT_BACKUP_ON = true
export const DEFAULT_AUTO_UPDATE = false
export const DEFAULT_CURSOR_CENTER = true
export const DEFAULT_TAG_DELIMITERS = ','
export const DEFAULT_ZOOM = 100
export const DEFAULT_FONT_FAMILY = ''
export const DEFAULT_CHECK_BEFORE_CREATE = false
export const DEFAULT_COPY_AFTER_CREATE = true
export const DEFAULT_MARKDOWN_PREVIEW = true
export const DEFAULT_BATCH_MARKDOWN_PREVIEW = true
export const DEFAULT_TAB_TO_INDENT = true
export const DEFAULT_BATCH_TAB_TO_INDENT = true
export const DEFAULT_EDITOR_FONT_SIZE = 14
export const DEFAULT_CUSTOM_CSS = ''

// ---------- UI ----------
export const APP_VERSION = 'v0.7.0'
export const TOAST_DURATION = 3000

export function compareSemver(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}
export const GUTTER_WIDTH = 56

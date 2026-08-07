// ---------- Timeline ----------
export const PX_MIN = 1
export const DAY_MIN = 1440
export const DAY_OFFSET = {
  prev: 0,
  today: DAY_MIN,
  next: 2 * DAY_MIN,
};
export const EDGE = 6

// ---------- Time ----------
export const MS_PER_SECOND = 1000
export const SECONDS_PER_MINUTE = 60
export const MIN_PER_HOUR = 60
export const HOURS_PER_DAY = 24
export const DAYS_PER_WEEK = 7
export const HOURS_PER_WEEK = DAYS_PER_WEEK * HOURS_PER_DAY
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE
export const MS_PER_HOUR = MS_PER_MINUTE * MIN_PER_HOUR
export const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR

// ---------- Backup ----------
export const MAX_BACKUP_COUNT = 4
export const DATA_DIR = 'timelog_data'
export const MAIN_NAME = 'timelog.json'
export const EXPORT_ASSETS_DIR = 'export-assets'

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
export const DEFAULT_SHOW_BLOCK_TITLE = true
export const DEFAULT_SHOW_BLOCK_TIME = true
export const DEFAULT_SHOW_BLOCK_TAGS = true
export const DEFAULT_SHOW_BLOCK_NOTE = true
export const DEFAULT_SHOW_BLOCK_COLOR_BAR = true
export const DEFAULT_MASK_BLOCK_OVERFLOW = false
export const DEFAULT_RENDER_NOTE_MARKDOWN = true
export const DEFAULT_END_TIME_AT_NOW = true
export const DEFAULT_MIN_BLOCK_MINUTES = 10

// ---------- UI ----------
export const APP_VERSION = 'v0.10.27'
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
export const EXPORT_DATE_TITLE_H = 36
export const EXPORT_AUTHOR_BLOCK_H = 80

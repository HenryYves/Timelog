import { ref } from 'vue'
import { isTauri, tRead, tWrite, tReadDir, tRemove } from './tauri.js'
import { KEY_PREFIX, MAIN_NAME, DATA_DIR, MAX_BACKUP_COUNT } from '../constants.js'
import { STR } from '../strings.js'
import { logger } from './log.js'
import { useToast } from '../composables/useToast.js'

const { toast } = useToast()

// =============================================
// Reactive state for the backup indicator dot
// =============================================
export const bkStatusText = ref('')
export const bkStatusClass = ref('')

// Internal module state
let saveTimer = null
let cleanTimer = null
let _backupOn = true
let _bkCustomPath = ''
let _keepDays = 0

// =============================================
// Settings sync — called from App.vue on mount
// =============================================
export function setBackupPrefs(opts) {
  if (opts.backupOn !== undefined) _backupOn = opts.backupOn
  if (opts.bkCustomPath !== undefined) _bkCustomPath = opts.bkCustomPath
  if (opts.keepDays !== undefined) _keepDays = opts.keepDays
}

// =============================================
// Backup indicator
// =============================================
export function setBk(text, state) {
  bkStatusText.value = text
  bkStatusClass.value = state || ''
}

// =============================================
// Helpers
// =============================================
function isDayKey(k) {
  if (!k.startsWith(KEY_PREFIX)) return false
  const datePortion = k.slice(KEY_PREFIX.length)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePortion)
}

function dkey(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

// =============================================
// Data serialisation
// =============================================
export function getAllData() {
  const days = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (isDayKey(k)) {
      try {
        const a = JSON.parse(localStorage.getItem(k))
        if (Array.isArray(a) && a.length) days[k.slice(KEY_PREFIX.length)] = a
      } catch (e) { logger.error('backup', 'getAllData parse day failed', e) }
    }
  }
  let tags = []
  try { tags = JSON.parse(localStorage.getItem(KEY_PREFIX + 'tags')) || [] } catch (e) { logger.error('backup', 'getAllData parse tags failed', e) }
  const data = {
    app: 'timelog',
    version: 3,
    updatedAt: new Date().toISOString(),
    tags,
    days,
  }
  // Stats
  try { data.statsCards = JSON.parse(localStorage.getItem('timelog:stats-cards') || 'null') } catch {}
  data.statsTimeRange = localStorage.getItem('timelog:stats-time-range') || null
  data.statsCustomStart = localStorage.getItem('timelog:stats-custom-start') || null
  data.statsCustomEnd = localStorage.getItem('timelog:stats-custom-end') || null
  // Settings
  data.settings = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags' && !isDayKey(k)
      && !k.startsWith('timelog:stats-') && k !== 'timelog:rolloutCache' && k !== 'timelog:skipVersion' && k !== 'timelog:pendingDownload') {
      try { data.settings[k.slice(KEY_PREFIX.length)] = localStorage.getItem(k) } catch {}
    }
  }
  return data
}

function normColor(c) {
  if (!c || !c.trim()) return '#C4C3C0'
  let v = c.trim()
  if (!v.startsWith('#')) v = '#' + v
  if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
  return v.slice(0, 7)
}

export function restoreAllData(data) {
  if (data && data.tags && Array.isArray(data.tags)) {
    localStorage.setItem(KEY_PREFIX + 'tags', JSON.stringify(
      data.tags.map(t => ({ name: t.name, color: normColor(t.color), group: t.group || '' }))
    ))
  }
  if (data && data.days) {
    Object.keys(data.days).forEach(d => {
      if (Array.isArray(data.days[d]) && data.days[d].length) {
        localStorage.setItem(KEY_PREFIX + d, JSON.stringify(data.days[d]))
      }
    })
  }
  // Restore stats
  if (data.statsCards) localStorage.setItem('timelog:stats-cards', JSON.stringify(data.statsCards))
  if (data.statsTimeRange) localStorage.setItem('timelog:stats-time-range', data.statsTimeRange)
  if (data.statsCustomStart) localStorage.setItem('timelog:stats-custom-start', data.statsCustomStart)
  if (data.statsCustomEnd) localStorage.setItem('timelog:stats-custom-end', data.statsCustomEnd)
  // Restore settings
  if (data.settings) {
    Object.entries(data.settings).forEach(([key, val]) => {
      localStorage.setItem(KEY_PREFIX + key, val)
    })
  }
}

// =============================================
// Backup file helpers (prepend DATA_DIR)
// =============================================
function bkPath(name) { return DATA_DIR + '/' + name }

// =============================================
// Tauri backup operations
// =============================================
export async function initBackup() {
  if (!isTauri()) {
    setBk('浏览器模式 · 仅本地', 'warn')
    return
  }
  try {
    const raw = await tRead(bkPath(MAIN_NAME))
    let has = false
    for (let i = 0; i < localStorage.length; i++) {
      if (isDayKey(localStorage.key(i))) { has = true; break }
    }
    if (raw && !has) {
      try {
        restoreAllData(JSON.parse(raw))
        // Notify App.vue so it can reload stores
        window.dispatchEvent(new CustomEvent('backup:restored'))
      } catch (e) { logger.error('backup', 'restore from backup error', e) }
    }
    setBk(_backupOn ? '备份可用 · 自动备份' : '自动备份已关闭', _backupOn ? 'on' : 'warn')
  } catch (e) {
    logger.error('backup', 'initBackup failed', e)
    setBk('备份初始化失败', 'warn')
  }
}

export async function doAutoSave() {
  if (!isTauri() || !_backupOn) return
  try {
    const today = dkey(new Date())
    const last = localStorage.getItem(KEY_PREFIX + 'lastBackupDate')
    if (last && last !== today) {
      const prev = await tRead(bkPath(MAIN_NAME))
      if (prev) {
        await tWrite(bkPath('timelog-backup-' + last + '.json'), prev)
        await rotateBackups()
      }
    }
    localStorage.setItem(KEY_PREFIX + 'lastBackupDate', today)
    await tWrite(bkPath(MAIN_NAME), JSON.stringify(getAllData(), null, 2))
    setBk(
      '已备份 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      'on',
    )
  } catch (e) {
    logger.error('backup', 'doAutoSave failed', e)
    setBk('备份失败', 'warn')
  }
}

export async function rotateBackups() {
  if (!isTauri()) return
  const files = (await tReadDir(DATA_DIR))
    .filter(n => /^timelog-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort()
  while (files.length > MAX_BACKUP_COUNT) {
    await tRemove(bkPath(files.shift()))
  }
}

export function scheduleSave() {
  if (!isTauri() || !_backupOn) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(doAutoSave, 500)
}

export function scheduleClean() {
  if (_keepDays <= 0) return
  clearTimeout(cleanTimer)
  cleanTimer = setTimeout(() => {
    const today = dkey(new Date())
    const last = localStorage.getItem(KEY_PREFIX + 'lastCleanDate')
    if (last === today) return
    localStorage.setItem(KEY_PREFIX + 'lastCleanDate', today)
    cleanOldDays()
  }, 500)
}

export function cleanOldDays() {
  if (_keepDays <= 0) return
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (isDayKey(k)) keys.push(k.slice(KEY_PREFIX.length))
  }
  keys.sort().reverse()
  if (keys.length <= _keepDays) return
  const toDel = keys.slice(_keepDays)
  toDel.forEach(d => localStorage.removeItem(KEY_PREFIX + d))
}

// =============================================
// Migration — handle custom backup path
// Uses raw invoke for cross-directory file ops
// =============================================
export async function migrateBackups(oldPath, newPath) {
  const T = window.__TAURI__
  const hasInvoke = !!(T && T.core && T.core.invoke)
  if (!hasInvoke || !oldPath || oldPath === newPath) return
  try {
    const oldDir = oldPath.replace(/\\/g, '/')
    const entries = await T.core.invoke('plugin:fs|read_dir', { path: oldDir, options: {} })
      .catch(() => [])
    const bks = entries.map(e => e.name)
      .filter(n => /^timelog-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    if (!bks.length) return
    const nd = (newPath || '').replace(/\\/g, '/')
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    for (const f of bks) {
      const arr = await T.core.invoke('plugin:fs|read_text_file', {
        path: oldDir + '/' + f, options: {},
      })
      const text = dec.decode(
        arr instanceof ArrayBuffer ? new Uint8Array(arr) : Uint8Array.from(arr),
      )
      if (nd) {
        await T.core.invoke('plugin:fs|mkdir', { path: nd, options: { recursive: true } })
        await T.core.invoke('plugin:fs|write_text_file', enc.encode(text), {
          headers: { path: encodeURIComponent(nd + '/' + f), options: '{}' },
        })
      } else {
        // Default location: AppData/timelog-data/
        const AD = 14
        await T.core.invoke('plugin:fs|write_text_file', enc.encode(text), {
          headers: {
            path: encodeURIComponent(DATA_DIR + '/' + f),
            options: JSON.stringify({ baseDir: AD }),
          },
        })
      }
      await T.core.invoke('plugin:fs|remove', { path: oldDir + '/' + f, options: {} })
    }
    toast(STR.toast.backupMigrated(bks.length))
  } catch (e) {
    logger.error('backup', 'migrateBackups failed', e)
  }
}

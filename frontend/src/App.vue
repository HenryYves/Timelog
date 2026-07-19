<template>
  <div id="app-container">
    <header @mousedown="onHeaderMouseDown">
      <h1><img src="/icons/icon.svg" class="logo" alt=""><img src="/icons/timelog.svg" class="logo-text" alt="Timelog"></h1>
      <div class="datenav">
        <button class="icon" @click="store.goPrevDay()">‹</button>
        <span class="date">{{ dateLabel }}</span>
        <button class="icon" @click="store.goNextDay()">›</button>
        <button @click="store.goToday()">今天</button>
      </div>
      <span class="spacer"></span>
      <span class="version">{{ APP_VERSION }}</span>
      <div class="more-wrap">
        <button class="more-btn" id="moreBtn" title="更多" @click="showMore = !showMore"><img src="/icons/more.svg" alt="更多"></button>
        <div class="dropdown" :class="{ open: showMore }" @keydown.escape.stop="showMore = false">
          <button class="dropdown-item" @click="showStats = true; showMore = false"><img src="/icons/stats.svg" alt="">统计</button>
          <button class="dropdown-item" @click="showSettings = true; showMore = false"><img src="/icons/settings.svg" alt="">设置</button>
          <button class="dropdown-item" @click="showTagMgr = true; showMore = false"><img src="/icons/tag.svg" alt="">标签</button>
          <button class="dropdown-item" @click="showExport = true; exportMode = 'import'; showMore = false"><img src="/icons/text-import.svg" alt="">文本导入</button>
          <button class="dropdown-item" @click="doImport(); showMore = false"><img src="/icons/import.svg" alt="">导入</button>
          <button class="dropdown-item" @click="showExport = true; exportMode = 'json-export'; showMore = false"><img src="/icons/export.svg" alt="">导出备份</button>
          <button class="dropdown-item" @click="showDataMgr = true; showMore = false"><img src="/icons/data.svg" alt="">管理数据</button>
          <button class="dropdown-item" @click="doBackupNow(); showMore = false"><img src="/icons/backup.svg" alt="">立即备份<span class="dot" :class="bkStatusClass"></span></button>
          <div style="font-size:11px;color:var(--text2);padding:4px 12px 2px;">{{ bkStatusText }}</div>
        </div>
      </div>
<button id="exportBtn" class="primary" @click="showMore = false; showExport = true; exportMode = 'export'">导出文本</button>
      <span class="win-ctrls" :class="{ on: winCtrlActive }" id="winCtrls">
        <button class="win-btn" id="winMin" title="最小化" @click="onWinMin"><img src="/icons/win-min.svg" alt=""></button>
        <button class="win-btn" id="winMax" :title="isMaximized ? '还原' : '最大化'" @click="onWinMax"><img :src="isMaximized ? '/icons/win-restore.svg' : '/icons/win-max.svg'" alt=""></button>
        <button class="win-btn close" id="winClose" title="关闭" @click="onWinClose"><img src="/icons/win-close.svg" alt=""></button>
      </span>
    </header>
    <div class="hint">拖动时间轴创建记录，右键多选，<kbd>?</kbd> 查看操作指南</div>
    <main id="scroller">
      <Timeline
        :modal-open="showModal"
        @edit-block="onEditBlock"
        @create-block="onCreateBlock"
      />
    </main>
    <EditModal
      v-if="showModal"
      :show="showModal"
      :editing-block="editingBlock"
      :create-times="createTimes"
      @close="closeModal"
      @manage-tags="onManageTags"
    />
    <SettingsPanel
      v-if="showSettings"
      :show="showSettings"
      @close="showSettings = false"
      @check-update-result="onCheckUpdateResult"
    />
    <ExportPanel
      v-if="showExport"
      :show="showExport"
      :mode="exportMode"
      :json-import-data="jsonImportData"
      @close="showExport = false; jsonImportData = null"
      @export-json="onExportJson"
    />
    <TagManager
      v-if="showTagMgr"
      :show="showTagMgr"
      @close="showTagMgr = false"
      @saved="onTagMgrSaved"
    />
    <DataManager
      v-if="showDataMgr"
      :show="showDataMgr"
      @close="showDataMgr = false"
      @changed="onDataMgrChanged"
    />

    <!-- Global UI -->
    <Toast />
    <ConfirmDialog
      :show="confirmVisible"
      :message="confirmMessage"
      :type="confirmType"
      @close="resolveConfirm(false)"
      @confirm="resolveConfirm(true)"
    />
    <HelpPanel
      v-if="showHelp"
      :show="showHelp"
      @close="showHelp = false"
    />
    <UpdateDialog
      v-if="showUpdate"
      :show="showUpdate"
      :update-info="updateInfo"
      @close="showUpdate = false"
      @will-install-on-exit="onWillInstallOnExit"
    />
    <BatchCreatePanel
      v-if="showBatchCreate"
      :show="showBatchCreate"
      @close="showBatchCreate = false"
    />
    <StatsPanel
      v-if="showStats"
      :show="showStats"
      @close="showStats = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onErrorCaptured, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { tExport } from './utils/tauri.js'
import { save } from '@tauri-apps/plugin-dialog'
import { useTimelogStore, dkey, storeUndo } from './store/timelog.js'
import { useSettingsStore } from './store/settings.js'
import { useTagStore } from './store/tags.js'
import { APP_VERSION, compareSemver } from './constants.js'
import { STR } from './strings.js'
import {
  bkStatusText, bkStatusClass, setBackupPrefs,
  initBackup, scheduleSave, scheduleClean, doAutoSave,
} from './utils/backup.js'
import Timeline from './components/Timeline.vue'
import EditModal from './components/EditModal.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ExportPanel from './components/ExportPanel.vue'
import TagManager from './components/TagManager.vue'
import DataManager from './components/DataManager.vue'
import Toast from './components/Toast.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import HelpPanel from './components/HelpPanel.vue'
import UpdateDialog from './components/UpdateDialog.vue'
import BatchCreatePanel from './components/BatchCreatePanel.vue'
import StatsPanel from './components/StatsPanel.vue'
import { useToast } from './composables/useToast.js'
import { useConfirm } from './composables/useConfirm.js'
import { logger } from './utils/log.js'

const store = useTimelogStore()
const settings = useSettingsStore()
const tagStore = useTagStore()

const { toast } = useToast()
const { confirmVisible, confirmMessage, confirmType, resolveConfirm } = useConfirm()

const exportMode = ref('export')

// More dropdown
const showMore = ref(false)
const showMoreClose = useModal(showMore)

function closeMore(e) { if (!e.target.closest('.more-wrap')) showMore.value = false }

// ── Rollout gate ──

async function fetchLatestJson() {
  try {
    const result = await invoke('fetch_latest_json')
    return result || null
  } catch {
    return null
  }
}

function isRolloutAllowed(version, rollout) {
  // null/undefined/>=100 → full push
  if (rollout == null || rollout >= 100) {
    localStorage.removeItem('timelog:rolloutCache')
    return true
  }

  let cache
  try { cache = JSON.parse(localStorage.getItem('timelog:rolloutCache')) } catch {}

  // Recompute if version or threshold changed
  if (!cache || cache.version !== version || cache.threshold !== rollout) {
    cache = {
      version,
      threshold: rollout,
      roll: Math.floor(Math.random() * 100), // 0~99
    }
    localStorage.setItem('timelog:rolloutCache', JSON.stringify(cache))
  }

  return cache.roll < rollout
}

const dateLabel = computed(() => {
  const d = store.curDate
  const wd = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
  return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 ' + wd
})

// ── Modal stack ──
const modalStack = ref([])

function focusTopModal() {
  nextTick(() => {
    const m = document.querySelectorAll('.overlay .modal')
    const top = [...m].filter(el => el.offsetParent !== null).pop()
    top?.querySelector('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')?.focus()
  })
}

function pushModal(close) {
  modalStack.value.push(close)
  focusTopModal()
}

function useModal(showRef, onClose) {
  const close = () => { showRef.value = false; if (onClose) onClose() }
  watch(showRef, (v) => {
    if (v) { pushModal(close) }
    else {
      const i = modalStack.value.lastIndexOf(close)
      if (i !== -1) modalStack.value.splice(i, 1)
      focusTopModal()
    }
  })
  return close
}

// EditModal
const showModal = ref(false)
const editingBlock = ref(null)
const createTimes = ref(null)
const editClose = useModal(showModal, () => { editingBlock.value = null; createTimes.value = null })
function onEditBlock(block) { editingBlock.value = block; createTimes.value = null; showModal.value = true }
function onCreateBlock(start, end) { editingBlock.value = null; createTimes.value = { start, end }; showModal.value = true }
function closeModal() { editClose() }
function onManageTags() { showTagMgr.value = true }

// Tag manager
const showTagMgr = ref(false)
const tagMgrClose = useModal(showTagMgr)
function onTagMgrSaved() { store.loadBlocks() }

// Data manager
const showDataMgr = ref(false)
const dataMgrClose = useModal(showDataMgr)
function onDataMgrChanged() { store.loadBlocks() }

// Settings
const showSettings = ref(false)
const settingsClose = useModal(showSettings)

// Export
const showExport = ref(false)
const jsonImportData = ref(null)
const exportClose = useModal(showExport, () => { jsonImportData.value = null })

// Help
const showHelp = ref(false)
const helpClose = useModal(showHelp)

// Update dialog
const showUpdate = ref(false)
const updateInfo = ref(null)
const updateClose = useModal(showUpdate)

// Batch create panel
const showBatchCreate = ref(false)
const batchCreateClose = useModal(showBatchCreate)
const showStats = ref(false)
const statsClose = useModal(showStats)

// More dropdown actions
function doImport() {
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'application/json,.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.days) {
        toast(STR.confirm.importFileError)
        return
      }
      jsonImportData.value = data
      exportMode.value = 'json-import'
      showExport.value = true
    } catch { toast(STR.toast.importFail) }
  }
  input.click()
}

async function onExportJson(opts) {
  showExport.value = false
  await doExportJson(opts)
}

async function doExportJson(opts = {}) {
  const incDays = opts.days !== false
  const incTags = opts.tags !== false
  const incStats = opts.stats !== false
  const incSettings = opts.settings === true

  let tags = []
  if (incTags) {
    try { tags = JSON.parse(localStorage.getItem('timelog:tags')) || [] } catch {}
  }
  const data = { version: 3, exported: new Date().toISOString(), tags, days: {} }

  // Export days
  if (incDays) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k.startsWith('timelog:') && /^\d{4}-\d{2}-\d{2}$/.test(k.slice(7))) {
        try { data.days[k.slice(7)] = JSON.parse(localStorage.getItem(k)) } catch {}
      }
    }
  }

  // Export stats views
  if (incStats) {
    try { data.statsCards = JSON.parse(localStorage.getItem('timelog:stats-cards') || 'null') } catch {}
    data.statsTimeRange = localStorage.getItem('timelog:stats-time-range') || null
    data.statsCustomStart = localStorage.getItem('timelog:stats-custom-start') || null
    data.statsCustomEnd = localStorage.getItem('timelog:stats-custom-end') || null
  }

  // Export settings
  if (incSettings) {
    const settingsKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('timelog:') && !k.startsWith('timelog:tags') && !/^\d{4}-\d{2}-\d{2}$/.test(k.slice(7))
        && !k.startsWith('timelog:stats-') && k !== 'timelog:rolloutCache' && k !== 'timelog:skipVersion' && k !== 'timelog:pendingDownload') {
        settingsKeys.push(k)
      }
    }
    data.settings = {}
    settingsKeys.forEach(k => {
      try { data.settings[k.slice(8)] = localStorage.getItem(k) } catch {}
    })
  }

  let filename = 'timelog-backup-' + dkey(new Date())
  if (settings.exportTimestamp) {
    const now = new Date()
    filename += '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  }
  filename += '.json'
  const json = JSON.stringify(data, null, 2)
  if (settings.exportDialog) {
    const filePath = await save({
      defaultPath: filename,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!filePath) return // user cancelled
    try {
      await window.__TAURI__.fs.writeTextFile(filePath, json)
      toast('已导出到：' + filePath)
    } catch { toast(STR.toast.backupFail) }
    return
  }
  const ok = await tExport(filename, json)
  if (ok) toast('已导出到下载目录：' + filename)
  else toast(STR.toast.backupFail)
}

async function doBackupNow() {
  const T = window.__TAURI__
  if (!T) {
    toast(STR.toast.backupTauriOnly)
    return
  }
  try {
    await doAutoSave()
    toast(STR.toast.backupOk)
  } catch { toast(STR.toast.backupFail) }
}

// Window controls
const winCtrlActive = ref(settings.borderless)
const isMaximized = ref(false)

// Check if Tauri is available
function isTauri() {
  const T = window.__TAURI__
  return !!(T && T.core && T.core.invoke)
}

// Window control handlers
function onWinMin() {
  if (!isTauri()) return
  try {
    window.__TAURI__.window.getCurrentWindow().minimize()
  } catch (e) {
    console.error('minimize failed:', e.message)
  }
}

function onWinMax() {
  if (!isTauri()) return
  try {
    window.__TAURI__.window.getCurrentWindow().toggleMaximize()
    isMaximized.value = !isMaximized.value
  } catch (e) {
    console.error('toggleMaximize failed:', e.message)
  }
}

function onWinClose() {
  if (isTauri()) {
    try {
      window.__TAURI__.window.getCurrentWindow().close()
    } catch (e) {
      console.error('close failed:', e.message)
    }
  } else {
    window.close()
  }
}

// Tauri header drag
function onHeaderMouseDown(e) {
  if (!isTauri()) return
  const t = e.target
  if (t.closest('button,input,select,textarea,.dropdown-item,.win-btn,.logo')) return
  try {
    window.__TAURI__.window.getCurrentWindow().startDragging()
  } catch (e) {
    console.error('startDragging failed:', e.message)
  }
}

// Apply borderless on mount
function applyBorderless() {
  const val = settings.borderless
  winCtrlActive.value = val
  const el = document.getElementById('winCtrls')
  if (el) {
    if (val) {
      el.classList.add('on')
      document.body.classList.add('borderless')
    } else {
      el.classList.remove('on')
      document.body.classList.remove('borderless')
    }
  }
  if (isTauri()) {
    try {
      window.__TAURI__.window.getCurrentWindow().setDecorations(!val)
    } catch (e) {
      console.error('setDecorations failed:', e.message)
    }
  }
}

// Global keyboard shortcuts (overlay close, modal delete, T, ?)
function onWindowKeyDown(e) {
  // Escape: close topmost visible overlay / clear selection
  if (e.key === 'Escape') {
    if (confirmVisible.value) { e.preventDefault(); resolveConfirm(false); return }
    if (modalStack.value.length > 0) { e.preventDefault(); modalStack.value.pop()(); return }
    return
  }

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z — store undo/redo (editor handles its own)
  if (e.ctrlKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
    const el = document.activeElement
    if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return // editor handles it
    e.preventDefault()
    if (e.key === 'z' || e.key === 'Z') {
      if (e.shiftKey) storeUndo.redo()
      else storeUndo.undo()
    } else {
      storeUndo.redo()
    }
    return
  }

  // Delete/Backspace when modal is open and editing a block: delete the block
  // 排除聚焦在输入框或编辑器的情况——用户正在打字，不应删除
  if ((e.key === 'Delete' || e.key === 'Backspace') && showModal.value && editingBlock.value && document.activeElement && !document.activeElement.isContentEditable && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault()
    store.deleteBlock(editingBlock.value.id)
    closeModal()
    return
  }

  // If any modal is open, ignore the rest
  if (modalStack.value.length > 0) return

  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    showStats.value = true
    return
  }
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault()
    showExport.value = true
    exportMode.value = 'export'
    return
  }
  if (e.key === '?' && !showHelp.value) {
    e.preventDefault()
    showHelp.value = true
    return
  }
  if (e.key === 't' || e.key === 'T') {
    e.preventDefault()
    const now = new Date()
    const isToday = dkey(now) === store.dateKey
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const blocks = store.blocks
    let s
    if (blocks.length > 0) {
      const lastEnd = Math.max(...blocks.map(b => b.end))
      s = (isToday && lastEnd > nowMin) ? nowMin : lastEnd
    } else {
      s = isToday ? nowMin : 540
    }
    if (s > 1380) s = 1380
    const duration = settings.defaultDuration
    editingBlock.value = null
    createTimes.value = { start: s, end: Math.min(s + duration, 1440) }
    showModal.value = true
  }
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    showBatchCreate.value = true
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault()
    store.selectAll()
    toast(STR.toast.contextSelected(store.selectedBlocks.size))
  }
}

// Called whenever blocks or tags change — debounced auto-save
function onDataChanged() {
  scheduleSave()
  scheduleClean()
}

// When initBackup restores from file, reload stores
function onBackupRestored() {
  store.loadBlocks()
  tagStore.loadTags()
}

onErrorCaptured((err, instance, info) => {
  logger.error('vue', err.message || String(err), { info, component: instance?.$options?.name })
  // Don't stop propagation — let Pinia/Vue handle it
  return false
})

// ── Auto-update ──
async function checkForUpdate(isManual) {
  try {
    const metadata = await invoke('check_update')
    if (!metadata) {
      if (!isManual) return
      // Manual check: try to tell user why
      const latest = await fetchLatestJson()
      if (latest?.version) {
        const cmp = compareSemver(APP_VERSION, latest.version)
        if (cmp > 0) {
          toast(STR.update.versionAhead)
        } else {
          toast(STR.update.noUpdate)
        }
      } else {
        toast(STR.update.noUpdate)
      }
      return
    }

    // Skip if user skipped this version
    const skipped = localStorage.getItem('timelog:skipVersion')
    if (skipped === metadata.version && !isManual) return

    // Pending download from previous session (crash recovery) → always show
    const pending = localStorage.getItem('timelog:pendingDownload')
    if (pending === metadata.version) {
      updateInfo.value = metadata
      showUpdate.value = true
      return
    }

    // Rollout gate (skip for manual check)
    if (!isManual) {
      const latest = await fetchLatestJson()
      if (!isRolloutAllowed(metadata.version, latest?.rollout)) return
    }

    updateInfo.value = metadata
    showUpdate.value = true
  } catch {
    if (isManual) toast(STR.update.checkFailed)
    // silent fail on startup check
  }
}

function onCheckUpdateResult(metadata) {
  updateInfo.value = metadata
  showUpdate.value = true
}

function onWillInstallOnExit(version) {
  localStorage.setItem('timelog:pendingDownload', version)
  toast(STR.update.willInstallOnExit)
}

onMounted(async () => {
  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('backup:restored', onBackupRestored)
  document.addEventListener('click', closeMore)

  // Backup initialisation
  setBackupPrefs({
    backupOn: settings.backupOn,
    bkCustomPath: settings.bkCustomPath,
    keepDays: settings.keepDays,
  })
  await initBackup()

  // Window decoration
  applyBorderless()

  // Crash recovery: check for pending download
  const pendingVer = localStorage.getItem('timelog:pendingDownload')
  if (pendingVer) {
    // Check if the pending version is still the latest
    try {
      const metadata = await invoke('check_update')
      if (metadata && metadata.version === pendingVer) {
        updateInfo.value = metadata
        showUpdate.value = true
      } else {
        localStorage.removeItem('timelog:pendingDownload')
      }
    } catch {}
  }

  if (settings.autoUpdate) {
    checkForUpdate(false)
  }

  // Watch settings changes that affect backup
  watch(() => settings.backupOn, (v) => setBackupPrefs({ backupOn: v }))
  watch(() => settings.bkCustomPath, (v) => setBackupPrefs({ bkCustomPath: v }))
  watch(() => settings.keepDays, (v) => setBackupPrefs({ keepDays: v }))
  watch(() => settings.borderless, () => applyBorderless())

  // Apply zoom & font
  function applyZoom() {
    const el = document.getElementById('app-container')
    if (!el) return
    const z = settings.zoom / 100
    el.style.transform = `scale(${z})`
    el.style.transformOrigin = '0 0'
    el.style.setProperty('--zoom', z)
    el.style.width = `${100 / z}%`
    el.style.height = `${100 / z}%`
  }
  function applyFontFamily() {
    if (settings.fontFamily) {
      document.body.style.fontFamily = settings.fontFamily + ', -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    } else {
      document.body.style.fontFamily = ''
    }
  }
  applyZoom()
  applyFontFamily()
  watch(() => settings.zoom, applyZoom)
  watch(() => settings.fontFamily, applyFontFamily)

  // When ConfirmDialog closes, return focus to top modal
  watch(confirmVisible, (v) => { if (!v) focusTopModal() })

  // Watch data changes → trigger auto-save / clean
  watch(() => store.blocks, onDataChanged, { deep: true })
  watch(() => tagStore.tags, onDataChanged, { deep: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeyDown)
  window.removeEventListener('backup:restored', onBackupRestored)
  document.removeEventListener('click', closeMore)
})
</script>

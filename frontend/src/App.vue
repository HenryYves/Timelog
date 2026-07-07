<template>
  <div id="app-container">
    <header @mousedown="onHeaderMouseDown">
      <h1><img src="/icons/icon.svg" class="logo" alt="">时间块记录</h1>
      <div class="datenav">
        <button class="icon" @click="store.goPrevDay()">‹</button>
        <span class="date">{{ dateLabel }}</span>
        <button class="icon" @click="store.goNextDay()">›</button>
        <button @click="store.goToday()">今天</button>
      </div>
      <span class="spacer"></span>
      <span class="version">{{ APP_VERSION }}</span>
      <div class="more-wrap">
        <button class="more-btn" id="moreBtn" title="更多" @click.stop="showMore = !showMore"><img src="/icons/more.svg" alt="更多"></button>
        <div class="dropdown" :class="{ open: showMore }">
          <div class="dropdown-item" @click="showSettings = true; showMore = false"><img src="/icons/settings.svg" alt="">设置</div>
          <div class="dropdown-item" @click="showTagMgr = true; showMore = false"><img src="/icons/tag.svg" alt="">标签</div>
          <div class="dropdown-item" @click="showExport = true; exportMode = 'import'; showMore = false"><img src="/icons/text-import.svg" alt="">文本导入</div>
          <div class="dropdown-item" @click="doImport"><img src="/icons/import.svg" alt="">导入</div>
          <div class="dropdown-item" @click="doExportJson"><img src="/icons/export.svg" alt="">导出备份</div>
          <div class="dropdown-item" @click="showDataMgr = true; showMore = false"><img src="/icons/data.svg" alt="">管理数据</div>
          <div class="dropdown-item" @click="doBackupNow"><img src="/icons/backup.svg" alt="">立即备份<span class="dot" :class="bkStatusClass"></span></div>
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
      :show="showModal"
      :editing-block="editingBlock"
      :create-times="createTimes"
      @close="closeModal"
      @manage-tags="onManageTags"
    />
    <SettingsPanel
      :show="showSettings"
      @close="showSettings = false"
      @check-update-result="onCheckUpdateResult"
    />
    <ExportPanel
      :show="showExport"
      :mode="exportMode"
      :json-import-data="jsonImportData"
      @close="showExport = false; jsonImportData = null"
    />
    <TagManager
      :show="showTagMgr"
      @close="showTagMgr = false"
      @saved="onTagMgrSaved"
    />
    <DataManager
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
      :show="showHelp"
      @close="showHelp = false"
    />
    <UpdateDialog
      :show="showUpdate"
      :update-info="updateInfo"
      @close="showUpdate = false"
      @will-install-on-exit="onWillInstallOnExit"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onErrorCaptured } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { tExport } from './utils/tauri.js'
import { save } from '@tauri-apps/plugin-dialog'
import { useTimelogStore, dkey } from './store/timelog.js'
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

// EditModal state
const showModal = ref(false)
const editingBlock = ref(null)
const createTimes = ref(null)

function onEditBlock(block) {
  editingBlock.value = block
  createTimes.value = null
  showModal.value = true
}

function onCreateBlock(start, end) {
  editingBlock.value = null
  createTimes.value = { start, end }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingBlock.value = null
  createTimes.value = null
}

function onManageTags() {
  showTagMgr.value = true
}

// Tag manager state
const showTagMgr = ref(false)
function onTagMgrSaved() {
  store.loadBlocks()
}

// Data manager state
const showDataMgr = ref(false)
function onDataMgrChanged() {
  store.loadBlocks()
}

// Settings state
const showSettings = ref(false)

// Export panel state
const showExport = ref(false)
const jsonImportData = ref(null)

// Help panel state
const showHelp = ref(false)
const showUpdate = ref(false)
const updateInfo = ref(null)

// More dropdown actions
function doImport() {
  showMore.value = false
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

async function doExportJson() {
  showMore.value = false
  let tags = []
  try { tags = JSON.parse(localStorage.getItem('timelog:tags')) || [] } catch {}
  const data = { version: 2, exported: new Date().toISOString(), tags, days: {} }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k.startsWith('timelog:') && /^\d{4}-\d{2}-\d{2}$/.test(k.slice(7))) {
      try { data.days[k.slice(7)] = JSON.parse(localStorage.getItem(k)) } catch {}
    }
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
  showMore.value = false
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
    if (confirmVisible) { e.preventDefault(); resolveConfirm(false); return }
    if (showMore.value) { e.preventDefault(); showMore.value = false; return }
    if (showModal.value) { e.preventDefault(); closeModal(); return }
    if (showUpdate.value) { e.preventDefault(); showUpdate.value = false; return }
    if (showSettings.value) { e.preventDefault(); showSettings.value = false; return }
    if (showExport.value) { e.preventDefault(); showExport.value = false; jsonImportData.value = null; return }
    if (showHelp.value) { e.preventDefault(); showHelp.value = false; return }
    if (showTagMgr.value) { e.preventDefault(); showTagMgr.value = false; return }
    if (showDataMgr.value) { e.preventDefault(); showDataMgr.value = false; return }
    // Not in a modal — let Timeline's handler clear selection
    return
  }

  // Delete/Backspace when modal is open and editing a block: delete the block
  if ((e.key === 'Delete' || e.key === 'Backspace') && showModal.value && editingBlock.value && document.activeElement && document.activeElement.id !== 'mNote') {
    e.preventDefault()
    store.deleteBlock(editingBlock.value.id)
    closeModal()
    return
  }

  // If any modal is open, ignore the rest
  if (showModal.value || showUpdate.value || showSettings.value || showExport.value || showHelp.value || showTagMgr.value || showDataMgr.value) return

  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === '?' && !showHelp.value) {
    e.preventDefault()
    showHelp.value = true
    return
  }
  if (e.key === 't' || e.key === 'T') {
    e.preventDefault()
    const now = new Date()
    let s = dkey(now) === store.dateKey
      ? now.getHours() * 60 + now.getMinutes()
      : 540
    s = Math.round(s / 5) * 5
    if (s > 1380) s = 1380
    const duration = settings.defaultDuration
    editingBlock.value = null
    createTimes.value = { start: s, end: Math.min(s + duration, 1440) }
    showMore.value = false
    showModal.value = true
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
  showMore.value = false
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

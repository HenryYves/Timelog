<template>
  <div id="app-container">
    <header @mousedown="onHeaderMouseDown">
      <img src="/icons/logo.svg" class="logo" alt="">
      <h1>Timelog</h1>
      <div class="datenav">
        <button @click="store.goPrevDay()">‹</button>
        <span class="date">{{ dateLabel }}</span>
        <button @click="store.goNextDay()">›</button>
        <button @click="store.goToday()">今天</button>
      </div>
      <span class="spacer"></span>
      <span class="version">v0.3.0</span>
      <div class="backup" v-if="bkStatusText">
        <span class="dot" :class="bkStatusClass"></span>
        <span>{{ bkStatusText }}</span>
      </div>
      <button class="primary" id="exportBtn" title="导出" @click="showExport = true">导出文本</button>
      <button class="icon" @click="showHelp = true" title="帮助">?</button>
      <button class="icon" title="标签" @click="showTagMgr = true">🏷</button>
      <button class="icon" title="数据管理" @click="showDataMgr = true">📊</button>
      <button class="icon" id="settingsBtn" title="设置" @click="showSettings = true">⚙</button>
      <span class="win-ctrls" :class="{ on: winCtrlActive }" id="winCtrls">
        <button class="win-btn" id="winMin" title="最小化" @click="onWinMin">─</button>
        <button class="win-btn" id="winMax" :title="isMaximized ? '还原' : '最大化'" @click="onWinMax">{{ isMaximized ? '❐' : '□' }}</button>
        <button class="win-btn close" id="winClose" title="关闭" @click="onWinClose">✕</button>
      </span>
    </header>
    <main>
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
    />
    <ExportPanel
      :show="showExport"
      @close="showExport = false"
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onErrorCaptured } from 'vue'
import { useTimelogStore, dkey } from './store/timelog.js'
import { useSettingsStore } from './store/settings.js'
import { useTagStore } from './store/tags.js'
import {
  bkStatusText, bkStatusClass, setBackupPrefs,
  initBackup, scheduleSave, scheduleClean,
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
import { useToast } from './composables/useToast.js'
import { useConfirm } from './composables/useConfirm.js'
import { logger } from './utils/log.js'

const store = useTimelogStore()
const settings = useSettingsStore()
const tagStore = useTagStore()

const { toast } = useToast()
const { confirmVisible, confirmMessage, confirmType, resolveConfirm } = useConfirm()

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

// Help panel state
const showHelp = ref(false)

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

// T key: quick create at current time; ? key: help
function onWindowKeyDown(e) {
  if (showModal.value || showSettings.value || showExport.value || showHelp.value || showTagMgr.value || showDataMgr.value) return
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

onMounted(async () => {
  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('backup:restored', onBackupRestored)

  // Backup initialisation
  setBackupPrefs({
    backupOn: settings.backupOn,
    bkCustomPath: settings.bkCustomPath,
    keepDays: settings.keepDays,
  })
  await initBackup()

  // Window decoration
  applyBorderless()

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
})
</script>

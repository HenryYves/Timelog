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
      <button class="primary" id="exportBtn" title="导出" @click="showExport = true">导出文本</button>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTimelogStore, dkey } from './store/timelog.js'
import { useSettingsStore } from './store/settings.js'
import Timeline from './components/Timeline.vue'
import EditModal from './components/EditModal.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ExportPanel from './components/ExportPanel.vue'

const store = useTimelogStore()
const settings = useSettingsStore()

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
  // Future: open tag manager modal
}

// Settings state
const showSettings = ref(false)

// Export panel state
const showExport = ref(false)

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

// T key: quick create at current time
function onWindowKeyDown(e) {
  if (showModal.value || showSettings.value || showExport.value) return
  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
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

onMounted(() => {
  window.addEventListener('keydown', onWindowKeyDown)
  applyBorderless()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeyDown)
})
</script>

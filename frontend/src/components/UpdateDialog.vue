<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal update-dialog" @keydown="trapFocus">
      <h2>{{ STR.update.title(updateInfo?.version) }}</h2>

      <p v-if="updateInfo?.date" class="update-date">{{ STR.update.published(updateInfo.date) }}</p>

      <div v-if="updateInfo?.body" class="update-body">
        <div class="update-body-label">{{ STR.update.changelog }}</div>
        <div class="update-body-scroll">{{ updateInfo.body }}</div>
      </div>

      <!-- Idle: 4 buttons -->
      <div v-if="phase === 'idle'" class="update-actions">
        <button ref="nowBtn" class="primary" @click="onUpdateNow">{{ STR.update.now }}</button>
        <button @click="onExitUpdate">{{ STR.update.onExit }}</button>
        <button @click="onSkip">{{ STR.update.skip }}</button>
        <button @click="emit('close')">{{ STR.update.dismiss }}</button>
      </div>

      <!-- Downloading -->
      <div v-if="phase === 'downloading'" class="update-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="progress-text">
          {{ formatBytes(downloaded) }}
          <template v-if="contentLength"> / {{ formatBytes(contentLength) }}</template>
          ({{ progressPct }}%)
        </div>
        <button @click="onCancel">{{ STR.update.cancel }}</button>
      </div>

      <!-- Installing -->
      <div v-if="phase === 'installing'" class="update-progress">
        <div class="progress-bar infinite"><div class="progress-fill-indeterminate"></div></div>
        <div class="progress-text">{{ STR.update.installing }}</div>
      </div>

      <!-- Done -->
      <div v-if="phase === 'done'" class="update-done">
        <p>{{ STR.update.done }}</p>
        <button @click="emit('close')" style="margin-top: 12px">{{ STR.btn.close }}</button>
      </div>

      <!-- Error -->
      <div v-if="phase === 'error'" class="update-error">
        <p>{{ errorMessage }}</p>
        <button @click="onRetry">{{ STR.update.retry }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Channel } from '@tauri-apps/api/core'
import { STR } from '../strings.js'

const props = defineProps({
  show: Boolean,
  updateInfo: Object, // { version, currentVersion, body, date } | null
})
const emit = defineEmits(['close', 'willInstallOnExit'])  // willInstallOnExit emits version string

const phase = ref('idle') // 'idle' | 'downloading' | 'installing' | 'done' | 'error'
const downloaded = ref(0)
const contentLength = ref(null)
const errorMessage = ref('')
const nowBtn = ref(null)
let cancelFlag = false
let isDownloading = false

const progressPct = computed(() => {
  if (!contentLength.value || contentLength.value === 0) return 0
  return Math.min(Math.round((downloaded.value / contentLength.value) * 100), 100)
})

function formatBytes(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB'
  return n + ' B'
}

watch(() => props.show, (val) => {
  if (val) { setTimeout(() => nowBtn.value?.focus(), 50) }
}, { immediate: true })

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll('button:not([disabled])')
  const visible = [...focusable].filter(el => el.offsetParent !== null)
  if (!visible.length) { e.preventDefault(); return }
  const idx = visible.indexOf(document.activeElement)
  if (e.shiftKey) {
    e.preventDefault()
    visible[idx <= 0 ? visible.length - 1 : idx - 1].focus()
  } else {
    e.preventDefault()
    visible[idx === -1 || idx >= visible.length - 1 ? 0 : idx + 1].focus()
  }
}

async function startDownload() {
  if (isDownloading) return false
  phase.value = 'downloading'
  downloaded.value = 0
  contentLength.value = null
  cancelFlag = false
  isDownloading = true

  try {
    const channel = new Channel()
    channel.onmessage = (msg) => {
      if (cancelFlag) return
      if (msg.event === 'started') {
        contentLength.value = msg.data.contentLength
      } else if (msg.event === 'progress') {
        downloaded.value += msg.data.chunkLength
      } else if (msg.event === 'finished') {
        // download complete, handled by the await below
      }
    }

    await invoke('download_update', { onEvent: channel })

    if (cancelFlag) return

    // Download succeeded
    return true
  } catch (e) {
    if (cancelFlag) return false
    phase.value = 'error'
    errorMessage.value = `${STR.update.downloadFailed}：${e?.message || String(e)}`
    return false
  } finally {
    isDownloading = false
  }
}

async function onUpdateNow() {
  const ok = await startDownload()
  if (!ok) return

  // Install
  phase.value = 'installing'
  try {
    await invoke('install_update')
    // install_update calls app.restart() on success, so we won't reach here
    phase.value = 'done'
  } catch (e) {
    phase.value = 'error'
    errorMessage.value = `${STR.update.installFailed}：${e?.message || String(e)}`
  }
}

async function onExitUpdate() {
  const ok = await startDownload()
  if (!ok) return

  emit('willInstallOnExit', props.updateInfo?.version)
  emit('close')
}

function onSkip() {
  if (props.updateInfo?.version) {
    localStorage.setItem('timelog:skipVersion', props.updateInfo.version)
  }
  emit('close')
}

function onCancel() {
  cancelFlag = true
  phase.value = 'idle'
}

function onRetry() {
  phase.value = 'idle'
}
</script>

<style scoped>
.update-dialog { max-width: 420px; }
.update-date { color: var(--text2); font-size: 13px; margin: 4px 0 12px; }
.update-body { margin-bottom: 16px; }
.update-body-label { font-weight: 600; margin-bottom: 6px; }
.update-body-scroll {
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text1);
  background: var(--bg2);
  border-radius: 6px;
  padding: 10px 12px;
}
.update-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.update-actions button { font-size: 13px; }

.update-progress { margin-top: 12px; }
.progress-bar {
  width: 100%; height: 8px; background: var(--bg2); border-radius: 4px;
  overflow: hidden; margin-bottom: 8px;
}
.progress-fill {
  height: 100%; background: var(--accent); border-radius: 4px;
  transition: width 0.1s ease;
}
.progress-fill-indeterminate {
  height: 100%; width: 30%; background: var(--accent); border-radius: 4px;
  animation: progress-slide 1.2s ease-in-out infinite;
}
@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(430%); }
}
.progress-text { font-size: 13px; color: var(--text2); margin-bottom: 10px; }
.update-error p { color: var(--red, #e74c3c); margin: 10px 0; font-size: 13px; }
.update-done p { font-size: 14px; text-align: center; padding: 16px 0; }
</style>

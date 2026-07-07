<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')">
    <div class="modal" @keydown="trapFocus">
      <h2>设置</h2>

      <label>默认时长（分钟）</label>
      <input type="number" id="setDuration" min="1" max="1440" style="width:80px;"
        :value="settings.defaultDuration"
        @change="onDurationChange">
      <div class="small">按 <kbd>T</kbd> 键快速创建时默认时间块长度</div>

      <div class="divider"></div>

      <label class="switchrow">
        <input type="checkbox" id="setAutoScroll"
          :checked="settings.autoScroll"
          @change="settings.setAutoScroll(($event.target).checked)">
        <span>打开时滚到当前时间</span>
      </label>

      <div class="divider"></div>
      <label style="margin-bottom:4px;">导出</label>

      <label class="switchrow">
        <input type="checkbox" id="setExportTimestamp"
          :checked="settings.exportTimestamp"
          @change="settings.setExportTimestamp(($event.target).checked)">
        <span>文件名加时间戳</span>
      </label>
      <div class="small">例：timelog-backup-2026-07-04-1730.json</div>

      <label class="switchrow">
        <input type="checkbox" id="setExportDialog"
          :checked="settings.exportDialog"
          @change="settings.setExportDialog(($event.target).checked)">
        <span>导出时弹出保存对话框</span>
      </label>

      <div class="divider"></div>

      <label>
        时间块透明度
        <span style="font-weight:400;color:var(--text2);">{{ settings.blockOpacity }}%</span>
      </label>
      <input type="range" id="setOpacity" min="5" max="200"
        :value="settings.blockOpacity"
        @input="onOpacityInput"
        style="width:100%;margin-top:4px;">

      <label>备份路径</label>
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
        <input type="text" id="bkPathInput"
          :value="bkPathDraft"
          @input="bkPathDraft = $event.target.value"
          placeholder="默认（AppData）"
          style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;"
          :title="bkPathDraft">
        <button type="button" style="flex:none;font-size:12px;" @click="onBkPathSave">保存</button>
        <button type="button" style="flex:none;font-size:12px;" @click="onBkPathReset">恢复默认</button>
      </div>
      <div class="small">输入绝对路径，留空则使用 AppData</div>

      <div class="divider"></div>

      <label class="switchrow">
        <input type="checkbox" id="setBorderless"
          :checked="settings.borderless"
          @change="onBorderlessChange">
        <span>无边框窗口</span>
      </label>
      <div class="small">启用后隐藏原生标题栏，顶部右侧显示窗口控制按钮</div>

      <div class="divider"></div>

      <label class="switchrow">
        <input type="checkbox" id="setBackup"
          :checked="settings.backupOn"
          @change="settings.setBackupOn(($event.target).checked)">
        <span>启用自动备份（Tauri）</span>
      </label>
      <div class="small">关闭后不再自动写入备份文件，避免数据量大时影响性能；你仍可随时点「立即备份」手动保存。</div>

      <div class="divider"></div>
      <label>备份策略</label>
      <div class="small">每天首次操作时，会把当前数据快照存为上一次日期的备份（timelog-backup-日期.json）；最多保留 4 个，超出自动删除最早的。</div>
      <div class="divider"></div>
      <label>只保留最近 N 天数据</label>
      <input type="number" id="setKeepDays" min="0" max="3650" style="width:80px;" placeholder="0"
        :value="settings.keepDays"
        @change="onKeepDaysChange">
      <div class="small">0 = 保留全部；设 7 则每天首次操作时自动删掉第 8 个及更早有数据的天，仅保留最近 7 个有数据的天。</div>

      <div class="divider"></div>

      <label class="switchrow">
        <input type="checkbox" id="setAutoUpdate"
          :checked="settings.autoUpdate"
          @change="settings.setAutoUpdate(($event.target).checked)">
        <span>自动更新</span>
      </label>
      <div class="small">启动时自动检查更新（默认关闭）</div>

      <div style="margin-top:8px;">
        <button type="button" id="checkUpdateBtn" @click="onCheckUpdate" :disabled="checkingUpdate">
          {{ checkingUpdate ? '检查中...' : '检查更新' }}
        </button>
      </div>

      <div class="actions"><span class="spacer"></span><button type="button" id="setClose" @click="emit('close')">关闭</button></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../store/settings.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useToast } from '../composables/useToast.js'
import { migrateBackups } from '../utils/backup.js'
import { APP_VERSION, compareSemver } from '../constants.js'
import { STR } from '../strings.js'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close', 'checkUpdateResult'])

const settings = useSettingsStore()
const { showConfirm } = useConfirm()
const { toast } = useToast()

const checkingUpdate = ref(false)

const bkPathDraft = ref(settings.bkCustomPath)

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
  )
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

watch(() => props.show, (val) => {
  if (val) {
    bkPathDraft.value = settings.bkCustomPath
  }
})

// Track maximize state for restore/maximize toggle
let winMaxed = false

function onDurationChange(e) {
  settings.setDuration(e.target.value)
  e.target.value = settings.defaultDuration
}

function onOpacityInput(e) {
  settings.setBlockOpacity(e.target.value)
}

function onBorderlessChange(e) {
  settings.setBorderless(e.target.checked)
  applyBorderless(e.target.checked)
}

function onKeepDaysChange(e) {
  settings.setKeepDays(e.target.value)
  e.target.value = settings.keepDays
}

function applyBorderless(val) {
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
  const T = window.__TAURI__
  if (T && T.window && T.window.getCurrentWindow) {
    try {
      T.window.getCurrentWindow().setDecorations(!val)
    } catch (e) {
      console.error('setDecorations failed:', e.message)
    }
  }
}

async function onBkPathSave() {
  const np = bkPathDraft.value.trim()
  if (np === settings.bkCustomPath) return
  const old = settings.bkCustomPath
  settings.setBkCustomPath(np)
  bkPathDraft.value = settings.bkCustomPath
  await migrateBackups(old, np)
}

async function onBkPathReset() {
  if (!settings.bkCustomPath) return
  const ok = await showConfirm(STR.confirm.backupPathReset)
  if (!ok) return
  const old = settings.bkCustomPath
  settings.setBkCustomPath('')
  bkPathDraft.value = ''
  await migrateBackups(old, '')
}

async function onCheckUpdate() {
  checkingUpdate.value = true
  try {
    const metadata = await invoke('check_update')
    if (metadata) {
      emit('checkUpdateResult', metadata)
    } else {
      // Check if local version is higher than remote
      const latest = await invoke('fetch_latest_json')
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
    }
  } catch (e) {
    toast(STR.update.checkFailed)
  } finally {
    checkingUpdate.value = false
  }
}
</script>

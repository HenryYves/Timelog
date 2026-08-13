<template>
  <div v-if="show" class="overlay" @mousedown.self="onClose" @keydown.escape.stop="onClose">
    <div class="modal settings-modal" ref="modalEl" @keydown="trapFocus">
      <h2>{{ STR.settings.title }}</h2>

      <div class="settings-layout">
        <!-- Left nav -->
        <nav class="settings-nav">
          <button v-for="tab in tabs" :key="tab.key"
            class="snav-item" :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >{{ tab.label }}</button>
        </nav>

        <!-- Right content -->
        <div class="settings-content">

          <BasicTab v-show="activeTab === 'basic'" @check-update-result="emit('checkUpdateResult', $event)" />

          <EditorTab v-show="activeTab === 'editor'" />

          <AppearanceTab v-show="activeTab === 'appearance'" />

          <!-- ═══════ 文件 ═══════ -->
          <div v-show="activeTab === 'files'">
            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.sectionExport }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('export')">
                <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
              </button>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.exportTimestamp }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.exportTimestamp" @change="settings.setExportTimestamp($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setExportTimestamp(DEFAULT_EXPORT_TIMESTAMP)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descExportTimestamp }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.exportDialog }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.exportDialog" @change="settings.setExportDialog($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setExportDialog(DEFAULT_EXPORT_DIALOG)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descExportDialog }}</div>
            </div>

            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.sectionBackup }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('backup')">
                <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
              </button>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.backupPath }}</label>
                <div>
                  <input type="text" :value="bkPathDraft" @input="bkPathDraft = $event.target.value" @change="onBkPathBlur" :placeholder="STR.settings.placeholderBackupPath" style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;" :title="bkPathDraft">
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="onBkPathReset">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descBackupPath }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.backupOn }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.backupOn" @change="settings.setBackupOn($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBackupOn(DEFAULT_BACKUP_ON)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descBackupOn }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.keepDays }}</label>
                <div>
                  <input type="number" min="0" max="3650" style="width:80px;" placeholder="0" :value="settings.keepDays" @change="onKeepDaysChange">
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setKeepDays(DEFAULT_KEEP_DAYS)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descKeepDays }}</div>
            </div>
          </div>

          <!-- ═══════ 开发者 ═══════ -->
          <div v-show="activeTab === 'dev'">
            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.navDev }}</h4>
            </div>

            <div class="sub-head">{{ STR.settings.sectionSkin }}</div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.reinstallSkin }}</label>
                <div>
                  <button type="button" class="small-btn" @click="reinstallSkin">{{ STR.settings.reinstallSkin }}</button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descReinstallSkin }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.devTools }}</label>
                <div>
                  <button type="button" class="small-btn" @click="openDevTools">{{ STR.settings.devTools }}</button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descDevTools }}</div>
            </div>
          </div>

        </div>
      </div>

      <div class="actions"><span class="spacer"></span><button type="button" id="setClose" @click="onClose">{{ STR.btn.close }}</button></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../store/settings.js'
import { useConfirm } from '../composables/useConfirm.js'
import { migrateBackups } from '../utils/backup.js'
import {
  DEFAULT_KEEP_DAYS,
  DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG,
  DEFAULT_BACKUP_ON,
} from '../constants.js'
import { STR } from '../strings.js'
import BasicTab from './settings/BasicTab.vue'
import EditorTab from './settings/EditorTab.vue'
import AppearanceTab from './settings/AppearanceTab.vue'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close', 'checkUpdateResult'])

const settings = useSettingsStore()
const { showConfirm } = useConfirm()

const modalEl = ref(null)

const bkPathDraft = ref(settings.bkCustomPath)

async function openDevTools() {
  try { await invoke('open_devtools') } catch { /* 非 Tauri 环境 */ }
}

async function reinstallSkin() {
  localStorage.removeItem('timelog:skinInstalled')
  const skinDir = settings.skinPath || (await invoke('get_default_asset_dir')) + '\\skins'
  const { installSkinTemplates, injectSkinStyle, reloadSkinStyle } = await import('../utils/skin.js')
  await installSkinTemplates(skinDir)
  if (settings.activeSkin) { await injectSkinStyle(skinDir, settings.activeSkin) }
}

const activeTab = ref('basic')
const tabs = [
  { key: 'basic', label: STR.settings.navBasic },
  { key: 'editor', label: STR.settings.navEditor },
  { key: 'appearance', label: STR.settings.navAppearance },
  { key: 'files', label: STR.settings.navFiles },
  { key: 'dev', label: STR.settings.navDev },
]

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
}, { immediate: true })

function onKeepDaysChange(e) {
  settings.setKeepDays(e.target.value)
  e.target.value = settings.keepDays
}

async function onBkPathBlur() {
  const np = bkPathDraft.value.trim()
  if (np === settings.bkCustomPath) return
  const ok = await showConfirm(`将备份路径改为 "${np}" 并迁移已有备份？`)
  if (!ok) return
  const old = settings.bkCustomPath
  settings.setBkCustomPath(np)
  bkPathDraft.value = settings.bkCustomPath
  await migrateBackups(old, np)
}

async function onBkPathReset() {
  if (!settings.bkCustomPath) return
  const ok = await showConfirm(STR.confirm.backupPathReset)
  if (!ok) {
    const first = modalEl.value?.querySelector('button, input:not([disabled])')
    if (first) first.focus()
    return
  }
  const old = settings.bkCustomPath
  settings.setBkCustomPath('')
  bkPathDraft.value = ''
  await migrateBackups(old, '')
}

function onClose() {
  if (document.activeElement?.tagName === 'INPUT') document.activeElement.blur()
  emit('close')
}

function resetCategory(cat) {
  switch (cat) {
    case 'export':
      settings.setExportTimestamp(DEFAULT_EXPORT_TIMESTAMP)
      settings.setExportDialog(DEFAULT_EXPORT_DIALOG)
      break
    case 'backup':
      // Note: unlike onBkPathReset, this does not call migrateBackups() or show confirmation.
      // Category reset is meant as a quick bulk restore; per-item reset handles migration.
      settings.setBkCustomPath('')
      bkPathDraft.value = ''
      settings.setBackupOn(DEFAULT_BACKUP_ON)
      settings.setKeepDays(DEFAULT_KEEP_DAYS)
      break
  }
}
</script>

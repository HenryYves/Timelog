<template>
  <div>
    <div class="section-head">
      <h4 class="section-title">{{ STR.settings.sectionExport }}</h4>
      <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetExport">
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
      <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetBackup">
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
</template>

<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../../store/settings.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { STR } from '../../strings.js'
import { migrateBackups } from '../../utils/backup.js'
import { DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG, DEFAULT_BACKUP_ON, DEFAULT_KEEP_DAYS } from '../../constants.js'

const settings = useSettingsStore()
const { showConfirm } = useConfirm()
const bkPathDraft = ref(settings.bkCustomPath)

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
    const first = document.querySelector('.settings-modal')?.querySelector('button, input:not([disabled])')
    if (first) first.focus()
    return
  }
  const old = settings.bkCustomPath
  settings.setBkCustomPath('')
  bkPathDraft.value = ''
  await migrateBackups(old, '')
}

function onKeepDaysChange(e) {
  settings.setKeepDays(e.target.value)
  e.target.value = settings.keepDays
}

function resetExport() {
  settings.setExportTimestamp(DEFAULT_EXPORT_TIMESTAMP)
  settings.setExportDialog(DEFAULT_EXPORT_DIALOG)
}

function resetBackup() {
  settings.setBkCustomPath('')
  bkPathDraft.value = ''
  settings.setBackupOn(DEFAULT_BACKUP_ON)
  settings.setKeepDays(DEFAULT_KEEP_DAYS)
}
</script>

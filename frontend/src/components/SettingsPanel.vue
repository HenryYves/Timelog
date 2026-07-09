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

          <!-- ═══════ 基础 ═══════ -->
          <div v-show="activeTab === 'basic'">
            <label>{{ STR.settings.version }}</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <code>{{ APP_VERSION }}</code>
              <a href="https://github.com/HenryYves/Timelog" target="_blank" class="small">GitHub</a>
              <a href="https://gitee.com/Henry_Yves/timelog" target="_blank" class="small">Gitee</a>
            </div>

            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.navBasic }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('basic')">
                <img src="/icons/restore.svg" alt="">
              </button>
            </div>

            <div class="row">
              <label>{{ STR.settings.autoUpdate }}</label>
              <div>
                <label class="toggle"><input type="checkbox" :checked="settings.autoUpdate" @change="settings.setAutoUpdate($event.target.checked)"><span class="tk"></span></label>
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setAutoUpdate(DEFAULT_AUTO_UPDATE)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descAutoUpdate }}</div>

            <div class="row">
              <span>{{ STR.settings.checkUpdate }}</span>
              <div>
                <button type="button" @click="onCheckUpdate" :disabled="checkingUpdate" class="small-btn">
                  {{ checkingUpdate ? STR.update.checking : STR.update.checkUpdate }}
                </button>
                <span class="restore-spacer"></span>
              </div>
            </div>

            <div class="row">
              <label>{{ STR.settings.language }}</label>
              <div>
                <select disabled style="width:140px;"><option>中文</option></select>
                <span class="restore-spacer"></span>
              </div>
            </div>
            <div class="small">{{ STR.settings.descLanguage }}</div>

            <div class="row">
              <span>{{ STR.settings.help }}</span>
              <div>
                <button type="button" class="small-btn" disabled>{{ STR.settings.helpButton }}</button>
                <span class="restore-spacer"></span>
              </div>
            </div>
            <div class="small">{{ STR.settings.descHelp }}</div>

            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.sectionStartup }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('startup')">
                <img src="/icons/restore.svg" alt="">
              </button>
            </div>

            <div class="row">
              <label>{{ STR.settings.autoScroll }}</label>
              <div>
                <label class="toggle"><input type="checkbox" :checked="settings.autoScroll" @change="settings.setAutoScroll($event.target.checked)"><span class="tk"></span></label>
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setAutoScroll(DEFAULT_AUTO_SCROLL)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descAutoScroll }}</div>
          </div>

          <!-- ═══════ 编辑器 ═══════ -->
          <div v-show="activeTab === 'editor'">
            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.sectionEditor }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('tEditor')">
                <img src="/icons/restore.svg" alt="">
              </button>
            </div>

            <div class="row">
              <label>{{ STR.settings.defaultDuration }}</label>
              <div>
                <input type="number" min="1" max="1440" style="width:80px;" :value="settings.defaultDuration" @change="onDurationChange">
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setDuration(DEFAULT_DURATION)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descDefaultDuration }}</div>

            <div class="row">
              <label>{{ STR.settings.markdownPreview }}</label>
              <label class="toggle"><input type="checkbox" disabled><span class="tk"></span></label>
            </div>
            <div class="small">{{ STR.settings.descMarkdownPreview }}</div>

            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.sectionBatchCreate }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('batchCreate')">
                <img src="/icons/restore.svg" alt="">
              </button>
            </div>

            <div class="row">
              <label>{{ STR.settings.checkBeforeCreate }}</label>
              <div>
                <label class="toggle"><input type="checkbox" :checked="settings.checkBeforeCreate" @change="settings.setCheckBeforeCreate($event.target.checked)"><span class="tk"></span></label>
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setCheckBeforeCreate(DEFAULT_CHECK_BEFORE_CREATE)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descCheckBeforeCreate }}</div>

            <div class="row">
              <label>{{ STR.settings.tagDelimiters }}</label>
              <div>
                <input type="text" :value="settings.tagDelimiters" @change="settings.setTagDelimiters($event.target.value)" placeholder="," style="width:200px;">
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setTagDelimiters(DEFAULT_TAG_DELIMITERS)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descTagDelimiters }}</div>
          </div>

          <!-- ═══════ 外观 ═══════ -->
          <div v-show="activeTab === 'appearance'">
            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.navAppearance }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('appearance')">
                <img src="/icons/restore.svg" alt="">
              </button>
            </div>

            <div class="row">
              <label>{{ STR.settings.fontFamily }}</label>
              <div>
                <input type="text" :value="settings.fontFamily" @change="settings.setFontFamily($event.target.value)" :placeholder="STR.settings.placeholderFontFamily" style="width:100%;">
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setFontFamily(DEFAULT_FONT_FAMILY)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descFontFamily }}</div>

            <div class="row">
              <label>{{ STR.settings.fontSize }}</label>
              <input type="text" disabled :placeholder="STR.settings.placeholderFontSize" style="width:120px;">
            </div>
            <div class="small">{{ STR.settings.descFontSize }}</div>

            <div class="row">
              <label>{{ STR.settings.zoom }} <span class="val-hint">{{ settings.zoom }}%</span></label>
              <div>
                <input type="range" min="25" max="400" :value="settings.zoom" @input="settings.setZoom($event.target.value)" style="width:180px;">
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setZoom(DEFAULT_ZOOM)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descZoom }}</div>

            <div class="row">
              <label>{{ STR.settings.blockOpacity }} <span class="val-hint">{{ settings.blockOpacity }}%</span></label>
              <div>
                <input type="range" min="5" max="200" :value="settings.blockOpacity" @input="onOpacityInput" style="width:180px;">
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBlockOpacity(DEFAULT_OPACITY)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descBlockOpacity }}</div>

            <div class="row">
              <label>{{ STR.settings.borderless }}</label>
              <div>
                <label class="toggle"><input type="checkbox" :checked="settings.borderless" @change="onBorderlessChange"><span class="tk"></span></label>
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBorderless(DEFAULT_BORDERLESS)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descBorderless }}</div>
          </div>

          <!-- ═══════ 文件 ═══════ -->
          <div v-show="activeTab === 'files'">
            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.sectionExport }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('export')">
                <img src="/icons/restore.svg" alt="">
              </button>
            </div>

            <div class="row">
              <label>{{ STR.settings.exportTimestamp }}</label>
              <div>
                <label class="toggle"><input type="checkbox" :checked="settings.exportTimestamp" @change="settings.setExportTimestamp($event.target.checked)"><span class="tk"></span></label>
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setExportTimestamp(DEFAULT_EXPORT_TIMESTAMP)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descExportTimestamp }}</div>

            <div class="row">
              <label>{{ STR.settings.exportDialog }}</label>
              <div>
                <label class="toggle"><input type="checkbox" :checked="settings.exportDialog" @change="settings.setExportDialog($event.target.checked)"><span class="tk"></span></label>
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setExportDialog(DEFAULT_EXPORT_DIALOG)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descExportDialog }}</div>

            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.sectionBackup }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('backup')">
                <img src="/icons/restore.svg" alt="">
              </button>
            </div>

            <div class="row">
              <label>{{ STR.settings.backupPath }}</label>
              <div>
                <input type="text" :value="bkPathDraft" @input="bkPathDraft = $event.target.value" @change="onBkPathBlur" :placeholder="STR.settings.placeholderBackupPath" style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;" :title="bkPathDraft">
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="onBkPathReset">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descBackupPath }}</div>

            <div class="row">
              <label>{{ STR.settings.backupOn }}</label>
              <div>
                <label class="toggle"><input type="checkbox" :checked="settings.backupOn" @change="settings.setBackupOn($event.target.checked)"><span class="tk"></span></label>
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBackupOn(DEFAULT_BACKUP_ON)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descBackupOn }}</div>

            <div class="row">
              <label>{{ STR.settings.keepDays }}</label>
              <div>
                <input type="number" min="0" max="3650" style="width:80px;" placeholder="0" :value="settings.keepDays" @change="onKeepDaysChange">
                <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setKeepDays(DEFAULT_KEEP_DAYS)">
                  <img src="/icons/restore.svg" alt="">
                </button>
              </div>
            </div>
            <div class="small">{{ STR.settings.descKeepDays }}</div>
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
import { useToast } from '../composables/useToast.js'
import { migrateBackups } from '../utils/backup.js'
import {
  APP_VERSION, compareSemver,
  DEFAULT_DURATION, DEFAULT_OPACITY, DEFAULT_KEEP_DAYS,
  DEFAULT_AUTO_SCROLL, DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG,
  DEFAULT_BORDERLESS, DEFAULT_BACKUP_ON, DEFAULT_AUTO_UPDATE,
  DEFAULT_TAG_DELIMITERS, DEFAULT_ZOOM, DEFAULT_FONT_FAMILY,
  DEFAULT_CHECK_BEFORE_CREATE,
} from '../constants.js'
import { STR } from '../strings.js'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close', 'checkUpdateResult'])

const settings = useSettingsStore()
const { showConfirm } = useConfirm()
const { toast } = useToast()

const checkingUpdate = ref(false)
const modalEl = ref(null)

const bkPathDraft = ref(settings.bkCustomPath)

const activeTab = ref('basic')
const tabs = [
  { key: 'basic', label: STR.settings.navBasic },
  { key: 'editor', label: STR.settings.navEditor },
  { key: 'appearance', label: STR.settings.navAppearance },
  { key: 'files', label: STR.settings.navFiles },
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

function resetCategory(cat) {
  switch (cat) {
    case 'startup':
      settings.setAutoScroll(DEFAULT_AUTO_SCROLL)
      break
    case 'tEditor':
      settings.setDuration(DEFAULT_DURATION)
      break
    case 'batchCreate':
      settings.setCheckBeforeCreate(DEFAULT_CHECK_BEFORE_CREATE)
      settings.setTagDelimiters(DEFAULT_TAG_DELIMITERS)
      break
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
    case 'basic':
      settings.setAutoUpdate(DEFAULT_AUTO_UPDATE)
      break
    case 'appearance':
      settings.setFontFamily(DEFAULT_FONT_FAMILY)
      settings.setZoom(DEFAULT_ZOOM)
      settings.setBlockOpacity(DEFAULT_OPACITY)
      settings.setBorderless(DEFAULT_BORDERLESS)
      break
  }
}
</script>

<style scoped>
/* ── Layout ── */
.settings-layout {
  display: flex;
  gap: 0;
  min-height: 360px;
  margin-top: 8px;
}
.settings-nav {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.snav-item {
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13.5px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
.snav-item:hover { background: var(--soft2); }
.snav-item.active { background: var(--blue-soft); color: var(--blue); font-weight: 600; }
.settings-content {
  flex: 1;
  padding-left: 20px;
  overflow-y: auto;
}

/* ── Setting rows ── */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}
.row > :first-child { flex-shrink: 0; }
.row > :last-child { display: flex; align-items: center; gap: 6px; }

.section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 16px 0 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.section-title {
  font-size: 12px;
  color: var(--text2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  margin: 0;
}

/* ── Restore button ── */
.btn-restore {
  width: 20px; height: 20px;
  padding: 2px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: .35;
  flex-shrink: 0;
}
.btn-restore:hover { opacity: 1; }
.btn-restore img { width: 100%; height: 100%; display: block; }

.restore-spacer { width: 20px; height: 20px; flex-shrink: 0; }

/* ── Select ── */
select {
  font-family: inherit; font-size: 13px;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 6px 10px; color: var(--text); background: var(--soft);
  cursor: pointer;
}
select:focus { outline: none; border-color: var(--blue); background: var(--canvas); }
select:disabled { opacity: .5; cursor: default; }

/* ── Value hints ── */
.val-hint { font-weight: 400; color: var(--text2); font-size: 13px; margin-left: 4px; }

/* ── Misc ── */
.small-btn { font-size: 12.5px; padding: 4px 10px; }
.settings-modal { width: 64.5vw; max-width: 95vw; height: calc(81vh / var(--zoom, 1)); max-height: calc(90vh / var(--zoom, 1)); overflow: auto; }
.settings-content .small { margin-top: 2px; margin-bottom: 0; }
.settings-content label { display: inline; font-size: inherit; color: inherit; margin: 0; font-weight: inherit; }
.settings-content input[type="checkbox"] { vertical-align: middle; }

/* ── Toggle switch ── */
.toggle { position: relative; display: inline-flex; align-items: center; width: 40px; height: 22px; flex-shrink: 0; cursor: pointer; }
.toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle .tk { position: absolute; inset: 0; background: var(--border); border-radius: 11px; transition: background .2s; }
.toggle .tk::before { content: ''; position: absolute; left: 2px; top: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.toggle input:checked + .tk { background: var(--blue); }
.toggle input:checked + .tk::before { transform: translateX(18px); }
.toggle input:disabled + .tk { opacity: .35; cursor: default; }
.toggle input:disabled + .tk::before { box-shadow: none; }

/* ── Range slider ── */
input[type="range"] {
  -webkit-appearance: none; appearance: none;
  height: 6px; border-radius: 3px;
  background: var(--border); outline: none; cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--blue); border: none;
  box-shadow: 0 1px 4px rgba(0,0,0,.15); cursor: pointer;
  transition: transform .15s;
}
input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); }
input[type="range"]::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--blue); border: none;
  box-shadow: 0 1px 4px rgba(0,0,0,.15); cursor: pointer;
}
input[type="range"]::-moz-range-thumb:hover { transform: scale(1.15); }
.settings-content input[type="range"] { vertical-align: middle; }
</style>

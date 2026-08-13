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

          <!-- ═══════ 外观 ═══════ -->
          <div v-show="activeTab === 'appearance'">
            <div class="section-head">
              <h4 class="section-title">{{ STR.settings.navAppearance }}</h4>
              <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetCategory('appearance')">
                <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
              </button>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.fontFamily }}</label>
                <div>
                  <input type="text" :value="settings.fontFamily" @change="settings.setFontFamily($event.target.value)" :placeholder="STR.settings.placeholderFontFamily" style="width:100%;">
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setFontFamily(DEFAULT_FONT_FAMILY)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descFontFamily }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.editorFontSize }} <span class="val-hint">{{ settings.editorFontSize }}px</span></label>
                <div>
                  <input type="number" min="10" max="28" style="width:80px;" :value="settings.editorFontSize" @change="onEditorFontSizeChange">
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descEditorFontSize }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.zoom }} <span class="val-hint">{{ settings.zoom }}%</span></label>
                <div>
                  <button class="small-btn" @click="showZoomPopup = true">{{ STR.settings.adjustZoom }} ({{ settings.zoom }}%)</button>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setZoom(DEFAULT_ZOOM)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
                <!-- Zoom popup — fixed size, zoom-compensated -->
                <div v-if="showZoomPopup" class="zoom-popup-overlay" @mousedown.self="showZoomPopup = false">
                  <div class="zoom-popup">
                    <div class="zoom-popup-head">{{ STR.settings.zoom }}: {{ settings.zoom }}%</div>
                    <input type="range" min="25" max="400" :value="settings.zoom"
                      @input="settings.setZoom($event.target.value)" />
                    <button type="button" @click="showZoomPopup = false">{{ STR.btn.close }}</button>
                  </div>
                </div>
              </div>
              <div class="small">{{ STR.settings.descZoom }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.borderless }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.borderless" @change="onBorderlessChange"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBorderless(DEFAULT_BORDERLESS)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descBorderless }}</div>
            </div>

            <!-- 皮肤 -->
            <div class="sub-head">{{ STR.settings.sectionSkin }}</div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.currentSkin }}</label>
                <div>
                  <select :value="settings.activeSkin" @change="onSkinSelect($event.target.value)"
                    @focus="onSkinDropdownOpen" style="width:180px;">
                    <option v-for="s in skinOptions" :key="s.id" :value="s.id"
                      :disabled="s.disabled">{{ s.label }}</option>
                  </select>
                  <span class="restore-spacer"></span>
                </div>
              </div>
            </div>
            <div class="setting-item">
              <div class="row" style="margin-top:8px;">
                <div style="display:flex;gap:8px;">
                  <button type="button" @click="openSkinFolder" class="small-btn">{{ STR.settings.openSkinFolder }}</button>
                  <button type="button" @click="refreshSkins" class="small-btn">{{ STR.settings.refresh }}</button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descSkin }}</div>
            </div>

            <!-- CSS 片段 -->
            <div class="sub-head">{{ STR.settings.sectionSnippet }}</div>

            <div class="snippet-scroll">
              <div v-if="snippetFiles.length === 0" class="small" style="padding:8px;">{{ STR.settings.noSnippets }}</div>
              <div v-for="name in snippetFiles" :key="name" class="row" style="margin-top:6px;">
                <label>{{ name }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="snippetEnabled(name)"
                      @change="onSnippetToggle(name, $event.target.checked)"><span class="tk"></span></label>
                </div>
              </div>
            </div>
            <div class="setting-item">
              <div class="row" style="margin-top:8px;">
                <div style="display:flex;gap:8px;">
                  <button type="button" @click="openSnippetFolder" class="small-btn">{{ STR.settings.openSnippetFolder }}</button>
                  <button type="button" @click="refreshSnippets" class="small-btn">{{ STR.settings.refresh }}</button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descSnippet }}</div>
            </div>

            <!-- 时间块 -->
            <div class="sub-head">{{ STR.settings.sectionBlockDisplay }}</div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.blockOpacity }} <span class="val-hint">{{ settings.blockOpacity }}%</span></label>
                <div>
                  <input type="range" min="5" max="200" :value="settings.blockOpacity" @input="onOpacityInput" style="width:180px;">
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBlockOpacity(DEFAULT_OPACITY)">
                    <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
                  </button>
                </div>
              </div>
              <div class="small">{{ STR.settings.descBlockOpacity }}</div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.showBlockTitle }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.showBlockTitle" @change="settings.setShowBlockTitle($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setShowBlockTitle(DEFAULT_SHOW_BLOCK_TITLE)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.showBlockTime }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.showBlockTime" @change="settings.setShowBlockTime($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setShowBlockTime(DEFAULT_SHOW_BLOCK_TIME)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.showBlockTags }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.showBlockTags" @change="settings.setShowBlockTags($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setShowBlockTags(DEFAULT_SHOW_BLOCK_TAGS)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.showBlockNote }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.showBlockNote" @change="settings.setShowBlockNote($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setShowBlockNote(DEFAULT_SHOW_BLOCK_NOTE)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.showBlockColorBar }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.showBlockColorBar" @change="settings.setShowBlockColorBar($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setShowBlockColorBar(DEFAULT_SHOW_BLOCK_COLOR_BAR)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.maskBlockOverflow }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.maskBlockOverflow" @change="settings.setMaskBlockOverflow($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setMaskBlockOverflow(DEFAULT_MASK_BLOCK_OVERFLOW)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="row">
                <label>{{ STR.settings.renderNoteMarkdown }}</label>
                <div>
                  <label class="toggle"><input type="checkbox" :checked="settings.renderNoteMarkdown" @change="settings.setRenderNoteMarkdown($event.target.checked)"><span class="tk"></span></label>
                  <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setRenderNoteMarkdown(DEFAULT_RENDER_NOTE_MARKDOWN)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
                </div>
              </div>
            </div>

          </div>

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
import { ref, watch, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../store/settings.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useToast } from '../composables/useToast.js'
import { logger } from '../utils/log.js'
import { migrateBackups } from '../utils/backup.js'
import {
  DEFAULT_OPACITY, DEFAULT_KEEP_DAYS,
  DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG,
  DEFAULT_BORDERLESS, DEFAULT_BACKUP_ON,
  DEFAULT_ZOOM, DEFAULT_FONT_FAMILY,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_SHOW_BLOCK_TITLE, DEFAULT_SHOW_BLOCK_TIME, DEFAULT_SHOW_BLOCK_TAGS, DEFAULT_SHOW_BLOCK_NOTE, DEFAULT_SHOW_BLOCK_COLOR_BAR,
  DEFAULT_MASK_BLOCK_OVERFLOW,
  DEFAULT_RENDER_NOTE_MARKDOWN,
} from '../constants.js'
import { STR } from '../strings.js'
import { reloadSkinStyle, injectSnippetStyle as _injSnippet, removeSnippetStyle as _rmSnippet, syncAllSnippetStyles as _syncSnippets } from '../utils/skin.js'
import BasicTab from './settings/BasicTab.vue'
import EditorTab from './settings/EditorTab.vue'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close', 'checkUpdateResult'])

const settings = useSettingsStore()
const showZoomPopup = ref(false)
const { showConfirm } = useConfirm()
const { toast } = useToast()

const modalEl = ref(null)

const bkPathDraft = ref(settings.bkCustomPath)

// ── Skin & Snippet ──
const userSkinFiles = ref([])
const snippetFiles = ref([])

const skinOptions = computed(() => {
  const builtin = [
    { id: '', label: STR.settings.skinDay },
    { id: 'night', label: STR.settings.skinNight },
  ]
  const userSkins = userSkinFiles.value
    .filter(name => name !== 'night')
    .map(name => ({ id: name, label: name }))
  const sep = userSkins.length > 0 ? [{ id: '', label: '─'.repeat(10), disabled: true }] : []
  return [...builtin, ...sep, ...userSkins]
})

async function resolveSkinPath() {
  if (settings.skinPath) return settings.skinPath
  const base = await invoke('get_default_asset_dir')
  return base + '\\skins'
}

async function resolveSnippetPath() {
  if (settings.snippetPath) return settings.snippetPath
  const base = await invoke('get_default_asset_dir')
  return base + '\\snippets'
}

async function onSkinDropdownOpen() {
  try {
    const path = await resolveSkinPath()
    userSkinFiles.value = await invoke('scan_css_files', { path })
    if (settings.activeSkin && settings.activeSkin !== 'night'
        && !userSkinFiles.value.includes(settings.activeSkin)) {
      settings.setActiveSkin('')
    }
  } catch { /* 静默 */ }
}

async function refreshSkins() {
  try {
    const path = await resolveSkinPath()
    userSkinFiles.value = await invoke('scan_css_files', { path })
    await doReloadSkinStyle()
  } catch { toast(STR.toast.folderNotFound) }
}

async function doReloadSkinStyle() {
  try {
    const path = await resolveSkinPath()
    reloadSkinStyle(path, settings.activeSkin)
  } catch {
    settings.setActiveSkin('')
  }
}

function onSkinSelect(val) {
  if (!val && settings.activeSkin === '') return
  settings.setActiveSkin(val)
}

// ── Snippet ──

async function refreshSnippets() {
  try {
    const path = await resolveSnippetPath()
    snippetFiles.value = await invoke('scan_css_files', { path })
    const valid = new Set(snippetFiles.value)
    settings.setEnabledSnippets(settings.enabledSnippets.filter(s => valid.has(s)))
    await doSyncSnippets()
  } catch { toast(STR.toast.folderNotFound) }
}

function snippetEnabled(name) {
  return settings.enabledSnippets.includes(name)
}

async function onSnippetToggle(name, on) {
  const list = [...settings.enabledSnippets]
  if (on) {
    if (!list.includes(name)) list.push(name)
    await doInjectSnippet(name)
  } else {
    const idx = list.indexOf(name)
    if (idx !== -1) list.splice(idx, 1)
    doRemoveSnippet(name)
  }
  settings.setEnabledSnippets(list)
}

async function doInjectSnippet(name) {
  try {
    const path = await resolveSnippetPath()
    _injSnippet(path, name)
  } catch { /* 跳过 */ }
}

function doRemoveSnippet(name) {
  _rmSnippet(name)
}

async function doSyncSnippets() {
  const path = await resolveSnippetPath()
  _syncSnippets(path, settings.enabledSnippets)
}

async function openSkinFolder() {
  try { await invoke('open_folder', { path: await resolveSkinPath() }) }
  catch { toast(STR.toast.folderNotFound) }
}

async function openSnippetFolder() {
  try { await invoke('open_folder', { path: await resolveSnippetPath() }) }
  catch { toast(STR.toast.folderNotFound) }
}

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
    refreshSnippets()
  }
}, { immediate: true })

function onEditorFontSizeChange(e) {
  settings.setEditorFontSize(e.target.value)
  e.target.value = settings.editorFontSize
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
      logger.error('settings', 'setDecorations failed', e)
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
    case 'appearance':
      settings.setFontFamily(DEFAULT_FONT_FAMILY)
      settings.setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE)
      settings.setZoom(DEFAULT_ZOOM)
      settings.setBlockOpacity(DEFAULT_OPACITY)
      settings.setBorderless(DEFAULT_BORDERLESS)
      settings.setActiveSkin('')
      settings.setEnabledSnippets([])
      break
  }
}
</script>

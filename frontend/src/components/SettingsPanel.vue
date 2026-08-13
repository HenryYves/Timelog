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

          <FilesTab v-show="activeTab === 'files'" />

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
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../store/settings.js'
import { STR } from '../strings.js'
import BasicTab from './settings/BasicTab.vue'
import EditorTab from './settings/EditorTab.vue'
import AppearanceTab from './settings/AppearanceTab.vue'
import FilesTab from './settings/FilesTab.vue'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close', 'checkUpdateResult'])

const settings = useSettingsStore()

const modalEl = ref(null)

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

function onClose() {
  if (document.activeElement?.tagName === 'INPUT') document.activeElement.blur()
  emit('close')
}

</script>

<template>
  <div>
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
</template>

<script setup>
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../../store/settings.js'
import { STR } from '../../strings.js'

const settings = useSettingsStore()

async function openDevTools() {
  try { await invoke('open_devtools') } catch { /* 非 Tauri 环境 */ }
}

async function reinstallSkin() {
  localStorage.removeItem('timelog:skinInstalled')
  const skinDir = settings.skinPath || (await invoke('get_default_asset_dir')) + '\\skins'
  const { installSkinTemplates, injectSkinStyle, reloadSkinStyle } = await import('../../utils/skin.js')
  await installSkinTemplates(skinDir)
  if (settings.activeSkin) { await injectSkinStyle(skinDir, settings.activeSkin) }
}
</script>

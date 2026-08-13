<template>
  <div>
    <label>{{ STR.settings.version }}</label>
    <div style="display:flex;align-items:center;gap:8px;">
      <code>{{ APP_VERSION }}</code>
      <a href="https://github.com/HenryYves/Timelog" target="_blank" class="small">GitHub</a>
      <a href="https://gitee.com/Henry_Yves/timelog" target="_blank" class="small">Gitee</a>
    </div>

    <div class="section-head">
      <h4 class="section-title">{{ STR.settings.navBasic }}</h4>
      <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetBasic">
        <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
      </button>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.autoUpdate }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.autoUpdate" @change="settings.setAutoUpdate($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setAutoUpdate(DEFAULT_AUTO_UPDATE)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descAutoUpdate }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <span>{{ STR.settings.checkUpdate }}</span>
        <div>
          <button type="button" @click="onCheckUpdate" :disabled="checkingUpdate" class="small-btn">
            {{ checkingUpdate ? STR.update.checking : STR.update.checkUpdate }}
          </button>
          <span class="restore-spacer"></span>
        </div>
      </div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.language }}</label>
        <div>
          <select disabled style="width:140px;"><option>{{ STR.settings.languageOption }}</option></select>
          <span class="restore-spacer"></span>
        </div>
      </div>
      <div class="small">{{ STR.settings.descLanguage }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <span>{{ STR.settings.help }}</span>
        <div>
          <button type="button" class="small-btn" disabled>{{ STR.settings.helpButton }}</button>
          <span class="restore-spacer"></span>
        </div>
      </div>
      <div class="small">{{ STR.settings.descHelp }}</div>
    </div>

    <div class="section-head">
      <h4 class="section-title">{{ STR.settings.sectionStartup }}</h4>
      <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetStartup">
        <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
      </button>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.autoScroll }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.autoScroll" @change="settings.setAutoScroll($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setAutoScroll(DEFAULT_AUTO_SCROLL)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descAutoScroll }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../../store/settings.js'
import { useToast } from '../../composables/useToast.js'
import { APP_VERSION, compareSemver, DEFAULT_AUTO_UPDATE, DEFAULT_AUTO_SCROLL } from '../../constants.js'
import { STR } from '../../strings.js'
import { logger } from '../../utils/log.js'

const emit = defineEmits(['check-update-result'])
const settings = useSettingsStore()
const { toast } = useToast()
const checkingUpdate = ref(false)

async function onCheckUpdate() {
  checkingUpdate.value = true
  try {
    const metadata = await invoke('check_update')
    if (metadata) {
      emit('check-update-result', metadata)
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
    logger.error('settings', 'checkUpdate failed', e)
    toast(STR.update.checkFailed)
  } finally {
    checkingUpdate.value = false
  }
}

function resetBasic() { settings.setAutoUpdate(DEFAULT_AUTO_UPDATE) }
function resetStartup() { settings.setAutoScroll(DEFAULT_AUTO_SCROLL) }
</script>

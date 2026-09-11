<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal" @keydown="trapFocus">
      <h2>{{ STR.help.title }}</h2>

      <div class="help-section">
        <h3>{{ STR.help.sectionBlocks }}</h3>
        <ul>
          <li v-for="t in STR.help.helpBlocks" :key="t" v-html="t"></li>
        </ul>
      </div>

      <div class="help-section">
        <h3>{{ STR.help.sectionShortcuts }}</h3>
        <ul>
          <li v-for="s in STR.help.helpShortcuts" :key="s.keys" v-html="renderShortcut(s)"></li>
        </ul>
      </div>

      <div class="help-section">
        <h3>{{ STR.help.sectionWindow }}</h3>
        <ul>
          <li v-for="t in STR.help.helpWindow" :key="t" v-html="t"></li>
        </ul>
      </div>

      <div class="help-section">
        <h3>{{ STR.help.sectionStats }}</h3>
        <ul>
          <li v-for="t in STR.help.helpStats" :key="t" v-html="t"></li>
        </ul>
      </div>

      <div class="help-section">
        <h3>{{ STR.help.sectionBackup }}</h3>
        <ul>
          <li v-for="t in STR.help.helpBackup" :key="t" v-html="t"></li>
        </ul>
      </div>

      <div class="help-section">
        <h3>{{ STR.help.sectionExport }}</h3>
        <ul>
          <li v-for="t in STR.help.helpExport" :key="t" v-html="t"></li>
        </ul>
      </div>

      <div class="help-section">
        <h3>{{ STR.help.sectionDebug }}</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <button @click="toggleLogs">{{ showLogs ? STR.help.hideLogs : STR.help.showLogs }}</button>
          <button @click="doExportLogs">{{ STR.help.exportLogs }}</button>
        </div>
        <pre v-if="showLogs" class="log-view">{{ logContent }}</pre>
      </div>

      <div class="help-footer">
        {{ STR.help.footer }}
      </div>

      <div class="actions">
        <span class="spacer"></span>
        <button @click="emit('close')">{{ STR.help.close }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { STR, t } from '../strings.js'
import { exportLogs, getLogText, logger } from '../utils/log.js'
import { useToast } from '../composables/useToast.js'

const { toast } = useToast()
const showLogs = ref(false)
const logContent = ref('')

async function doExportLogs() {
  try {
    const path = await exportLogs()
    if (path) toast(t('help.logExportedTo', { path }))
    else toast(STR.help.exportCanceled)
  } catch (e) {
    logger.error('help', 'exportLogs failed', e)
    toast(STR.help.exportLogsFailed)
  }
}

function toggleLogs() {
  showLogs.value = !showLogs.value
  if (showLogs.value) logContent.value = getLogText() || STR.help.noLogs
}

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

// 快捷键项为结构化数据 { keys, desc }，不再依赖"双空格"分隔符
function renderShortcut(item) {
  const keys = String(item.keys).replace(/ \+ /g, '</kbd> + <kbd>')
  return '<kbd>' + keys + '</kbd> ' + item.desc
}

// Focus trap
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
</script>

<style scoped>
.modal { max-height: calc(82vh / var(--zoom, 1)); overflow: auto; }
.help-section {
  margin: 12px 0;
  position: relative;
  padding-left: 14px;
}
.help-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(to bottom, var(--primary-soft) 0%, var(--primary) 40%);
}
.help-section h3 {
  font-size: 13.5px;
  margin: 0 0 4px;
  color: var(--text);
}
.help-section ul {
  margin: 0;
  padding: 0 0 0 18px;
}
.help-section li {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text2);
}
.help-section li span {
  color: var(--text);
}
.help-footer {
  text-align: center;
  font-size: 12px;
  color: var(--text2);
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.log-view {
  margin-top: 8px; max-height: 200px; overflow: auto;
  background: var(--soft); padding: 8px; border-radius: 4px;
  font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;
  color: var(--text2);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
</style>

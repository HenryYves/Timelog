<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')">
    <div class="modal">
      <h2>导出 / 导入</h2>

      <label>导出文本</label>
      <textarea class="exportbox" readonly :value="exText"></textarea>
      <div class="actions">
        <span class="copied" v-if="copiedMsg">已复制 ✓</span>
        <span class="spacer"></span>
        <button type="button" @click="copyText">复制</button>
        <button type="button" class="primary" @click="downloadJson">下载 JSON</button>
      </div>

      <div class="divider"></div>

      <label>导入</label>
      <div class="actions">
        <button type="button" @click="triggerFileInput">导入 JSON</button>
        <input type="file" ref="fileInput" accept="application/json,.json" hidden @change="importJson">
        <button type="button" @click="pasteImport">粘贴导入</button>
      </div>

      <div class="small" v-if="importMsg" style="margin-top:8px;">{{ importMsg }}</div>

      <div class="actions">
        <span class="spacer"></span>
        <button type="button" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useTimelogStore, fmt } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { KEY_PREFIX } from '../constants.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const timelogStore = useTimelogStore()
const tagStore = useTagStore()
const { showAlert } = useConfirm()

const exText = ref('')
const copiedMsg = ref(false)
const importMsg = ref('')
const fileInput = ref(null)

// --- Build export text ---
function buildExport() {
  return timelogStore.blocks.slice().sort((a, b) => a.start - b.start).map(ev => {
    const t = (ev.tags && ev.tags.length) ? ':' + ev.tags.join(',') : ''
    return '- (' + fmt(ev.start) + '-' + fmt(ev.end) + t + ')' + (ev.title || '') + ';' +
      (ev.note || '').replace(/\n(.*)/g, (m, line) =>
        /^\s*(?:[-*]|\d+\.)\s/.test(line) ? '\n\t' + line : '\n ' + line)
  }).join('\n')
}

// When panel opens, build export text
watch(() => props.show, (val) => {
  if (val) {
    exText.value = buildExport()
    copiedMsg.value = false
    importMsg.value = ''
  }
})

// --- Copy to clipboard ---
async function copyText() {
  try {
    await navigator.clipboard.writeText(exText.value)
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea')
    ta.value = exText.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copiedMsg.value = true
}

// --- Download JSON backup (all dates) ---
function downloadJson() {
  const days = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags') {
      try {
        const data = JSON.parse(localStorage.getItem(k))
        if (Array.isArray(data) && data.length) {
          days[k.slice(KEY_PREFIX.length)] = data
        }
      } catch { /* skip corrupt keys */ }
    }
  }
  const data = { version: 1, exported: new Date().toISOString(), days }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = new Date()
  const name = 'timelog-backup-' +
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + '.json'
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// --- Import JSON ---
function triggerFileInput() {
  fileInput.value?.click()
}

async function importJson(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result)
      let count = 0
      if (data.days && typeof data.days === 'object') {
        Object.entries(data.days).forEach(([date, blocks]) => {
          if (Array.isArray(blocks) && blocks.length) {
            localStorage.setItem(KEY_PREFIX + date, JSON.stringify(blocks))
            count += blocks.length
          }
        })
      } else if (data.blocks && Array.isArray(data.blocks)) {
        const byDate = {}
        data.blocks.forEach(b => {
          const date = b._date
          if (date) {
            if (!byDate[date]) byDate[date] = []
            byDate[date].push(b)
          }
        })
        Object.entries(byDate).forEach(([date, blocks]) => {
          localStorage.setItem(KEY_PREFIX + date, JSON.stringify(blocks))
        })
        count = data.blocks.length
      }
      timelogStore.loadBlocks()
      importMsg.value = STR.toast.imported + ' ' + count + ' 条'
      setTimeout(() => { importMsg.value = ''; emit('close') }, 1500)
    } catch {
      await showAlert(STR.toast.importFail)
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

// --- Parse exported text (inverse of buildExport) ---
function parseImportText(text) {
  const lines = (text || '').replace(/\r/g, '').split('\n')
  const recs = []
  let cur = null
  for (const line of lines) {
    const m = line.match(/^-\s*\((\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})(?::([^)]*))?\)(.*)$/)
    if (m) {
      if (cur) recs.push(cur)
      const s = (+m[1]) * 60 + (+m[2])
      const en = (+m[3]) * 60 + (+m[4])
      const tg = m[5] ? m[5].split(',').map(x => x.trim()).filter(Boolean) : []
      const rest = m[6] || ''
      const idx = rest.indexOf(';')
      const title = idx >= 0 ? rest.slice(0, idx) : rest
      const note = idx >= 0 ? rest.slice(idx + 1) : ''
      cur = { start: s, end: en, tags: tg, title: title.trim(), note: note }
    } else if (cur) {
      cur.note += '\n' + line.replace(/^ /, '')
    }
  }
  if (cur) recs.push(cur)
  return recs.map(r => ({
    id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
    start: r.start,
    end: r.end <= r.start ? r.start + 1 : r.end,
    title: r.title,
    note: (r.note || '').replace(/\s+$/, ''),
    tags: r.tags,
  }))
}

// --- Paste import (read clipboard as exported text) ---
async function pasteImport() {
  let text
  try {
    text = await navigator.clipboard.readText()
  } catch {
    await showAlert('无法读取剪贴板，请检查权限')
    return
  }
  const recs = parseImportText(text)
  if (!recs.length) {
    await showAlert(STR.confirm.importNoRecords)
    return
  }
  // Import to current day (merge)
  const date = timelogStore.dateKey
  const key = KEY_PREFIX + date
  let existing = []
  try { existing = JSON.parse(localStorage.getItem(key)) || [] } catch { /* empty */ }
  const merged = existing.concat(recs)
  localStorage.setItem(key, JSON.stringify(merged))
  // Add any tags that don't exist yet
  recs.forEach(r => (r.tags || []).forEach(tn => {
    if (tn && !tagStore.tags.find(t => t.name === tn)) {
      tagStore.addTag({ name: tn, color: '#8A8A8A', group: '' })
    }
  }))
  timelogStore.loadBlocks()
  importMsg.value = '已粘贴导入 ' + recs.length + ' 条记录到 ' + date
  setTimeout(() => {
    importMsg.value = ''
    emit('close')
  }, 2000)
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20,20,20,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}
.modal {
  background: var(--canvas);
  border-radius: 12px;
  width: 480px;
  max-width: 100%;
  padding: 20px;
  box-shadow: 0 8px 40px rgba(0,0,0,.18);
  max-height: 90vh;
  overflow: auto;
}
.modal h2 {
  font-size: 15px;
  margin: 0 0 6px;
  font-weight: 650;
}
.modal label {
  display: block;
  font-size: 12px;
  color: var(--text2);
  margin: 12px 0 5px;
  font-weight: 600;
}
.exportbox {
  width: 100%;
  min-height: 280px;
  height: 40vh;
  font-family: Menlo, Consolas, monospace;
  font-size: 12.5px;
  white-space: pre;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  background: var(--soft);
  color: var(--text);
  resize: vertical;
}
.copied {
  color: var(--green);
  font-size: 13px;
  font-weight: 600;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
.spacer { flex: 1; }
.divider {
  height: 1px;
  background: var(--border);
  margin: 16px 0;
}
.small {
  font-size: 12px;
  color: var(--text2);
}
</style>

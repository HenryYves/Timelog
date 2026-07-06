<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')">
    <div class="modal">

      <!-- ======================== TEXT EXPORT VIEW ======================== -->
      <template v-if="mode === 'export'">
        <h2>导出文本（当天）</h2>
        <textarea class="exportbox" readonly :value="exText"></textarea>
        <div class="actions">
          <span class="copied" v-if="copiedMsg">已复制 ✓</span>
          <span class="spacer"></span>
          <button type="button" @click="emit('close')">关闭</button>
          <button type="button" class="primary" @click="copyText">复制到剪贴板</button>
        </div>
      </template>

      <!-- ======================== TEXT IMPORT VIEW ======================== -->
      <template v-if="mode === 'import'">
        <h2>从文本导入</h2>
        <div class="sub">粘贴"导出文本"格式的内容，解析为记录导入到指定日期。</div>

        <label>粘贴文本</label>
        <textarea class="exportbox import-area" v-model="importText"
          placeholder="- (9:00-10:30:工作)写周报;记得同步进度"
          @input="onImportTextChange"></textarea>

        <label>导入到日期</label>
        <input type="date" v-model="importDate">

        <label>导入方式</label>
        <div class="radio">
          <label><input type="radio" name="txMode" value="merge" v-model="importMode" checked> 合并到该天</label>
          <label><input type="radio" name="txMode" value="replace" v-model="importMode"> 覆盖该天</label>
        </div>

        <div class="small" v-if="importPreview !== null">{{ importPreview }}</div>

        <div class="actions">
          <span class="spacer"></span>
          <button type="button" @click="emit('close')">取消</button>
          <button type="button" class="primary" @click="confirmImport">确认导入</button>
        </div>
      </template>

      <!-- ======================== JSON IMPORT VIEW ======================== -->
      <template v-if="mode === 'json-import' && jsonImportData">
        <h2>导入备份</h2>
        <div class="sub">{{ jsonImportSummary }}</div>

        <label>导入方式</label>
        <div class="radio">
          <label><input type="radio" name="jimMode" value="merge" v-model="jsonImportMode"> 合并（保留现有）</label>
          <label><input type="radio" name="jimMode" value="replace" v-model="jsonImportMode"> 覆盖（清空后导入）</label>
        </div>

        <label>只导入日期范围（可选，留空=全部）</label>
        <div class="timerow">
          <input type="date" v-model="jsonDateFrom"><span>—</span><input type="date" v-model="jsonDateTo">
        </div>

        <label>只导入每日时间段（可选，留空=整天）</label>
        <div class="timerow">
          <input type="time" v-model="jsonTimeFrom" step="60"><span>—</span><input type="time" v-model="jsonTimeTo" step="60">
        </div>

        <div class="actions">
          <span class="spacer"></span>
          <button type="button" @click="cancelJsonImport">取消</button>
          <button type="button" class="primary" @click="confirmJsonImport">确认导入</button>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useTimelogStore, fmt, dkey, fromInput } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { KEY_PREFIX } from '../constants.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useToast } from '../composables/useToast.js'
import { STR } from '../strings.js'
import { scheduleSave } from '../utils/backup.js'

const props = defineProps({
  show: Boolean,
  mode: { type: String, default: 'export' }, // 'export' | 'import' | 'json-import'
  jsonImportData: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const timelogStore = useTimelogStore()
const tagStore = useTagStore()
const { showAlert } = useConfirm()
const { toast } = useToast()

// --- Export ---
const exText = ref('')
const copiedMsg = ref(false)

function buildExport() {
  return timelogStore.blocks.slice().sort((a, b) => a.start - b.start).map(ev => {
    const t = (ev.tags && ev.tags.length) ? ':' + ev.tags.join(',') : ''
    return '- (' + fmt(ev.start) + '-' + fmt(ev.end) + t + ')' + (ev.title || '') + ';' +
      (ev.note || '').replace(/\n(.*)/g, (m, line) =>
        /^\s*(?:[-*]|\d+\.)\s/.test(line) ? '\n\t' + line : '\n ' + line)
  }).join('\n')
}

watch(() => props.show, (val) => {
  if (val && props.mode === 'export') {
    exText.value = buildExport()
    copiedMsg.value = false
  }
  if (val && props.mode === 'import') {
    importText.value = ''
    importDate.value = dkey(new Date())
    importMode.value = 'merge'
    importPreview.value = null
  }
})

async function copyText() {
  try {
    await navigator.clipboard.writeText(exText.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = exText.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copiedMsg.value = true
}

// --- Import ---
const importText = ref('')
const importDate = ref('')
const importMode = ref('merge') // 'merge' | 'replace'
const importPreview = ref(null)

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

function onImportTextChange() {
  const n = parseImportText(importText.value).length
  importPreview.value = n ? '可解析 ' + n + ' 条记录' : '未解析到有效记录'
}

async function confirmImport() {
  const recs = parseImportText(importText.value)
  if (!recs.length) {
    await showAlert('未解析到有效记录，请检查文本格式。')
    return
  }
  const date = importDate.value || dkey(new Date())
  const mode = importMode.value
  const key = KEY_PREFIX + date

  let existing = []
  try { existing = JSON.parse(localStorage.getItem(key)) || [] } catch { /* empty */ }
  existing = (mode === 'merge') ? existing.concat(recs) : recs
  localStorage.setItem(key, JSON.stringify(existing))

  // Auto-add unknown tags
  let added = false
  recs.forEach(r => (r.tags || []).forEach(tn => {
    if (tn && !tagStore.tags.find(t => t.name === tn)) {
      tagStore.addTag({ name: tn, color: '#8A8A8A', group: '' })
      added = true
    }
  }))
  if (added) tagStore.saveTags()

  emit('close')
  if (date === dkey(new Date())) {
    timelogStore.loadBlocks()
  }
  scheduleSave()
  toast('已导入 ' + recs.length + ' 条到 ' + date)
}

// --- JSON Import ---
const jsonImportMode = ref('merge')
const jsonDateFrom = ref('')
const jsonDateTo = ref('')
const jsonTimeFrom = ref('')
const jsonTimeTo = ref('')
const jsonImportSummary = ref('')

function buildJsonImportSummary(data) {
  if (!data || !data.days) return ''
  const dates = Object.keys(data.days)
  let cnt = 0
  dates.forEach(d => cnt += data.days[d].length)
  const sorted = dates.slice().sort()
  return '共 ' + dates.length + ' 天、' + cnt + ' 条记录' +
    (dates.length ? '（' + sorted[0] + ' → ' + sorted[sorted.length - 1] + '）' : '')
}

function isDayKey(k) {
  if (!k.startsWith(KEY_PREFIX)) return false
  const datePortion = k.slice(KEY_PREFIX.length)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePortion)
}

function cancelJsonImport() {
  emit('close')
}

async function confirmJsonImport() {
  const data = props.jsonImportData
  if (!data || !data.days) return

  const mode = jsonImportMode.value
  const df = jsonDateFrom.value
  const dt = jsonDateTo.value
  const tf = jsonTimeFrom.value
  const tt = jsonTimeTo.value
  const tfm = tf ? fromInput(tf) : null
  const ttm = tt ? fromInput(tt) : null

  // Replace mode: clear all existing day keys
  if (mode === 'replace') {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (isDayKey(k)) localStorage.removeItem(k)
    }
  }

  // Import tags from backup
  if (data.tags) {
    data.tags.forEach(t => {
      if (t && t.name && !tagStore.tags.find(x => x.name === t.name)) {
        tagStore.addTag({ name: t.name, color: t.color || '#8A8A8A', group: t.group || '' })
      }
    })
  }

  // Import filtered days
  Object.keys(data.days).forEach(d => {
    if (df && d < df) return
    if (dt && d > dt) return
    let incoming = data.days[d].filter(b => {
      if (tfm != null && b.start < tfm) return false
      if (ttm != null && b.start > ttm) return false
      return true
    })
    if (!incoming.length) return

    const key = KEY_PREFIX + d
    let existing = []
    try { existing = JSON.parse(localStorage.getItem(key)) || [] } catch { /* empty */ }
    if (mode === 'merge') {
      const map = {}
      existing.concat(incoming).forEach(b => {
        map[b.id || ('b' + b.start + '-' + b.end + Math.random())] = b
      })
      existing = Object.values(map)
    } else {
      existing = incoming
    }
    localStorage.setItem(key, JSON.stringify(existing))
  })

  emit('close')
  timelogStore.loadBlocks()
  tagStore.loadTags()
  scheduleSave()
  showAlert('导入完成。')
}

// Watch mode changes to initialize JSON import state
watch(() => [props.mode, props.jsonImportData], ([mode, data]) => {
  if (mode === 'json-import' && data && data.days) {
    jsonImportMode.value = 'merge'
    jsonDateFrom.value = ''
    jsonDateTo.value = ''
    jsonTimeFrom.value = ''
    jsonTimeTo.value = ''
    jsonImportSummary.value = buildJsonImportSummary(data)
  }
})
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
.modal .sub {
  color: var(--text2);
  font-size: 12.5px;
  margin-bottom: 10px;
}
.modal label {
  display: block;
  font-size: 12px;
  color: var(--text2);
  margin: 12px 0 5px;
  font-weight: 600;
}
.modal input[type=date],
.modal input[type=time],
.modal input[type=text] {
  width: 100%;
  font-family: inherit;
  font-size: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 10px;
  color: var(--text);
  background: var(--soft);
}
.modal input:focus {
  outline: none;
  border-color: var(--blue);
  background: var(--canvas);
}
.timerow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timerow input {
  width: auto;
  flex: 1;
}
.timerow span {
  color: var(--text2);
}
.exportbox {
  width: 100%;
  min-height: 360px;
  height: 56vh;
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
.exportbox.import-area {
  min-height: 180px;
  height: 34vh;
}
.copied {
  color: var(--green);
  font-size: 13px;
  font-weight: 600;
}
.radio {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 13.5px;
}
.radio label {
  margin: 0;
  color: var(--text);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
.spacer { flex: 1; }
.small {
  font-size: 12px;
  color: var(--text2);
}
</style>

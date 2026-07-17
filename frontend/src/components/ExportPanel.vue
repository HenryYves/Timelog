<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal" @keydown="trapFocus">

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
          <button type="button" class="primary" @click="confirmImport">确认导入</button>
          <button type="button" @click="emit('close')">取消</button>
        </div>
      </template>

      <!-- ======================== JSON EXPORT VIEW ======================== -->
      <template v-if="mode === 'json-export'">
        <h2>导出备份</h2>
        <div class="sub">选择要导出的内容。</div>

        <label>导出内容</label>
        <div class="check-group">
          <label><input type="checkbox" v-model="exportDays" checked> 数据</label>
          <label><input type="checkbox" v-model="exportTags" checked> 标签</label>
          <label><input type="checkbox" v-model="exportStats" checked> 统计视图</label>
          <label><input type="checkbox" v-model="exportSettings"> 设置</label>
        </div>

        <div class="actions">
          <span class="spacer"></span>
          <button type="button" class="primary" @click="emit('exportJson', { days: exportDays, tags: exportTags, stats: exportStats, settings: exportSettings })">确认导出</button>
          <button type="button" @click="emit('close')">取消</button>
        </div>
      </template>

      <!-- ======================== JSON IMPORT VIEW ======================== -->
      <template v-if="mode === 'json-import' && jsonImportData">
        <h2>导入备份</h2>
        <div class="sub">{{ jsonImportSummary }}</div>

        <label>导入内容</label>
        <div class="check-group">
          <label><input type="checkbox" v-model="jsonImportDays"> 数据</label>
          <label><input type="checkbox" v-model="jsonImportTags"> 标签</label>
          <label><input type="checkbox" v-model="jsonImportStats"> 统计视图</label>
          <label v-if="jsonImportData.settings"><input type="checkbox" v-model="jsonImportSettings"> 设置</label>
        </div>

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
          <button type="button" class="primary" @click="confirmJsonImport">确认导入</button>
          <button type="button" @click="cancelJsonImport">取消</button>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useTimelogStore, fmt, dkey, fromInput } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { useSettingsStore } from '../store/settings.js'
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
const emit = defineEmits(['close', 'exportJson'])

const timelogStore = useTimelogStore()
const tagStore = useTagStore()
const settingsStore = useSettingsStore()
const { showAlert } = useConfirm()
const { toast } = useToast()

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

// --- Export ---
const exText = ref('')
const copiedMsg = ref(false)
const importText = ref('')
const importDate = ref('')
const importMode = ref('merge')
const importPreview = ref(null)

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
}, { immediate: true })

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
  toast(STR.toast.importCountTo(recs.length, date))
}

// --- JSON Export ---
const exportDays = ref(true)
const exportTags = ref(true)
const exportStats = ref(true)
const exportSettings = ref(false)

// --- JSON Import ---
const jsonImportDays = ref(true)
const jsonImportTags = ref(true)
const jsonImportStats = ref(true)
const jsonImportSettings = ref(false)
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

  const doDays = jsonImportDays.value
  const doTags = jsonImportTags.value
  const doStats = jsonImportStats.value
  const doSettings = jsonImportSettings.value

  // Import days
  if (doDays) {
    if (mode === 'replace') {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (isDayKey(k)) localStorage.removeItem(k)
      }
    }

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
  }

  // Import tags
  if (doTags && data.tags) {
    if (mode === 'replace') {
      tagStore.tags.splice(0, tagStore.tags.length)
    }
    data.tags.forEach(t => {
      if (t && t.name && !tagStore.tags.find(x => x.name === t.name)) {
        tagStore.addTag({ name: t.name, color: t.color || '#8A8A8A', group: t.group || '' })
      }
    })
    tagStore.saveTags()
  }

  // Import stats views
  if (doStats) {
    if (data.statsCards) localStorage.setItem('timelog:stats-cards', JSON.stringify(data.statsCards))
    if (data.statsTimeRange) localStorage.setItem('timelog:stats-time-range', data.statsTimeRange)
    if (data.statsCustomStart) localStorage.setItem('timelog:stats-custom-start', data.statsCustomStart)
    if (data.statsCustomEnd) localStorage.setItem('timelog:stats-custom-end', data.statsCustomEnd)
  }

  // Import settings
  if (doSettings && data.settings) {
    Object.entries(data.settings).forEach(([key, val]) => {
      localStorage.setItem('timelog:' + key, val)
    })
    settingsStore.reloadSettings()
  }

  emit('close')
  timelogStore.loadBlocks()
  tagStore.loadTags()
  scheduleSave()
  toast(STR.toast.imported)
}

// Watch mode changes to initialize JSON import state
watch(() => [props.mode, props.jsonImportData], ([mode, data]) => {
  if (mode === 'json-import' && data && data.days) {
    jsonImportDays.value = true
    jsonImportTags.value = true
    jsonImportStats.value = true
    jsonImportSettings.value = false
    jsonImportMode.value = 'merge'
    jsonDateFrom.value = ''
    jsonDateTo.value = ''
    jsonTimeFrom.value = ''
    jsonTimeTo.value = ''
    jsonImportSummary.value = buildJsonImportSummary(data)
  }
}, { immediate: true })
</script>

<style scoped>
.modal { max-height: calc(82vh / var(--zoom, 1)); overflow: auto; }
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
.check-group {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 13.5px;
  flex-wrap: wrap;
}
.check-group label {
  margin: 0;
  color: var(--text);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
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

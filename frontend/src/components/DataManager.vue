<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal" ref="modalEl" @keydown="trapFocus">
      <div class="dm-head">
        <h2>数据管理</h2>
        <span class="dm-range" v-if="dateRange">{{ dateRange }}</span>
      </div>
      <div class="sub">按日期段删除，或逐天删除。</div>

      <label>删除日期段（含起止当天）</label>
      <div class="timerow">
        <input type="date" v-model="fromDate">
        <span>—</span>
        <input type="date" v-model="toDate">
        <button class="del" @click="deleteDateRange">删除</button>
      </div>
      <div class="small">会删除该日期范围内所有天的全部记录。</div>

      <div class="divider"></div>

      <label>所有日期</label>
      <div class="day-list">
      <div v-if="days.length === 0" class="small">暂无数据</div>
      <label class="dayrow select-all" v-if="days.length">
        <input type="checkbox" :checked="allSelected" @change="toggleAll">
        <span class="small">全选 / 取消</span>
      </label>
      <div v-for="d in days" :key="d.date" class="dayrow">
        <label class="dcheck"><input type="checkbox" :checked="selectedDays.has(d.date)" @change="toggleDay(d.date)"></label>
        <div class="dinfo">
          {{ d.date }}
          <span class="dmeta">{{ d.count }} 条 · {{ d.hours.toFixed(1) }} 小时</span>
        </div>
        <button class="del" @click="deleteDate(d.date)">删除整天</button>
      </div>
      </div>

      <div v-if="selectedDays.size" class="batch-actions">
        <button class="del" @click="deleteSelected">删除选中 ({{ selectedDays.size }})</button>
        <button @click="exportSelected">导出选中 ({{ selectedDays.size }})</button>
      </div>

      <div style="margin-top:12px;">
        <button class="del" @click="deleteAll">全部删除</button>
        <span class="small" style="margin-left:8px;">删除所有日期和标签的全部记录，不可恢复。</span>
      </div>

      <div class="divider"></div>

      <label>导入备份</label>
      <div class="actions">
        <button @click="triggerImport">导入 JSON</button>
        <input type="file" ref="fileInput" accept="application/json,.json" hidden @change="onFileSelected">
      </div>
      <div class="small">选择一个 timelog JSON 备份文件导入。已存在的日期会被合并。</div>

      <div class="actions">
        <span class="spacer"></span>
        <button @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { KEY_PREFIX } from '../constants.js'
import { pushStoreUndo, addDays } from '../store/timelog.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'
import { extractBlocks, normalizeDayData } from '../utils/dayStorage.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'changed'])
const { showConfirm, showAlert } = useConfirm()

const days = ref([])
const modalEl = ref(null)
const fromDate = ref('')
const toDate = ref('')
const fileInput = ref(null)
const selectedDays = ref(new Set())

const allSelected = computed(() => days.value.length > 0 && selectedDays.value.size === days.value.length)

const dateRange = computed(() => {
  if (!days.value.length) return ''
  // days sorted newest-first; last = earliest, first = latest
  const first = days.value[days.value.length - 1].date
  const last = days.value[0].date
  return first === last ? first : first + ' — ' + last
})

function toggleDay(date) {
  const s = new Set(selectedDays.value)
  if (s.has(date)) s.delete(date)
  else s.add(date)
  selectedDays.value = s
}
function toggleAll() {
  if (allSelected.value) selectedDays.value = new Set()
  else selectedDays.value = new Set(days.value.map(d => d.date))
}

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

function isDayKey(k) {
  return k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags' &&
    /^\d{4}-\d{2}-\d{2}$/.test(k.slice(KEY_PREFIX.length))
}

function loadDays() {
  const map = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (isDayKey(k)) {
      const date = k.slice(KEY_PREFIX.length)
      try {
        const { blocks, _cutMeta } = normalizeDayData(JSON.parse(localStorage.getItem(k)))
        // 有时间块，或发生过剪贴（_cutMeta 非空）都算有数据
        if (blocks.length || Object.keys(_cutMeta).length) {
          let mins = 0
          blocks.forEach(b => mins += (b.end - b.start))
          map[date] = { count: blocks.length, hours: Math.round((mins / 60) * 10) / 10 }
        }
      } catch { /* skip corrupt keys */ }
    }
  }
  days.value = Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, info]) => ({ date, ...info }))
}

watch(() => props.show, (val) => {
  if (val) {
    fromDate.value = ''
    toDate.value = ''
    selectedDays.value = new Set()
    loadDays()
  }
}, { immediate: true })

function refocusModal() { modalEl.value?.querySelector('button')?.focus() }

/**
 * 删除某天数据前的邻居清理（防止时间凭空增加）：
 * 1. D 从昨天借的 → 清理昨天的 toNext（块随 D 删除）
 * 2. D 从明天借的 → 清理明天的 toPrev（块随 D 删除）
 * 3. D 借给明天的 → 删除明天的 fromPrev meta + 该来源胶水块
 * 4. D 借给昨天的 → 删除昨天的 fromNext meta + 该来源胶水块
 */
function returnBorrowedTime(date) {
  const prevKey = KEY_PREFIX + addDays(date, -1)
  const nextKey = KEY_PREFIX + addDays(date, 1)

  const saveOrRemove = (key, blocks, meta) => {
    if (!blocks.length && !Object.keys(meta).length) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify({ blocks, _cutMeta: meta }))
  }

  // D 借来的：清理邻居的 toNext/toPrev（块不迁移，随 D 删除）
  ;[
    { key: prevKey, field: 'toNext' },
    { key: nextKey, field: 'toPrev' },
  ].forEach(({ key, field }) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const data = normalizeDayData(JSON.parse(raw))
      if (data._cutMeta[field]?.targetDate === date) {
        delete data._cutMeta[field]
        saveOrRemove(key, data.blocks, data._cutMeta)
      }
    } catch { /* skip corrupt neighbors */ }
  })

  // D 借出的：删除邻居的 from* meta + 该来源的胶水块
  ;[
    { key: nextKey, field: 'fromPrev' },
    { key: prevKey, field: 'fromNext' },
  ].forEach(({ key, field }) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const data = normalizeDayData(JSON.parse(raw))
      if (data._cutMeta[field]?.sourceDate === date) {
        delete data._cutMeta[field]
        const blocks = data.blocks.filter(b => b._cut?.sourceDate !== date)
        saveOrRemove(key, blocks, data._cutMeta)
      }
    } catch { /* skip corrupt neighbors */ }
  })
}

async function deleteDate(date) {
  const ok = await showConfirm(STR.confirm.deleteDay(date))
  if (!ok) { refocusModal(); return }
  returnBorrowedTime(date)
  localStorage.removeItem(KEY_PREFIX + date)
  loadDays()
  emit('changed')
}

async function deleteDateRange() {
  if (!fromDate.value || !toDate.value) {
    await showAlert(STR.confirm.selectDateRange)
    return
  }
  const lo = fromDate.value <= toDate.value ? fromDate.value : toDate.value
  const hi = fromDate.value <= toDate.value ? toDate.value : fromDate.value
  const toDel = days.value.filter(d => d.date >= lo && d.date <= hi)
  if (!toDel.length) {
    await showAlert(STR.confirm.noRecordsInRange)
    return
  }
  const total = toDel.reduce((s, d) => s + d.count, 0)
  const ok = await showConfirm(STR.confirm.deleteRangeConfirm(toDel.length, total))
  if (!ok) { refocusModal(); return }
  toDel.forEach(d => {
    returnBorrowedTime(d.date)
    localStorage.removeItem(KEY_PREFIX + d.date)
  })
  loadDays()
  emit('changed')
}

async function deleteSelected() {
  if (!selectedDays.value.size) return
  const total = [...selectedDays.value].reduce((s, d) => {
    const day = days.value.find(x => x.date === d)
    return s + (day?.count || 0)
  }, 0)
  const ok = await showConfirm(STR.confirm.deleteRangeConfirm(selectedDays.value.size, total))
  if (!ok) { refocusModal(); return }
  selectedDays.value.forEach(d => {
    returnBorrowedTime(d)
    localStorage.removeItem(KEY_PREFIX + d)
  })
  selectedDays.value = new Set()
  loadDays()
  emit('changed')
}

async function exportSelected() {
  if (!selectedDays.value.size) return
  const data = { version: 3, exported: new Date().toISOString(), tags: [], days: {} }
  // Include tags
  try { data.tags = JSON.parse(localStorage.getItem(KEY_PREFIX + 'tags')) || [] } catch {}
  // Export selected days
  selectedDays.value.forEach(d => {
    try { data.days[d] = JSON.parse(localStorage.getItem(KEY_PREFIX + d)) } catch {}
  })
  const json = JSON.stringify(data, null, 2)
  if (window.__TAURI__) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({
      defaultPath: 'timelog-partial-' + [...selectedDays.value].sort()[0] + '.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (path) await writeFile(path, new TextEncoder().encode(json))
  } else {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'timelog-partial.json'
    a.click()
    URL.revokeObjectURL(url)
  }
}

async function deleteAll() {
  const totalDays = days.value.length
  const totalBlocks = days.value.reduce((s, d) => s + d.count, 0)
  if (!totalDays) {
    await showAlert(STR.confirm.noRecords)
    return
  }
  const ok = await showConfirm(STR.confirm.deleteAllConfirm(totalDays, totalBlocks))
  if (!ok) { refocusModal(); return }
  days.value.forEach(d => localStorage.removeItem(KEY_PREFIX + d.date))
  loadDays()
  emit('changed')
}

function triggerImport() {
  fileInput.value?.click()
}

async function onFileSelected(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result)
      let count = 0
      if (data.days && typeof data.days === 'object') {
        // Snapshot before any mutations
        const snapDays = {}
        Object.keys(data.days).forEach(date => {
          snapDays[date] = localStorage.getItem(KEY_PREFIX + date)
        })

        Object.entries(data.days).forEach(([date, dayData]) => {
          const blocks = extractBlocks(dayData)
          if (blocks.length) {
            // Merge with existing data
            const key = KEY_PREFIX + date
            let existingRaw = null
            try { existingRaw = JSON.parse(snapDays[date]) } catch { /* ignore */ }
            const existingBlocks = extractBlocks(existingRaw)
            const existingMeta = (existingRaw && existingRaw._cutMeta) || (dayData && dayData._cutMeta) || {}
            const merged = existingBlocks.concat(blocks)
            // Deduplicate by id
            const seen = {}
            merged.forEach(b => {
              const bid = b.id || ('b' + b.start + '-' + b.end)
              if (!seen[bid]) seen[bid] = b
            })
            localStorage.setItem(key, JSON.stringify({ blocks: Object.values(seen), _cutMeta: existingMeta }))
            count += blocks.length
          }
        })

        // Snapshot final state for redo
        const finalDays = {}
        Object.keys(snapDays).forEach(date => {
          finalDays[date] = localStorage.getItem(KEY_PREFIX + date)
        })

        // Push undo entry
        pushStoreUndo({
          undo: () => {
            for (const [date, oldVal] of Object.entries(snapDays)) {
              if (oldVal === null) localStorage.removeItem(KEY_PREFIX + date)
              else localStorage.setItem(KEY_PREFIX + date, oldVal)
            }
          },
          redo: () => {
            for (const [date, val] of Object.entries(finalDays)) {
              if (val === null) localStorage.removeItem(KEY_PREFIX + date)
              else localStorage.setItem(KEY_PREFIX + date, val)
            }
          },
        })
      }
      loadDays()
      emit('changed')
      await showAlert(STR.toast.imported + ' ' + count + ' 条')
    } catch {
      await showAlert(STR.toast.importFail)
    }
  }
  reader.readAsText(file)
  // Reset so same file can be re-imported
  e.target.value = ''
}
</script>

<style scoped>
.dm-head { display: flex; align-items: baseline; justify-content: space-between; }
.dm-head h2 { margin: 0; }
.dm-range { font-size: 12px; color: var(--text2); white-space: nowrap; }
.modal { max-height: calc(82vh / var(--zoom, 1)); overflow: auto; }
.day-list { max-height: 35vh; overflow-y: auto; }
.dayrow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 6px;
  font-size: 13.5px;
}
.dayrow .dinfo {
  flex: 1;
}
.dayrow .dmeta {
  color: var(--text2);
  font-size: 12px;
}
.divider {
  height: 1px;
  background: var(--border);
  margin: 16px 0;
}
.spacer { flex: 1; }
.dcheck { flex-shrink: 0; }
.dcheck input { cursor: pointer; }
.select-all { cursor: pointer; gap: 8px; }
.batch-actions {
  display: flex; gap: 8px; margin-top: 10px; align-items: center;
}
.batch-actions button { font-size: 13px; }
.small {
  font-size: 12px;
  color: var(--text2);
}
</style>

<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')">
    <div class="modal">
      <h2>数据管理</h2>
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
      <div v-if="days.length === 0" class="small">暂无数据</div>
      <div v-for="d in days" :key="d.date" class="dayrow">
        <div class="dinfo">
          {{ d.date }}
          <span class="dmeta">{{ d.count }} 条 · {{ d.hours.toFixed(1) }} 小时</span>
        </div>
        <button class="del" @click="deleteDate(d.date)">删除整天</button>
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
import { ref, watch } from 'vue'
import { KEY_PREFIX } from '../constants.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'changed'])
const { showConfirm, showAlert } = useConfirm()

const days = ref([])
const fromDate = ref('')
const toDate = ref('')
const fileInput = ref(null)

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
        const data = JSON.parse(localStorage.getItem(k))
        if (Array.isArray(data) && data.length) {
          let mins = 0
          data.forEach(b => mins += (b.end - b.start))
          map[date] = { count: data.length, hours: Math.round((mins / 60) * 10) / 10 }
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
    loadDays()
  }
})

async function deleteDate(date) {
  const ok = await showConfirm(STR.confirm.deleteDay(date))
  if (!ok) return
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
  if (!ok) return
  toDel.forEach(d => localStorage.removeItem(KEY_PREFIX + d.date))
  loadDays()
  emit('changed')
}

async function deleteAll() {
  const totalDays = days.value.length
  const totalBlocks = days.value.reduce((s, d) => s + d.count, 0)
  if (!totalDays) {
    await showAlert(STR.confirm.noRecords)
    return
  }
  const ok = await showConfirm(STR.confirm.deleteAllConfirm(totalDays, totalBlocks))
  if (!ok) return
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
        Object.entries(data.days).forEach(([date, blocks]) => {
          if (Array.isArray(blocks) && blocks.length) {
            // Merge with existing data
            const key = KEY_PREFIX + date
            let existing = []
            try { existing = JSON.parse(localStorage.getItem(key)) || [] } catch { /* ignore */ }
            const merged = existing.concat(blocks)
            // Deduplicate by id
            const seen = {}
            merged.forEach(b => {
              const bid = b.id || ('b' + b.start + '-' + b.end)
              if (!seen[bid]) seen[bid] = b
            })
            localStorage.setItem(key, JSON.stringify(Object.values(seen)))
            count += blocks.length
          }
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
.modal input[type=date] {
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

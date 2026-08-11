<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="onCancel">
    <div class="modal" ref="modalEl" @keydown="trapFocus">
      <div class="modal-head">
        <h2>{{ editingBlock ? '编辑时间块' : '记录时间块' }}</h2>
        <span class="duration">{{ duration }}</span>
      </div>

      <label>做了什么</label>
      <input
        type="text"
        id="mTitle"
        v-model="mTitle"
        placeholder="例如：写昨天的复盘"
        autocomplete="off"
        @keydown.enter.prevent="save"
        @focus="settings.autoSelectOnFocus && $event.target.select()"
      >

      <label>时间（可选 +/- 前缀切换帧：−昨天 / +明天 / 无前缀今天）</label>
      <div class="timerow">
        <input type="text" id="mStart" v-model="mStart" pattern="[+\-]?\d{1,2}:\d{2}" placeholder="-08:00" maxlength="6" autocomplete="off" @keydown.enter.prevent="focusFirstChip" @blur="onTimeBlur('start')" @focus="settings.autoSelectOnFocus && $event.target.select()">
        <span>—</span>
        <input type="text" id="mEnd" v-model="mEnd" pattern="[+\-]?\d{1,2}:\d{2}" placeholder="+08:00" maxlength="6" autocomplete="off" @keydown.enter.prevent="focusFirstChip" @blur="onTimeBlur('end')" @focus="settings.autoSelectOnFocus && $event.target.select()">
      </div>

      <label>标签</label>
      <div id="mTags" ref="mTagsRef">
        <template v-for="(tagList, group) in groupedTags" :key="group">
          <div v-if="Object.keys(groupedTags).length > 1 || group !== ''" class="grouplabel">{{ group }}</div>
          <div class="tagwrap">
            <span
              v-for="t in tagList"
              :key="t.name"
              class="chip"
              :class="{ sel: selectedTags.includes(t.name) }"
              tabindex="0"
              role="checkbox"
              :aria-checked="selectedTags.includes(t.name)"
              :style="selectedTags.includes(t.name) ? { background: tagStore.colorOf(t.name).bg, borderColor: tagStore.colorOf(t.name).hex } : {}"
              @click="toggleTag(t.name)"
              @keydown="(e) => onChipKeydown(e, t.name)"
            >
              <span class="tdot" :style="{ background: tagStore.colorOf(t.name).hex }"></span>{{ t.name }}
            </span>
          </div>
        </template>
        <span
          class="chip add"
          tabindex="0"
          @click="emit('manage-tags')"
          @keydown="(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('manage-tags'); } }"
        >⚙ 管理标签</span>
      </div>

      <label>备注（可选）</label>
      <MarkdownEditor
        v-model="mNote"
        height="126px"
        :font-size="settings.editorFontSize"
        :enable-md="settings.markdownPreview"
      />

      <div class="actions">
        <button v-show="!!editingBlock" class="del" @click="deleteBlock">删除</button>
        <button v-show="!!editingBlock" @click="copyBlock">复制</button>
        <span class="spacer"></span>
        <button class="primary" @click="save">保存</button>
        <button @click="onCancel">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { DAY_MIN, DAY_OFFSET } from '../constants.js'
import { useTimelogStore, fmt, toInput, todayStorageBase, addDays } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { useSettingsStore } from '../store/settings.js'
import { useCoordConverter } from '../composables/useCoordConverter.js'
import { useToast } from '../composables/useToast.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'
import MarkdownEditor from './MarkdownEditor.vue'

const props = defineProps({
  show: Boolean,
  editingBlock: { type: Object, default: null },
  createTimes: { type: Object, default: null },
})
const emit = defineEmits(['close', 'manage-tags'])

const timelogStore = useTimelogStore()
const tagStore = useTagStore()
const settings = useSettingsStore()
const { pageRange } = useCoordConverter()
const { toast } = useToast()
const { showConfirm } = useConfirm()

// Form fields
const mTitle = ref('')
const mNote = ref('')
const mStart = ref('')
const mEnd = ref('')
const selectedTags = ref([])
const mTagsRef = ref(null)
const modalEl = ref(null)
const _lastDeselect = ref(null)

// Snapshot on open — used to skip confirm when nothing changed
const original = ref({ title: '', note: '', start: '', end: '', tags: [] })

function isDirty() {
  return mTitle.value !== original.value.title ||
    mNote.value !== original.value.note ||
    mStart.value !== original.value.start ||
    mEnd.value !== original.value.end ||
    selectedTags.value.join(',') !== original.value.tags.join(',')
}

// Populate form when modal opens
// 时间输入接受 [-+]HH:MM 格式，帧由符号决定，可跨区编辑

function parseSignedTime(str) {
  // HH:MM
  const m = (str || '').trim().match(/^([+-])?(\d{1,2}):(\d{2})$/)
  if (m) {
    const min = parseInt(m[2]) * 60 + parseInt(m[3])
    if (min > DAY_MIN) return null
    return { base: m[1] === '-' ? DAY_OFFSET.prev : m[1] === '+' ? DAY_OFFSET.next : DAY_OFFSET.today, min }
  }
  // HHMM (省略 :)
  const n = (str || '').trim().match(/^([+-])?(\d{2})(\d{2})$/)
  if (n) {
    const min = parseInt(n[2]) * 60 + parseInt(n[3])
    if (min > DAY_MIN) return null
    return { base: n[1] === '-' ? DAY_OFFSET.prev : n[1] === '+' ? DAY_OFFSET.next : DAY_OFFSET.today, min }
  }
  return null
}

// blur 时校验格式，非法则回退（范围由 save 时的穿界 split 处理）
function onTimeBlur(field) {
  const val = field === 'start' ? mStart.value : mEnd.value
  if (!val.trim()) return
  const p = parseSignedTime(val)
  if (!p) {
    if (field === 'start') mStart.value = original.value.start
    else mEnd.value = original.value.end
  }
}

function formatSignedTime(local, base) {
  const t = toInput(local)
  if (base === DAY_OFFSET.prev) return '-' + t
  if (base === DAY_OFFSET.next) return '+' + t
  return t
}

// 返回起点坐标所属的帧基准（统一帧坐标）
function frameOf(x) {
  if (x < DAY_OFFSET.today) return DAY_OFFSET.prev      // 昨天帧
  if (x < DAY_OFFSET.next) return DAY_OFFSET.today   // 今天帧
  return DAY_OFFSET.next                 // 明天帧
}

// 返回终点坐标所属的帧基准（统一帧坐标）
// 终点使用 <= 判断，1440 算作昨天帧的结束
function frameOfEnd(x) {
  if (x <= DAY_OFFSET.today) return DAY_OFFSET.prev     // 昨天帧
  if (x <= DAY_OFFSET.next) return DAY_OFFSET.today  // 今天帧
  return DAY_OFFSET.next                 // 明天帧
}

watch(
  () => [props.show, props.editingBlock, props.createTimes],
  ([show, block, cTimes]) => {
    if (!show) return
    if (block) {
      // 存储坐标即统一帧坐标，逐端点判帧并转本地分钟
      const sBase = frameOf(block.start)
      const eBase = frameOfEnd(block.end)
      mTitle.value = block.title || ''
      mNote.value = block.note || ''
      mStart.value = formatSignedTime(block.start - sBase, sBase)
      mEnd.value = formatSignedTime(block.end - eBase, eBase)
      selectedTags.value = [...(block.tags || [])]
    } else if (cTimes) {
      // 存储坐标即统一帧坐标，逐端点判帧并转本地分钟
      const sBase = frameOf(cTimes.start)
      const eBase = frameOfEnd(cTimes.end)
      mTitle.value = ''
      mNote.value = ''
      mStart.value = formatSignedTime(cTimes.start - sBase, sBase)
      mEnd.value = formatSignedTime(cTimes.end - eBase, eBase)
      selectedTags.value = []
    }
    original.value = {
      title: mTitle.value,
      note: mNote.value,
      start: mStart.value,
      end: mEnd.value,
      tags: [...selectedTags.value],
    }
    nextTick(() => {
      const el = document.getElementById('mTitle')
      if (el) el.focus()
    })
  },
  { immediate: true },
)

// Tag grouping
const groupedTags = computed(() => {
  const groups = {}
  tagStore.tags.forEach(t => {
    const g = t.group || ''
    if (!groups[g]) groups[g] = []
    groups[g].push(t)
  })
  return groups
})

// Duration display (HH:MM)
const duration = computed(() => {
  const sp = parseSignedTime(mStart.value)
  const ep = parseSignedTime(mEnd.value)
  const ms = sp ? sp.base + sp.min : 0
  const me = ep ? ep.base + ep.min : 0
  return toInput(Math.max(me - ms, 0))
})

// Tag toggle — 快速取消再选中（800ms 内）→ 提升到第一位（作为主标签）
function toggleTag(name) {
  const idx = selectedTags.value.indexOf(name)
  if (idx === -1) {
    const d = _lastDeselect.value
    if (d && d.name === name && Date.now() - d.time < 800) {
      selectedTags.value.unshift(name)
    } else {
      selectedTags.value.push(name)
    }
    _lastDeselect.value = null
  } else {
    selectedTags.value.splice(idx, 1)
    _lastDeselect.value = { name, time: Date.now() }
  }
}

// Chip keyboard navigation
function onChipKeydown(e, name) {
  if (e.key === ' ') {
    e.preventDefault()
    toggleTag(name)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const chip = e.currentTarget
    const wrap = chip.closest('.tagwrap')
    if (!mTagsRef.value) return
    const wraps = Array.from(mTagsRef.value.querySelectorAll('.tagwrap'))
    const i = wraps.indexOf(wrap)
    if (i === wraps.length - 1) {
      const note = document.querySelector('.md-editor')
      if (note) note.focus()
    } else {
      const fc = wraps[i + 1].querySelector('.chip:not(.add)')
      if (fc) fc.focus()
    }
  }
}

// Focus first tag chip (from time input Enter)
function focusFirstChip() {
  const fc = document.querySelector('#mTags .chip:not(.add)')
  if (fc) fc.focus()
}

// Save
async function save() {
  const sp = parseSignedTime(mStart.value)
  const ep = parseSignedTime(mEnd.value)
  if (!sp || !ep) return
  const storeBase = todayStorageBase(timelogStore._cutMeta)
  const toStorage = (p) => p.base === DAY_OFFSET.today ? p.min + storeBase : p.min + p.base
  let s = toStorage(sp)
  let en = toStorage(ep)
  if (en <= s) en = s + 1
  const newId = props.editingBlock?.id || ('b' + Date.now() + Math.random().toString(36).slice(2, 6))
  // 穿界 split：溢出段用统一坐标存入相邻天（可同时穿上下界）
  // 使用统一帧坐标：昨天 [0,1440)，今天 [1440,2880)，明天 [2880,4320)
  const splitKeys = []
  {
    const us = sp.base + sp.min
    const ue = ep.base + ep.min
    const todayUStart = pageRange.value.lo  // 本页可见起点（统一帧坐标）
    const todayUEnd = pageRange.value.hi    // 本页可见终点（统一帧坐标）
    // 计算本地分钟用于提示（从今天帧 1440 偏移）
    const localStart = todayUStart >= DAY_OFFSET.today && todayUStart < DAY_OFFSET.next ? todayUStart - DAY_OFFSET.today : 0
    const localEnd = todayUEnd >= DAY_OFFSET.today && todayUEnd < DAY_OFFSET.next ? todayUEnd - DAY_OFFSET.today : DAY_MIN
    if (us < todayUStart && ue > todayUStart) {
      const ok = await showConfirm(`时间跨越区段边界，${fmt(localStart)}之前的部分将存入昨天。确认？`)
      if (!ok) return
      splitKeys.push({ dateKey: addDays(timelogStore.dateKey, -1), start: us + DAY_MIN, end: todayUStart + DAY_MIN })
      s = todayUStart
    }
    if (us < todayUEnd && ue > todayUEnd) {
      const ok = await showConfirm(`时间跨越区段边界，${fmt(localEnd)}之后的部分将存入明天。确认？`)
      if (!ok) return
      splitKeys.push({ dateKey: addDays(timelogStore.dateKey, 1), start: todayUEnd - DAY_MIN, end: ue - DAY_MIN })
      en = todayUEnd
    }
  }
  if (en <= s) en = s + 1
  const dur = en - s
  // Confirm short blocks (new blocks only, not edits)
  if (!props.editingBlock && settings.minBlockMinutes > 0 && dur < settings.minBlockMinutes) {
    const confirmed = await showConfirm(STR.confirm.shortBlock(dur, settings.minBlockMinutes))
    if (!confirmed) return  // stay in editor
  }
  // 写分裂块到相邻天
  splitKeys.forEach(sk => {
    try {
      const key = 'timelog:' + sk.dateKey
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) : { blocks: [], _cutMeta: {} }
      const blocks = Array.isArray(data) ? data : (data.blocks || [])
      const piece = { id: newId, start: sk.start, end: sk.end, title: mTitle.value.trim(), note: '', tags: selectedTags.value.slice() }
      // 同 ID 合并
      const existing = blocks.findIndex(b => b.id === newId)
      if (existing !== -1) {
        blocks[existing].start = Math.min(blocks[existing].start, piece.start)
        blocks[existing].end = Math.max(blocks[existing].end, piece.end)
      } else {
        blocks.push(piece)
      }
      localStorage.setItem(key, JSON.stringify(Array.isArray(data) ? blocks : { blocks, _cutMeta: data._cutMeta || {} }))
    } catch {}
  })
  const rec = {
    id: newId,
    start: s,
    end: en,
    title: mTitle.value.trim(),
    note: mNote.value.trim(),
    tags: selectedTags.value.slice(),
    // 保留胶水标记，避免编辑胶水块后丢失来源信息
    ...(props.editingBlock?._cut ? { _cut: props.editingBlock._cut } : {}),
  }
  if (props.editingBlock) timelogStore.updateBlock(rec)
  else timelogStore.addBlock(rec)
  emit('close')
}

async function onCancel() {
  if (!isDirty()) { emit('close'); return }
  const confirmed = await showConfirm(STR.confirm.discardEdit)
  if (confirmed) {
    emit('close')
  } else {
    await nextTick()
    const first = modalEl.value?.querySelector('button, input:not([disabled])')
    if (first) first.focus()
  }
}

// Delete with confirmation
async function deleteBlock() {
  if (!props.editingBlock) return
  const confirmed = await showConfirm(STR.confirm.deleteBlock)
  if (!confirmed) {
    await nextTick()
    const first = modalEl.value?.querySelector('button, input:not([disabled])')
    if (first) first.focus()
    return
  }
  timelogStore.deleteBlock(props.editingBlock.id)
  emit('close')
}

// Copy to clipboard + toast — reads live form values, not props.editingBlock
function copyBlock() {
  const sp = parseSignedTime(mStart.value)
  const ep = parseSignedTime(mEnd.value)
  const storeBase = todayStorageBase(timelogStore._cutMeta)
  const toStorage = (p) => p ? (p.base === DAY_OFFSET.today ? p.min + storeBase : p.min + p.base) : 0
  timelogStore.clipboard = [{
    start: toStorage(sp),
    end: toStorage(ep),
    title: mTitle.value.trim(),
    note: mNote.value.trim(),
    tags: selectedTags.value.slice(),
  }]
  toast(STR.toast.copyBlock)
}

// Focus trap
function trapFocus(e) {
  if (e.key !== 'Tab') return
  if (document.activeElement?.isContentEditable) return
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
.modal-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.modal-head h2 { margin: 0; }
.modal { max-height: calc(82vh / var(--zoom, 1)); overflow: auto; }
.duration {
  font-size: 13px;
  color: var(--text2);
  font-family: Menlo, Consolas, monospace;
  white-space: nowrap;
  user-select: none;
}
.grouplabel {
  font-size: 11px;
  color: var(--text2);
  font-weight: 700;
  margin: 10px 0 4px;
}
.tagwrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 4px 11px;
  font-size: 12.5px;
  cursor: pointer;
  background: var(--canvas);
  user-select: none;
}
.chip.sel {
  font-weight: 600;
}
.chip.add {
  color: var(--text2);
  border-style: dashed;
  margin-top: 8px;
}
.chip:focus-visible,
.chip:focus {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
</style>

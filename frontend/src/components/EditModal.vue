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
      >

      <label>时间（可选 +/- 前缀切换帧：−昨天 / +明天 / 无前缀今天）</label>
      <div class="timerow">
        <input type="text" id="mStart" v-model="mStart" pattern="[+-]?\d{1,2}:\d{2}" placeholder="-08:00" maxlength="6" autocomplete="off" @keydown.enter.prevent="focusFirstChip" @blur="onTimeBlur('start')">
        <span>—</span>
        <input type="text" id="mEnd" v-model="mEnd" pattern="[+-]?\d{1,2}:\d{2}" placeholder="+08:00" maxlength="6" autocomplete="off" @keydown.enter.prevent="focusFirstChip" @blur="onTimeBlur('end')">
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
        :custom-css="settings.customCss"
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
import { useTimelogStore, fmt, toInput, todayStorageBase, storageToLocal } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { useSettingsStore } from '../store/settings.js'
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
    if (min > 1440) return null
    return { base: m[1] === '-' ? 0 : m[1] === '+' ? 2880 : 1440, min }
  }
  // HHMM (省略 :)
  const n = (str || '').trim().match(/^([+-])?(\d{2})(\d{2})$/)
  if (n) {
    const min = parseInt(n[2]) * 60 + parseInt(n[3])
    if (min > 1440) return null
    return { base: n[1] === '-' ? 0 : n[1] === '+' ? 2880 : 1440, min }
  }
  return null
}

// blur 时校验格式 + 范围（是否落在当天的可截取区段内），非法则回退
function onTimeBlur(field) {
  const val = field === 'start' ? mStart.value : mEnd.value
  if (!val.trim()) return
  const p = parseSignedTime(val)
  let valid = false
  if (p) {
    if (p.base === 0) {
      const cutAt = timelogStore._cutMeta?.fromPrev?.cutAt
      valid = cutAt != null && p.min >= cutAt && p.min <= 1440
    } else if (p.base === 1440) {
      const start = timelogStore._cutMeta?.toPrev?.cutAt || 0
      const end = timelogStore._cutMeta?.toNext?.cutAt || 1440
      valid = p.min >= start && p.min <= end
    } else {
      const cutAt = timelogStore._cutMeta?.fromNext?.cutAt
      valid = cutAt != null && p.min >= 0 && p.min <= cutAt
    }
  }
  if (!valid) {
    if (field === 'start') mStart.value = original.value.start
    else mEnd.value = original.value.end
  }
}

function formatSignedTime(local, base) {
  const t = toInput(local)
  if (base === 0) return '-' + t
  if (base === 2880) return '+' + t
  return t
}

watch(
  () => [props.show, props.editingBlock, props.createTimes],
  ([show, block, cTimes]) => {
    if (!show) return
    if (block) {
      const local = storageToLocal(block.start, block.end, timelogStore._cutMeta)
      const sBase = block.start < 1440 ? 0 : block.start < 2880 ? 1440 : 2880
      const eBase = block.end <= 1440 ? 0 : block.end <= 2880 ? 1440 : 2880
      mTitle.value = block.title || ''
      mNote.value = block.note || ''
      mStart.value = formatSignedTime(local.start, sBase)
      mEnd.value = formatSignedTime(local.end, eBase)
      selectedTags.value = [...(block.tags || [])]
    } else if (cTimes) {
      const local = storageToLocal(cTimes.start, cTimes.end, timelogStore._cutMeta)
      const sBase = cTimes.start < 1440 ? 0 : cTimes.start < 2880 ? 1440 : 2880
      const eBase = cTimes.end <= 1440 ? 0 : cTimes.end <= 2880 ? 1440 : 2880
      mTitle.value = ''
      mNote.value = ''
      mStart.value = formatSignedTime(local.start, sBase)
      mEnd.value = formatSignedTime(local.end, eBase)
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

// Tag toggle
function toggleTag(name) {
  const idx = selectedTags.value.indexOf(name)
  if (idx === -1) selectedTags.value.push(name)
  else selectedTags.value.splice(idx, 1)
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
  const storeBase = todayStorageBase(timelogStore._cutMeta)
  const toStorage = (p) => p ? (p.base === 1440 ? p.min + storeBase : p.min + p.base) : 0
  let s = toStorage(sp)
  let en = toStorage(ep)
  if (en <= s) en = s + 1
  const dur = en - s
  // Confirm short blocks (new blocks only, not edits)
  if (!props.editingBlock && settings.minBlockMinutes > 0 && dur < settings.minBlockMinutes) {
    const confirmed = await showConfirm(STR.confirm.shortBlock(dur, settings.minBlockMinutes))
    if (!confirmed) return  // stay in editor
  }
  const rec = {
    id: props.editingBlock?.id || ('b' + Date.now() + Math.random().toString(36).slice(2, 6)),
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
  const toStorage = (p) => p ? (p.base === 1440 ? p.min + storeBase : p.min + p.base) : 0
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
  outline: 2px solid var(--blue);
  outline-offset: 1px;
}
</style>

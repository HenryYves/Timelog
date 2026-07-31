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

      <label>时间</label>
      <div class="timerow">
        <span v-if="startPrefix" class="frame-prefix">{{ startPrefix }}</span>
        <input type="time" id="mStart" v-model="mStart" step="60" @keydown.enter.prevent="focusFirstChip">
        <span>—</span>
        <span v-if="endPrefix" class="frame-prefix">{{ endPrefix }}</span>
        <input type="time" id="mEnd" v-model="mEnd" step="60" @keydown.enter.prevent="focusFirstChip">
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
import { useTimelogStore, fmt, toInput, fromInput, storageToLocal, localToStorage } from '../store/timelog.js'
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
// 用 storageToLocal 获取真实的本地时间（接入了 todayStorageBase），
// frameBase 仅用于输入框前缀（昨天 0 / 今天 1440 / 明天 2880）
const startBase = ref(0)
const endBase = ref(0)
// 当前块的帧类型（save 时回推存储坐标用）
const curFrame = ref('today')

function framePrefix(base) {
  if (base === 2880) return '+'
  if (base === 0 && timelogStore._cutMeta?.fromPrev) return '-'
  return ''
}
const startPrefix = computed(() => framePrefix(startBase.value))
const endPrefix = computed(() => framePrefix(endBase.value))

watch(
  () => [props.show, props.editingBlock, props.createTimes],
  ([show, block, cTimes]) => {
    if (!show) return
    if (block) {
      const local = storageToLocal(block.start, block.end, timelogStore._cutMeta)
      startBase.value = block.start < 1440 ? 0 : block.start < 2880 ? 1440 : 2880
      endBase.value = block.end <= 1440 ? 0 : block.end <= 2880 ? 1440 : 2880
      curFrame.value = block.start < 1440 ? 'prev' : block.start < 2880 ? 'today' : 'next'
      mTitle.value = block.title || ''
      mNote.value = block.note || ''
      mStart.value = toInput(local.start)
      mEnd.value = toInput(local.end)
      selectedTags.value = [...(block.tags || [])]
    } else if (cTimes) {
      const local = storageToLocal(cTimes.start, cTimes.end, timelogStore._cutMeta)
      startBase.value = cTimes.start < 1440 ? 0 : cTimes.start < 2880 ? 1440 : 2880
      endBase.value = cTimes.end <= 1440 ? 0 : cTimes.end <= 2880 ? 1440 : 2880
      curFrame.value = cTimes.start < 1440 ? 'prev' : cTimes.start < 2880 ? 'today' : 'next'
      mTitle.value = ''
      mNote.value = ''
      mStart.value = toInput(local.start)
      mEnd.value = toInput(local.end)
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
  const diff = fromInput(mEnd.value) - fromInput(mStart.value)
  return toInput(Math.max(diff, 0))
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
  const st = localToStorage(
    fromInput(mStart.value), fromInput(mEnd.value),
    timelogStore._cutMeta, curFrame.value,
  )
  let s = st.start
  let en = st.end
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
// 剪贴板统一存存储坐标
function copyBlock() {
  const st = localToStorage(
    fromInput(mStart.value), fromInput(mEnd.value),
    timelogStore._cutMeta, curFrame.value,
  )
  timelogStore.clipboard = [{
    start: st.start,
    end: st.end,
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
.frame-prefix {
  font-weight: 700;
  color: var(--text2);
  user-select: none;
}
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

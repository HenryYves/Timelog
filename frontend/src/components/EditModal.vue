<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')">
    <div class="modal" ref="modalEl" @keydown="trapFocus">
      <h2>{{ editingBlock ? '编辑时间块' : '记录时间块' }}</h2>

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
        <input type="time" id="mStart" v-model="mStart" step="60" @keydown.enter.prevent="focusFirstChip">
        <span>—</span>
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
      <textarea
        id="mNote"
        v-model="mNote"
        placeholder="例如：写得有点慢但挺认真的"
        @input="updatePreview"
        @scroll="syncScroll"
      ></textarea>
      <div class="mdhint">支持 **粗体** *斜体* ~~删除线~~ `代码` - 列表 # 标题</div>
      <div class="mdprev" id="mNotePrev" v-show="notePreview" v-html="notePreview"></div>

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
import { useTimelogStore, fmt, toInput, fromInput } from '../store/timelog.js'
import { useTagStore } from '../store/tags.js'
import { mdToHtml, esc } from '../utils/markdown.js'
import { useToast } from '../composables/useToast.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'

const props = defineProps({
  show: Boolean,
  editingBlock: { type: Object, default: null },
  createTimes: { type: Object, default: null },
})
const emit = defineEmits(['close', 'manage-tags'])

const timelogStore = useTimelogStore()
const tagStore = useTagStore()
const { toast } = useToast()
const { showConfirm } = useConfirm()

// Form fields
const mTitle = ref('')
const mNote = ref('')
const mStart = ref('')
const mEnd = ref('')
const selectedTags = ref([])
const notePreview = ref('')
const mTagsRef = ref(null)
const modalEl = ref(null)

// Populate form when modal opens
watch(
  () => [props.show, props.editingBlock, props.createTimes],
  ([show, block, cTimes]) => {
    if (!show) return
    if (block) {
      mTitle.value = block.title || ''
      mNote.value = block.note || ''
      mStart.value = toInput(block.start)
      mEnd.value = toInput(block.end)
      selectedTags.value = [...(block.tags || [])]
    } else if (cTimes) {
      mTitle.value = ''
      mNote.value = ''
      mStart.value = toInput(cTimes.start)
      mEnd.value = toInput(cTimes.end)
      selectedTags.value = []
    }
    updatePreview()
    nextTick(() => {
      const el = document.getElementById('mTitle')
      if (el) el.focus()
    })
  },
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
      const note = document.getElementById('mNote')
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

// Markdown preview
function updatePreview() {
  notePreview.value = mNote.value.trim() ? mdToHtml(mNote.value) : ''
}

// One-way scroll sync: textarea -> preview
function syncScroll(e) {
  const ta = e.target
  const pv = document.getElementById('mNotePrev')
  if (!pv) return
  const fm = ta.scrollHeight - ta.clientHeight
  const tm = pv.scrollHeight - pv.clientHeight
  pv.scrollTop = fm > 0 ? (ta.scrollTop / fm) * tm : 0
}

// Save
function save() {
  const s = fromInput(mStart.value)
  let en = fromInput(mEnd.value)
  if (en <= s) en = s + 1
  const rec = {
    id: props.editingBlock?.id || ('b' + Date.now() + Math.random().toString(36).slice(2, 6)),
    start: s,
    end: en,
    title: mTitle.value.trim(),
    note: mNote.value.trim(),
    tags: selectedTags.value.slice(),
  }
  if (props.editingBlock) timelogStore.updateBlock(rec)
  else timelogStore.addBlock(rec)
  emit('close')
}

async function onCancel() {
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
  timelogStore.clipboard = [{
    start: fromInput(mStart.value),
    end: fromInput(mEnd.value),
    title: mTitle.value.trim(),
    note: mNote.value.trim(),
    tags: selectedTags.value.slice(),
  }]
  toast(STR.toast.copyBlock)
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
}.mdhint {
  font-size: 11px;
  color: var(--text2);
  margin-top: 5px;
}
.mdprev {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  background: var(--soft);
  line-height: 1.45;
}
#mNote,
#mNotePrev {
  height: 126px;
  line-height: 1.5;
  font-size: 14px;
  padding: 9px 10px;
  box-sizing: border-box;
  overflow-y: auto;
}
#mNote {
  resize: none;
  min-height: 0;
}
.mdprev ul {
  margin: 4px 0;
  padding-left: 18px;
}
.mdprev ol {
  margin: 4px 0;
  padding-left: 18px;
}
.mdprev code {
  background: rgba(0,0,0,.06);
  padding: 0 3px;
  border-radius: 3px;
  font-family: Menlo, Consolas, monospace;
}
.mdprev .md-h1 {
  font-size: 15px;
}
.mdprev .md-h {
  font-weight: 700;
  margin: 2px 0;
}
.mdprev a {
  color: var(--blue);
}
</style>

<template>
  <div v-if="show" class="overlay" @mousedown.self="onCancel" @keydown.escape.stop="onCancel">
    <div class="modal" ref="modalEl" @keydown="trapFocus">
      <h2>{{ STR.batchCreate.title }}</h2>
      <MarkdownEditor
        v-model="text"
        height="220px"
        :font-size="settings.editorFontSize"
        :enable-md="settings.batchMarkdownPreview"
        :custom-css="settings.customCss"
        :placeholder="STR.batchCreate.placeholder"
        :tag-line="true"
        auto-focus
      />
      <div class="small" style="margin:4px 0 10px;">{{ STR.batchCreate.preview(parsed.length) }}</div>
      <div class="actions">
        <span class="spacer"></span>
        <button class="primary" :disabled="!parsed.length" @click="onCreate">{{ STR.batchCreate.create }}</button>
        <button @click="onCancel">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useTimelogStore, dkey, toInput } from '../store/timelog.js'
import { useSettingsStore } from '../store/settings.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useToast } from '../composables/useToast.js'
import { STR } from '../strings.js'
import MarkdownEditor from './MarkdownEditor.vue'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const store = useTimelogStore()
const settings = useSettingsStore()
const { showConfirm } = useConfirm()
const { toast } = useToast()

const text = ref('')
watch(() => props.show, (v) => { if (v) text.value = '' })
const modalEl = ref(null)

// Parse text into blocks
const parsed = computed(() => {
  const raw = text.value
  if (!raw.trim()) return []

  // Split by --- lines; trailing blank lines are consumed by the separator
  const chunks = raw.split(/\n[ \t]*---[ \t]*\n/)
  const results = []
  let prevEnd = null
  for (const chunk of chunks) {
    const block = parseChunk(chunk, prevEnd)
    if (block) { results.push(block); prevEnd = block.end }
  }
  return results
})

function splitTags(str, delims) {
  // Escape special regex chars, build character class: e.g. ", ， ." → /[,，.]+/
  const escaped = [...delims].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')
  return str.split(new RegExp('[' + escaped + ']+')).map(t => t.trim()).filter(Boolean)
}

function parseChunk(chunk, prevEnd) {
  const lines = chunk.split('\n')
  if (!lines.length) return null

  const title = (lines[0] || '').trim() || STR.batchCreate.defaultTitle
  const tags = lines.length > 1
    ? splitTags(lines[1], settings.tagDelimiters)
    : []
  const timeStr = lines.length > 2 ? (lines[2] || '').trim() : ''
  const note = lines.length > 3 ? lines.slice(3).join('\n').trimEnd() : ''

  let start, end
  if (timeStr) {
    const full = timeStr.match(/^(\d{2})(\d{2})\s+(\d{2})(\d{2})$/)
    if (full) {
      start = parseInt(full[1]) * 60 + parseInt(full[2])
      end = parseInt(full[3]) * 60 + parseInt(full[4])
      if (end <= start || start >= 1440) { start = null; end = null }
    } else {
      // Single time → treat as end time, start from prevEnd / default
      const single = timeStr.match(/^(\d{2})(\d{2})$/)
      if (single) {
        end = parseInt(single[1]) * 60 + parseInt(single[2])
        start = null // will be filled by prevEnd / all-day logic below
      }
    }
  }
  if (start == null) {
    if (prevEnd != null) {
      start = prevEnd
      // If prevEnd is in the future (today) → all-day warning
      const now = new Date()
      if (dkey(now) === store.dateKey) {
        const nowMin = now.getHours() * 60 + now.getMinutes()
        if (prevEnd > nowMin) { start = 0; end = 1440; return { title, tags, start, end, note } }
      }
    } else {
      // No prevEnd and no explicit time → all-day warning
      start = 0; end = 1440; return { title, tags, start, end, note }
    }
  }
  if (end == null) {
    end = Math.min(start + 30, 1440)
  } else if (end <= start) {
    // User only provided end time, but start >= end → all-day warning
    start = 0; end = 1440; return { title, tags, start, end, note }
  }

  return { title, tags, start, end, note }
}

// Focus trap
function trapFocus(e) {
  if (e.key !== 'Tab') return
  if (document.activeElement?.isContentEditable) return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll('button:not([disabled]), textarea')
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

async function onCreate() {
  const blocks = parsed.value
  if (!blocks.length) return

  if (settings.checkBeforeCreate) {
    const lines = [`${STR.batchCreate.preview(blocks.length)}\n`]
    for (const b of blocks) {
      lines.push(`${toInput(b.start)} - ${toInput(b.end)}  ${b.title}`)
      if (b.tags.length) lines.push(`  标签：${b.tags.join(', ')}`)
    }
    const confirmed = await showConfirm(lines.join('\n'))
    if (!confirmed) return
  }

  for (const b of blocks) {
    store.addBlock({
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
      start: b.start,
      end: b.end,
      title: b.title,
      note: b.note,
      tags: b.tags,
    })
  }
  toast(STR.batchCreate.created(blocks.length))
  if (settings.copyAfterCreate && text.value.trim()) {
    try { await navigator.clipboard.writeText(text.value) } catch {}
  }
  emit('close')
}

async function onCancel() {
  if (text.value.trim()) {
    const confirmed = await showConfirm(STR.confirm.discardEdit)
    if (!confirmed) return
  }
  emit('close')
}
</script>

<style scoped>
</style>

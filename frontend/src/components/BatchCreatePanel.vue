<template>
  <div v-if="show" class="overlay" @mousedown.self="onCancel" @keydown.escape.stop="onCancel">
    <div class="modal" ref="modalEl" @keydown="trapFocus">
      <h2>{{ STR.batchCreate.title }}</h2>
      <textarea
        ref="ta"
        v-model="text"
        class="batch-ta"
        :placeholder="STR.batchCreate.placeholder"
        @input="onInput"
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
import { ref, computed, nextTick } from 'vue'
import { useTimelogStore, dkey } from '../store/timelog.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useToast } from '../composables/useToast.js'
import { STR } from '../strings.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const store = useTimelogStore()
const { showConfirm } = useConfirm()
const { toast } = useToast()

const text = ref('')
const ta = ref(null)
const modalEl = ref(null)

// Parse text into blocks
const parsed = computed(() => {
  const raw = text.value.trim()
  if (!raw) return []

  // Split by --- lines (standalone, with optional surrounding whitespace)
  const chunks = raw.split(/\n\s*---\s*(?:\n|$)/)
  return chunks.map(parseChunk).filter(b => b)
})

function parseChunk(chunk) {
  const lines = chunk.split('\n')
  if (!lines.length) return null

  const title = (lines[0] || '').trim() || STR.batchCreate.defaultTitle
  const tags = lines.length > 1
    ? lines[1].split(',').map(t => t.trim()).filter(Boolean)
    : []
  const timeStr = lines.length > 2 ? (lines[2] || '').trim() : ''
  const note = lines.length > 3 ? lines.slice(3).join('\n').trimEnd() : ''

  let start, end
  if (timeStr) {
    const m = timeStr.match(/^(\d{2})(\d{2})\s+(\d{2})(\d{2})$/)
    if (m) {
      start = parseInt(m[1]) * 60 + parseInt(m[2])
      end = parseInt(m[3]) * 60 + parseInt(m[4])
      if (end <= start || start >= 1440) { start = null; end = null }
    }
  }
  if (start == null) {
    // Default: same logic as T key
    const now = new Date()
    if (dkey(now) === store.dateKey && store.blocks.length) {
      const last = store.blocks[store.blocks.length - 1]
      start = Math.min(last.end, 1380)
    } else {
      start = 540
    }
    start = Math.round(start / 5) * 5
    end = Math.min(start + 30, 1440)
  }

  return { title, tags, start, end, note }
}

// Focus trap
function trapFocus(e) {
  if (e.key !== 'Tab') return
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

function onInput() {
  // Trigger re-computation
}

async function onCreate() {
  for (const b of parsed.value) {
    store.addBlock({
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
      start: b.start,
      end: b.end,
      title: b.title,
      note: b.note,
      tags: b.tags,
    })
  }
  toast(STR.batchCreate.created(parsed.value.length))
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
.batch-ta {
  width: 100%; min-height: 220px; font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 13px; line-height: 1.6;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 12px; color: var(--text); background: var(--soft);
  resize: vertical; tab-size: 2;
}
.batch-ta:focus { outline: none; border-color: var(--blue); background: var(--canvas); }
.batch-ta::placeholder { color: var(--text2); opacity: .6; }
</style>

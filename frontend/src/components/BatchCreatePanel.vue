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
import { useTimelogStore, dkey, fmtSigned, unifiedToStorage } from '../store/timelog.js'
import { useSettingsStore } from '../store/settings.js'
import { useCoordConverter } from '../composables/useCoordConverter.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useToast } from '../composables/useToast.js'
import { STR } from '../strings.js'
import MarkdownEditor from './MarkdownEditor.vue'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const store = useTimelogStore()
const settings = useSettingsStore()
const { pageRange } = useCoordConverter()
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

/**
 * 解析时间token为统一坐标（带帧）：
 *   -HHMM → 昨天帧 [0,1440)
 *    HHMM → 今天帧 [1440,2880)
 *   +HHMM → 明天帧 [2880,4320)
 */
function parseTimeToken(tok) {
  const m = tok.match(/^([+-]?)(\d{2})(\d{2})$/)
  if (!m) return null
  const min = parseInt(m[2]) * 60 + parseInt(m[3])
  if (min > 1440) return null
  if (m[1] === '-') return min
  if (m[1] === '+') return 2880 + min
  return 1440 + min
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

  const allDay = () => ({ title, tags, start: 1440, end: 2880, note })

  let start, end
  if (timeStr) {
    const parts = timeStr.split(/\s+/)
    if (parts.length === 2) {
      const s = parseTimeToken(parts[0])
      const e = parseTimeToken(parts[1])
      if (s != null && e != null) {
        start = s
        end = e
        if (end <= start) { start = null; end = null }
      }
    } else if (parts.length === 1) {
      // Single time → treat as end time, start from prevEnd / default
      const e = parseTimeToken(parts[0])
      if (e != null) {
        end = e
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
        const prevLocal = prevEnd >= 1440 && prevEnd < 2880 ? prevEnd - 1440 : null
        if (prevLocal != null && prevLocal > nowMin) return allDay()
      }
    } else {
      // No prevEnd and no explicit time → all-day warning
      return allDay()
    }
  }
  if (end == null) {
    // 使用统一帧坐标：昨天 [0,1440)，今天 [1440,2880)，明天 [2880,4320)
    // cap 截断到本页可见终点，防止溢出到不可见区域
    const cap = pageRange.value.hi
    end = Math.min(start + 30, cap)
  } else if (end <= start) {
    // User only provided end time, but start >= end → all-day warning
    return allDay()
  }

  return { title, tags, start, end, note }
}

// Focus trap
function trapFocus(e) {
  if (e.key !== 'Tab') return
  if (document.activeElement?.isContentEditable) return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll('button:not([disabled]), textarea, [tabindex="0"]')
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

  // Short-block check (independent of checkBeforeCreate)
  if (settings.minBlockMinutes > 0) {
    const short = blocks.filter(b => (b.end - b.start) < settings.minBlockMinutes)
    if (short.length) {
      const names = short.map(b => `${fmtSigned(b.start)}-${fmtSigned(b.end)} ${b.title}`).join('\n')
      const confirmed = await showConfirm(
        `以下 ${short.length} 个时间块跨度不足 ${settings.minBlockMinutes} 分钟：\n${names}\n\n${STR.confirm.shortBlock(short[0].end - short[0].start, settings.minBlockMinutes)}`
      )
      if (!confirmed) return
    }
  }

  if (settings.checkBeforeCreate) {
    const lines = [`${STR.batchCreate.preview(blocks.length)}\n`]
    for (const b of blocks) {
      lines.push(`${fmtSigned(b.start)} - ${fmtSigned(b.end)}  ${b.title}`)
      if (b.tags.length) lines.push(`  标签：${b.tags.join(', ')}`)
    }
    const confirmed = await showConfirm(lines.join('\n'))
    if (!confirmed) return
  }

  for (const b of blocks) {
    store.addBlock({
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
      start: unifiedToStorage(b.start),
      end: unifiedToStorage(b.end),
      title: b.title,
      note: b.note,
      tags: b.tags,
    })
  }
  toast(STR.batchCreate.created(blocks.length))
  if (settings.copyAfterCreate && text.value.trim()) {
    if (window.__TAURI__) {
      try { await window.__TAURI__.core.invoke('clipboard_write_text', { text: text.value }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(text.value) } catch {}
    }
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
.modal { max-height: calc(86vh / var(--zoom, 1)); overflow: auto; }
</style>

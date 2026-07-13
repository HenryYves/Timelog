<template>
  <div class="md-wrap" :style="{ height: height || '126px' }">
    <div
      v-if="enableMd"
      ref="editorEl"
      class="md-editor"
      :style="{ fontSize: fontSize + 'px' }"
      contenteditable="true"
      @input="onInput"
      @keydown="onKeydown"
      @paste="onPaste"
      @compositionend="onInput"
    />
    <textarea
      v-else
      ref="taRef"
      :value="modelValue"
      :placeholder="placeholder"
      class="md-fallback"
      :style="{ fontSize: fontSize + 'px' }"
      @input="e => emit('update:modelValue', e.target.value)"
      @keydown="onTaKeydown"
    />
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from 'vue'
import { useSettingsStore } from '../store/settings.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  fontSize: { type: Number, default: 14 },
  enableMd: { type: Boolean, default: true },
  customCss: { type: String, default: '' },
  autoFocus: { type: Boolean, default: false },
  tagLine: { type: Boolean, default: false },
  height: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const settingsStore = useSettingsStore()
const editorEl = ref(null)
const taRef = ref(null)
const isUpdating = ref(false)

// ── Scanner: Cursor offset preservation ──

function saveCursorOffset(root) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let offset = 0
  let node = walker.firstChild()
  while (node) {
    if (node === range.startContainer) {
      offset += range.startOffset
      return offset
    }
    offset += (node.textContent || '').length
    node = walker.nextNode()
  }
  return null
}

function restoreCursorOffset(root, offset) {
  if (offset == null) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let accumulated = 0
  let node = walker.firstChild()
  while (node) {
    const len = (node.textContent || '').length
    if (accumulated + len >= offset) {
      const pos = Math.min(offset - accumulated, len)
      const sel = window.getSelection()
      const range = document.createRange()
      range.setStart(node, pos)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    accumulated += len
    node = walker.nextNode()
  }
  // Fallback: end of content
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

// ── Scanner: Unwrap previous formatting ──

function unwrapFormatting(root) {
  const els = root.querySelectorAll('.md-marker, .md-escape, .tag-hint, b, i, s, code')
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i]
    const parent = el.parentNode
    if (!parent) continue
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el)
    }
    parent.removeChild(el)
  }
}

// ── Scanner: State machine ──

function scanContentEditable(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)

  let state = 'normal'

  for (const textNode of nodes) {
    const text = textNode.textContent || ''

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]

      if (state === 'escape') {
        // Already handled the \ in previous iteration
        state = 'normal'
        continue
      }

      if (ch === '\\') {
        // Wrap \ as gray marker
        const parent = textNode.parentNode
        const span = document.createElement('span')
        span.className = 'md-escape'
        span.textContent = '\\'
        if (i === 0) {
          parent.insertBefore(span, textNode)
          textNode.textContent = text.slice(1)
        } else {
          const after = textNode.splitText(i)
          after.textContent = after.textContent.slice(1)
          parent.insertBefore(span, after)
        }
        state = 'escape'
        return false // re-scan needed
      }

      if (ch === '`') {
        const close = text.indexOf('`', i + 1)
        if (close >= 0) {
          wrapInline(textNode, i, close + 1, 'code', 'code')
          return false
        }
        continue
      }

      if (ch === '~' && text[i + 1] === '~') {
        const closeIdx = text.indexOf('~~', i + 2)
        if (closeIdx >= 0) {
          wrapInline(textNode, i, closeIdx + 2, 's', 's')
          return false
        }
        i++
        continue
      }

      if (ch === '*' && text[i + 1] === '*') {
        const closeIdx = text.indexOf('**', i + 2)
        if (closeIdx >= 0) {
          wrapBold(textNode, i, closeIdx + 2)
          return false
        }
        i++
        continue
      }

      if (ch === '*' && text[i + 1] !== '*') {
        const closeIdx = text.indexOf('*', i + 1)
        if (closeIdx >= 0) {
          wrapInline(textNode, i, closeIdx + 1, 'i', 'i')
          return false
        }
        continue
      }
    }
  }

  return true // scan complete, no DOM changes
}

function wrapInline(textNode, start, end, wrapperTag, wrapperClass) {
  const text = textNode.textContent || ''
  const before = text.slice(0, start)
  const marker1 = text.slice(start, start + (end - start > 3 ? 1 : 1)) // single char marker
  // For backtick: marker is 1 char, content is between
  // For ~: marker is 2 chars
  let markerLen
  if (wrapperTag === 'code') {
    markerLen = 1
  } else if (wrapperTag === 's') {
    markerLen = 2
  } else {
    markerLen = 1
  }
  const firstMarker = text.slice(start, start + markerLen)
  const content = text.slice(start + markerLen, end - markerLen)
  const lastMarker = text.slice(end - markerLen, end)
  const after = text.slice(end)

  const frag = document.createDocumentFragment()
  if (before) frag.appendChild(document.createTextNode(before))

  const m1 = document.createElement('span')
  m1.className = 'md-marker'
  m1.textContent = firstMarker
  frag.appendChild(m1)

  const wrapper = document.createElement(wrapperTag)
  wrapper.textContent = content
  frag.appendChild(wrapper)

  const m2 = document.createElement('span')
  m2.className = 'md-marker'
  m2.textContent = lastMarker
  frag.appendChild(m2)

  if (after) frag.appendChild(document.createTextNode(after))

  textNode.parentNode.replaceChild(frag, textNode)
}

function wrapBold(textNode, start, end) {
  const text = textNode.textContent || ''
  const before = text.slice(0, start)
  const firstMarker = text.slice(start, start + 2)
  const content = text.slice(start + 2, end - 2)
  const lastMarker = text.slice(end - 2, end)
  const after = text.slice(end)

  const frag = document.createDocumentFragment()
  if (before) frag.appendChild(document.createTextNode(before))

  const m1 = document.createElement('span')
  m1.className = 'md-marker'
  m1.textContent = firstMarker
  frag.appendChild(m1)

  const b = document.createElement('b')
  b.textContent = content
  frag.appendChild(b)

  const m2 = document.createElement('span')
  m2.className = 'md-marker'
  m2.textContent = lastMarker
  frag.appendChild(m2)

  if (after) frag.appendChild(document.createTextNode(after))

  textNode.parentNode.replaceChild(frag, textNode)
}

function scanAndHighlight() {
  const root = editorEl.value
  if (!root) return
  const offset = saveCursorOffset(root)
  unwrapFormatting(root)
  while (!scanContentEditable(root)) {}
  restoreCursorOffset(root, offset)
}

// ── Plain text extraction ──

function getPlainText() {
  return editorEl.value.innerText || ''
}

// ── Event handlers ──

function onInput() {
  if (isUpdating.value) return
  scanAndHighlight()
  emit('update:modelValue', getPlainText())
}

function onPaste(e) {
  e.preventDefault()
  const text = e.clipboardData.getData('text/plain')
  document.execCommand('insertText', false, text)
  onInput()
}

function onKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    if (!settingsStore.tabToIndent) return
    document.execCommand('insertText', false, '\t')
    return
  }
}

function onTaKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    if (!settingsStore.tabToIndent) return
    const ta = taRef.value
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newVal = ta.value.slice(0, start) + '\t' + ta.value.slice(end)
    emit('update:modelValue', newVal)
    nextTick(() => {
      ta.selectionStart = ta.selectionEnd = start + 1
    })
  }
}

// ── Lifecycle ──

onMounted(() => {
  if (props.enableMd && props.modelValue) {
    editorEl.value.textContent = props.modelValue
    scanAndHighlight()
  }
  if (props.autoFocus) {
    nextTick(() => {
      const el = props.enableMd ? editorEl.value : taRef.value
      if (el) el.focus()
    })
  }
})

watch(() => props.modelValue, (val) => {
  if (isUpdating.value || !editorEl.value || !props.enableMd) return
  const current = getPlainText()
  if (current !== val) {
    editorEl.value.textContent = val
    scanAndHighlight()
  }
})
</script>

<style scoped>
.md-wrap {
  position: relative;
  width: 100%;
}

.md-editor {
  height: 100%;
  overflow-y: auto;
  outline: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--soft);
  color: var(--text);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
  cursor: text;
}

.md-editor:focus {
  border-color: var(--blue);
  background: var(--canvas);
}

/* ── Scanner styles ── */
.md-editor .md-marker {
  opacity: 0.35;
  font-weight: normal;
  font-style: normal;
}

.md-editor .md-escape {
  opacity: 0.35;
}

.md-editor b {
  font-weight: 700;
}

.md-editor i {
  font-style: italic;
}

.md-editor s {
  text-decoration: line-through;
  opacity: 0.7;
}

.md-editor code {
  background: rgba(0,0,0,.06);
  padding: 0 3px;
  border-radius: 3px;
  font-family: Menlo, Consolas, monospace;
}

.md-fallback {
  width: 100%;
  height: 100%;
  resize: vertical;
  tab-size: 2;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  background: var(--soft);
  font-family: 'Cascadia Code', Consolas, monospace;
  line-height: 1.6;
  box-sizing: border-box;
}

.md-fallback:focus {
  outline: none;
  border-color: var(--blue);
  background: var(--canvas);
}

.md-fallback::placeholder {
  color: var(--text2);
  opacity: .6;
}
</style>

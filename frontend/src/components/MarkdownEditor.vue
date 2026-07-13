<template>
  <div class="md-wrap" :style="{ height: height || '126px' }">
    <div
      v-if="enableMd"
      ref="editorEl"
      class="md-editor"
      :style="{ fontSize: fontSize + 'px' }"
      contenteditable="true"
      tabindex="0"
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
    <component :is="'style'" v-if="customCss">{{ customCss }}</component>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from 'vue'
import { useSettingsStore } from '../store/settings.js'
import { useTagStore } from '../store/tags.js'
import { getTagHint as _getTagHint, getWordBeforeCursor, getDelimiters, getAllCandidates as _getAllCandidates, confirmTagInFreq, loadFreqFromStorage, saveFreqToStorage } from '../utils/editor.js'

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
const tagStore = useTagStore()
const editorEl = ref(null)
const taRef = ref(null)
const isUpdating = ref(false)
const navMode = ref(false)
let inputLock = 0
// lastLineIndex moved into centerCursor closure

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
  const els = root.querySelectorAll('.EditMarkdown-marker, .EditMarkdown-escape, .EditMarkdown-bold, .EditMarkdown-italic, .EditMarkdown-strike, .EditMarkdown-code, .EditMarkdown-highlight')
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
  while (walker.nextNode()) {
    // Skip text inside already-formatted elements — prevents infinite
    // re-wrapping (e.g. \ inside escape span being escaped again)
    let parent = walker.currentNode.parentNode
    let skip = false
    while (parent && parent !== root) {
      if (parent.className && /EditMarkdown-/.test(parent.className)) {
        skip = true
        break
      }
      parent = parent.parentNode
    }
    if (!skip) nodes.push(walker.currentNode)
  }

  for (const textNode of nodes) {
    const text = textNode.textContent || ''
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]

      if (ch === '\\') {
        // \ escapes the NEXT character: \ gray, next char as literal text
        const parent = textNode.parentNode
        const escSpan = document.createElement('span')
        escSpan.className = 'EditMarkdown-escape'
        escSpan.textContent = '\\'

        if (i === 0) {
          const escapedChar = text.length > 1 ? text[1] : null
          if (!escapedChar) continue // lone \ at end of text — leave as-is
          parent.insertBefore(escSpan, textNode)
          const literal = document.createTextNode(escapedChar)
          parent.insertBefore(literal, textNode)
          textNode.nodeValue = text.slice(2) // remove \ + escaped char
        } else {
          const after = textNode.splitText(i)
          const escapedChar = after.nodeValue.length > 1 ? after.nodeValue[1] : null
          if (!escapedChar) continue // lone \ at end of text
          after.nodeValue = after.nodeValue.slice(2)
          const literal = document.createTextNode(escapedChar)
          parent.insertBefore(literal, after)
          parent.insertBefore(escSpan, literal) // \ before escaped char
        }
        return false
      }

      // Helper: find unescaped closing marker, skipping \escaped ones
      function findClosing(text, marker, from) {
        let idx = from
        while (true) {
          idx = text.indexOf(marker, idx)
          if (idx < 0 || idx === 0) return idx
          if (text[idx - 1] !== '\\') return idx
          // Previous char is \ — but \\x means the \ itself is escaped, marker is not
          if (idx >= 2 && text[idx - 2] === '\\') return idx
          idx += marker.length // \x: skip this truly escaped marker
        }
      }

      if (ch === '`') {
        const close = findClosing(text, '`', i + 1)
        if (close >= 0) {
          wrapInline(textNode, i, close + 1, 'code', 'code')
          return false
        }
        continue
      }

      if (ch === '=' && text[i + 1] === '=') {
        const closeIdx = findClosing(text, '==', i + 2)
        if (closeIdx >= 0) {
          wrapInline(textNode, i, closeIdx + 2, 'mark', 'mark')
          return false
        }
        i++
        continue
      }

      if (ch === '~' && text[i + 1] === '~') {
        const closeIdx = findClosing(text, '~~', i + 2)
        if (closeIdx >= 0) {
          wrapInline(textNode, i, closeIdx + 2, 's', 's')
          return false
        }
        i++
        continue
      }

      if (ch === '*' && text[i + 1] === '*') {
        const closeIdx = findClosing(text, '**', i + 2)
        if (closeIdx >= 0) {
          wrapBold(textNode, i, closeIdx + 2)
          return false
        }
        i++
        continue
      }

      if (ch === '*' && text[i + 1] !== '*') {
        const closeIdx = findClosing(text, '*', i + 1)
        if (closeIdx >= 0) {
          wrapInline(textNode, i, closeIdx + 1, 'i', 'i')
          return false
        }
        continue
      }
    }
  }

  return true
}

function wrapInline(textNode, start, end, wrapperTag, wrapperClass) {
  const text = textNode.textContent || ''
  const before = text.slice(0, start)
  // markerLen: 1 for code/*, 2 for ~~
  let markerLen
  if (wrapperTag === 'code') {
    markerLen = 1
  } else if (wrapperTag === 's' || wrapperTag === 'mark') {
    markerLen = 2 // ~~ and == are 2-char markers
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
  m1.className = 'EditMarkdown-marker'
  m1.textContent = firstMarker
  frag.appendChild(m1)

  const wrapper = document.createElement(wrapperTag)
  const cls = { code: 'EditMarkdown-code', i: 'EditMarkdown-italic', s: 'EditMarkdown-strike', mark: 'EditMarkdown-highlight' }
  wrapper.className = cls[wrapperTag] || ''
  wrapper.textContent = content
  frag.appendChild(wrapper)

  const m2 = document.createElement('span')
  m2.className = 'EditMarkdown-marker'
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
  m1.className = 'EditMarkdown-marker'
  m1.textContent = firstMarker
  frag.appendChild(m1)

  const b = document.createElement('b')
  b.className = 'EditMarkdown-bold'
  b.textContent = content
  frag.appendChild(b)

  const m2 = document.createElement('span')
  m2.className = 'EditMarkdown-marker'
  m2.textContent = lastMarker
  frag.appendChild(m2)

  if (after) frag.appendChild(document.createTextNode(after))

  textNode.parentNode.replaceChild(frag, textNode)
}

function scanAndHighlight() {
  // N 模式：仅备注行触发语法渲染；T 模式：全局触发
  if (props.tagLine && getCurrentLineType() < LineType.NOTE) return
  const root = editorEl.value
  if (!root) return
  const offset = saveCursorOffset(root)
  unwrapFormatting(root)
  root.normalize() // merge adjacent text nodes so scanner sees full patterns
  while (!scanContentEditable(root)) {}
  restoreCursorOffset(root, offset)
}

// ── Plain text extraction ──

function getPlainText() {
  const clone = editorEl.value.cloneNode(true)
  clone.querySelectorAll('.tag-hint').forEach(el => el.remove())
  return clone.innerText || ''
}

// ── Cursor centering ──

const centerCursor = (function() {
  let lastLineIndex = -1
  return function() {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (!rect || !rect.top) return
    const editorRect = editorEl.value.getBoundingClientRect()
    const z = (settingsStore.zoom || 100) / 100
    const cursorY = (rect.top - editorRect.top) / z + editorEl.value.scrollTop

    const lineIndex = Math.floor(cursorY / 24)
    if (lineIndex === lastLineIndex) return
    lastLineIndex = lineIndex

    const target = cursorY - editorEl.value.clientHeight / 2
    editorEl.value.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }
})()

// ── Tag hint ──

const tagFreq = {}

function loadFreq() {
  Object.assign(tagFreq, loadFreqFromStorage())
}

function saveFreq() {
  saveFreqToStorage(tagFreq)
}

function getWordAtCursor() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  let node = sel.anchorNode
  if (!node) return null
  let offset = sel.anchorOffset

  // If anchor is on a parent element (cursor next to hint span boundary),
  // step into the adjacent text node
  if (node.nodeType === 1) {
    // Cursor before a contenteditable="false" hint: use text node to left
    if (offset > 0 && node.childNodes[offset - 1]?.nodeType === 3) {
      node = node.childNodes[offset - 1]
      offset = node.textContent.length
    }
    // Cursor after a hint: use text node to right
    else if (offset < node.childNodes.length && node.childNodes[offset]?.nodeType === 3) {
      node = node.childNodes[offset]
      offset = 0
    }
  }

  const text = node.textContent || ''
  const delimiters = getDelimiters()
  return getWordBeforeCursor(text, offset, delimiters)
}

function getTagHint(word) {
  const tags = tagStore.tags.map(t => t.name)
  return _getTagHint(word, tags, tagFreq)
}

function getAllCandidates(word) {
  const tags = tagStore.tags.map(t => t.name)
  return _getAllCandidates(word, tags, tagFreq)
}

// ── Line type detection ──

const LineType = { TITLE: 0, TAG: 1, TIME: 2, NOTE: 3, UNKNOWN: -1 }

function getCurrentLineType() {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return LineType.UNKNOWN
  let lineEl = sel.anchorNode
  while (lineEl && lineEl.parentNode !== editorEl.value) {
    lineEl = lineEl.parentNode
  }
  if (!lineEl || lineEl.parentNode !== editorEl.value) return LineType.UNKNOWN

  let linesInBlock = 0
  for (const child of editorEl.value.childNodes) {
    if (child === lineEl) { linesInBlock++; break }
    const t = (child.textContent || '').trim()
    if (/^---$/.test(t)) { linesInBlock = 0; continue }
    if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {
      linesInBlock++
    }
  }
  if (linesInBlock === 1) return LineType.TITLE
  if (linesInBlock === 2) return LineType.TAG
  if (linesInBlock === 3) return LineType.TIME
  if (linesInBlock >= 4) return LineType.NOTE
  return LineType.UNKNOWN
}

// ── Tag hint ──

function updateInlineHint() {
  if (!props.tagLine) return
  if (getCurrentLineType() !== LineType.TAG) return
  const old = editorEl.value.querySelector('.tag-hint')
  if (old) old.remove()

  const word = getWordAtCursor()
  if (!word) return

  // Delimiter typed: confirm the tag before the delimiter
  const lastChar = word[word.length - 1]
  if (',.，。、'.includes(lastChar)) {
    const tag = word.slice(0, -1).trim()
    if (tag) confirmTag(tag)
    return
  }

  const hint = getTagHint(word)
  if (!hint) return

  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  const hintSpan = document.createElement('span')
  hintSpan.className = 'tag-hint'
  hintSpan.textContent = hint
  range.collapse(false)
  range.insertNode(hintSpan)
  // Move cursor before hint
  range.setStartBefore(hintSpan)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function confirmTagHint() {
  const hint = editorEl.value.querySelector('.tag-hint')
  if (!hint) return
  const word = getWordAtCursor()
  if (!word) return
  const suffix = hint.textContent || ''
  const fullTag = word + suffix

  // Insert suffix as regular text, then remove the hint span
  const parent = hint.parentNode
  // Save where to place cursor: after the hint span (which will be removed)
  const range = document.createRange()
  range.setStartAfter(hint)
  range.collapse(true)

  const suffixNode = document.createTextNode(suffix)
  parent.insertBefore(suffixNode, hint)
  hint.remove()
  parent.normalize() // merge adjacent text nodes

  // Position cursor: range was set after hint, which is now after the merged text
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)

  confirmTag(fullTag)
  // Programmatic DOM change doesn't trigger input event —
  // manually re-check for further prefix matches (e.g. "写作" → "写作方法")
  nextTick(() => {
    updateInlineHint()
    editorEl.value?.focus()
  })
}

function cycleTagHint() {
  const hint = editorEl.value.querySelector('.tag-hint')
  if (!hint) return
  const word = getWordAtCursor()
  if (!word) return
  const candidates = getAllCandidates(word)
  if (!candidates.length) return

  // Determine current candidate from hint
  const suffix = hint.textContent || ''
  const full = word + suffix
  const idx = candidates.indexOf(full)

  // Next candidate (cycle)
  const nextIdx = (idx + 1) % candidates.length
  const next = candidates[nextIdx]

  // Replace hint text
  hint.textContent = next.slice(word.length)

  // Update cursor
  const sel = window.getSelection()
  const range = document.createRange()
  range.setStartBefore(hint)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function confirmTag(word) {
  confirmTagInFreq(word, tagFreq)
  saveFreqToStorage(tagFreq)
}

function onInput() {
  if (inputLock > 0) return
  inputLock++
  try {
    scanAndHighlight()
    emit('update:modelValue', getPlainText())
  } finally {
    nextTick(() => {
      if (props.tagLine) updateInlineHint()
      centerCursor()
    })
    // Unlock after a macro-task — ensures all microtask-level input events
    // triggered by DOM mutations in the scanner have been processed
    setTimeout(() => { inputLock = 0 }, 0)
  }
}

function onPaste(e) {
  e.preventDefault()
  const text = e.clipboardData.getData('text/plain')
  document.execCommand('insertText', false, text)
  onInput()
}

function onKeydown(e) {
  const isTagLine = props.tagLine
  const hint = editorEl.value.querySelector('.tag-hint')

  // Backspace/Delete with hint present: remove hint, let browser delete normally
  if (hint && (e.key === 'Backspace' || e.key === 'Delete')) {
    hint.remove()
    // Let event proceed — browser handles the actual deletion
  }

  // Enter: confirm tag hint (tagLine only)
  if (e.key === 'Enter' && isTagLine) {
    const word = getWordAtCursor()
    if (word) confirmTag(word)
    // Remove hint span before default Enter behavior inserts newline
    if (hint) hint.remove()
    return
  }

  // Tab: tag hint cycling, nav mode tab-out, or indent
  if (e.key === 'Tab') {
    // Tag hint cycling takes priority when hint exists
    if (isTagLine && hint) {
      e.preventDefault()
      e.stopPropagation()
      confirmTagHint()
      return
    }

    // Nav mode: jump to next focusable
    if (navMode.value) {
      e.preventDefault()
      e.stopPropagation()
      const focusable = [...document.querySelectorAll(
        '.modal button:not([disabled]), .modal input:not([disabled]), [tabindex="0"]'
      )]
      if (focusable.length > 0) focusable[0].focus()
      navMode.value = false
      editorEl.value.style.outline = ''
      return
    }

    // Normal: insert tab (only at line start)
    e.preventDefault()
    e.stopPropagation()
    // Only intercept Tab at line start; elsewhere let browser handle focus
    let atLineStart = false
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const node = sel.anchorNode
      const off = sel.anchorOffset
      const text = node?.textContent || ''
      // Cursor at start of text, or after \n, or after existing leading tabs
      if (off === 0 || text[off - 1] === '\n') {
        atLineStart = true
      } else {
        let i = off - 1
        while (i >= 0 && text[i] === '\t') i--
        atLineStart = i < 0 || text[i] === '\n'
      }
    }
    const tabIndent = props.tagLine ? settingsStore.batchTabToIndent : settingsStore.tabToIndent
    // Only insert \t when indent is ON AND cursor is at line start.
    // Otherwise, switch focus to next element in modal.
    if (!tabIndent || !atLineStart) {
      const modal = editorEl.value.closest('.modal')
      if (modal) {
        const focusable = modal.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        )
        const visible = [...focusable].filter(el => el.offsetParent !== null)
        const idx = visible.indexOf(editorEl.value)
        if (e.shiftKey) {
          if (idx > 0) visible[idx - 1].focus()
          else if (visible.length) visible[visible.length - 1].focus()
        } else {
          if (idx !== -1 && idx < visible.length - 1) visible[idx + 1].focus()
          else if (visible.length) visible[0].focus()
        }
      }
      return
    }
    // Insert tab at line start with indent enabled
    e.preventDefault()
    e.stopPropagation()
    const tabNode = document.createTextNode('\t')
    if (sel?.rangeCount) {
      const r = sel.getRangeAt(0)
      r.deleteContents()
      r.insertNode(tabNode)
      r.setStartAfter(tabNode)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
    }
    return
  }

  // ESC: nav mode toggle
  if (e.key === 'Escape') {
    if (!navMode.value) {
      e.preventDefault()
      e.stopPropagation()
      editorEl.value.blur()
      navMode.value = true
      editorEl.value.style.outline = '2px solid var(--text2)'
      return
    }
    // Second ESC: exit nav mode, let modal handle ESC
    navMode.value = false
    editorEl.value.style.outline = ''
    return
  }

  // Space/Enter from container focus: enter edit mode
  if ((e.key === ' ' || e.key === 'Enter') && document.activeElement !== editorEl.value) {
    e.preventDefault()
    editorEl.value.focus()
    return
  }
}

function onTaKeydown(e) {
  if (e.key === 'Tab') {
    const tabIndent = props.tagLine ? settingsStore.batchTabToIndent : settingsStore.tabToIndent
    const ta = taRef.value
    const start = ta.selectionStart
    // Cursor at start, after \n, or after existing leading tabs
    let atLineStart = start === 0 || ta.value[start - 1] === '\n'
    if (!atLineStart && start > 0) {
      let i = start - 1
      while (i >= 0 && ta.value[i] === '\t') i--
      atLineStart = i < 0 || ta.value[i] === '\n'
    }

    if (!tabIndent || !atLineStart) {
      e.preventDefault()
      e.stopPropagation()
      const modal = ta.closest('.modal')
      if (modal) {
        const focusable = modal.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        )
        const visible = [...focusable].filter(el => el.offsetParent !== null)
        const idx = visible.indexOf(ta)
        if (e.shiftKey) {
          if (idx > 0) visible[idx - 1].focus()
          else if (visible.length) visible[visible.length - 1].focus()
        } else {
          if (idx !== -1 && idx < visible.length - 1) visible[idx + 1].focus()
          else if (visible.length) visible[0].focus()
        }
      }
      return
    }

    e.preventDefault()
    e.stopPropagation()
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
  loadFreq()
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

// modelValue → editor sync (one-way, from parent to child only on initial load or reset)
watch(() => props.modelValue, (val) => {
  if (isUpdating.value || !editorEl.value || !props.enableMd) return
  const current = getPlainText()
  if (current !== val) {
    // Only sync when truly different (e.g. modal opened with existing text, or reset)
    isUpdating.value = true
    editorEl.value.textContent = val
    nextTick(() => { isUpdating.value = false })
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

/* ── Scanner styles (unscoped — elements created via JS need global classes) ── */
.md-editor .tag-hint {
  color: var(--text2);
  opacity: 0.5;
  user-select: none;
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

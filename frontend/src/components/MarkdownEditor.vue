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
      @compositionstart="isComposing = true"
      @compositionend="isComposing = false; startUndoEntry('insertText'); onInput"
      @focus="onEditorFocus"
      @mousedown="lastEditorMousedown = Date.now()"
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
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSettingsStore } from '../store/settings.js'
import { useTagStore } from '../store/tags.js'
import { getTagHint as _getTagHint, getWordBeforeCursor, getDelimiters, getAllCandidates as _getAllCandidates, confirmTagInFreq, loadFreqFromStorage, saveFreqToStorage } from '../utils/editor.js'
import { UndoManager, shouldMergeEditorEntry } from '../utils/undo.js'
import { saveCursor, restoreCursor } from '../utils/cursor.js'
import { unwrapFormatting, scanContentEditable, scanLists, renumberLists } from '../utils/scanner.js'
import noEditSvg from '../assets/no-edit.svg'

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
const editorUndo = new UndoManager()
let pendingUndoEntry = null // snapshot taken before current input
let isComposing = false    // IME composition in progress — skip undo tracking
let lastEditorMousedown = 0

function onEditorFocus() {
  if (navMode.value) return
  // Focus via keyboard (Tab / Enter) → nav mode; mouse click → edit mode
  if (Date.now() - lastEditorMousedown > 300) {
    navMode.value = true
    const el = editorEl.value
    if (el) el.style.outline = '2px solid var(--text2)'
  }
}
let _scanning = false     // scanAndHighlight in progress — suppress selectionchange



// ── List continuation helpers ──

function getCurrentBlock() {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return null
  let block = sel.getRangeAt(0).startContainer
  while (block && block.parentNode !== editorEl.value) {
    block = block.parentNode
  }
  // If the container is a bare text node directly in root (no wrapping
  // <div>), use the root itself as the "block" so textContent includes
  // preceding elements like marker spans.
  if (block && block.nodeType === 3 && block.parentNode === editorEl.value) {
    return editorEl.value
  }
  return block && block !== editorEl.value ? block : null
}

function getOffsetInBlock(block) {
  if (!block) return 0
  const sel = window.getSelection()
  if (!sel?.rangeCount) return 0
  const range = sel.getRangeAt(0)
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null)
  let pos = 0
  let node = walker.firstChild()
  while (node) {
    if (node === range.startContainer) {
      return pos + range.startOffset
    }
    pos += (node.textContent || '').length
    node = walker.nextNode()
  }
  return pos
}

function getListPrefix() {
  const block = getCurrentBlock()
  if (!block) return null
  const text = block.textContent || ''
  const m = text.match(/^(\s*)([-*]|\d+\.)\s/)
  if (!m) return null
  return { full: m[0], indent: m[1], marker: m[2], content: text.slice(m[0].length) }
}


function scanAndHighlight() {
  // N 模式：仅备注行触发语法渲染；T 模式：全局触发
  if (props.tagLine && getCurrentLineType() < LineType.NOTE) return
  const root = editorEl.value
  if (!root) return
  _scanning = true
  try {
    const focused = document.activeElement === root
    const saved = focused ? saveCursor(root) : null
    unwrapFormatting(root)
    root.normalize() // merge adjacent text nodes so scanner sees full patterns
    renumberLists(root, props.tagLine) // re-number ordered lists before scanning
    scanLists(root, props.tagLine)   // list markers: - / * / 1. at line start
    // N mode: only scan NOTE lines (4+); T mode: scan all
    if (props.tagLine) {
      let lineNo = 0
      for (const child of root.childNodes) {
        const t = (child.textContent || '').trim()
        if (/^---$/.test(t)) { lineNo = 0; continue }
        if (child.nodeType === 1) lineNo++
        if (lineNo > 3) while (!scanContentEditable(child)) {}
      }
    } else {
      while (!scanContentEditable(root)) {}
    }
    // Wrap bare text nodes in root with <div> — stabilizes cursor against
    // browser boundary-push behavior in WebView2's flat DOM mode.
    let _i = 0
    while (_i < root.childNodes.length) {
      const child = root.childNodes[_i]
      if (child.nodeType === 3) {
        const div = document.createElement('div')
        root.insertBefore(div, child)
        div.appendChild(child)
        continue // _i stays, next iteration sees the new <div>
      }
      _i++
    }
    if (saved) restoreCursor(root, saved)
  } finally {
    _scanning = false
  }
}

// ── Plain text extraction ──

function getPlainText() {
  const root = editorEl.value
  if (!root) return ''
  const parts = []
  function walk(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        parts.push(child.textContent || '')
      } else if (child.nodeType === 1) {
        if (child.classList && child.classList.contains('tag-hint')) continue
        const tag = child.tagName
        if (tag === 'DIV') {
          // contenteditable 用 <div> 换行，在每个 <div> 前插入 \n（首个除外）
          if (parts.length > 0) parts.push('\n')
          walk(child)
        } else if (tag === 'BR') {
          parts.push('\n')
        } else {
          // 行内元素（span/b/i/s/mark/code）——进入提取文字
          walk(child)
        }
      }
    }
  }
  walk(root)
  return parts.join('')
}

// ── Cursor centering ──

let _centerLine = -1
let _lineH = 0

function getEditorLineHeight() {
  if (!_lineH && editorEl.value) {
    _lineH = parseFloat(getComputedStyle(editorEl.value).lineHeight) || 24
  }
  return _lineH || 24
}

function resetCenterCursor() {
  _centerLine = -1
}

function centerCursor(force = false) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  let rect = range.getBoundingClientRect()
  // WebView2 quirk: collapsed range on element boundary may return height=0.
  // Fall back to the element's own bounding rect.
  if (rect.height === 0 && range.startContainer.nodeType === 1) {
    rect = range.startContainer.getBoundingClientRect()
  }
  if (!rect || !rect.height) return

  const editor = editorEl.value
  const editorRect = editor.getBoundingClientRect()
  const z = (settingsStore.zoom || 100) / 100
  const cursorY = (rect.top - editorRect.top) / z + editor.scrollTop

  const lineH = getEditorLineHeight()
  const lineIndex = Math.floor(cursorY / lineH)
  if (!force && lineIndex === _centerLine) return
  _centerLine = lineIndex

  // Only scroll if cursor is more than 1 line away from viewport center
  const visibleCenter = editor.scrollTop + editor.clientHeight / 2
  if (Math.abs(cursorY - visibleCenter) < lineH) return

  const target = cursorY - editor.clientHeight / 2
  editor.scrollTo({ top: target, behavior: 'smooth' })
}

function onSelectionChange() {
  if (_scanning) return  // suppress during scan — nextTick handles it after
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  if (!editorEl.value) return
  if (!editorEl.value.contains(sel.anchorNode)) return
  centerCursor()
}

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

// ── Undo ──

function _undoSnapshot() {
  const root = editorEl.value
  return {
    text: getPlainText(),
    offset: saveCursor(root)
  }
}

function restoreUndoState(state) {
  if (!state) return
  setEditorContent(state.text)
  nextTick(() => {
    scanAndHighlight()
    if (state.offset) restoreCursor(editorEl.value, state.offset)
  })
}

function startUndoEntry(inputType) {
  if (pendingUndoEntry || isComposing) return
  pendingUndoEntry = { prev: _undoSnapshot(), next: null, inputType }
}

function commitUndoEntry() {
  if (!pendingUndoEntry) return
  pendingUndoEntry.next = _undoSnapshot()

  // Ignore no-op changes
  if (pendingUndoEntry.prev.text === pendingUndoEntry.next.text) {
    pendingUndoEntry = null
    return
  }

  const entry = pendingUndoEntry
  const top = editorUndo.top()

  // Only merge consecutive insertText (continuous typing). Structural
  // changes (Enter, Backspace, Delete) always start a new undo entry.
  if (top && entry.inputType === 'insertText' && top._snapshot?.inputType === 'insertText' && shouldMergeEditorEntry(top._snapshot || top, entry)) {
    // Merge: update the redo target of the previous entry
    editorUndo.updateRedo(() => restoreUndoState(entry.next))
    top._snapshot = entry
  } else {
    editorUndo.push({
      _snapshot: entry,
      undo: () => restoreUndoState(entry.prev),
      redo: () => restoreUndoState(entry.next)
    })
  }
  pendingUndoEntry = null
}

function onInput() {
  if (inputLock > 0) return
  inputLock++

  // Commit undo entry (snapshot after browser DOM change)
  commitUndoEntry()

  try {
    scanAndHighlight()
    emit('update:modelValue', getPlainText())
  } finally {
    nextTick(() => {
      if (props.tagLine) updateInlineHint()
    })
    // Use rAF so layout is complete before reading cursor bounding rect
    requestAnimationFrame(() => {
      centerCursor(true)
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
  // Nav mode: Space/Enter to edit, others blocked (Tab handled below at ~870)
  if (navMode.value) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      navMode.value = false
      editorEl.value.style.outline = ''
      return
    }
    if (e.key !== 'Tab') {
      e.preventDefault()
      return
    }
    // Tab: let it reach the nav-mode handler below for direction-aware focus jump
  }

  const isTagLine = props.tagLine
  const hint = editorEl.value.querySelector('.tag-hint')

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z — custom undo/redo
  if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault()
    if (e.shiftKey || e.key === 'Y') {
      editorUndo.redo()
    } else {
      editorUndo.undo()
    }
    return
  }
  if (e.ctrlKey && e.key === 'y') {
    e.preventDefault()
    editorUndo.redo()
    return
  }

  // Start undo entry for undoable keys (before browser modifies DOM)
  if (!e.ctrlKey && !e.metaKey) {
    const k = e.key
    if (k.length === 1) {
      startUndoEntry('insertText')
    } else if (k === 'Enter') {
      startUndoEntry('insertParagraph')
    } else if (k === 'Backspace' || k === 'Delete') {
      startUndoEntry('deleteContent')
    }
  }

  // Backspace/Delete: handle EditMarkdown elements
  if (e.key === 'Backspace' || e.key === 'Delete') {
    // Remove hint if present
    if (hint) hint.remove()

    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0)
      if (range.collapsed) {
        let node = range.startContainer

        // Case 1 (Backspace only): cursor inside an EditMarkdown element
        //  - escape → delete element + char
        //  - marker/content → unwrap (preserve text)
        if (e.key === 'Backspace' && node.nodeType === 3) {
          let el = node.parentNode
          while (el && el !== editorEl.value) {
            if (el.className && el.className.includes('EditMarkdown-escape')) {
              e.preventDefault()
              const parent = el.parentNode
              const r = document.createRange()
              if (el.nextSibling) { r.setStartBefore(el.nextSibling) }
              else if (el.previousSibling) { r.setStartAfter(el.previousSibling) }
              else { r.selectNodeContents(parent); r.collapse(true) }
              r.collapse(true)
              el.remove()
              if (parent) parent.normalize()
              sel.removeAllRanges()
              sel.addRange(r)
              return
            }
            // Marker/content elements:
            //  - offset=0 → delete char from previous text node (marker edge)
            //  - offset>0 in marker/escape → manual delete at cursor position
            //  - offset>0 in content wrapper (<b>/<i>/etc.) → browser native
            if (el.className && /EditMarkdown-/.test(el.className)) {
              if (range.startOffset > 0) {
                if (el.classList?.contains('EditMarkdown-marker') ||
                    el.classList?.contains('EditMarkdown-escape')) {
                  // Mid-marker: delete char before cursor ourselves
                  e.preventDefault()
                  inputLock++
                  const t = node.textContent || ''
                  const newOff = range.startOffset - 1
                  node.textContent = t.slice(0, newOff) + t.slice(range.startOffset)
                  sel.collapse(node, newOff)
                  inputLock--
                  onInput()
                }
                // content wrapper mid-text → break, let browser handle
                break
              }
              // offset=0: delete char from previous text node
              let prev = node.previousSibling
              while (prev) {
                if (prev.nodeType === 3) break
                prev = prev.previousSibling
              }
              if (prev && prev.nodeType === 3) {
                const text = prev.textContent || ''
                if (text.length > 0) {
                  e.preventDefault()
                  inputLock++
                  prev.textContent = text.slice(0, -1)
                  if (!prev.textContent) {
                    const span = prev.parentNode
                    if (span && span.nodeType === 1 && span !== el.parentNode) span.remove()
                  }
                  node.parentNode.normalize?.()
                  inputLock--
                  onInput()
                }
              }
              return
            }
            el = el.parentNode
          }
        }

        // Case 1b (Delete): cursor at end of text inside EditMarkdown element.
        // Delete first character of next text node (mirror of Backspace logic).
        if (e.key === 'Delete' && node.nodeType === 3) {
          const textLen = (node.textContent || '').length
          if (range.startOffset < textLen) {
            // Mid-text in marker/escape: delete char at cursor position
            let elM = node.parentNode
            while (elM && elM !== editorEl.value) {
              if (elM.classList?.contains('EditMarkdown-marker') ||
                  elM.classList?.contains('EditMarkdown-escape')) {
                e.preventDefault()
                inputLock++
                const t = node.textContent || ''
                node.textContent = t.slice(0, range.startOffset) + t.slice(range.startOffset + 1)
                sel.removeAllRanges()
                const r = document.createRange()
                r.setStart(node, range.startOffset)
                r.collapse(true)
                sel.addRange(r)
                inputLock--
                onInput()
                return
              }
              elM = elM.parentNode
            }
          }
          // Cursor at text end inside EditMarkdown: delete first char
          // of next text node (mirror of Backspace offset=0 logic).
          if (range.startOffset === textLen && textLen > 0) {
            let el = node.parentNode
            while (el && el !== editorEl.value) {
              if (el.className && /EditMarkdown-/.test(el.className)) {
                let next = node.nextSibling
                while (next) {
                  if (next.nodeType === 3) break
                  next = next.nextSibling
                }
                if (next && next.nodeType === 3) {
                  const text = next.textContent || ''
                  if (text.length > 0) {
                    e.preventDefault()
                    inputLock++
                    next.textContent = text.slice(1)
                    if (!next.textContent) {
                      const span = next.parentNode
                      if (span && span.nodeType === 1 && span !== el.parentNode) span.remove()
                    }
                    node.parentNode.normalize?.()
                    inputLock--
                    onInput()
                  }
                }
                return
              }
              el = el.parentNode
            }
          }
        }

        // Case 2: cursor at text node boundary next to an EditMarkdown sibling
        if (node.nodeType === 3) {
          if (e.key === 'Backspace' && range.startOffset === 0) {
            const prev = node.previousSibling
            if (prev && prev.nodeType === 1 && prev.className && /EditMarkdown-/.test(prev.className)) {
              e.preventDefault()
              const parent = prev.parentNode
              prev.remove()
              // Keep block non-empty to prevent browser merge —
              // check for actual content, not just empty text nodes
              if (parent && !parent.textContent.trim() && parent.querySelector('br') === null) {
                parent.appendChild(document.createElement('br'))
              }
              return
            }
          }
          if (e.key === 'Delete' && range.startOffset === (node.textContent || '').length) {
            const next = node.nextSibling
            if (next && next.nodeType === 1 && next.className && /EditMarkdown-/.test(next.className)) {
              e.preventDefault()
              const parent = next.parentNode
              next.remove()
              if (parent && !parent.textContent.trim() && parent.querySelector('br') === null) {
                parent.appendChild(document.createElement('br'))
              }
              return
            }
          }
        }

        // Case 3: Backspace at position 1 in the first content text of a block.
        // WebView2 merges blocks when deletion results in cursor at pos 0
        // of a block's first text node. Handle ourselves to prevent the merge.
        if (e.key === 'Backspace' && node.nodeType === 3 && range.startOffset === 1) {
          const block = node.parentNode
          if (block && block !== editorEl.value) {
            // Check that only EditMarkdown elements precede this text node
            let prev = node.previousSibling
            let atBlockStart = true
            while (prev) {
              if (!(prev.nodeType === 1 && prev.className && /EditMarkdown-/.test(prev.className))) {
                atBlockStart = false
                break
              }
              prev = prev.previousSibling
            }
            if (atBlockStart && block.previousSibling) {
              e.preventDefault()
              const text = node.textContent || ''
              node.textContent = text.slice(1) // delete first char
              const r = document.createRange()
              r.setStart(node, 0)
              r.collapse(true)
              sel.removeAllRanges()
              sel.addRange(r)
              return
            }
          }
        }
      }
    }
  }

  // Enter: confirm tag hint (tagLine only), then fall through to div-break
  if (e.key === 'Enter' && isTagLine) {
    const word = getWordAtCursor()
    if (word) confirmTag(word)
    if (hint) hint.remove()
  }

  // Enter: unified split + insert + cleanup + scanAll paths (list / indent / plain)
  // use the same formula: split text at cursor, insert new block after.
  if (e.key === 'Enter') {
    const prefix = getListPrefix()
    // Empty list item → end the list
    if (prefix && !prefix.content.trim()) {
      e.preventDefault()
      const block = getCurrentBlock()
      if (block) { block.textContent = ''; block.appendChild(document.createElement('br')) }
      return
    }
    const block = getCurrentBlock()
    // Empty line → fallback appendChild
    if (!block || !block.textContent) {
      e.preventDefault()
      inputLock++
      const newDiv = document.createElement('div')
      newDiv.appendChild(document.createElement('br'))
      editorEl.value.appendChild(newDiv)
      const sel = window.getSelection()
      sel.collapse(newDiv.firstChild, 0)
      inputLock--
      onInput()
      return
    }
    e.preventDefault()
    inputLock++
    const offset = getOffsetInBlock(block)
    const fullText = block.textContent || ''
    const textBefore = fullText.slice(0, offset)
    const textAfter = fullText.slice(offset)
    // Determine prefix for new line
    let newPrefix = ''
    if (prefix) {
      let nextMarker = prefix.marker
      const ordered = prefix.marker.match(/^(\d+)\.$/)
      if (ordered) nextMarker = (parseInt(ordered[1]) + 1) + '.'
      newPrefix = prefix.indent + nextMarker + ' '
    } else {
      const im = fullText.match(/^(\s+)/)
      if (im && fullText.trim()) newPrefix = im[1]
    }
    const parent = editorEl.value
    const refNode = block.nextSibling
    // Current block: keep if has content, remove if empty
    if (textBefore.trim()) {
      block.textContent = textBefore
    } else {
      block.remove()
    }
    // <br> div needed when no content after OR cursor at line start
    const sel = window.getSelection()
    const content = newPrefix + textAfter
    const needBr = !content || !textBefore.trim()
    if (needBr) {
      const brDiv = document.createElement('div')
      brDiv.appendChild(document.createElement('br'))
      parent.insertBefore(brDiv, refNode)
      if (!content) sel.collapse(brDiv.firstChild, 0)
    }
    if (content) {
      const contentDiv = document.createElement('div')
      contentDiv.textContent = content
      parent.insertBefore(contentDiv, refNode)
      sel.collapse(contentDiv.firstChild, newPrefix ? newPrefix.length : 0)
    }
    inputLock--
    onInput()
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

    // Nav mode: jump to next/prev focusable (respect Shift+Tab)
    if (navMode.value) {
      e.preventDefault()
      e.stopPropagation()
      const focusable = [...document.querySelectorAll(
        '.modal button:not([disabled]), .modal input:not([disabled]), [tabindex="0"]'
      )]
      const idx = focusable.indexOf(editorEl.value)
      let next
      if (e.shiftKey) {
        next = idx > 0 ? focusable[idx - 1] : focusable[focusable.length - 1]
      } else {
        next = idx < focusable.length - 1 ? focusable[idx + 1] : focusable[0]
      }
      if (next) next.focus()
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

// ── Set editor content with proper <div> line structure ──
function setEditorContent(text) {
  const root = editorEl.value
  root.innerHTML = ''
  resetCenterCursor()
  // Set CSS vars for ::before/::after pseudo-element spacers
  const lineH = parseFloat(getComputedStyle(root).lineHeight) || (props.fontSize * 1.6)
  root.style.setProperty('--spacer-h', Math.round(lineH * 5) + 'px')
  root.style.setProperty('--no-edit-bg', `url("${noEditSvg}")`)
  const lines = text ? text.split('\n') : ['']
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  for (const line of lines) {
    const div = document.createElement('div')
    if (line) {
      div.textContent = line
    } else {
      div.appendChild(document.createElement('br'))
    }
    root.appendChild(div)
  }
}

// ── Lifecycle ──

onMounted(() => {
  loadFreq()
  if (props.enableMd) {
    document.addEventListener('selectionchange', onSelectionChange)
    setEditorContent(props.modelValue)
    nextTick(() => {
      scanAndHighlight()
      // Scroll past ::before spacer for existing content without moving cursor
      nextTick(() => {
        const el = editorEl.value
        if (el && props.modelValue) {
          const h = parseFloat(getComputedStyle(el).getPropertyValue('--spacer-h')) || 112
          el.scrollTop = h
        }
      })
    })
  }
  if (props.autoFocus) {
    nextTick(() => {
      const el = props.enableMd ? editorEl.value : taRef.value
      if (el) el.focus()
    })
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
})

// modelValue → editor sync (one-way, from parent to child only on initial load or reset)
watch(() => props.modelValue, (val) => {
  if (isUpdating.value || !editorEl.value || !props.enableMd) return
  const current = getPlainText()
  if (current !== val) {
    // Only sync when truly different (e.g. modal opened with existing text, or reset)
    isUpdating.value = true
    setEditorContent(val)
    nextTick(() => {
      scanAndHighlight()
      isUpdating.value = false
    })
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

/* ── Link ── */
.md-editor .EditMarkdown-link {
  color: var(--blue);
  text-decoration: underline;
  cursor: pointer;
}
</style>

/**
 * Markdown scanner — DOM-based formatting for contenteditable.
 * Extracted from MarkdownEditor.vue to keep component size manageable.
 */

// ── Unwrap previous formatting ──

export function unwrapFormatting(root) {
  const els = root.querySelectorAll('.EditMarkdown-marker, .EditMarkdown-escape, .EditMarkdown-bold, .EditMarkdown-italic, .EditMarkdown-strike, .EditMarkdown-code, .EditMarkdown-highlight, .EditMarkdown-link')
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
export function scanContentEditable(root) {
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
    if (text.length > 0) console.log('[scan] text="' + text.slice(0, 40) + '"')
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

      // [text](url) link — find ] then ( then )，用 findClosing 处理转义
      if (ch === '[') {
        const bracket = findClosing(text, ']', i + 1)
        if (bracket > i + 1 && text[bracket + 1] === '(') {
          const paren = findClosing(text, ')', bracket + 2)
          if (paren >= 0) {
            wrapLink(textNode, i, bracket, paren)
            return false
          }
        }
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
export function wrapInline(textNode, start, end, wrapperTag, wrapperClass) {
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

export function wrapBold(textNode, start, end) {
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

export function wrapLink(textNode, start, bracket, paren) {
  const text = textNode.textContent || ''
  const before = text.slice(0, start)
  const linkText = text.slice(start + 1, bracket)
  const url = text.slice(bracket + 2, paren)
  const after = text.slice(paren + 1)

  const frag = document.createDocumentFragment()
  if (before) frag.appendChild(document.createTextNode(before))

  const m1 = document.createElement('span')
  m1.className = 'EditMarkdown-marker'
  m1.textContent = '['
  frag.appendChild(m1)

  const a = document.createElement('a')
  a.className = 'EditMarkdown-link'
  a.setAttribute('href', url)
  a.setAttribute('target', '_blank')
  a.setAttribute('rel', 'noopener')
  a.textContent = linkText
  frag.appendChild(a)

  const m2 = document.createElement('span')
  m2.className = 'EditMarkdown-marker'
  m2.textContent = ']('
  frag.appendChild(m2)

  const urlSpan = document.createElement('span')
  urlSpan.className = 'EditMarkdown-marker'
  urlSpan.textContent = url
  frag.appendChild(urlSpan)

  const m3 = document.createElement('span')
  m3.className = 'EditMarkdown-marker'
  m3.textContent = ')'
  frag.appendChild(m3)

  if (after) frag.appendChild(document.createTextNode(after))

  textNode.parentNode.replaceChild(frag, textNode)
}
export function scanLists(root, tagLine) {
  let lineNo = 0
  for (const child of root.childNodes) {
    // Only block-level children: <div> or direct text nodes
    if (child.nodeType !== 1 && child.nodeType !== 3) continue
    if (child.className && /EditMarkdown-/.test(child.className)) continue

    // N mode: count lines, skip TITLE/TAG/TIME (first 3 lines per block)
    if (tagLine) {
      const t = (child.textContent || '').trim()
      if (/^---$/.test(t)) { lineNo = 0; continue }
      if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {
        lineNo++
      }
      if (lineNo <= 3) continue
    }

    const textNode = child.nodeType === 1 ? child.firstChild : child
    if (!textNode || textNode.nodeType !== 3) continue
    const text = textNode.textContent || ''

    // Match list markers: leading whitespace, then - / * / N.
    const m = text.match(/^(\s*)([-*]|\d+\.)\s/)
    if (!m) continue

    const markerLen = m[0].length
    const marker = m[0]
    const rest = text.slice(markerLen)

    const mSpan = document.createElement('span')
    mSpan.className = 'EditMarkdown-marker'
    mSpan.textContent = marker
    const parent = child.nodeType === 1 ? child : child.parentNode
    parent.insertBefore(mSpan, textNode)
    textNode.textContent = rest
  }
}
export function renumberLists(root, tagLine) {
  let counter = 0, lineNo = 0
  for (const child of root.childNodes) {
    if (child.nodeType !== 1 && child.nodeType !== 3) continue

    // N mode: count lines, skip TITLE/TAG/TIME (first 3 lines per block)
    if (tagLine) {
      const t = (child.textContent || '').trim()
      if (/^---$/.test(t)) { lineNo = 0; continue }
      if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {
        lineNo++
      }
      if (lineNo <= 3) continue
    }

    const textNode = child.nodeType === 1 ? child.firstChild : child
    if (!textNode || textNode.nodeType !== 3) continue
    const text = textNode.textContent || ''

    // Match ordered list marker: optional whitespace + digits + dot
    const m = text.match(/^(\s*)(\d+)\.(\s.*|$)/)
    if (m) {
      counter++
      const oldNum = m[2] + '.'
      const newNum = counter + '.'
      if (oldNum !== newNum) {
        textNode.textContent = m[1] + newNum + m[3]
      }
    } else {
      // Empty line or non-ordered content breaks the sequence
      counter = 0
    }
  }
}

/**
 * Count all text within a node subtree.
 */
function countText(node) {
  if (node.nodeType === 3) return (node.textContent || '').length
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null)
  let total = 0
  let n = walker.firstChild()
  while (n) { total += (n.textContent || '').length; n = walker.nextNode() }
  return total
}

/**
 * Check if an element is a block-level container for trail purposes.
 */
function isBlock(el) {
  return el && el.nodeType === 1 &&
    (el.tagName === 'DIV' || el.tagName === 'P') &&
    el.contentEditable !== 'false'
}

/**
 * Save cursor position within root.
 * Returns { offset: number, trail: string[] } or null.
 */
export function saveCursor(root) {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return null
  const range = sel.getRangeAt(0)

  const origSc = range.startContainer
  const origSo = range.startOffset
  // Diagnostic: walk DOM in order, show cursor position with |
  let _s = '', _done = false
  function _walk(n) {
    if (!_done && n === origSc) {
      if (origSc.nodeType === 3) {
        _s += n.textContent.slice(0, origSo) + '|' + n.textContent.slice(origSo)
        _done = true
        return
      }
      // Element: walk children, insert | at startOffset
      _s += '<' + n.nodeName.toLowerCase()
      if (n.className?.includes('EditMarkdown-')) _s += '.' + n.className.split(' ')[0]
      _s += '>'
      for (let i = 0; i < n.childNodes.length; i++) {
        if (!_done && i === origSo) { _s += '|'; _done = true }
        _walk(n.childNodes[i])
      }
      if (!_done) { _s += '|'; _done = true }
      _s += '</' + n.nodeName.toLowerCase() + '>'
      return
    }
    if (n.nodeType === 3) {
      _s += n.textContent
      return
    }
    const tag = n.nodeName.toLowerCase()
    const voidTags = { br:1, hr:1, img:1, input:1 }
    _s += '<' + tag
    if (n.className?.includes('EditMarkdown-')) _s += '.' + n.className.split(' ')[0]
    _s += '>'
    if (!voidTags[tag]) {
      for (const c of n.childNodes) _walk(c)
      _s += '</' + tag + '>'
    }
  }
  _walk(root)
  if (!_done) _s += '|'
  // console.log('[cursor]', _s.slice(0, 300))
  // If cursor landed in an element (browser pushed it there), redirect
  // to the nearest text node so offset computation is text-based.
  // root.startOffset is a child index — convert to linear text offset.
  let sc = range.startContainer
  let so = range.startOffset
  // Cursor at start of non-root element that follows a text node —
  // browser push pattern from text boundary into adjacent element.
  if (sc !== root && sc.nodeType === 1 && so === 0 && countText(sc) > 0) {
    const prev = sc.previousSibling
    if (prev && prev.nodeType === 3) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
      let n = walker.firstChild(), acc = 0
      while (n) {
        acc += (n.textContent || '').length
        if (n === prev) { sc = prev; so = (prev.textContent || '').length; break }
        n = walker.nextNode()
      }
    }
  }
  if (sc === root) {
    let textOff = 0
    for (let i = 0; i < so; i++) {
      const child = root.childNodes[i]
      if (child) textOff += countText(child)
    }
    so = textOff
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
    let node = walker.firstChild(), accumulated = 0
    while (node) {
      const len = (node.textContent || '').length
      if (accumulated + len > so || (accumulated + len === so && len === 0)) {
        sc = node; so = so - accumulated; break
      }
      if (accumulated + len === so && len > 0) {
        // At text boundary — root cursor between children, stay at end of prev text
        sc = node; so = len; break
      }
      accumulated += len
      node = walker.nextNode()
    }
    if (sc === root) {
      const w2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
      let last = null, n = w2.firstChild()
      while (n) { last = n; n = w2.nextNode() }
      if (last) { sc = last; so = (last.textContent || '').length }
    }
  }

  // Phase 1: TreeWalker — cursor in a text node?
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let offset = 0
  let prevText = null
  let node = walker.firstChild()
  while (node) {
    if (node === sc) {
      const trail = []
      // Cursor at start of text node AND previous text is in a different
      // <div> — record the block boundary so restoreCursor can distinguish
      // "end of prev line" from "start of this line" at the same offset.
      if (so === 0 && prevText) {
        let p = prevText.parentNode
        while (p && p !== root && p.tagName !== 'DIV') p = p.parentNode
        let c = node.parentNode
        while (c && c !== root && c.tagName !== 'DIV') c = c.parentNode
        if (p && c && p !== c) trail.push('DIV')
      }
      const _r = { offset: offset + so, trail }
      // console.log('[cursor] save →', JSON.stringify(_r))
      return _r
    }
    prevText = node
    offset += (node.textContent || '').length
    node = walker.nextNode()
  }

  // Phase 2: cursor in an element — backtrack to nearest text.
  // Record empty block elements between cursor and nearest text as trail.
  const trail = []
  let el = sc

  // Reset offset: Phase 1 accumulated all text in the root, but the cursor
  // may be before some of that text (e.g. in an empty div that precedes a
  // text-bearing div).  We re-derive offset from preceding siblings below.
  offset = 0

  // Count text within the container up to startOffset
  if (el !== root) {
    for (let i = 0; i < so; i++) {
      const child = el.childNodes[i]
      if (child) offset += countText(child)
    }
  }

  // If the starting element itself is an empty block, record it
  if (isBlock(el) && countText(el) === 0) {
    trail.push(el.tagName)
  }

  // Walk backward through previousSibling → parentNode to accumulate
  // ALL text preceding the cursor (not just the first text sibling).
  while (el && el !== root) {
    let prev = el.previousSibling
    while (prev) {
      const textLen = countText(prev)
      offset += textLen
      if (isBlock(prev) && textLen === 0) {
        trail.push(prev.tagName)
      }
      prev = prev.previousSibling
    }
    el = el.parentNode
    // Check parent after walking up: starting element may not be a block
    // (e.g. <br>), but its parent (empty <div>) is an empty block.
    if (el && el !== root && isBlock(el) && countText(el) === 0) {
      trail.push(el.tagName)
    }
  }

  trail.reverse()
  const _r = { offset, trail }
  // console.log('[cursor] save →', JSON.stringify(_r))
  return _r
}

export function placeAt(sel, root, node, offset) {
  const range = document.createRange()
  // Redirect from non-editable elements (e.g. spacers) to nearest text
  if (node.nodeType === 1 && node.contentEditable === 'false') {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
    let target = null, n = walker.firstChild()
    while (n) { target = n; n = walker.nextNode() }
    if (target) {
      node = target
      offset = (target.textContent || '').length
    } else {
      range.selectNodeContents(root)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
  }
  // Never land in root — redirect to nearest text node
  if (node === root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
    let target = null, n = walker.firstChild()
    while (n) { target = n; n = walker.nextNode() }
    if (target) {
      range.setStart(target, (target.textContent || '').length)
    } else {
      range.selectNodeContents(root)
      range.collapse(false)
    }
  } else if (node.nodeType === 3) {
    const textLen = (node.textContent || '').length
    const clamped = Math.min(offset, textLen)
    range.setStart(node, clamped)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    // Browser may push cursor at text boundary to parent element.
    // Pull back to stay in text node. Empty text (len=0) can't be saved.
    if (sel.rangeCount && textLen > 0) {
      const actual = sel.getRangeAt(0)
      if (actual.startContainer !== node) {
        range.setStart(node, Math.max(0, clamped - 1))
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    return
  } else {
    const clamped = Math.min(offset, node.childNodes.length)
    range.setStart(node, clamped)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    // WebView2 may push cursor from element boundary to previous text node.
    // Pull back: force cursor to the start of this element's content.
    if (sel.rangeCount) {
      const actual = sel.getRangeAt(0)
      if (!node.contains(actual.startContainer)) {
        range.selectNodeContents(node)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    return
  }
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function findBlockSibling(from) {
  let el = from
  while (el) {
    const next = el.nextSibling
    if (isBlock(next)) return next
    if (!el.nextSibling && el.parentNode) {
      const pt = el.parentNode
      if (isBlock(pt)) {
        const pn = pt.nextSibling
        if (isBlock(pn)) return pn
        break
      }
      el = el.parentNode
      continue
    }
    break
  }
  return null
}

function stepTrailFrom(parent, trail) {
  let found = 0
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i]
    if (isBlock(child) && countText(child) === 0) {
      found++
      if (found >= trail.length) return child
    }
  }
  return null
}

export function restoreCursor(root, state) {
  if (!state) return
  // console.log('[cursor] restore ←', JSON.stringify(state))
  const { offset, trail } = state
  const sel = window.getSelection()

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let accumulated = 0
  let node = walker.firstChild()

  while (node) {
    const len = (node.textContent || '').length

    // Cursor inside this text node (but if trail is non-empty, cursor was
    // in an empty block, not in the text — fall through to trail handling)
    if (accumulated + len > offset || (accumulated + len === offset && len === 0)) {
      if (trail.length === 0) {
        placeAt(sel, root, node, Math.min(offset - accumulated, len))
        return
      }
      break
    }

    // Boundary: accumulated + len === offset && len > 0
    if (accumulated + len === offset) {
      const next = walker.nextNode()
      if (trail.length === 0) {
        // Prefer next text node only if it's empty (e.g. after marker span).
        if (next && (next.textContent || '').length === 0) {
          placeAt(sel, root, next, 0); return
        }
      }
      // Cursor in element — find next block via trail
      if (trail.length > 0) {
        const block = findBlockSibling(node)
        if (block && block.tagName === trail[0]) {
          if (trail.length === 1) {
            placeAt(sel, root, block, 0)
          } else {
            // Remaining trail entries match consecutive empty-block siblings
            const parent = block.parentNode
            const idx = Array.prototype.indexOf.call(parent.childNodes, block)
            let found = 0
            for (let i = idx + 1; i < parent.childNodes.length; i++) {
              const child = parent.childNodes[i]
              if (isBlock(child) && countText(child) === 0) {
                found++
                if (found >= trail.length - 1) {
                  placeAt(sel, root, child, 0)
                  return
                }
              }
            }
            placeAt(sel, root, block, 0)
          }
          return
        }
      }
      // When trail records a block boundary (Phase 1), next text in a
      // different div means cursor was at block start, not text end.
      if (trail.length > 0 && next) {
        const curBlock = node.parentNode?.closest?.('div')
        const nextBlock = next.parentNode?.closest?.('div')
        if (curBlock && nextBlock && curBlock !== nextBlock) {
          placeAt(sel, root, next, 0); return
        }
      }
      placeAt(sel, root, node, len)
      return
    }

    accumulated += len
    node = walker.nextNode()
  }

  // Trail-based recovery: cursor was in empty block element(s)
  if (trail.length > 0) {
    const target = stepTrailFrom(root, trail)
    if (target) { placeAt(sel, root, target, 0); return }
  }

  // Fallback: find last text node or last editable block, place cursor there
  const walker2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let lastText = null, n2 = walker2.firstChild()
  while (n2) { lastText = n2; n2 = walker2.nextNode() }
  if (lastText) {
    placeAt(sel, root, lastText, (lastText.textContent || '').length)
  } else {
    // No text at all — find last editable block (skip non-editable spacers)
    let last = root.lastChild
    while (last && last.nodeType === 1 && last.contentEditable === 'false') {
      last = last.previousSibling
    }
    if (last && last.nodeType === 1) {
      placeAt(sel, root, last, last.childNodes.length)
    } else {
      const range = document.createRange()
      range.selectNodeContents(root)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }
}

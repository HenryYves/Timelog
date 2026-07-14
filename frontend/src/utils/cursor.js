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
  return el && el.nodeType === 1 && (el.tagName === 'DIV' || el.tagName === 'P')
}

/**
 * Save cursor position within root.
 * Returns { offset: number, trail: string[] } or null.
 */
export function saveCursor(root) {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return null
  const range = sel.getRangeAt(0)

  // Diagnostic: walk DOM in order, show cursor position with |
  let _s = '', _done = false
  function _walk(n) {
    if (!_done && n === range.startContainer) {
      if (range.startContainer.nodeType === 3) {
        _s += n.textContent.slice(0, range.startOffset) + '|' + n.textContent.slice(range.startOffset)
        _done = true
        return
      }
      // Element: walk children, insert | at startOffset
      _s += '<' + n.nodeName.toLowerCase()
      if (n.className?.includes('EditMarkdown-')) _s += '.' + n.className.split(' ')[0]
      _s += '>'
      for (let i = 0; i < n.childNodes.length; i++) {
        if (!_done && i === range.startOffset) { _s += '|'; _done = true }
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
  console.log('[cursor]', _s.slice(0, 300))
  // Phase 1: TreeWalker — cursor in a text node?
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let offset = 0
  let node = walker.firstChild()
  while (node) {
    if (node === range.startContainer) {
      return { offset: offset + range.startOffset, trail: [] }
    }
    offset += (node.textContent || '').length
    node = walker.nextNode()
  }

  // Phase 2: cursor in an element — backtrack to nearest text.
  // Record empty block elements between cursor and nearest text as trail.
  const trail = []
  let el = range.startContainer

  // Reset offset: Phase 1 accumulated all text in the root, but the cursor
  // may be before some of that text (e.g. in an empty div that precedes a
  // text-bearing div).  We re-derive offset from preceding siblings below.
  offset = 0

  // Count text within the container up to startOffset
  if (el !== root) {
    for (let i = 0; i < range.startOffset; i++) {
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
  }

  trail.reverse()
  return { offset, trail }
}

function placeAt(sel, root, node, offset) {
  const range = document.createRange()
  if (node.nodeType === 3) {
    const clamped = Math.min(offset, (node.textContent || '').length)
    range.setStart(node, clamped)
  } else {
    const clamped = Math.min(offset, node.childNodes.length)
    range.setStart(node, clamped)
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
      if (trail.length === 0) {
        // Cursor in text — prefer next text node at pos 0
        const next = walker.nextNode()
        if (next) { placeAt(sel, root, next, 0); return }
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

  // Fallback: end of content
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

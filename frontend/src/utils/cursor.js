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

  // Walk backward through previousSibling → parentNode.previousSibling
  // until we hit a node that contains text.
  while (el && el !== root) {
    let prev = el.previousSibling
    while (prev) {
      const textLen = countText(prev)
      if (textLen > 0) {
        offset += textLen
        trail.reverse()
        return { offset, trail }
      }
      if (isBlock(prev) && countText(prev) === 0) {
        trail.push(prev.tagName)
      }
      prev = prev.previousSibling
    }
    el = el.parentNode
    if (el && el !== root && isBlock(el) && countText(el) > 0) {
      break
    }
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

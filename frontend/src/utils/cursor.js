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

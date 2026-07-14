import { describe, it, expect } from 'vitest'
import { saveCursor, restoreCursor } from '../../utils/cursor.js'

function setup(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

function placeCursor(root, path, offset) {
  let node = root
  for (const idx of path) node = node.childNodes[idx]
  const sel = window.getSelection()
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

describe('saveCursor', () => {
  it('S1: cursor in middle of text', () => {
    const root = setup('<div>hello world</div>')
    placeCursor(root, [0, 0], 5) // "hello| world"
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 5, trail: [] })
  })

  it('S2: cursor in empty text after marker span', () => {
    const root = setup('<div><span>- </span></div>')
    // Add empty text node after span (simulating scanLists output)
    root.firstChild.appendChild(document.createTextNode(''))
    placeCursor(root, [0, 1], 0) // <span>- </span>|""
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 2, trail: [] })
  })

  it('S5: cursor in empty div at start (no preceding text)', () => {
    const root = setup('<div></div><div>text</div>')
    placeCursor(root, [0], 0) // <div></div>| cursor in first (empty) child
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 0, trail: ['DIV'] })
  })

  it('S3: cursor in empty div after text div', () => {
    const root = setup('<div>text</div><div></div>')
    placeCursor(root, [1], 0) // cursor in second (empty) div
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 4, trail: ['DIV'] })
  })

  it('S4: cursor in second consecutive empty div (no preceding text)', () => {
    const root = setup('<div></div><div></div>')
    placeCursor(root, [1], 0) // cursor in second empty div
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 0, trail: ['DIV', 'DIV'] })
  })

  it('S6: cursor in empty div after text node at root level', () => {
    const root = setup('') // empty root
    root.appendChild(document.createTextNode('text'))
    const div = document.createElement('div')
    root.appendChild(div)
    placeCursor(root, [1], 0) // cursor in empty div after "text"
    const r = saveCursor(root)
    expect(r).toEqual({ offset: 4, trail: ['DIV'] })
  })

  it('returns null when no selection', () => {
    const root = setup('<div>text</div>')
    window.getSelection().removeAllRanges()
    expect(saveCursor(root)).toBeNull()
  })

  it('cursor at start of text', () => {
    const root = setup('<div>hello</div>')
    placeCursor(root, [0, 0], 0) // |hello
    expect(saveCursor(root)).toEqual({ offset: 0, trail: [] })
  })

  it('cursor inside nested element (span inside div)', () => {
    const root = setup('<div><span>text</span></div>')
    placeCursor(root, [0, 0, 0], 2) // <span>te|xt</span>
    expect(saveCursor(root)).toEqual({ offset: 2, trail: [] })
  })
})

describe('restoreCursor', () => {
  function cursorText(root) {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return ''
    const range = sel.getRangeAt(0)
    if (range.startContainer.nodeType === 3) {
      return range.startContainer.textContent.slice(0, range.startOffset) +
             '|' +
             range.startContainer.textContent.slice(range.startOffset)
    }
    return '<' + range.startContainer.nodeName + '>|'
  }

  it('S1: restore to middle of text', () => {
    const root = setup('<div>hello world</div>')
    restoreCursor(root, { offset: 5, trail: [] })
    expect(cursorText(root)).toBe('hello| world')
  })

  it('S2: restore to empty text after marker span', () => {
    const root = setup('<div><span>- </span></div>')
    root.firstChild.appendChild(document.createTextNode(''))
    restoreCursor(root, { offset: 2, trail: [] })
    // Should land in the empty text, not in the span
    const sel = window.getSelection()
    const container = sel.getRangeAt(0).startContainer
    expect(container.nodeType).toBe(3)
    expect(container.textContent).toBe('')
    expect(sel.getRangeAt(0).startOffset).toBe(0)
  })

  it('S3: restore to empty div after text', () => {
    const root = setup('<div>text</div><div></div>')
    restoreCursor(root, { offset: 4, trail: ['DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[1])
    expect(sel.getRangeAt(0).startOffset).toBe(0)
  })

  it('S4: restore to second consecutive empty div', () => {
    const root = setup('<div></div><div></div>')
    restoreCursor(root, { offset: 0, trail: ['DIV', 'DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[1])
  })

  it('S4b: restore to second empty div with preceding text', () => {
    const root = setup('<div>text</div><div></div><div></div>')
    restoreCursor(root, { offset: 4, trail: ['DIV', 'DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[2])
  })

  it('S5: restore to empty div at start', () => {
    const root = setup('<div></div><div>text</div>')
    restoreCursor(root, { offset: 0, trail: ['DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[0])
  })

  it('S6: restore to empty div after text at root level', () => {
    const root = setup('')
    root.appendChild(document.createTextNode('text'))
    const div = document.createElement('div')
    root.appendChild(div)
    restoreCursor(root, { offset: 4, trail: ['DIV'] })
    const sel = window.getSelection()
    expect(sel.getRangeAt(0).startContainer).toBe(root.childNodes[1])
  })
})

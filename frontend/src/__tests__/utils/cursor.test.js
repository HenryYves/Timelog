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
})

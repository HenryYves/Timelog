/**
 * @fileoverview MarkdownEditor 键盘事件处理函数。
 * 从 MarkdownEditor.vue onKeydown 提取，纯 DOM 操作，无 Vue 依赖。
 * 通过 ctx 对象接收 MarkdownEditor 的内部状态。
 */

/**
 * Backspace 键处理 — contenteditable 中 EditMarkdown 元素的退格删除。
 * 处理 escape 元素删除、marker/content 边界退格、WebView2 block 合并防御。
 * @returns {boolean} true = 已处理（调用方应 return）
 */
export function handleBackspace(ctx, e) {
  const hint = ctx.editorEl.value.querySelector('.tag-hint')
  if (hint) hint.remove()

  const sel = window.getSelection()
  if (!sel?.rangeCount) return false
  const range = sel.getRangeAt(0)
  if (!range.collapsed) return false
  let node = range.startContainer

  // Case 1: cursor inside an EditMarkdown element
  if (node.nodeType === 3) {
    let el = node.parentNode
    while (el && el !== ctx.editorEl.value) {
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
        return true
      }
      if (el.className && /EditMarkdown-/.test(el.className)) {
        if (range.startOffset > 0) {
          if (el.classList?.contains('EditMarkdown-marker') ||
              el.classList?.contains('EditMarkdown-escape')) {
            e.preventDefault()
            ctx.inputLock.v++
            const t = node.textContent || ''
            const newOff = range.startOffset - 1
            node.textContent = t.slice(0, newOff) + t.slice(range.startOffset)
            sel.collapse(node, newOff)
            ctx.inputLock.v--
            ctx.onInput()
          }
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
            ctx.inputLock.v++
            prev.textContent = text.slice(0, -1)
            if (!prev.textContent) {
              const span = prev.parentNode
              if (span && span.nodeType === 1 && span !== el.parentNode) span.remove()
            }
            node.parentNode.normalize?.()
            ctx.inputLock.v--
            ctx.onInput()
          }
        }
        return true
      }
      el = el.parentNode
    }
  }

  // Case 2: cursor at text node boundary next to an EditMarkdown sibling
  if (node.nodeType === 3) {
    if (range.startOffset === 0) {
      const prev = node.previousSibling
      if (prev && prev.nodeType === 1 && prev.className && /EditMarkdown-/.test(prev.className)) {
        e.preventDefault()
        const parent = prev.parentNode
        prev.remove()
        if (parent && !parent.textContent.trim() && parent.querySelector('br') === null) {
          parent.appendChild(document.createElement('br'))
        }
        return true
      }
    }
  }

  // Case 3: Backspace at position 1 in the first content text of a block
  // WebView2 merges blocks — handle ourselves to prevent the merge
  if (node.nodeType === 3 && range.startOffset === 1) {
    const block = node.parentNode
    if (block && block !== ctx.editorEl.value) {
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
        node.textContent = text.slice(1)
        const r = document.createRange()
        r.setStart(node, 0)
        r.collapse(true)
        sel.removeAllRanges()
        sel.addRange(r)
        const parent = node.parentNode
        if (parent && parent !== ctx.editorEl.value && !parent.textContent.trim() && !parent.querySelector('br')) {
          parent.appendChild(document.createElement('br'))
        }
        return true
      }
    }
  }

  return false
}

/**
 * Delete 键处理 — EditMarkdown 元素的 Delete 键（mirror Backspace 逻辑）。
 */
export function handleDelete(ctx, e) {
  const hint = ctx.editorEl.value.querySelector('.tag-hint')
  if (hint) hint.remove()

  const sel = window.getSelection()
  if (!sel?.rangeCount) return false
  const range = sel.getRangeAt(0)
  if (!range.collapsed) return false
  let node = range.startContainer

  // Case 1b: cursor at end of text inside EditMarkdown element
  if (node.nodeType === 3) {
    const textLen = (node.textContent || '').length
    if (range.startOffset < textLen) {
      let elM = node.parentNode
      while (elM && elM !== ctx.editorEl.value) {
        if (elM.classList?.contains('EditMarkdown-marker') ||
            elM.classList?.contains('EditMarkdown-escape')) {
          e.preventDefault()
          ctx.inputLock.v++
          const t = node.textContent || ''
          node.textContent = t.slice(0, range.startOffset) + t.slice(range.startOffset + 1)
          sel.removeAllRanges()
          const r = document.createRange()
          r.setStart(node, range.startOffset)
          r.collapse(true)
          sel.addRange(r)
          ctx.inputLock.v--
          ctx.onInput()
          return true
        }
        elM = elM.parentNode
      }
    }
    if (range.startOffset === textLen && textLen > 0) {
      let el = node.parentNode
      while (el && el !== ctx.editorEl.value) {
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
              ctx.inputLock.v++
              next.textContent = text.slice(1)
              if (!next.textContent) {
                const span = next.parentNode
                if (span && span.nodeType === 1 && span !== el.parentNode) span.remove()
              }
              node.parentNode.normalize?.()
              ctx.inputLock.v--
              ctx.onInput()
            }
          }
          return true
        }
        el = el.parentNode
      }
    }
  }

  // Case 2 (Delete variant): cursor at text end next to EditMarkdown sibling
  if (node.nodeType === 3 && range.startOffset === (node.textContent || '').length) {
    const next = node.nextSibling
    if (next && next.nodeType === 1 && next.className && /EditMarkdown-/.test(next.className)) {
      e.preventDefault()
      const parent = next.parentNode
      next.remove()
      if (parent && !parent.textContent.trim() && parent.querySelector('br') === null) {
        parent.appendChild(document.createElement('br'))
      }
      return true
    }
  }

  return false
}

/**
 * Enter 键处理 — tag hint 确认、列表延续、新 div 创建。
 */
export function handleEnter(ctx, e) {
  const hint = ctx.editorEl.value.querySelector('.tag-hint')

  if (ctx.tagLine) {
    const word = ctx.getWordAtCursor()
    if (word) ctx.confirmTag(word)
    if (hint) hint.remove()
  }

  const prefix = ctx.getListPrefix()
  if (prefix && !prefix.content.trim()) {
    e.preventDefault()
    const block = ctx.getCurrentBlock()
    if (block) { block.textContent = ''; block.appendChild(document.createElement('br')) }
    return true
  }

  const block = ctx.getCurrentBlock()
  if (!block || !block.textContent) {
    e.preventDefault()
    ctx.inputLock.v++
    const newDiv = document.createElement('div')
    newDiv.appendChild(document.createElement('br'))
    ctx.editorEl.value.appendChild(newDiv)
    const sel = window.getSelection()
    sel.collapse(newDiv.firstChild, 0)
    ctx.inputLock.v--
    ctx.onInput()
    return true
  }

  e.preventDefault()
  ctx.inputLock.v++
  const offset = ctx.getOffsetInBlock(block)
  const fullText = block.textContent || ''
  const textBefore = fullText.slice(0, offset)
  const textAfter = fullText.slice(offset)
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
  const parent = ctx.editorEl.value
  const refNode = block.nextSibling
  if (textBefore.trim()) {
    block.textContent = textBefore
  } else {
    block.remove()
  }
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
  ctx.inputLock.v--
  ctx.onInput()
  return true
}

/**
 * Tab 键处理 — tag hint 确认、nav 模式跳转、行首缩进。
 */
export function handleTab(ctx, e) {
  const hint = ctx.editorEl.value.querySelector('.tag-hint')

  if (ctx.tagLine && hint) {
    e.preventDefault()
    e.stopPropagation()
    ctx.confirmTagHint()
    return true
  }

  if (ctx.navMode.value) {
    e.preventDefault()
    e.stopPropagation()
    const focusable = [...document.querySelectorAll(
      '.modal button:not([disabled]), .modal input:not([disabled]), .modal [tabindex="0"]'
    )].filter(el => el.offsetParent !== null)
    const idx = focusable.indexOf(ctx.editorEl.value)
    let next
    if (e.shiftKey) {
      next = idx > 0 ? focusable[idx - 1] : focusable[focusable.length - 1]
    } else {
      next = idx < focusable.length - 1 ? focusable[idx + 1] : focusable[0]
    }
    if (next) next.focus()
    ctx.navMode.value = false
    ctx.editorEl.value.style.outline = ''
    return true
  }

  e.preventDefault()
  e.stopPropagation()
  let atLineStart = false
  const sel = window.getSelection()
  if (sel?.rangeCount) {
    const node = sel.anchorNode
    const off = sel.anchorOffset
    const text = node?.textContent || ''
    if (off === 0 || text[off - 1] === '\n') {
      atLineStart = true
    } else {
      let i = off - 1
      while (i >= 0 && text[i] === '\t') i--
      atLineStart = i < 0 || text[i] === '\n'
    }
  }
  const tabIndent = ctx.tagLine ? ctx.settingsStore.batchTabToIndent : ctx.settingsStore.tabToIndent
  if (!tabIndent || !atLineStart) {
    const modal = ctx.editorEl.value.closest('.modal')
    if (modal) {
      const focusable = modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      )
      const visible = [...focusable].filter(el => el.offsetParent !== null)
      const idx = visible.indexOf(ctx.editorEl.value)
      if (e.shiftKey) {
        if (idx > 0) visible[idx - 1].focus()
        else if (visible.length) visible[visible.length - 1].focus()
      } else {
        if (idx !== -1 && idx < visible.length - 1) visible[idx + 1].focus()
        else if (visible.length) visible[0].focus()
      }
    }
    return true
  }

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
  return true
}

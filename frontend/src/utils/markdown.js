export function esc(s) {
  return (s + '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  )
}

export function mdInline(s) {
  s = esc(s)
  // 处理 \ 转义：\x → &#charCode; 实体，防止被后续 markdown 正则误匹配
  // 在 esc() 之后执行，这样引入的 & 不会被二次转义
  s = s.replace(/\\(.)/g, (_, c) => `&#${c.charCodeAt(0)};`)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  s = s.replace(/==([^=]+)==/g, '<mark>$1</mark>')
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return s
}

export function mdToHtml(text) {
  const lines = (text || '').split(/\n/)
  let html = ''
  const stack = []
  function closeAll() {
    while (stack.length) html += '</' + stack.pop().type + '>'
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const um = raw.match(/^(\s*)[-*]\s+(.*)$/)
    const om = raw.match(/^(\s*)\d+\.\s+(.*)$/)
    if (um || om) {
      const lead = (um || om)[1].replace(/\t/g, '  ').length
      const type = um ? 'ul' : 'ol'
      const content = um ? um[2] : om[2]
      while (stack.length &&
        (stack[stack.length - 1].indent > lead ||
          (stack[stack.length - 1].indent === lead &&
            stack[stack.length - 1].type !== type)))
        html += '</' + stack.pop().type + '>'
      if (!stack.length || stack[stack.length - 1].indent < lead) {
        html += '<' + type + '>'
        stack.push({ type, indent: lead })
      }
      html += '<li>' + mdInline(content) + '</li>'
      continue
    }
    closeAll()
    const hm = raw.match(/^(#{1,3})\s+(.*)$/)
    if (hm) {
      html += '<div class="md-h md-h' + hm[1].length + '">' +
        mdInline(hm[2]) + '</div>'
      continue
    }
    if (raw.trim() === '') { html += '<br>'; continue }
    html += '<div>' + mdInline(raw) + '</div>'
  }
  closeAll()
  return html
}

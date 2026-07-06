import { describe, it, expect } from 'vitest'
import { mdToHtml } from '../../utils/markdown.js'

describe('mdToHtml', () => {
  it('wraps plain text in div', () => {
    expect(mdToHtml('hello')).toContain('<div>hello</div>')
  })

  it('handles empty input', () => {
    expect(mdToHtml('')).toBe('<br>')
    expect(mdToHtml(null)).toBe('<br>')
  })

  it('renders bold', () => {
    const r = mdToHtml('**bold**')
    expect(r).toContain('<b>bold</b>')
  })

  it('renders italic', () => {
    const r = mdToHtml('*italic*')
    expect(r).toContain('<i>italic</i>')
  })

  it('renders strikethrough', () => {
    const r = mdToHtml('~~strike~~')
    expect(r).toContain('<s>strike</s>')
  })

  it('renders inline code', () => {
    const r = mdToHtml('`code`')
    expect(r).toContain('<code>code</code>')
  })

  it('renders unordered list', () => {
    const r = mdToHtml('- item1\n- item2')
    expect(r).toContain('<ul>')
    expect(r).toContain('<li>')
  })

  it('renders ordered list', () => {
    const r = mdToHtml('1. first\n2. second')
    expect(r).toContain('<ol>')
    expect(r).toContain('<li>')
  })

  it('renders headings', () => {
    expect(mdToHtml('# H1')).toContain('md-h1')
    expect(mdToHtml('## H2')).toContain('md-h2')
  })

  it('escapes HTML entities', () => {
    const r = mdToHtml('<script>alert("xss")</script>')
    expect(r).not.toContain('<script>')
    expect(r).toContain('&lt;script&gt;')
  })

  it('renders markdown link', () => {
    const r = mdToHtml('[text](https://example.com)')
    expect(r).toContain('<a href="https://example.com"')
    expect(r).toContain('text</a>')
  })

  it('handles mixed content', () => {
    const r = mdToHtml('# Title\n\nThis is **bold** and *italic*\n\n- item 1\n- item 2')
    expect(r).toContain('md-h1')
    expect(r).toContain('<b>bold</b>')
    expect(r).toContain('<i>italic</i>')
    expect(r).toContain('<ul>')
  })

  it('handles nested lists', () => {
    const r = mdToHtml('- parent\n  - child')
    expect(r).toContain('<ul>')
    // Should have nested ul for child item
    const ulCount = (r.match(/<ul>/g) || []).length
    expect(ulCount).toBeGreaterThanOrEqual(2)
  })
})

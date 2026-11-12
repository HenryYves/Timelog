import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import MarkdownEditor from '../../components/MarkdownEditor.vue'

// getPlainText 把 contenteditable DOM 回读为纯文本。
// 浏览器的空行结构是 <div><br></div>，DIV 和 BR 各算一个换行会翻倍。
function mountEditor() {
  return mount(MarkdownEditor, {
    props: { modelValue: '' },
    global: { plugins: [createPinia()] },
  })
}

async function lastText(wrapper) {
  const ev = wrapper.emitted('update:modelValue')
  return ev[ev.length - 1][0]
}

describe('MarkdownEditor plain text extraction', () => {
  it('one empty line between text counts as one newline', async () => {
    const wrapper = mountEditor()
    const el = wrapper.find('.md-editor')
    el.element.innerHTML = '<div>a</div><div><br></div><div>b</div>'
    await el.trigger('input')
    expect(await lastText(wrapper)).toBe('a\n\nb')
  })

  it('empty editor emits empty string, not a newline', async () => {
    const wrapper = mountEditor()
    const el = wrapper.find('.md-editor')
    el.element.innerHTML = '<div><br></div>'
    await el.trigger('input')
    expect(await lastText(wrapper)).toBe('')
  })

  it('multiple empty lines keep their count', async () => {
    const wrapper = mountEditor()
    const el = wrapper.find('.md-editor')
    el.element.innerHTML = '<div>a</div><div><br></div><div><br></div><div>b</div>'
    await el.trigger('input')
    expect(await lastText(wrapper)).toBe('a\n\n\nb')
  })
})

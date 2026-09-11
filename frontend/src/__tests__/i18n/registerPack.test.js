import { describe, it, expect } from 'vitest'
import { availableLangs, registerPack, setLang, getLang, STR, t } from '../../i18n/index.js'

describe('i18n 语言包注册（文件注入入口）', () => {
  it('registerPack 后出现在 availableLangs，可切换，缺 key 回退默认语言', () => {
    registerPack('xx', { settings: { language: 'XX语言' } }, 'Testish')

    expect(availableLangs().map(l => l.code)).toContain('xx')
    expect(availableLangs().find(l => l.code === 'xx').label).toBe('Testish')

    setLang('xx')
    expect(getLang()).toBe('xx')
    expect(STR.settings.language).toBe('XX语言')

    // 该包没提供的 key → 回退到默认语言(zh)
    expect(STR.btn.ok).toBe('确定')
    expect(t('toast.copied', { n: 2 })).toBe('已复制 2 个')

    setLang('zh')
    expect(getLang()).toBe('zh')
  })
})

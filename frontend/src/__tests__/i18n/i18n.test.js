import { describe, it, expect } from 'vitest'
import { STR, t, getLang, availableLangs } from '../../i18n/index.js'

describe('i18n: t() 占位符插值', () => {
  it('单占位符', () => {
    expect(t('toast.copied', { n: 3 })).toBe('已复制 3 个')
  })

  it('多占位符', () => {
    expect(t('confirm.shortBlock', { dur: 5, min: 10 }))
      .toBe('时间块跨度仅 5 分钟（小于设定的 10 分钟），确定创建吗？')
  })

  it('同名占位符出现多次全部替换', () => {
    expect(t('confirm.renameTag', { old: 'a', name: 'b' }))
      .toBe('标签"a"已改名为"b"，是否将已有记录中的"a"替换为"b"？')
  })

  it('pasteResult 拆出的两变体', () => {
    expect(t('toast.pasteResultAnchored', { n: 2 })).toBe('已粘贴 2 个（锚定位置）')
    expect(t('toast.pasteResultOriginal', { n: 2 })).toBe('已粘贴 2 个（原时间）')
  })

  it('缺 key 时返回 key 本身', () => {
    expect(t('nope.missing')).toBe('nope.missing')
  })

  it('无 params 时原样返回（含数组/HTML）', () => {
    expect(t('btn.ok')).toBe('确定')
    expect(Array.isArray(t('stats.weekDays'))).toBe(true)
    expect(t('help.helpBlocks')[0]).toContain('<b>')
  })
})

describe('i18n: 响应式 STR facade（纯文本读取）', () => {
  it('顶层与嵌套读取', () => {
    expect(STR.settings.language).toBe('语言')
    expect(STR.toast.saved).toBe('已保存')
  })

  it('stats 组（整组对象外传路径）读得到', () => {
    expect(STR.stats.untagged).toBe('无标签')
    expect(STR.stats.unrecorded).toBe('未记录时间')
  })

  it('数组条目', () => {
    expect(STR.stats.weekDays).toHaveLength(7)
    expect(STR.help.helpShortcuts.length).toBeGreaterThan(0)
  })

  it('默认语言 zh，可用语言列表', () => {
    expect(getLang()).toBe('zh')
    expect(availableLangs()).toEqual([{ code: 'zh', label: '中文' }])
  })
})

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BarChart from '../../components/BarChart.vue'

describe('BarChart', () => {
  const items = [
    { tag: 'Work', minutes: 120, color: '#FF0000' },
    { tag: 'Play', minutes: 60, color: '#00FF00' },
  ]

  it('shows no-data message when items empty', () => {
    const wrapper = mount(BarChart, {
      props: { items: [], noDataText: '暂无数据' },
    })
    expect(wrapper.text()).toContain('暂无数据')
  })

  it('renders bar rows', () => {
    const wrapper = mount(BarChart, {
      props: { items, noDataText: '' },
    })
    expect(wrapper.findAll('.bar-row').length).toBe(2)
  })

  it('shows data text when showData is true', () => {
    const wrapper = mount(BarChart, {
      props: { items, showData: true, showPercent: false, noDataText: '' },
    })
    expect(wrapper.text()).toContain('2h')
  })

  it('does not add interactive class when interactive is false', () => {
    const wrapper = mount(BarChart, {
      props: { items, interactive: false, noDataText: '' },
    })
    expect(wrapper.find('.bar-row.interactive').exists()).toBe(false)
  })
})

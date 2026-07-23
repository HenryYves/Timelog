import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PieChart from '../../components/PieChart.vue'

describe('PieChart', () => {
  const slices = [
    { tag: 'Work', path: 'M350,50 A80,80 0 1 1 430,210 Z', color: '#FF0000', minutes: 120 },
    { tag: 'Play', path: 'M350,130 L430,210 A80,80 0 0 1 350,50 Z', color: '#00FF00', minutes: 60 },
  ]
  const labels = [
    { tag: 'Work', color: '#FF0000', linePoints: '350,50 350,30 420,30', textX: '426', textY: '35', anchor: 'start', dataText: '2h', pctText: '66.7%' },
    { tag: 'Play', color: '#00FF00', linePoints: '430,210 450,210 480,210', textX: '486', textY: '215', anchor: 'start', dataText: '1h', pctText: '33.3%' },
  ]

  it('shows no-data message when slices empty', () => {
    const wrapper = mount(PieChart, {
      props: { slices: [], labels: [], noDataText: '暂无数据' },
    })
    expect(wrapper.text()).toContain('暂无数据')
  })

  it('renders SVG with slices and labels', () => {
    const wrapper = mount(PieChart, {
      props: { slices, labels, noDataText: '暂无数据' },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.findAll('path').length).toBe(2)
    expect(wrapper.findAll('polyline').length).toBe(2)
  })

  it('shows data text when showData is true', () => {
    const wrapper = mount(PieChart, {
      props: { slices, labels, showData: true, showPercent: false, noDataText: '' },
    })
    expect(wrapper.text()).toContain('2h')
  })

  it('does not render interactive class when interactive is false', () => {
    const wrapper = mount(PieChart, {
      props: { slices, labels, interactive: false, noDataText: '' },
    })
    expect(wrapper.find('.pie-slice.interactive').exists()).toBe(false)
  })
})

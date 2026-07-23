import { describe, it, expect } from 'vitest'
import { buildWatermarkOverlay } from '../../utils/watermark.js'

const noopResolver = async (raw) => raw

describe('buildWatermarkOverlay', () => {
  it('returns empty for zero width', async () => {
    expect(await buildWatermarkOverlay({
      width: 0, height: 100,
      wmType: 'text', wmText: 'test',
      resolveAssetUrl: noopResolver,
    })).toBe('')
  })

  it('returns empty for zero height', async () => {
    expect(await buildWatermarkOverlay({
      width: 100, height: 0,
      wmType: 'text', wmText: 'test',
      resolveAssetUrl: noopResolver,
    })).toBe('')
  })

  it('returns empty when no wmType matches', async () => {
    expect(await buildWatermarkOverlay({
      width: 100, height: 100,
      wmType: '', wmText: '',
      resolveAssetUrl: noopResolver,
    })).toBe('')
  })

  it('returns empty for text type with empty text', async () => {
    expect(await buildWatermarkOverlay({
      width: 100, height: 100,
      wmType: 'text', wmText: '',
      resolveAssetUrl: noopResolver,
    })).toBe('')
  })

  it('returns empty for image type without image', async () => {
    expect(await buildWatermarkOverlay({
      width: 100, height: 100,
      wmType: 'image', wmImage: '',
      resolveAssetUrl: noopResolver,
    })).toBe('')
  })
})

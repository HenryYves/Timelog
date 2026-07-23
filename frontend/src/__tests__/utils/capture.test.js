import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadImg, clearAssetCache } from '../../utils/capture.js'

// ---- loadImg ----
describe('loadImg', () => {
  it('resolves with Image on successful load', async () => {
    // Mock Image constructor to simulate successful load
    const origImage = globalThis.Image
    globalThis.Image = class {
      constructor() {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    const img = await loadImg('test.png')
    expect(img).toBeInstanceOf(Image)
    globalThis.Image = origImage
  })

  it('rejects on error', async () => {
    const origImage = globalThis.Image
    globalThis.Image = class {
      constructor() {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    await expect(loadImg('bad.png')).rejects.toThrow('Failed to load image')
    globalThis.Image = origImage
  })
})

// ---- clearAssetCache ----
describe('clearAssetCache', () => {
  it('does not throw when called', () => {
    expect(() => clearAssetCache('test')).not.toThrow()
  })
})

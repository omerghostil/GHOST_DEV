import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { getImageProfileByTask, optimizeImageDataUrl } from './image-optimizer'

async function buildSamplePngDataUrl(): Promise<string> {
  const buffer = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 120, g: 120, b: 120 },
    },
  })
    .png()
    .toBuffer()

  return `data:image/png;base64,${buffer.toString('base64')}`
}

describe('image-optimizer', () => {
  it('ממיר תמונה ל-jpeg דחוס עם detail נמוך לסריקת low', async () => {
    const sourceImage = await buildSamplePngDataUrl()
    const result = await optimizeImageDataUrl(sourceImage, 'scan-low')
    expect(result.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(result.detail).toBe('low')
    expect(result.byteSize).toBeGreaterThan(0)
  })

  it('בוחר פרופיל נכון לפי סוג משימה', () => {
    expect(getImageProfileByTask('chat', false)).toBe('chat-high')
    expect(getImageProfileByTask('scan', false)).toBe('scan-low')
    expect(getImageProfileByTask('scan', true)).toBe('scan-standard')
  })
})

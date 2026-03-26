import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TimelineSampledFrame } from '../types'
import { buildCollageFromFrames } from './collage-builder'

const ORIGINAL_IMAGE = globalThis.Image

class MockImage {
  onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null
  onerror: ((this: GlobalEventHandlers, ev: Event | string) => unknown) | null = null

  set src(_value: string) {
    this.onload?.call(window, new Event('load'))
  }
}

describe('buildCollageFromFrames', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.Image = ORIGINAL_IMAGE
  })

  it('בונה קולאז׳ ומחזיר data URL של JPEG', async () => {
    globalThis.Image = MockImage as unknown as typeof Image
    const originalCreateElement = document.createElement.bind(document)

    const mockCanvasContext = {
      fillStyle: '',
      font: '',
      textBaseline: 'middle',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 100 }),
    } as unknown as CanvasRenderingContext2D

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCanvasContext),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,FAKE'),
    } as unknown as HTMLCanvasElement

    const createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas
      }
      return originalCreateElement(tagName)
    })

    const frames: TimelineSampledFrame[] = [
      { dataUrl: 'data:image/webp;base64,AAAA', capturedAtIso: '2026-03-25T10:00:00.000Z' },
      { dataUrl: 'data:image/webp;base64,BBBB', capturedAtIso: '2026-03-25T10:00:02.000Z' },
    ]

    const result = await buildCollageFromFrames(frames)
    expect(result).toBe('data:image/jpeg;base64,FAKE')
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
    expect(mockCanvasContext.drawImage).toHaveBeenCalledTimes(2)
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.82)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureLatestCameraFrame, releaseCameraResources } from './camera-frame'

describe('camera-frame service', () => {
  afterEach(() => {
    releaseCameraResources()
    vi.restoreAllMocks()
  })

  it('לוכד פריים ומחזיר data url', async () => {
    const mockTrackStop = vi.fn()
    const mockStream = {
      getTracks: () => [{ stop: mockTrackStop }],
    } as unknown as MediaStream

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    })

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'video') {
        const video = originalCreateElement('video') as HTMLVideoElement
        Object.defineProperty(video, 'videoWidth', { get: () => 640 })
        Object.defineProperty(video, 'videoHeight', { get: () => 360 })
        Object.defineProperty(video, 'readyState', { get: () => HTMLMediaElement.HAVE_CURRENT_DATA })
        Object.defineProperty(video, 'paused', { get: () => false })
        video.play = vi.fn().mockResolvedValue(undefined)
        return video
      }

      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas') as HTMLCanvasElement
        vi.spyOn(canvas, 'getContext').mockReturnValue({
          drawImage: vi.fn(),
        } as unknown as CanvasRenderingContext2D)
        vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/webp;base64,AAAA')
        return canvas
      }

      return originalCreateElement(tagName)
    })

    const frame = await captureLatestCameraFrame()
    expect(frame.startsWith('data:image/webp')).toBe(true)
  })
})

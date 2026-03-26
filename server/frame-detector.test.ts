import { describe, expect, it, vi } from 'vitest'
import {
  createFrameRelevanceDetector,
  isFrameRelevantByDetections,
  parseImageDataUrl,
  resolveConfidenceThreshold,
} from './frame-detector'

const ONE_PIXEL_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9W0xw5QAAAAASUVORK5CYII='

describe('frame-detector', () => {
  const buildMemoryUsage = (heapUsed: number): NodeJS.MemoryUsage => ({
    rss: heapUsed,
    heapTotal: heapUsed,
    heapUsed,
    external: 0,
    arrayBuffers: 0,
  })

  it('מחשב threshold תקין מהסביבה או ברירת מחדל', () => {
    expect(resolveConfidenceThreshold(undefined)).toBe(0.45)
    expect(resolveConfidenceThreshold('0.72')).toBe(0.72)
    expect(resolveConfidenceThreshold('not-number')).toBe(0.45)
    expect(resolveConfidenceThreshold('2')).toBe(0.45)
  })

  it('מחלץ buffer מתוך data url תקין', () => {
    const buffer = parseImageDataUrl(ONE_PIXEL_PNG_DATA_URL)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('זורק שגיאה עבור data url לא תקין', () => {
    expect(() => parseImageDataUrl('invalid')).toThrow('פורמט תמונה לא תקין')
  })

  it('מחזיר true רק אם יש תווית יעד מעל threshold', () => {
    const detections = [
      { class: 'dog', score: 0.99 },
      { class: 'person', score: 0.7 },
      { class: 'car', score: 0.3 },
    ]
    expect(isFrameRelevantByDetections(detections, 0.6)).toBe(true)
    expect(isFrameRelevantByDetections(detections, 0.8)).toBe(false)
  })

  it('מזהה רלוונטיות, מודד לוגים, ומשחרר tensor', async () => {
    const dispose = vi.fn()
    const detect = createFrameRelevanceDetector({
      loadModel: async () => ({
        detect: async () => [{ class: 'car', score: 0.91 }],
      }),
      decodeImage: async () => ({ dispose }),
      nowMs: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(135),
      cpuUsage: vi
        .fn()
        .mockReturnValueOnce({ user: 1, system: 2 })
        .mockReturnValueOnce({ user: 11, system: 22 }),
      memoryUsage: vi.fn().mockReturnValueOnce(buildMemoryUsage(1000)).mockReturnValueOnce(buildMemoryUsage(1800)),
      logInfo: vi.fn(),
      logError: vi.fn(),
    })

    const relevant = await detect(ONE_PIXEL_PNG_DATA_URL)
    expect(relevant).toBe(true)
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('מחזיר שגיאה כאשר טעינת המודל נכשלת', async () => {
    const detect = createFrameRelevanceDetector({
      loadModel: async () => {
        throw new Error('model unavailable')
      },
      nowMs: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(15),
      cpuUsage: vi
        .fn()
        .mockReturnValueOnce({ user: 0, system: 0 })
        .mockReturnValueOnce({ user: 1, system: 1 }),
      memoryUsage: vi.fn().mockReturnValue(buildMemoryUsage(100)),
      logInfo: vi.fn(),
      logError: vi.fn(),
    })

    await expect(detect(ONE_PIXEL_PNG_DATA_URL)).rejects.toThrow('model unavailable')
  })
})

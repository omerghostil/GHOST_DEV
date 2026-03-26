import { describe, expect, it, vi } from 'vitest'
import { createFrameRelevanceRouteHandler } from './frame-relevance-route'

interface MockResponse {
  status: ReturnType<typeof vi.fn>
  json: ReturnType<typeof vi.fn>
}

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    status: vi.fn(),
    json: vi.fn(),
  }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response
}

describe('frame-relevance-route', () => {
  it('מחזיר 200 עם relevant=true כאשר הזיהוי מצליח', async () => {
    const enqueueTask = vi.fn(async <T>(task: () => Promise<T>) => task())
    const detectFrameRelevance = vi.fn(async () => true)
    const handler = createFrameRelevanceRouteHandler({ enqueueTask, detectFrameRelevance })
    const response = createMockResponse()

    await handler(
      { body: { frameDataUrl: 'data:image/webp;base64,AAAA' } } as never,
      response as never,
      vi.fn(),
    )

    expect(enqueueTask).toHaveBeenCalledTimes(1)
    expect(detectFrameRelevance).toHaveBeenCalledWith('data:image/webp;base64,AAAA')
    expect(response.json).toHaveBeenCalledWith({ relevant: true })
  })

  it('מחזיר 400 כאשר הקלט לא תקין', async () => {
    const handler = createFrameRelevanceRouteHandler({
      enqueueTask: vi.fn(async <T>(task: () => Promise<T>) => task()),
      detectFrameRelevance: vi.fn(async () => true),
    })
    const response = createMockResponse()

    await handler({ body: { frameDataUrl: 'invalid' } } as never, response as never, vi.fn())

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith({ error: 'קלט בדיקת רלוונטיות פריים לא תקין.' })
  })

  it('מחזיר 502 כאשר הזיהוי נכשל', async () => {
    const enqueueTask = vi.fn(async <T>(task: () => Promise<T>) => task())
    const handler = createFrameRelevanceRouteHandler({
      enqueueTask,
      detectFrameRelevance: vi.fn(async () => {
        throw new Error('detector failed')
      }),
    })
    const response = createMockResponse()

    await handler(
      { body: { frameDataUrl: 'data:image/webp;base64,AAAA' } } as never,
      response as never,
      vi.fn(),
    )

    expect(response.status).toHaveBeenCalledWith(502)
    expect(response.json).toHaveBeenCalledWith({
      error: 'בדיקת רלוונטיות פריים נכשלה: detector failed',
    })
  })
})

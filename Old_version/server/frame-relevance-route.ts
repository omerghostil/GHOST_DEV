import type { RequestHandler } from 'express'
import { z } from 'zod'

export const FrameRelevanceRequestSchema = z.object({
  frameDataUrl: z.string().startsWith('data:image/'),
})

interface FrameRelevanceRouteDependencies {
  enqueueTask: <T>(task: () => Promise<T>) => Promise<T>
  detectFrameRelevance: (frameDataUrl: string) => Promise<boolean>
}

/**
 * בונה handler ל-API רלוונטיות פריים עם תלות בזיהוי לוקאלי.
 */
export function createFrameRelevanceRouteHandler({
  enqueueTask,
  detectFrameRelevance,
}: FrameRelevanceRouteDependencies): RequestHandler {
  return async (request, response) => {
    const parsed = FrameRelevanceRequestSchema.safeParse(request.body)
    // #region agent log
    fetch('http://127.0.0.1:7626/ingest/f6fda51a-fcfa-4231-a1db-7687b6fe417d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8eb92e' },
      body: JSON.stringify({
        sessionId: '8eb92e',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'server/frame-relevance-route.ts:19',
        message: 'frame-relevance request received',
        data: {
          parseSuccess: parsed.success,
          hasBody: Boolean(request.body),
          frameDataUrlPrefix: typeof request.body?.frameDataUrl === 'string' ? request.body.frameDataUrl.slice(0, 32) : null,
          frameDataUrlLength: typeof request.body?.frameDataUrl === 'string' ? request.body.frameDataUrl.length : -1,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    if (!parsed.success) {
      return response.status(400).json({ error: 'קלט בדיקת רלוונטיות פריים לא תקין.' })
    }

    try {
      const relevant = await enqueueTask(() => detectFrameRelevance(parsed.data.frameDataUrl))
      // #region agent log
      fetch('http://127.0.0.1:7626/ingest/f6fda51a-fcfa-4231-a1db-7687b6fe417d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8eb92e' },
        body: JSON.stringify({
          sessionId: '8eb92e',
          runId: 'pre-fix',
          hypothesisId: 'H5',
          location: 'server/frame-relevance-route.ts:44',
          message: 'frame-relevance response success',
          data: { relevant },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      return response.json({ relevant })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'שגיאה פנימית לא ידועה.'
      // #region agent log
      fetch('http://127.0.0.1:7626/ingest/f6fda51a-fcfa-4231-a1db-7687b6fe417d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8eb92e' },
        body: JSON.stringify({
          sessionId: '8eb92e',
          runId: 'pre-fix',
          hypothesisId: 'H5',
          location: 'server/frame-relevance-route.ts:61',
          message: 'frame-relevance response failed',
          data: {
            errorMessage: message,
            errorName: error instanceof Error ? error.name : 'unknown',
            stackTop: error instanceof Error ? (error.stack?.split('\n')[0] ?? null) : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      return response.status(502).json({ error: `בדיקת רלוונטיות פריים נכשלה: ${message}` })
    }
  }
}

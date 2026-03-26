import { httpRequest } from './http-client'

const API_TIMEOUT_MS = 20000

interface FrameRelevancePayload {
  relevant?: boolean
  error?: string
}

async function parseJsonIfPossible<T>(response: Response): Promise<T | null> {
  const rawText = await response.text()
  if (!rawText.trim()) {
    return null
  }
  try {
    return JSON.parse(rawText) as T
  } catch {
    return null
  }
}

/**
 * בודק האם הפריים כולל אדם או רכב.
 */
export async function checkFrameRelevance(frameDataUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await httpRequest('/api/frame-relevance', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ frameDataUrl }),
    })

    const payload = await parseJsonIfPossible<FrameRelevancePayload>(response)
    if (!response.ok) {
      if (payload?.error) {
        throw new Error(payload.error)
      }
      throw new Error(`בדיקת רלוונטיות פריים נכשלה (HTTP ${response.status}).`)
    }

    return Boolean(payload?.relevant)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('בדיקת רלוונטיות פריים חרגה מזמן ההמתנה.')
    }
    if (error instanceof TypeError) {
      throw new Error('לא ניתן להתחבר לשרת בדיקת הרלוונטיות.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

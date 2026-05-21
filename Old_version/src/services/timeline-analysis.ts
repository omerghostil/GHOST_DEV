import type { Channel } from '../types'
import { httpRequest } from './http-client'

const API_TIMEOUT_MS = 32000

interface TimelineAnalysisPayload {
  summary?: string
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
 * שולח קולאז׳ פריימים לשרת ומחזיר תיאור כרונולוגי.
 */
export async function requestTimelineAnalysis(
  channel: Channel,
  collageDataUrl: string,
  frameTimestamps: string[],
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await httpRequest('/api/collage-analysis', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          watchScope: channel.watchScope,
          location: channel.location,
          members: channel.members,
        },
        collageDataUrl,
        frameTimestamps,
      }),
    })

    const payload = await parseJsonIfPossible<TimelineAnalysisPayload>(response)
    if (!response.ok) {
      if (payload?.error) {
        throw new Error(payload.error)
      }
      throw new Error(`ניתוח קולאז׳ נכשל (HTTP ${response.status}).`)
    }

    if (!payload?.summary || typeof payload.summary !== 'string') {
      throw new Error('תגובה לא תקינה משירות ניתוח הקולאז׳.')
    }

    return payload.summary
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('ניתוח הקולאז׳ חרג מזמן ההמתנה.')
    }
    if (error instanceof TypeError) {
      throw new Error('לא ניתן להתחבר לשרת ניתוח הקולאז׳.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

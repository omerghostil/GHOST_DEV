import type { Channel } from '../types'
import { httpRequest } from './http-client'

const API_TIMEOUT_MS = 20000

interface VisionReply {
  text: string
  sources: string[]
}

interface VisionErrorPayload {
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
 * שולח פריים + הודעת משתמש לשרת ה-proxy ומחזיר תשובת ניתוח.
 */
export async function requestVisionReply(
  channel: Channel,
  userPrompt: string,
  frameDataUrl: string,
  analysisContext?: string,
): Promise<VisionReply> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await httpRequest('/api/chat-vision', {
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
        prompt: userPrompt,
        frameDataUrl,
        analysisContext,
      }),
    })

    const payload = await parseJsonIfPossible<Partial<VisionReply> & VisionErrorPayload>(response)
    if (!response.ok) {
      const errorMessage = payload?.error
      if (errorMessage) {
        throw new Error(errorMessage)
      }
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(
          'שירות הניתוח לא זמין. ודא שהשרת רץ ושמפתח ה-API מוגדר כראוי.',
        )
      }
      throw new Error(`השרת לא הצליח לייצר תשובה (HTTP ${response.status}).`)
    }

    if (!payload?.text || !Array.isArray(payload.sources)) {
      throw new Error('תגובה לא תקינה מהשרת.')
    }

    return {
      text: payload.text,
      sources: payload.sources,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('הבקשה לניתוח תמונה חרגה מזמן ההמתנה.')
    }
    if (error instanceof TypeError) {
      throw new Error(
        'לא ניתן להתחבר לשרת הניתוח. ודא ש־npm run dev רץ (כולל proxy על localhost:8787), או הרץ בנפרד: npm run dev:server.',
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

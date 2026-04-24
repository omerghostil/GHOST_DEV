import type { Channel, Operation, OperationMode } from '../types'
import { httpRequest } from './http-client'

const API_TIMEOUT_MS = 22000

export interface OperationScanResult {
  operationId: string
  mode: OperationMode
  critical?: boolean
  score?: number
  summary: string
}

interface OperationScanErrorPayload {
  error?: string
}

interface OperationScanPayload {
  results: OperationScanResult[]
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
 * מריץ סריקת פריים מול כל המבצעים המופעלים: האם זוהתה נוכחות של טריגר ההתראה בפריים.
 */
export async function requestOperationScan(
  channel: Channel,
  frameDataUrl: string,
  operations: Operation[],
): Promise<OperationScanResult[]> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await httpRequest('/api/operation-scan', {
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
        frameDataUrl,
        operations: operations.map((op) => ({
          id: op.id,
          name: op.name,
          schedule: op.schedule,
          mode: op.mode,
          alertTrigger: op.trigger,
          action: op.action,
          modelOverride: op.modelOverride,
          detailLevel: op.detailLevel,
        })),
      }),
    })

    const payload = await parseJsonIfPossible<Partial<OperationScanPayload> & OperationScanErrorPayload>(response)
    if (!response.ok) {
      const errorMessage = payload?.error
      if (errorMessage) {
        throw new Error(errorMessage)
      }
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(
          'שירות סריקת המבצעים לא זמין. ודא שהשרת רץ ושמפתח ה-API מוגדר כראוי.',
        )
      }
      throw new Error(`סריקת מבצעים נכשלה (HTTP ${response.status}).`)
    }

    if (!payload?.results || !Array.isArray(payload.results)) {
      throw new Error('תגובת סריקת מבצעים לא תקינה מהשרת.')
    }

    return payload.results.map((row) => ({
      operationId: row.operationId,
      mode: (row.mode ?? 'alert') as OperationMode,
      critical: row.critical != null ? Boolean(row.critical) : undefined,
      score: typeof row.score === 'number' ? row.score : undefined,
      summary: typeof row.summary === 'string' ? row.summary : '',
    }))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('סריקת המבצעים חרגה מזמן ההמתנה.')
    }
    if (error instanceof TypeError) {
      throw new Error(
        'לא ניתן להתחבר לשרת הניתוח. ודא ש־npm run dev רץ (proxy על localhost:8787).',
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

import { httpRequest } from './http-client'

interface ErrorPayload {
  error?: string
}

async function parseJson<T>(response: Response): Promise<T | null> {
  const raw = await response.text()
  if (!raw.trim()) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * מדווח תקלה חדשה מהמשתמש למערכת הניהול.
 */
export async function reportIssue(input: {
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}): Promise<void> {
  const response = await httpRequest('/api/issues', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (response.ok) {
    return
  }
  const payload = await parseJson<ErrorPayload>(response)
  throw new Error(payload?.error ?? 'דיווח התקלה נכשל.')
}

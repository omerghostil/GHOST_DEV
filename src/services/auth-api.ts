import type { AuthLoginResponse, AuthProfile } from '../types/admin'
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
 * מבצע התחברות ומחזיר טוקנים ופרופיל משתמש.
 */
export async function loginRequest(username: string, password: string): Promise<AuthLoginResponse> {
  const response = await httpRequest('/api/auth/login', {
    method: 'POST',
    withAuth: false,
    body: JSON.stringify({ username, password }),
  })
  const payload = await parseJson<AuthLoginResponse & ErrorPayload>(response)
  if (!response.ok || !payload?.accessToken || !payload.refreshToken || !payload.profile) {
    throw new Error(payload?.error ?? 'התחברות נכשלה.')
  }
  return payload
}

/**
 * מושך את פרופיל המשתמש המחובר.
 */
export async function meRequest(): Promise<AuthProfile> {
  const response = await httpRequest('/api/auth/me')
  const payload = await parseJson<{ profile?: AuthProfile } & ErrorPayload>(response)
  if (!response.ok || !payload?.profile) {
    throw new Error(payload?.error ?? 'משיכת פרופיל נכשלה.')
  }
  return payload.profile
}

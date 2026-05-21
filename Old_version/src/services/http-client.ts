import type { AuthProfile } from '../types/admin'
import { clearAuthSession, readAccessToken, readRefreshToken, writeAccessTokenProfile } from '../utils/auth-session'

interface HttpRequestOptions extends RequestInit {
  withAuth?: boolean
}

interface RefreshResponsePayload {
  accessToken?: string
  profile?: AuthProfile
  error?: string
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) {
    return null
  }
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  const payload = (await response.json().catch(() => null)) as RefreshResponsePayload | null
  if (!response.ok || !payload?.accessToken || !payload.profile) {
    clearAuthSession()
    return null
  }
  writeAccessTokenProfile(payload.accessToken, payload.profile)
  return payload.accessToken
}

/**
 * מבצע קריאת HTTP סטנדרטית עם חיבור אופציונלי לטוקן התחברות.
 */
export async function httpRequest(path: string, options: HttpRequestOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body != null) {
    headers.set('Content-Type', 'application/json')
  }
  const shouldAttachAuth = options.withAuth !== false
  if (shouldAttachAuth) {
    const existingAccessToken = readAccessToken()
    if (existingAccessToken) {
      headers.set('Authorization', `Bearer ${existingAccessToken}`)
    }
  }
  const firstResponse = await fetch(path, {
    ...options,
    headers,
  })
  if (firstResponse.status !== 401 || !shouldAttachAuth) {
    return firstResponse
  }
  const refreshedAccessToken = await refreshAccessToken()
  if (!refreshedAccessToken) {
    return firstResponse
  }
  const retryHeaders = new Headers(options.headers)
  if (!retryHeaders.has('Content-Type') && options.body != null) {
    retryHeaders.set('Content-Type', 'application/json')
  }
  retryHeaders.set('Authorization', `Bearer ${refreshedAccessToken}`)
  return fetch(path, {
    ...options,
    headers: retryHeaders,
  })
}

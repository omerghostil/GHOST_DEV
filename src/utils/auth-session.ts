import type { AuthProfile } from '../types/admin'

const SESSION_STORAGE_KEY = 'ghost_auth_session'
const ACCESS_TOKEN_STORAGE_KEY = 'ghost_access_token'
const REFRESH_TOKEN_STORAGE_KEY = 'ghost_refresh_token'
const PROFILE_STORAGE_KEY = 'ghost_auth_profile'
const TEMP_USER = 'admin'
const TEMP_PASSKEY = 'admin8888'

/**
 * בודק אם פרטי ההתחברות תואמים להרשאות הזמניות של המערכת.
 */
export function validateCredentials(user: string, passkey: string): boolean {
  return user === TEMP_USER && passkey === TEMP_PASSKEY
}

/**
 * מחזיר האם קיימת התחברות פעילה בסשן הנוכחי.
 */
export function readAuthSession(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * שומר התחברות פעילה בסשן של הדפדפן.
 */
export function writeAuthSession(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '1')
  } catch {
    // אין פעולה: כשל ב-storage לא אמור לשבור התחברות.
  }
}

/**
 * מוחק את מצב ההתחברות מהסשן.
 */
export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    window.sessionStorage.removeItem(PROFILE_STORAGE_KEY)
  } catch {
    // אין פעולה: כשל ב-storage לא אמור לשבור התנתקות.
  }
}

export function writeAuthTokens(accessToken: string, refreshToken: string, profile: AuthProfile): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '1')
    window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
    window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken)
    window.sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // אין פעולה: כשל ב-storage לא אמור לשבור התחברות.
  }
}

/**
 * מעדכן access token ופרופיל בלי לדרוס refresh token קיים.
 */
export function writeAccessTokenProfile(accessToken: string, profile: AuthProfile): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '1')
    window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
    window.sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // אין פעולה: כשל ב-storage לא אמור לשבור התחברות.
  }
}

export function readAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function readRefreshToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function readAuthProfile(): AuthProfile | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as AuthProfile
  } catch {
    return null
  }
}

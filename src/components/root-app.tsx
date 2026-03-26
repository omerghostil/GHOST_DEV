import { useEffect, useState } from 'react'
import App from '../App'
import { LoginPage } from './login-page'
import { SuperAdminPanel } from './super-admin-panel'
import type { AuthProfile } from '../types/admin'
import { loginRequest, meRequest } from '../services/auth-api'
import { clearAuthSession, readAuthProfile, readAuthSession, writeAuthTokens } from '../utils/auth-session'

/**
 * מעטפת היישום שמנתבת לפי תפקיד משתמש מחובר.
 */
export function RootApp() {
  const [profile, setProfile] = useState<AuthProfile | null>(() => {
    if (!readAuthSession()) {
      return null
    }
    return readAuthProfile()
  })
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!profile) {
      return
    }
    void meRequest().catch(() => {
      clearAuthSession()
      setProfile(null)
      setAuthError('הסשן פג תוקף. יש להתחבר מחדש.')
    })
  }, [profile])

  async function handleAuthenticate(username: string, password: string): Promise<boolean> {
    try {
      const payload = await loginRequest(username, password)
      writeAuthTokens(payload.accessToken, payload.refreshToken, payload.profile)
      setProfile(payload.profile)
      setAuthError('')
      return true
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'התחברות נכשלה.')
      return false
    }
  }

  function handleLogout() {
    clearAuthSession()
    setProfile(null)
  }

  if (!profile) {
    return <LoginPage onAuthenticate={handleAuthenticate} externalErrorMessage={authError} />
  }

  if (profile.role === 'super_admin') {
    return <SuperAdminPanel profile={profile} onLogout={handleLogout} />
  }

  return <App currentUserRole={profile.role} onLogout={handleLogout} />
}

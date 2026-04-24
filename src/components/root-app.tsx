import { useEffect, useRef, useState } from 'react'
import App from '../App'
import { LoginPage } from './login-page'
import { SuperAdminPanel } from './super-admin-panel'
import type { AuthProfile } from '../types/admin'
import { ghostAccessRequest, loginRequest, meRequest } from '../services/auth-api'
import { clearAuthSession, readAuthProfile, readAuthSession, writeAuthTokens } from '../utils/auth-session'

const SUPER_ADMIN_COMBO = new Set(['g', 'a'])

const LOCAL_SUPER_ADMIN_PROFILE: AuthProfile = {
  userId: 'local-super-admin',
  organizationId: '',
  organizationName: '',
  role: 'super_admin',
  username: 'omeradmin',
  firstName: 'Ghost',
  lastName: 'Admin',
}

/**
 * מעטפת היישום שמנתבת לפי תפקיד משתמש מחובר.
 */
function tryPickupImpersonation(): AuthProfile | null {
  try {
    const hash = window.location.hash
    if (!hash.startsWith('#impersonate=')) return null
    const encoded = hash.slice('#impersonate='.length)
    const binary = atob(encoded)
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { accessToken: string; refreshToken: string; profile: AuthProfile }
    writeAuthTokens(payload.accessToken, payload.refreshToken, payload.profile)
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    return payload.profile
  } catch {
    return null
  }
}

export function RootApp() {
  const [profile, setProfile] = useState<AuthProfile | null>(() => {
    const impersonated = tryPickupImpersonation()
    if (impersonated) return impersonated
    if (!readAuthSession()) {
      return null
    }
    return readAuthProfile()
  })
  const [authError, setAuthError] = useState('')
  const pressedKeysRef = useRef(new Set<string>())
  const comboFiredRef = useRef(false)

  useEffect(() => {
    function checkSuperAdminCombo() {
      if (comboFiredRef.current) return
      for (const key of SUPER_ADMIN_COMBO) {
        if (!pressedKeysRef.current.has(key)) return
      }
      comboFiredRef.current = true
      setProfile(LOCAL_SUPER_ADMIN_PROFILE)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        return
      }
      const key = event.key.toLowerCase()
      if (!SUPER_ADMIN_COMBO.has(key)) return
      pressedKeysRef.current.add(key)
      checkSuperAdminCombo()
    }

    function handleKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      pressedKeysRef.current.delete(key)
      if (pressedKeysRef.current.size === 0) {
        comboFiredRef.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    if (!profile) {
      return
    }
    if (profile.userId === 'local-super-admin') {
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

  async function handleGhostAccess(): Promise<void> {
    try {
      const payload = await ghostAccessRequest()
      writeAuthTokens(payload.accessToken, payload.refreshToken, payload.profile)
      setProfile(payload.profile)
      setAuthError('')
    } catch {
      setAuthError('כניסת ghost נכשלה.')
    }
  }

  function handleLogout() {
    clearAuthSession()
    setProfile(null)
  }

  if (!profile) {
    return (
      <LoginPage
        onAuthenticate={handleAuthenticate}
        onGhostAccess={handleGhostAccess}
        externalErrorMessage={authError}
      />
    )
  }

  if (profile.role === 'super_admin') {
    return <SuperAdminPanel profile={profile} onLogout={handleLogout} />
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username
  return <App currentUserRole={profile.role} fullName={fullName} organizationName={profile.organizationName || ''} onLogout={handleLogout} />
}

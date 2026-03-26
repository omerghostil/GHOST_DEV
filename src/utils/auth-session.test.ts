// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAuthSession,
  readAuthSession,
  validateCredentials,
  writeAuthSession,
} from './auth-session'

describe('auth-session', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('מאמת פרטי גישה תקינים בלבד', () => {
    expect(validateCredentials('admin', 'admin8888')).toBe(true)
    expect(validateCredentials('admin', 'bad-pass')).toBe(false)
    expect(validateCredentials('other-user', 'admin8888')).toBe(false)
  })

  it('שומר וקורא סטטוס התחברות מה-sessionStorage', () => {
    expect(readAuthSession()).toBe(false)
    writeAuthSession()
    expect(readAuthSession()).toBe(true)
    clearAuthSession()
    expect(readAuthSession()).toBe(false)
  })

  it('מחזיר fallback בטוח כאשר storage לא זמין', () => {
    const getSpy = vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const setSpy = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const removeSpy = vi.spyOn(window.sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(readAuthSession()).toBe(false)
    expect(() => writeAuthSession()).not.toThrow()
    expect(() => clearAuthSession()).not.toThrow()

    getSpy.mockRestore()
    setSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

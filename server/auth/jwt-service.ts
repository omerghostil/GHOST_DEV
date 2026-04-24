import jwt from 'jsonwebtoken'
import type { UserRole } from '../admin/types'

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

export interface AuthAccessPayload {
  userId: string
  organizationId: string
  organizationName: string
  role: UserRole
  username: string
  firstName: string
  lastName: string
}

export interface RefreshPayload {
  tokenId: string
  userId: string
}

function getAccessSecret(): string {
  return process.env.JWT_ACCESS_SECRET?.trim() || 'ghost-default-access-secret-change-me'
}

function getRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET?.trim() || 'ghost-default-refresh-secret-change-me'
}

/**
 * חותם access token קצר לשימוש ב-API.
 */
export function signAccessToken(payload: AuthAccessPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_TTL })
}

/**
 * מאמת access token ומחזיר payload תקין.
 */
export function verifyAccessToken(token: string): AuthAccessPayload {
  return jwt.verify(token, getAccessSecret()) as AuthAccessPayload
}

/**
 * חותם refresh token ומחזיר גם זמן תפוגה בפורמט UNIX.
 */
export function signRefreshToken(payload: RefreshPayload): { token: string; expiresAtUnix: number } {
  const expiresAtUnix = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS
  const token = jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL_SECONDS })
  return { token, expiresAtUnix }
}

/**
 * מאמת refresh token ומחזיר payload.
 */
export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, getRefreshSecret()) as RefreshPayload
}

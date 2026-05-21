import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../auth/jwt-service'
import type { UserRole } from '../admin/types'

export interface RequestAuthContext {
  userId: string
  organizationId: string
  organizationName: string
  role: UserRole
  username: string
  firstName: string
  lastName: string
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: RequestAuthContext
  }
}

function extractBearerToken(request: Request): string | null {
  const authorization = request.header('authorization')
  if (!authorization) {
    return null
  }
  const [kind, token] = authorization.split(' ')
  if (kind !== 'Bearer' || !token) {
    return null
  }
  return token
}

/**
 * מאמת access token ומוסיף הקשר משתמש לבקשה.
 */
export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const token = extractBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'נדרש טוקן גישה תקף.' })
    return
  }

  try {
    request.auth = verifyAccessToken(token)
    next()
  } catch {
    response.status(401).json({ error: 'טוקן גישה לא תקף או פג תוקף.' })
  }
}

/**
 * בודק הרשאות role לפי רשימת תפקידים מותרת.
 */
export function requireRoles(allowedRoles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.auth) {
      response.status(401).json({ error: 'משתמש לא מזוהה.' })
      return
    }
    if (!allowedRoles.includes(request.auth.role)) {
      response.status(403).json({ error: 'אין הרשאה לפעולה זו.' })
      return
    }
    next()
  }
}

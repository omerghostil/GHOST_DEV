import type { Request } from 'express'
import type { RequestAuthContext } from './auth-guard'

export interface TenantContext {
  organizationId: string
  userId: string
  role: RequestAuthContext['role']
}

/**
 * מחלץ tenant context מה-JWT בלבד — לעולם לא מ-body/query.
 * זורק שגיאה אם אין auth context.
 */
export function extractTenantContext(request: Request): TenantContext {
  const auth = request.auth
  if (!auth?.organizationId || !auth.userId) {
    throw new Error('חסר הקשר ארגוני מאומת בבקשה.')
  }
  return {
    organizationId: auth.organizationId,
    userId: auth.userId,
    role: auth.role,
  }
}

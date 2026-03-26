import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { LoginRequestSchema, RefreshRequestSchema } from './schemas'
import { USER_ROLES, type UserRecord } from './types'
import type { IAdminRepository } from '../db/repository-types'
import { hashPassword, verifyPassword } from '../security/crypto-utils'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AuthAccessPayload,
} from '../auth/jwt-service'
import { requireAuth } from '../middleware/auth-guard'

interface CreateAuthRouterOptions {
  store: IAdminRepository
}

function buildAuthPayload(user: UserRecord): AuthAccessPayload {
  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    username: user.username,
  }
}

function readBootstrapCredentials(): { username: string; password: string } {
  return {
    username: process.env.SUPER_ADMIN_USERNAME?.trim() || 'ghostadmin',
    password: process.env.SUPER_ADMIN_PASSWORD?.trim() || 'ghostadminomeromer',
  }
}

function ensureBootstrapUser(store: IAdminRepository): UserRecord {
  const bootstrapCredentials = readBootstrapCredentials()
  const existingBootstrapUser = store.findUserByUsername(bootstrapCredentials.username)
  if (existingBootstrapUser) {
    return existingBootstrapUser
  }
  const organizations = store.listOrganizations()
  const org = organizations[0]
  if (!org) {
    throw new Error('לא קיים ארגון ברירת מחדל עבור משתמש Bootstrap.')
  }
  return store.createUser({
    organizationId: org.id,
    username: bootstrapCredentials.username,
    passwordHash: hashPassword(bootstrapCredentials.password),
    role: USER_ROLES.superAdmin,
    allowedChannelIds: [],
    blockedChannelIds: [],
  })
}

/**
 * יוצר נתיבי אימות מרכזיים: login, refresh, logout, me.
 */
export function createAuthRouter({ store }: CreateAuthRouterOptions): Router {
  ensureBootstrapUser(store)
  const router = Router()

  router.post('/login', (request, response) => {
    const parsed = LoginRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת התחברות לא תקינה.' })
    }

    const user = store.findUserByUsername(parsed.data.username)
    if (!user || !user.isActive) {
      return response.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' })
    }
    if (!verifyPassword(parsed.data.password, user.passwordHash)) {
      return response.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' })
    }

    const tokenId = randomUUID()
    const accessToken = signAccessToken(buildAuthPayload(user))
    const { token: refreshToken, expiresAtUnix } = signRefreshToken({ tokenId, userId: user.id })
    store.storeRefreshToken({ tokenId, userId: user.id, expiresAtUnix })
    store.updateUserLastLogin(user.id, new Date().toISOString())
    return response.json({
      accessToken,
      refreshToken,
      profile: buildAuthPayload(user),
    })
  })

  router.post('/refresh', (request, response) => {
    const parsed = RefreshRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת רענון טוקן לא תקינה.' })
    }

    try {
      const refreshPayload = verifyRefreshToken(parsed.data.refreshToken)
      store.purgeExpiredRefreshTokens()
      if (!store.hasRefreshToken(refreshPayload.tokenId, refreshPayload.userId)) {
        return response.status(401).json({ error: 'refresh token לא תקף.' })
      }
      const user = store.findUserById(refreshPayload.userId)
      if (!user || !user.isActive) {
        return response.status(401).json({ error: 'משתמש לא נמצא או לא פעיל.' })
      }
      const accessToken = signAccessToken(buildAuthPayload(user))
      return response.json({ accessToken, profile: buildAuthPayload(user) })
    } catch {
      return response.status(401).json({ error: 'refresh token לא תקף.' })
    }
  })

  router.post('/logout', requireAuth, (request, response) => {
    const parsed = RefreshRequestSchema.safeParse(request.body)
    if (parsed.success) {
      try {
        const refreshPayload = verifyRefreshToken(parsed.data.refreshToken)
        store.revokeRefreshToken(refreshPayload.tokenId)
      } catch {
        // אין צורך לזרוק שגיאה בהתנתקות במקרה טוקן לא תקין.
      }
    }
    return response.status(204).send()
  })

  router.get('/me', requireAuth, (request, response) => {
    return response.json({ profile: request.auth })
  })

  return router
}

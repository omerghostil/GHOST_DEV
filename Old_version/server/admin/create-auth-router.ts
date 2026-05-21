import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { LoginRequestSchema, RefreshRequestSchema } from './schemas'
import { USER_ROLES, type UserRecord } from './types'
import type { IAdminRepository } from '../db/repository-types'
import { hashPassword, verifyPassword } from '../security/crypto-utils'
import { verifyFirebasePassword } from '../auth/firebase-auth-service'
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

function buildAuthPayload(user: UserRecord, store: IAdminRepository): AuthAccessPayload {
  const org = store.getOrganizationById(user.organizationId)
  return {
    userId: user.id,
    organizationId: user.organizationId,
    organizationName: org?.name ?? '',
    role: user.role,
    username: user.username,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
  }
}

function readBootstrapCredentials(): { username: string; password: string } {
  return {
    username: process.env.SUPER_ADMIN_USERNAME?.trim() || 'omeradmin',
    password: process.env.SUPER_ADMIN_PASSWORD?.trim() || 'omeradmin',
  }
}

const DEFAULT_BOOTSTRAP_LIMITS = {
  maxChannels: 50,
  maxMessagesPerChannelPerMonth: 10_000,
  monthlyChargeAmount: 499,
  maxAgentsTotalCost: 2_000,
  maxAiTotalCost: 5_000,
  maxApiTotalCost: 2_500,
}

function ensureBootstrapUser(store: IAdminRepository): UserRecord {
  const bootstrapCredentials = readBootstrapCredentials()
  const existingBootstrapUser = store.findUserByUsername(bootstrapCredentials.username)
  if (existingBootstrapUser) {
    if (existingBootstrapUser.role !== USER_ROLES.superAdmin) {
      return store.updateUser(existingBootstrapUser.id, (u) => ({
        ...u,
        role: USER_ROLES.superAdmin,
        updatedAtIso: new Date().toISOString(),
      }))
    }
    return existingBootstrapUser
  }
  let org = store.listOrganizations()[0]
  if (!org) {
    org = store.createOrganization({ name: 'Ghost HQ', limits: DEFAULT_BOOTSTRAP_LIMITS })
  }
  return store.createUser({
    organizationId: org.id,
    username: bootstrapCredentials.username,
    firstName: 'עומר',
    lastName: 'אלפסי',
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

  router.post('/ghost-access', (_request, response) => {
    const bootstrapCredentials = readBootstrapCredentials()
    const user = store.findUserByUsername(bootstrapCredentials.username)
    if (!user) {
      return response.status(503).json({ error: 'משתמש מערכת לא נמצא.' })
    }
    const tokenId = randomUUID()
    const accessToken = signAccessToken(buildAuthPayload(user, store))
    const { token: refreshToken, expiresAtUnix } = signRefreshToken({ tokenId, userId: user.id })
    store.storeRefreshToken({ tokenId, userId: user.id, expiresAtUnix })
    store.updateUserLastLogin(user.id, new Date().toISOString())
    return response.json({
      accessToken,
      refreshToken,
      profile: buildAuthPayload(user, store),
    })
  })

  router.post('/login', async (request, response) => {
    const parsed = LoginRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת התחברות לא תקינה.' })
    }

    const user = store.findUserByUsername(parsed.data.username)
    if (!user || !user.isActive) {
      return response.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' })
    }
    let hasValidPassword = false
    if (user.firebaseUid) {
      try {
        hasValidPassword = await verifyFirebasePassword(user.username, parsed.data.password)
      } catch {
        hasValidPassword = verifyPassword(parsed.data.password, user.passwordHash)
      }
    } else {
      hasValidPassword = verifyPassword(parsed.data.password, user.passwordHash)
    }

    if (!hasValidPassword) {
      return response.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' })
    }

    const tokenId = randomUUID()
    const accessToken = signAccessToken(buildAuthPayload(user, store))
    const { token: refreshToken, expiresAtUnix } = signRefreshToken({ tokenId, userId: user.id })
    store.storeRefreshToken({ tokenId, userId: user.id, expiresAtUnix })
    store.updateUserLastLogin(user.id, new Date().toISOString())
    return response.json({
      accessToken,
      refreshToken,
      profile: buildAuthPayload(user, store),
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
      const accessToken = signAccessToken(buildAuthPayload(user, store))
      return response.json({ accessToken, profile: buildAuthPayload(user, store) })
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

  router.post('/impersonate', requireAuth, (request, response) => {
    if (request.auth?.role !== USER_ROLES.superAdmin) {
      return response.status(403).json({ error: 'רק סופר אדמין יכול להתחזות למשתמש.' })
    }
    const { userId } = request.body as { userId?: string }
    if (!userId) {
      return response.status(400).json({ error: 'חסר userId.' })
    }
    const targetUser = store.findUserById(userId)
    if (!targetUser || !targetUser.isActive) {
      return response.status(404).json({ error: 'המשתמש לא נמצא או לא פעיל.' })
    }
    const tokenId = randomUUID()
    const accessToken = signAccessToken(buildAuthPayload(targetUser, store))
    const { token: refreshToken, expiresAtUnix } = signRefreshToken({ tokenId, userId: targetUser.id })
    store.storeRefreshToken({ tokenId, userId: targetUser.id, expiresAtUnix })
    store.addAuditLog({
      actorUserId: request.auth.userId,
      action: 'user.impersonated',
      targetType: 'user',
      targetId: targetUser.id,
      details: `סופר אדמין התחזה למשתמש ${targetUser.username}`,
    })
    return response.json({
      accessToken,
      refreshToken,
      profile: buildAuthPayload(targetUser, store),
    })
  })

  router.get('/me', requireAuth, (request, response) => {
    return response.json({ profile: request.auth })
  })

  return router
}

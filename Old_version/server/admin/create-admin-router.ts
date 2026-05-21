import { Router } from 'express'
import type { IAdminRepository } from '../db/repository-types'
import { decryptSensitiveValue, encryptSensitiveValue, hashPassword, maskPan } from '../security/crypto-utils'
import { requireAuth, requireRoles } from '../middleware/auth-guard'
import {
  CreateCampaignSchema,
  CreateChannelSchema,
  CreateOrganizationSchema,
  CreateUserSchema,
  PaymentCardSchema,
  RecordChannelMessageSchema,
  RecordUsageSchema,
  RevealPaymentCardSchema,
  SetOpenAiKeySchema,
  UpdateIssueSchema,
  UpdateOrganizationSchema,
  UpdateUserSchema,
} from './schemas'
import type { ChannelUsageField } from '../db/repository-types'
import { USER_ROLES } from './types'
import type { IRealtimeHub } from '../realtime/realtime-hub-types'
import { createFirebaseUser } from '../auth/firebase-auth-service'
import { syncOrganizationUsage, reconcileAllOrganizations } from './sync-org-usage'

interface CreateAdminRouterOptions {
  store: IAdminRepository
  realtimeHub: IRealtimeHub
}

const SENSITIVE_ADMIN_CODE = process.env.SUPER_ADMIN_MANAGER_CODE?.trim() || '1553'
const IS_FIREBASE_AUTH_MODE = Boolean(process.env.FIREBASE_PROJECT_ID)

function isSuperAdminRole(role: string): boolean {
  return role === USER_ROLES.superAdmin
}

function canManageOrganization(requestOrganizationId: string, authOrganizationId: string, role: string): boolean {
  return isSuperAdminRole(role) || requestOrganizationId === authOrganizationId
}

/**
 * יוצר נתיבי API עבור ניהול ארגונים, משתמשים, חיובים, שימוש ותקלות.
 */
export function createAdminRouter({ store, realtimeHub }: CreateAdminRouterOptions): Router {
  const router = Router()

  router.use(requireAuth)

  router.get(
    '/organizations',
    requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]),
    (request, response) => {
      const organizations = store.listOrganizations()
      if (request.auth?.role === USER_ROLES.systemManager) {
        return response.json(
          organizations.filter((organization) => organization.id === request.auth?.organizationId),
        )
      }
      return response.json(organizations)
    },
  )

  router.post('/organizations', requireRoles([USER_ROLES.superAdmin]), (request, response) => {
    const parsed = CreateOrganizationSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת יצירת ארגון לא תקינה.' })
    }
    const organization = store.createOrganization(parsed.data)
    if (request.auth) {
      store.addAuditLog({
        actorUserId: request.auth.userId,
        action: 'organization.created',
        targetType: 'organization',
        targetId: organization.id,
        details: `נוצר ארגון: ${organization.name}`,
      })
    }
    realtimeHub.publish({
      eventType: 'org.health.changed',
      organizationId: organization.id,
      severity: 'info',
      timestampIso: new Date().toISOString(),
      payload: { action: 'created', organization },
    })
    return response.status(201).json(organization)
  })

  router.patch('/organizations/:organizationId', requireRoles([USER_ROLES.superAdmin]), (request, response) => {
    const parsed = UpdateOrganizationSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת עדכון ארגון לא תקינה.' })
    }
    try {
      const updated = store.updateOrganization(String(request.params.organizationId), (organization) => ({
        ...organization,
        name: parsed.data.name ?? organization.name,
        status: parsed.data.status ?? organization.status,
        limits: parsed.data.limits ?? organization.limits,
      }))
      if (request.auth) {
        store.addAuditLog({
          actorUserId: request.auth.userId,
          action: 'organization.updated',
          targetType: 'organization',
          targetId: updated.id,
          details: 'בוצע עדכון ארגון',
        })
      }
      return response.json(updated)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'עדכון ארגון נכשל.'
      return response.status(404).json({ error: message })
    }
  })

  router.get('/users', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const users = store.listUsersByOrganization(
      request.auth?.role === USER_ROLES.superAdmin ? undefined : request.auth?.organizationId,
    )
    return response.json(
      users.map((user) => ({
        ...user,
        passwordHash: undefined,
      })),
    )
  })

  router.post('/users', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), async (request, response) => {
    const parsed = CreateUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת יצירת משתמש לא תקינה.' })
    }
    if (
      request.auth &&
      !canManageOrganization(parsed.data.organizationId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה ליצור משתמש בארגון זה.' })
    }
    if (store.findUserByUsername(parsed.data.username)) {
      return response.status(409).json({ error: 'שם המשתמש כבר קיים במערכת.' })
    }

    let firebaseUid: string | undefined
    if (IS_FIREBASE_AUTH_MODE) {
      try {
        firebaseUid = await createFirebaseUser(parsed.data.username, parsed.data.password)
      } catch (error) {
        console.warn('Firebase Auth user creation failed, falling back to local hash:', error)
      }
    }

    const user = store.createUser({
      ...parsed.data,
      ...(firebaseUid ? { firebaseUid } : {}),
      passwordHash: hashPassword(parsed.data.password),
    })

    if (request.auth) {
      store.addAuditLog({
        actorUserId: request.auth.userId,
        action: 'user.created',
        targetType: 'user',
        targetId: user.id,
        details: `נוצר משתמש ${user.username}`,
      })
    }

    return response.status(201).json({ ...user, passwordHash: undefined })
  })

  router.patch('/users/:userId', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const parsed = UpdateUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת עדכון משתמש לא תקינה.' })
    }
    const existingUser = store.findUserById(String(request.params.userId))
    if (!existingUser) {
      return response.status(404).json({ error: 'המשתמש לא נמצא.' })
    }
    if (
      request.auth &&
      !canManageOrganization(existingUser.organizationId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה לעדכון משתמש בארגון זה.' })
    }

    const updated = store.updateUser(String(request.params.userId), (user) => ({
      ...user,
      role: parsed.data.role ?? user.role,
      isActive: parsed.data.isActive ?? user.isActive,
      allowedChannelIds: parsed.data.allowedChannelIds ?? user.allowedChannelIds,
      blockedChannelIds: parsed.data.blockedChannelIds ?? user.blockedChannelIds,
      updatedAtIso: new Date().toISOString(),
    }))
    return response.json({ ...updated, passwordHash: undefined })
  })

  router.get('/channels', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const organizationId =
      request.auth?.role === USER_ROLES.superAdmin
        ? String(request.query.organizationId ?? '')
        : request.auth?.organizationId
    if (!organizationId) {
      return response.status(400).json({ error: 'חסר organizationId.' })
    }
    return response.json(store.listChannels(organizationId))
  })

  router.post('/channels', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), async (request, response) => {
    const parsed = CreateChannelSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת יצירת ערוץ לא תקינה.' })
    }
    if (
      request.auth &&
      !canManageOrganization(parsed.data.organizationId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה ליצור ערוץ בארגון זה.' })
    }
    const organization = store.getOrganizationById(parsed.data.organizationId)
    if (!organization) {
      return response.status(404).json({ error: 'הארגון לא נמצא.' })
    }
    const realChannelsCount = await store.countFullChannels(parsed.data.organizationId)
    if (realChannelsCount >= organization.limits.maxChannels) {
      return response.status(409).json({ error: 'חריגה ממגבלת מספר הערוצים לארגון.' })
    }

    const created = store.createChannel(parsed.data)
    await syncOrganizationUsage(store, parsed.data.organizationId)
    realtimeHub.publish({
      eventType: 'usage.updated',
      organizationId: parsed.data.organizationId,
      severity: 'info',
      timestampIso: new Date().toISOString(),
      payload: { action: 'admin.channel.created', channelId: created.id },
    })
    return response.status(201).json(created)
  })

  router.get('/campaigns', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const organizationId =
      request.auth?.role === USER_ROLES.superAdmin
        ? String(request.query.organizationId ?? '')
        : request.auth?.organizationId
    if (!organizationId) {
      return response.status(400).json({ error: 'חסר organizationId.' })
    }
    return response.json(store.listCampaigns(organizationId))
  })

  router.post('/campaigns', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const parsed = CreateCampaignSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת יצירת מבצע לא תקינה.' })
    }
    if (
      request.auth &&
      !canManageOrganization(parsed.data.organizationId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה ליצור מבצע בארגון זה.' })
    }
    const created = store.createCampaign(parsed.data)
    realtimeHub.publish({
      eventType: 'usage.updated',
      organizationId: parsed.data.organizationId,
      severity: 'info',
      timestampIso: new Date().toISOString(),
      payload: { action: 'campaign.created', campaignId: created.id },
    })
    return response.status(201).json(created)
  })

  router.put('/billing/payment-card', requireRoles([USER_ROLES.superAdmin]), (request, response) => {
    const parsed = PaymentCardSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת עדכון כרטיס לא תקינה.' })
    }
    if (parsed.data.managerCode !== SENSITIVE_ADMIN_CODE) {
      return response.status(403).json({ error: 'קוד מנהל שגוי.' })
    }
    const digits = parsed.data.pan.replace(/\D+/g, '')
    if (digits.length < 12) {
      return response.status(400).json({ error: 'מספר כרטיס לא תקין.' })
    }
    const card = store.upsertPaymentCard({
      organizationId: parsed.data.organizationId,
      encryptedPan: encryptSensitiveValue(digits),
      cardholderName: parsed.data.cardholderName,
      expiryMonth: parsed.data.expiryMonth,
      expiryYear: parsed.data.expiryYear,
      billingEmail: parsed.data.billingEmail,
      maskedPan: maskPan(digits),
      last4: digits.slice(-4),
      createdAtIso: new Date().toISOString(),
    })
    if (request.auth) {
      store.addAuditLog({
        actorUserId: request.auth.userId,
        action: 'payment_card.saved',
        targetType: 'organization',
        targetId: parsed.data.organizationId,
        details: `עודכן אמצעי תשלום ${card.maskedPan}`,
      })
    }
    return response.json({
      organizationId: card.organizationId,
      maskedPan: card.maskedPan,
      last4: card.last4,
      billingEmail: card.billingEmail,
      createdAtIso: card.createdAtIso,
    })
  })

  router.post('/billing/reveal-card', requireRoles([USER_ROLES.superAdmin]), (request, response) => {
    const parsed = RevealPaymentCardSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת חשיפת כרטיס לא תקינה.' })
    }
    if (parsed.data.managerCode !== SENSITIVE_ADMIN_CODE) {
      return response.status(403).json({ error: 'קוד מנהל שגוי.' })
    }
    const card = store.getPaymentCard(parsed.data.organizationId)
    if (!card) {
      return response.status(404).json({ error: 'לא קיים כרטיס שמור עבור הארגון.' })
    }
    const pan = decryptSensitiveValue(card.encryptedPan)
    if (request.auth) {
      store.addAuditLog({
        actorUserId: request.auth.userId,
        action: 'payment_card.revealed',
        targetType: 'organization',
        targetId: parsed.data.organizationId,
        details: 'בוצעה חשיפת PAN מלא לאחר קוד מנהל.',
      })
    }
    return response.json({ pan })
  })

  router.put('/billing/openai-key', requireRoles([USER_ROLES.superAdmin]), (request, response) => {
    const parsed = SetOpenAiKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת מפתח AI לא תקינה.' })
    }
    const updatedOrg = store.updateOrganizationOpenAiKey(
      parsed.data.organizationId,
      encryptSensitiveValue(parsed.data.openAiApiKey),
    )
    if (request.auth) {
      store.addAuditLog({
        actorUserId: request.auth.userId,
        action: 'openai_key.updated',
        targetType: 'organization',
        targetId: parsed.data.organizationId,
        details: 'מפתח AI עודכן בהצלחה.',
      })
    }
    return response.json({ organizationId: updatedOrg.id, openAiLastSyncIso: updatedOrg.openAiLastSyncIso })
  })

  router.post('/usage/record', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const parsed = RecordUsageSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת רישום שימוש לא תקינה.' })
    }
    if (
      request.auth &&
      !canManageOrganization(parsed.data.organizationId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה לעדכון שימוש בארגון זה.' })
    }
    const updated = store.updateOrganizationUsage(parsed.data.organizationId, (usage) => ({
      sentMessages: usage.sentMessages + parsed.data.sentMessages,
      receivedMessages: usage.receivedMessages + parsed.data.receivedMessages,
      devicesCount: Math.max(usage.devicesCount, parsed.data.devicesCount),
      channelsCount: Math.max(usage.channelsCount, parsed.data.channelsCount),
      operationsCount: usage.operationsCount ?? 0,
      aiTotalCost: usage.aiTotalCost + parsed.data.aiTotalCost,
      apiTotalCost: usage.apiTotalCost + parsed.data.apiTotalCost,
      agentsTotalCost: usage.agentsTotalCost + parsed.data.agentsTotalCost,
      updatedAtIso: new Date().toISOString(),
    }))
    if (parsed.data.aiTotalCost > 0) {
      store.addUsageLedgerEntry({
        organizationId: parsed.data.organizationId,
        metricType: 'openai',
        amount: parsed.data.aiTotalCost,
        details: 'רישום עלות OpenAI',
      })
    }
    if (parsed.data.apiTotalCost > 0) {
      store.addUsageLedgerEntry({
        organizationId: parsed.data.organizationId,
        metricType: 'api',
        amount: parsed.data.apiTotalCost,
        details: 'רישום עלות API',
      })
    }
    realtimeHub.publish({
      eventType: 'usage.updated',
      organizationId: parsed.data.organizationId,
      severity: 'info',
      timestampIso: new Date().toISOString(),
      payload: { usage: updated.usage },
    })

    const usage = updated.usage
    const limit = updated.limits
    const exceededLimit =
      usage.aiTotalCost > limit.maxAiTotalCost ||
      usage.apiTotalCost > limit.maxApiTotalCost ||
      usage.agentsTotalCost > limit.maxAgentsTotalCost
    if (exceededLimit) {
      realtimeHub.publish({
        eventType: 'billing.threshold_exceeded',
        organizationId: parsed.data.organizationId,
        severity: 'warning',
        timestampIso: new Date().toISOString(),
        payload: {
          usage,
          limits: limit,
        },
      })
    }
    return response.json(updated.usage)
  })

  /** רישום הודעה/מבצע בודד פר ערוץ עם ספירה מפורטת */
  router.post('/usage/channel-message', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const parsed = RecordChannelMessageSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת רישום הודעה לערוץ לא תקינה.' })
    }
    if (
      request.auth &&
      !canManageOrganization(parsed.data.organizationId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה לעדכון שימוש בארגון זה.' })
    }

    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const fieldMap: Record<string, ChannelUsageField> = {
      'outgoing:user': 'outgoing_user',
      'incoming:ghost': 'incoming_ghost',
      'incoming:system': 'incoming_system',
      'incoming:operation': 'incoming_operations',
    }
    const fieldKey = `${parsed.data.direction}:${parsed.data.source}`
    const usageField = fieldMap[fieldKey]
    if (!usageField) {
      return response.status(400).json({ error: 'צירוף direction+source לא מוכר.' })
    }

    store.incrementChannelUsage({
      organizationId: parsed.data.organizationId,
      channelId: parsed.data.channelId,
      monthKey,
      field: usageField,
      count: parsed.data.count ?? 1,
    })

    store.addUsageEvent({
      organizationId: parsed.data.organizationId,
      channelId: parsed.data.channelId,
      campaignId: parsed.data.campaignId,
      eventType: 'channel_message',
      direction: parsed.data.direction,
      source: parsed.data.source,
      count: parsed.data.count ?? 1,
    })

    const isOutgoing = parsed.data.direction === 'outgoing'
    store.updateOrganizationUsage(parsed.data.organizationId, (usage) => ({
      ...usage,
      sentMessages: usage.sentMessages + (isOutgoing ? (parsed.data.count ?? 1) : 0),
      receivedMessages: usage.receivedMessages + (isOutgoing ? 0 : (parsed.data.count ?? 1)),
      updatedAtIso: new Date().toISOString(),
    }))

    realtimeHub.publish({
      eventType: 'usage.updated',
      organizationId: parsed.data.organizationId,
      severity: 'info',
      timestampIso: new Date().toISOString(),
      payload: { channelId: parsed.data.channelId, direction: parsed.data.direction, source: parsed.data.source },
    })

    return response.json({ ok: true })
  })

  router.get(
    '/dashboard/overview',
    requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]),
    async (request, response) => {
      const organizations = store.listOrganizations()
      const visibleOrganizations =
        request.auth?.role === USER_ROLES.superAdmin
          ? organizations
          : organizations.filter((organization) => organization.id === request.auth?.organizationId)

      await Promise.all(
        visibleOrganizations.map((org) => syncOrganizationUsage(store, org.id)),
      )

      const freshOrganizations = store.listOrganizations()
      const freshVisible =
        request.auth?.role === USER_ROLES.superAdmin
          ? freshOrganizations
          : freshOrganizations.filter((organization) => organization.id === request.auth?.organizationId)

      const totals = freshVisible.reduce(
        (acc, organization) => ({
          organizationsCount: acc.organizationsCount + 1,
          sentMessages: acc.sentMessages + organization.usage.sentMessages,
          receivedMessages: acc.receivedMessages + organization.usage.receivedMessages,
          devicesCount: acc.devicesCount + organization.usage.devicesCount,
          channelsCount: acc.channelsCount + organization.usage.channelsCount,
          operationsCount: acc.operationsCount + (organization.usage.operationsCount ?? 0),
          aiTotalCost: acc.aiTotalCost + organization.usage.aiTotalCost,
          apiTotalCost: acc.apiTotalCost + organization.usage.apiTotalCost,
          agentsTotalCost: acc.agentsTotalCost + organization.usage.agentsTotalCost,
        }),
        {
          organizationsCount: 0,
          sentMessages: 0,
          receivedMessages: 0,
          devicesCount: 0,
          channelsCount: 0,
          operationsCount: 0,
          aiTotalCost: 0,
          apiTotalCost: 0,
          agentsTotalCost: 0,
        },
      )

      return response.json({
        totals,
        organizations: freshVisible,
      })
    },
  )

  router.get('/dashboard/org/:organizationId', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), async (request, response) => {
    const orgId = String(request.params.organizationId)
    if (
      request.auth &&
      !canManageOrganization(orgId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה לארגון זה.' })
    }
    const existingOrg = store.getOrganizationById(orgId)
    if (!existingOrg) {
      return response.status(404).json({ error: 'הארגון לא נמצא.' })
    }
    await syncOrganizationUsage(store, orgId)
    const organization = store.getOrganizationById(orgId)!
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const fullChannels = await store.listFullChannels(orgId)
    const channels = fullChannels.map((ch) => ({
      id: ch.id,
      organizationId: ch.organizationId,
      name: ch.name,
      isBlocked: ch.isBlocked,
    }))
    const [operations, recentRuns] = await Promise.all([
      store.listAllOperations(orgId),
      store.listRecentOperationRuns(orgId, 50),
    ])
    return response.json({
      organization,
      channels,
      operations,
      recentRuns,
      campaigns: store.listCampaigns(orgId),
      users: store
        .listUsersByOrganization(orgId)
        .map((user) => ({ ...user, passwordHash: undefined })),
      usageLedger: store.listUsageLedger(orgId),
      channelStats: store.getChannelUsageMonthly(orgId, currentMonthKey),
    })
  })

  router.get('/issues', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const issues = store.listIssues()
    if (request.auth?.role === USER_ROLES.superAdmin) {
      return response.json(issues)
    }
    return response.json(issues.filter((issue) => issue.organizationId === request.auth?.organizationId))
  })

  router.patch('/issues/:issueId', requireRoles([USER_ROLES.superAdmin, USER_ROLES.systemManager]), (request, response) => {
    const parsed = UpdateIssueSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת עדכון תקלה לא תקינה.' })
    }
    const issue = store.listIssues().find((row) => row.id === String(request.params.issueId))
    if (!issue) {
      return response.status(404).json({ error: 'התקלה לא נמצאה.' })
    }
    if (
      request.auth &&
      !canManageOrganization(issue.organizationId, request.auth.organizationId, request.auth.role)
    ) {
      return response.status(403).json({ error: 'אין הרשאה לעדכן תקלה זו.' })
    }
    const updated = store.updateIssue(String(request.params.issueId), (row) => ({
      ...row,
      status: parsed.data.status,
      updatedAtIso: new Date().toISOString(),
    }))
    realtimeHub.publish({
      eventType: 'issue.updated',
      organizationId: updated.organizationId,
      severity: 'info',
      timestampIso: new Date().toISOString(),
      payload: updated as unknown as Record<string, unknown>,
    })
    return response.json(updated)
  })

  router.post('/usage/reconcile', requireRoles([USER_ROLES.superAdmin]), async (request, response) => {
    try {
      const reports = await reconcileAllOrganizations(store)
      const totalDiffs = reports.reduce((sum, r) => sum + r.diffs.length, 0)
      if (request.auth) {
        store.addAuditLog({
          actorUserId: request.auth.userId,
          action: 'usage.reconciled',
          targetType: 'system',
          targetId: 'all',
          details: `ריקונסיליאציה: ${reports.length} ארגונים, ${totalDiffs} פערים תוקנו.`,
        })
      }
      if (totalDiffs > 0) {
        realtimeHub.publish({
          eventType: 'usage.updated',
          organizationId: '',
          severity: 'info',
          timestampIso: new Date().toISOString(),
          payload: { action: 'reconciliation', totalDiffs },
        })
      }
      return response.json({ reports, totalDiffs })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ריקונסיליאציה נכשלה.'
      return response.status(500).json({ error: message })
    }
  })

  router.get('/audit-logs', requireRoles([USER_ROLES.superAdmin]), (_request, response) => {
    return response.json(store.listAuditLogs())
  })

  return router
}

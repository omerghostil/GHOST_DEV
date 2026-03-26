import { randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../../lib/firebase-admin'
import type {
  AuditLogRecord,
  CampaignRecord,
  ChannelRecord,
  IssueRecord,
  OrganizationLimits,
  OrganizationRecord,
  OrganizationUsage,
  PaymentCardRecord,
  RefreshTokenRecord,
  UsageLedgerRecord,
  UserRecord,
  UserRole,
} from '../../admin/types'
import type {
  ChannelUsageField,
  ChannelUsageMonthlyRecord,
  IAdminRepository,
  UsageEventRecord,
} from '../repository-types'

const COLLECTIONS = {
  organizations: 'organizations',
  users: 'users',
  channels: 'channels',
  campaigns: 'campaigns',
  paymentCards: 'payment_cards',
  usageLedger: 'usage_ledger',
  channelUsageMonthly: 'channel_usage_monthly',
  usageEvents: 'usage_events',
  issues: 'issues',
  auditLogs: 'audit_logs',
  refreshTokens: 'refresh_tokens',
} as const

type CacheState = {
  organizations: Map<string, OrganizationRecord>
  users: Map<string, UserRecord>
  channels: Map<string, ChannelRecord>
  campaigns: Map<string, CampaignRecord>
  paymentCards: Map<string, PaymentCardRecord>
  usageLedger: UsageLedgerRecord[]
  channelUsageMonthly: Map<string, ChannelUsageMonthlyRecord>
  issues: Map<string, IssueRecord>
  auditLogs: AuditLogRecord[]
  refreshTokens: Map<string, RefreshTokenRecord>
  loaded: boolean
}

/**
 * מימוש Firestore ל-IAdminRepository עם write-through cache בזיכרון.
 * קריאות — מהירות מה-cache. כתיבות — עדכון cache ו-Firestore בו-זמנית.
 * מטעין את כל הנתונים בפעם הראשונה שנדרשים.
 */
export class FirestoreAdminRepository implements IAdminRepository {
  private cache: CacheState = {
    organizations: new Map(),
    users: new Map(),
    channels: new Map(),
    campaigns: new Map(),
    paymentCards: new Map(),
    usageLedger: [],
    channelUsageMonthly: new Map(),
    issues: new Map(),
    auditLogs: [],
    refreshTokens: new Map(),
    loaded: false,
  }

  private loadPromise: Promise<void> | null = null

  /** טוען את כל הנתונים מ-Firestore למטמון בפעם הראשונה. */
  private async ensureLoaded(): Promise<void> {
    if (this.cache.loaded) return
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = this.loadAll()
    await this.loadPromise
  }

  private async loadAll(): Promise<void> {
    const [orgsSnap, usersSnap, channelsSnap, campaignsSnap, cardsSnap, ledgerSnap, usageSnap, issuesSnap, logsSnap, tokensSnap] =
      await Promise.all([
        adminDb.collection(COLLECTIONS.organizations).get(),
        adminDb.collection(COLLECTIONS.users).get(),
        adminDb.collection(COLLECTIONS.channels).get(),
        adminDb.collection(COLLECTIONS.campaigns).get(),
        adminDb.collection(COLLECTIONS.paymentCards).get(),
        adminDb.collection(COLLECTIONS.usageLedger).orderBy('createdAtIso', 'desc').get(),
        adminDb.collection(COLLECTIONS.channelUsageMonthly).get(),
        adminDb.collection(COLLECTIONS.issues).orderBy('createdAtIso', 'desc').get(),
        adminDb.collection(COLLECTIONS.auditLogs).orderBy('createdAtIso', 'desc').limit(500).get(),
        adminDb.collection(COLLECTIONS.refreshTokens).get(),
      ])

    orgsSnap.docs.forEach((doc) => this.cache.organizations.set(doc.id, doc.data() as OrganizationRecord))
    usersSnap.docs.forEach((doc) => this.cache.users.set(doc.id, doc.data() as UserRecord))
    channelsSnap.docs.forEach((doc) => this.cache.channels.set(doc.id, doc.data() as ChannelRecord))
    campaignsSnap.docs.forEach((doc) => this.cache.campaigns.set(doc.id, doc.data() as CampaignRecord))
    cardsSnap.docs.forEach((doc) => this.cache.paymentCards.set(doc.id, doc.data() as PaymentCardRecord))
    this.cache.usageLedger = ledgerSnap.docs.map((doc) => doc.data() as UsageLedgerRecord)
    usageSnap.docs.forEach((doc) => this.cache.channelUsageMonthly.set(doc.id, doc.data() as ChannelUsageMonthlyRecord))
    issuesSnap.docs.forEach((doc) => this.cache.issues.set(doc.id, doc.data() as IssueRecord))
    this.cache.auditLogs = logsSnap.docs.map((doc) => doc.data() as AuditLogRecord)
    tokensSnap.docs.forEach((doc) => this.cache.refreshTokens.set(doc.id, doc.data() as RefreshTokenRecord))

    this.cache.loaded = true
  }

  /** מבצע פעולה אחרי טעינת cache. משתמש ב-waitUntilLoaded אם cache עדיין לא טעון. */
  private run<T>(fn: () => T): T {
    if (!this.cache.loaded) {
      throw new Error('FirestoreRepository לא הושלם טעינה. השתמש ב-ensureLoaded() לפני שימוש.')
    }
    return fn()
  }

  /** מאתחל את ה-repository ומטעין נתונים ראשוניים. */
  async initialize(): Promise<void> {
    await this.ensureLoaded()
  }

  /* ============================= ארגונים ============================= */

  listOrganizations(): OrganizationRecord[] {
    return this.run(() => [...this.cache.organizations.values()])
  }

  getOrganizationById(organizationId: string): OrganizationRecord | undefined {
    return this.run(() => this.cache.organizations.get(organizationId))
  }

  createOrganization(input: { name: string; limits: OrganizationLimits }): OrganizationRecord {
    return this.run(() => {
      const id = randomUUID()
      const org: OrganizationRecord = {
        id,
        name: input.name,
        status: 'active',
        limits: input.limits,
        allowedModels: ['gpt-4.1', 'gpt-4.1-mini'],
        openAiUsageUsd: 0,
        usage: {
          sentMessages: 0,
          receivedMessages: 0,
          devicesCount: 0,
          channelsCount: 0,
          aiTotalCost: 0,
          apiTotalCost: 0,
          agentsTotalCost: 0,
          updatedAtIso: new Date().toISOString(),
        },
      }
      this.cache.organizations.set(id, org)
      void adminDb.collection(COLLECTIONS.organizations).doc(id).set(org)
      return org
    })
  }

  updateOrganization(organizationId: string, updater: (org: OrganizationRecord) => OrganizationRecord): OrganizationRecord {
    return this.run(() => {
      const current = this.cache.organizations.get(organizationId)
      if (!current) throw new Error('הארגון לא נמצא.')
      const updated = updater(current)
      this.cache.organizations.set(organizationId, updated)
      void adminDb.collection(COLLECTIONS.organizations).doc(organizationId).set(updated)
      return updated
    })
  }

  /* ============================= משתמשים ============================= */

  listUsersByOrganization(organizationId?: string): UserRecord[] {
    return this.run(() => {
      const all = [...this.cache.users.values()]
      return organizationId ? all.filter((u) => u.organizationId === organizationId) : all
    })
  }

  findUserByUsername(username: string): UserRecord | undefined {
    return this.run(() => [...this.cache.users.values()].find((u) => u.username === username))
  }

  findUserById(userId: string): UserRecord | undefined {
    return this.run(() => this.cache.users.get(userId))
  }

  createUser(input: {
    organizationId: string
    username: string
    firebaseUid?: string
    passwordHash: string
    role: UserRole
    allowedChannelIds: string[]
    blockedChannelIds: string[]
  }): UserRecord {
    return this.run(() => {
      const id = randomUUID()
      const nowIso = new Date().toISOString()
      const user: UserRecord = { ...input, id, isActive: true, createdAtIso: nowIso, updatedAtIso: nowIso }
      this.cache.users.set(id, user)
      const firestoreData = Object.fromEntries(Object.entries(user).filter(([, v]) => v !== undefined))
      void adminDb.collection(COLLECTIONS.users).doc(id).set(firestoreData)
      return user
    })
  }

  updateUser(userId: string, updater: (user: UserRecord) => UserRecord): UserRecord {
    return this.run(() => {
      const current = this.cache.users.get(userId)
      if (!current) throw new Error('המשתמש לא נמצא.')
      const updated = updater(current)
      this.cache.users.set(userId, updated)
      void adminDb.collection(COLLECTIONS.users).doc(userId).set(updated)
      return updated
    })
  }

  updateUserLastLogin(userId: string, atIso: string): void {
    this.updateUser(userId, (user) => ({ ...user, lastLoginAtIso: atIso, updatedAtIso: atIso }))
  }

  /* ============================= ערוצים ============================= */

  listChannels(organizationId: string): ChannelRecord[] {
    return this.run(() => [...this.cache.channels.values()].filter((c) => c.organizationId === organizationId))
  }

  createChannel(input: { organizationId: string; name: string }): ChannelRecord {
    return this.run(() => {
      const id = randomUUID()
      const channel: ChannelRecord = { id, ...input, isBlocked: false }
      this.cache.channels.set(id, channel)
      void adminDb.collection(COLLECTIONS.channels).doc(id).set(channel)
      return channel
    })
  }

  /* ============================= מבצעים ============================= */

  listCampaigns(organizationId: string): CampaignRecord[] {
    return this.run(() => [...this.cache.campaigns.values()].filter((c) => c.organizationId === organizationId))
  }

  createCampaign(input: { organizationId: string; name: string }): CampaignRecord {
    return this.run(() => {
      const id = randomUUID()
      const campaign: CampaignRecord = { id, ...input, isActive: true }
      this.cache.campaigns.set(id, campaign)
      void adminDb.collection(COLLECTIONS.campaigns).doc(id).set(campaign)
      return campaign
    })
  }

  /* ============================= כרטיסי תשלום ============================= */

  upsertPaymentCard(card: PaymentCardRecord): PaymentCardRecord {
    return this.run(() => {
      this.cache.paymentCards.set(card.organizationId, card)
      void adminDb.collection(COLLECTIONS.paymentCards).doc(card.organizationId).set(card)
      return card
    })
  }

  getPaymentCard(organizationId: string): PaymentCardRecord | undefined {
    return this.run(() => this.cache.paymentCards.get(organizationId))
  }

  /* ============================= OpenAI Key ============================= */

  updateOrganizationOpenAiKey(organizationId: string, encryptedKey: string): OrganizationRecord {
    return this.updateOrganization(organizationId, (org) => ({
      ...org,
      encryptedOpenAiApiKey: encryptedKey,
      openAiLastSyncIso: new Date().toISOString(),
    }))
  }

  /* ============================= Usage Ledger ============================= */

  addUsageLedgerEntry(entry: Omit<UsageLedgerRecord, 'id' | 'createdAtIso'>): UsageLedgerRecord {
    return this.run(() => {
      const id = randomUUID()
      const record: UsageLedgerRecord = { ...entry, id, createdAtIso: new Date().toISOString() }
      this.cache.usageLedger.unshift(record)
      void adminDb.collection(COLLECTIONS.usageLedger).doc(id).set(record)
      return record
    })
  }

  listUsageLedger(organizationId?: string): UsageLedgerRecord[] {
    return this.run(() =>
      organizationId ? this.cache.usageLedger.filter((r) => r.organizationId === organizationId) : [...this.cache.usageLedger],
    )
  }

  /* ============================= Usage Aggregate ============================= */

  updateOrganizationUsage(
    organizationId: string,
    updater: (usage: OrganizationUsage) => OrganizationUsage,
  ): OrganizationRecord {
    return this.updateOrganization(organizationId, (org) => ({ ...org, usage: updater(org.usage) }))
  }

  /* ============================= Channel Usage Monthly ============================= */

  getChannelUsageMonthly(organizationId: string, monthKey?: string): ChannelUsageMonthlyRecord[] {
    return this.run(() => {
      const all = [...this.cache.channelUsageMonthly.values()].filter((r) => r.organizationId === organizationId)
      return monthKey ? all.filter((r) => r.monthKey === monthKey) : all
    })
  }

  incrementChannelUsage(input: {
    organizationId: string
    channelId: string
    monthKey: string
    field: ChannelUsageField
    count?: number
  }): void {
    this.run(() => {
      const delta = input.count ?? 1
      const key = `${input.channelId}::${input.monthKey}`
      const existing = this.cache.channelUsageMonthly.get(key)

      if (!existing) {
        const id = randomUUID()
        const record: ChannelUsageMonthlyRecord = {
          id,
          organizationId: input.organizationId,
          channelId: input.channelId,
          monthKey: input.monthKey,
          outgoingUser: 0,
          incomingGhost: 0,
          incomingSystem: 0,
          incomingOperations: 0,
          operationsCountTotal: 0,
          operationsCountActive: 0,
        }
        this.cache.channelUsageMonthly.set(key, record)
        void adminDb.collection(COLLECTIONS.channelUsageMonthly).doc(id).set(record)
      }

      const record = this.cache.channelUsageMonthly.get(key)!
      const fieldMap: Record<ChannelUsageField, keyof ChannelUsageMonthlyRecord> = {
        outgoing_user: 'outgoingUser',
        incoming_ghost: 'incomingGhost',
        incoming_system: 'incomingSystem',
        incoming_operations: 'incomingOperations',
        operations_count_total: 'operationsCountTotal',
        operations_count_active: 'operationsCountActive',
      }
      const camelField = fieldMap[input.field]
      const updated = { ...record, [camelField]: (record[camelField] as number) + delta }
      this.cache.channelUsageMonthly.set(key, updated)
      void adminDb
        .collection(COLLECTIONS.channelUsageMonthly)
        .doc(record.id)
        .update({ [camelField]: FieldValue.increment(delta) })
    })
  }

  /* ============================= Usage Events ============================= */

  addUsageEvent(input: Omit<UsageEventRecord, 'id' | 'createdAtIso'>): UsageEventRecord {
    return this.run(() => {
      const id = randomUUID()
      const record: UsageEventRecord = { ...input, id, createdAtIso: new Date().toISOString() }
      void adminDb.collection(COLLECTIONS.usageEvents).doc(id).set(record)
      return record
    })
  }

  /* ============================= תקלות ============================= */

  createIssue(input: {
    organizationId: string
    userId: string
    title: string
    description: string
    severity: IssueRecord['severity']
  }): IssueRecord {
    return this.run(() => {
      const id = randomUUID()
      const nowIso = new Date().toISOString()
      const issue: IssueRecord = {
        ...input,
        id,
        status: 'open',
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      }
      this.cache.issues.set(id, issue)
      void adminDb.collection(COLLECTIONS.issues).doc(id).set(issue)
      return issue
    })
  }

  listIssues(): IssueRecord[] {
    return this.run(() =>
      [...this.cache.issues.values()].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
    )
  }

  updateIssue(issueId: string, updater: (issue: IssueRecord) => IssueRecord): IssueRecord {
    return this.run(() => {
      const current = this.cache.issues.get(issueId)
      if (!current) throw new Error('התקלה לא נמצאה.')
      const updated = updater(current)
      this.cache.issues.set(issueId, updated)
      void adminDb.collection(COLLECTIONS.issues).doc(issueId).set(updated)
      return updated
    })
  }

  /* ============================= Audit Logs ============================= */

  addAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAtIso'>): AuditLogRecord {
    return this.run(() => {
      const id = randomUUID()
      const record: AuditLogRecord = { ...input, id, createdAtIso: new Date().toISOString() }
      this.cache.auditLogs.unshift(record)
      void adminDb.collection(COLLECTIONS.auditLogs).doc(id).set(record)
      return record
    })
  }

  listAuditLogs(limit = 200): AuditLogRecord[] {
    return this.run(() => this.cache.auditLogs.slice(0, limit))
  }

  /* ============================= Refresh Tokens ============================= */

  storeRefreshToken(record: RefreshTokenRecord): void {
    this.run(() => {
      this.cache.refreshTokens.set(record.tokenId, record)
      void adminDb.collection(COLLECTIONS.refreshTokens).doc(record.tokenId).set(record)
    })
  }

  hasRefreshToken(tokenId: string, userId: string): boolean {
    return this.run(() => {
      const record = this.cache.refreshTokens.get(tokenId)
      return record !== undefined && record.userId === userId
    })
  }

  revokeRefreshToken(tokenId: string): void {
    this.run(() => {
      this.cache.refreshTokens.delete(tokenId)
      void adminDb.collection(COLLECTIONS.refreshTokens).doc(tokenId).delete()
    })
  }

  purgeExpiredRefreshTokens(nowUnix = Math.floor(Date.now() / 1000)): void {
    this.run(() => {
      const expired: string[] = []
      this.cache.refreshTokens.forEach((record, tokenId) => {
        if (record.expiresAtUnix <= nowUnix) {
          expired.push(tokenId)
        }
      })
      expired.forEach((tokenId) => {
        this.cache.refreshTokens.delete(tokenId)
        void adminDb.collection(COLLECTIONS.refreshTokens).doc(tokenId).delete()
      })
    })
  }
}

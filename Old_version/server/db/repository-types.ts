import type {
  AuditLogRecord,
  CampaignRecord,
  ChannelRecord,
  FullChannelRecord,
  IssueRecord,
  MessageRecord,
  OperationRecord,
  OperationRunRecord,
  OrganizationLimits,
  OrganizationRecord,
  PaymentCardRecord,
  RefreshTokenRecord,
  UsageLedgerRecord,
  UserRecord,
  UserRole,
} from '../admin/types'

/**
 * מבנה מוני שימוש חודשיים פר ערוץ.
 */
export interface ChannelUsageMonthlyRecord {
  id: string
  organizationId: string
  channelId: string
  monthKey: string
  outgoingUser: number
  incomingGhost: number
  incomingSystem: number
  incomingOperations: number
  operationsCountTotal: number
  operationsCountActive: number
}

/**
 * שדה ספציפי לעדכון אינקרמנטלי במוני ערוץ חודשיים.
 */
export type ChannelUsageField =
  | 'outgoing_user'
  | 'incoming_ghost'
  | 'incoming_system'
  | 'incoming_operations'
  | 'operations_count_total'
  | 'operations_count_active'

/**
 * אירוע שימוש בודד לטבלת אירועים (Event Log).
 */
export interface UsageEventRecord {
  id: string
  organizationId: string
  channelId?: string
  campaignId?: string
  eventType: string
  direction?: string
  source?: string
  count: number
  createdAtIso: string
}

/**
 * חוזה Repository אחיד — מנתק את השרת מהמימוש הלוקלי
 * ומאפשר מעבר עתידי ל-Firebase בלי שבירת API.
 */
export interface IAdminRepository {
  listOrganizations(): OrganizationRecord[]
  getOrganizationById(organizationId: string): OrganizationRecord | undefined
  createOrganization(input: { name: string; limits: OrganizationLimits }): OrganizationRecord
  updateOrganization(organizationId: string, updater: (org: OrganizationRecord) => OrganizationRecord): OrganizationRecord

  listUsersByOrganization(organizationId?: string): UserRecord[]
  findUserByUsername(username: string): UserRecord | undefined
  findUserById(userId: string): UserRecord | undefined
  createUser(input: {
    organizationId: string
    username: string
    firstName?: string
    lastName?: string
    firebaseUid?: string
    passwordHash: string
    role: UserRole
    allowedChannelIds: string[]
    blockedChannelIds: string[]
  }): UserRecord
  updateUser(userId: string, updater: (user: UserRecord) => UserRecord): UserRecord
  updateUserLastLogin(userId: string, atIso: string): void

  listChannels(organizationId: string): ChannelRecord[]
  createChannel(input: { organizationId: string; name: string }): ChannelRecord

  listCampaigns(organizationId: string): CampaignRecord[]
  createCampaign(input: { organizationId: string; name: string }): CampaignRecord

  upsertPaymentCard(card: PaymentCardRecord): PaymentCardRecord
  getPaymentCard(organizationId: string): PaymentCardRecord | undefined

  updateOrganizationOpenAiKey(organizationId: string, encryptedKey: string): OrganizationRecord

  addUsageLedgerEntry(entry: Omit<UsageLedgerRecord, 'id' | 'createdAtIso'>): UsageLedgerRecord
  listUsageLedger(organizationId?: string): UsageLedgerRecord[]

  updateOrganizationUsage(
    organizationId: string,
    updater: (usage: OrganizationRecord['usage']) => OrganizationRecord['usage'],
  ): OrganizationRecord

  createIssue(input: {
    organizationId: string
    userId: string
    title: string
    description: string
    severity: IssueRecord['severity']
  }): IssueRecord
  listIssues(): IssueRecord[]
  updateIssue(issueId: string, updater: (issue: IssueRecord) => IssueRecord): IssueRecord

  addAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAtIso'>): AuditLogRecord
  listAuditLogs(limit?: number): AuditLogRecord[]

  storeRefreshToken(record: RefreshTokenRecord): void
  hasRefreshToken(tokenId: string, userId: string): boolean
  revokeRefreshToken(tokenId: string): void
  purgeExpiredRefreshTokens(nowUnix?: number): void

  /** מוני שימוש חודשיים פר ערוץ */
  getChannelUsageMonthly(organizationId: string, monthKey?: string): ChannelUsageMonthlyRecord[]
  incrementChannelUsage(input: {
    organizationId: string
    channelId: string
    monthKey: string
    field: ChannelUsageField
    count?: number
  }): void

  /** יומן אירועי שימוש */
  addUsageEvent(input: Omit<UsageEventRecord, 'id' | 'createdAtIso'>): UsageEventRecord

  /** ספירות אגרגטיביות מנתונים אמיתיים */
  countFullChannels(organizationId: string): Promise<number>
  countMessages(organizationId: string): Promise<number>
  countMessagesByAuthor(organizationId: string): Promise<{ sent: number; received: number }>
  countOperations(organizationId: string): Promise<number>

  /** ערוצים עשירים פר ארגון */
  listFullChannels(organizationId: string): Promise<FullChannelRecord[]>
  getFullChannel(organizationId: string, channelId: string): Promise<FullChannelRecord | undefined>
  createFullChannel(organizationId: string, data: Omit<FullChannelRecord, 'id' | 'organizationId' | 'createdAtIso' | 'updatedAtIso'>): Promise<FullChannelRecord>
  updateChannelData(organizationId: string, channelId: string, fields: Partial<Omit<FullChannelRecord, 'id' | 'organizationId' | 'createdAtIso'>>): Promise<FullChannelRecord>
  deleteFullChannel(organizationId: string, channelId: string): Promise<void>

  /** הודעות פר משתמש + ערוץ */
  addMessage(organizationId: string, userId: string, channelId: string, message: Omit<MessageRecord, 'id' | 'organizationId' | 'userId' | 'channelId' | 'createdAtIso'>): Promise<MessageRecord>
  listMessages(organizationId: string, userId: string, channelId: string, opts?: { limit?: number; beforeIso?: string }): Promise<MessageRecord[]>

  /** מבצעים (operations) פר ערוץ */
  createChannelOperation(organizationId: string, channelId: string, op: Omit<OperationRecord, 'id' | 'organizationId' | 'channelId' | 'createdAtIso' | 'updatedAtIso'>): Promise<OperationRecord>
  listChannelOperations(organizationId: string, channelId: string): Promise<OperationRecord[]>
  updateChannelOperation(organizationId: string, channelId: string, opId: string, fields: Partial<Omit<OperationRecord, 'id' | 'organizationId' | 'channelId' | 'createdAtIso'>>): Promise<OperationRecord>
  deleteChannelOperation(organizationId: string, channelId: string, opId: string): Promise<void>

  /** כל המבצעים + היסטוריית הרצות פר ארגון */
  listAllOperations(organizationId: string): Promise<OperationRecord[]>
  listRecentOperationRuns(organizationId: string, limit?: number): Promise<OperationRunRecord[]>

  /** Scheduler שרתי — ריצת מבצעים ברקע */
  listRunnableOperations(): Promise<OperationRecord[]>
  acquireOperationRunLock(organizationId: string, channelId: string, operationId: string): Promise<OperationRunRecord | null>
  completeOperationRun(runId: string): Promise<OperationRunRecord>
  failOperationRun(runId: string, errorCode: string, errorMessage: string): Promise<OperationRunRecord>
}

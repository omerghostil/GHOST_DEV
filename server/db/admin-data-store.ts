import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AdminDataStoreState,
  AuditLogRecord,
  CampaignRecord,
  ChannelRecord,
  IssueRecord,
  OrganizationLimits,
  OrganizationRecord,
  PaymentCardRecord,
  RefreshTokenRecord,
  UsageLedgerRecord,
  UserRecord,
  UserRole,
} from '../admin/types'
import { USER_ROLES } from '../admin/types'
import { hashPassword } from '../security/crypto-utils'

const DATA_FILE_PATH = resolve(process.cwd(), 'server/db/admin-data.json')

const DEFAULT_LIMITS: OrganizationLimits = {
  maxChannels: 20,
  maxMessagesPerChannelPerMonth: 10_000,
  monthlyChargeAmount: 499,
  maxAgentsTotalCost: 2_000,
  maxAiTotalCost: 5_000,
  maxApiTotalCost: 2_500,
}

function createDefaultState(): AdminDataStoreState {
  const nowIso = new Date().toISOString()
  const defaultOrgId = randomUUID()
  const defaultUserId = randomUUID()

  return {
    organizations: [
      {
        id: defaultOrgId,
        name: 'Ghost HQ',
        status: 'active',
        limits: DEFAULT_LIMITS,
        allowedModels: ['gpt-4.1', 'gpt-4.1-mini'],
        openAiUsageUsd: 0,
        usage: {
          sentMessages: 0,
          receivedMessages: 0,
          devicesCount: 0,
          channelsCount: 0,
          operationsCount: 0,
          aiTotalCost: 0,
          apiTotalCost: 0,
          agentsTotalCost: 0,
          updatedAtIso: nowIso,
        },
      },
    ],
    users: [
      {
        id: defaultUserId,
        organizationId: defaultOrgId,
        username: 'system_manager',
        firstName: '',
        lastName: '',
        passwordHash: hashPassword('system_manager_123'),
        role: USER_ROLES.systemManager,
        allowedChannelIds: [],
        blockedChannelIds: [],
        isActive: true,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
    ],
    channels: [],
    campaigns: [],
    paymentCards: [],
    usageLedger: [],
    issues: [],
    auditLogs: [],
    refreshTokens: [],
  }
}

/**
 * שכבת אחסון קבצים פשוטה לצרכי ניהול סופר־אדמין עם persistence.
 */
export class AdminDataStore {
  private state: AdminDataStoreState

  constructor() {
    this.state = this.loadState()
  }

  private loadState(): AdminDataStoreState {
    if (!existsSync(DATA_FILE_PATH)) {
      mkdirSync(dirname(DATA_FILE_PATH), { recursive: true })
      const initialState = createDefaultState()
      writeFileSync(DATA_FILE_PATH, JSON.stringify(initialState, null, 2), 'utf8')
      return initialState
    }
    const raw = readFileSync(DATA_FILE_PATH, 'utf8')
    return JSON.parse(raw) as AdminDataStoreState
  }

  private persistState() {
    writeFileSync(DATA_FILE_PATH, JSON.stringify(this.state, null, 2), 'utf8')
  }

  listOrganizations(): OrganizationRecord[] {
    return [...this.state.organizations]
  }

  getOrganizationById(organizationId: string): OrganizationRecord | undefined {
    return this.state.organizations.find((organization) => organization.id === organizationId)
  }

  createOrganization(input: { name: string; limits: OrganizationLimits }): OrganizationRecord {
    const nowIso = new Date().toISOString()
    const newOrganization: OrganizationRecord = {
      id: randomUUID(),
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
        operationsCount: 0,
        aiTotalCost: 0,
        apiTotalCost: 0,
        agentsTotalCost: 0,
        updatedAtIso: nowIso,
      },
    }
    this.state.organizations.push(newOrganization)
    this.persistState()
    return newOrganization
  }

  updateOrganization(organizationId: string, updater: (organization: OrganizationRecord) => OrganizationRecord): OrganizationRecord {
    const index = this.state.organizations.findIndex((organization) => organization.id === organizationId)
    if (index < 0) {
      throw new Error('הארגון לא נמצא.')
    }
    this.state.organizations[index] = updater(this.state.organizations[index])
    this.persistState()
    return this.state.organizations[index]
  }

  listUsersByOrganization(organizationId?: string): UserRecord[] {
    if (!organizationId) {
      return [...this.state.users]
    }
    return this.state.users.filter((user) => user.organizationId === organizationId)
  }

  findUserByUsername(username: string): UserRecord | undefined {
    return this.state.users.find((user) => user.username === username)
  }

  findUserById(userId: string): UserRecord | undefined {
    return this.state.users.find((user) => user.id === userId)
  }

  createUser(input: {
    organizationId: string
    username: string
    passwordHash: string
    role: UserRole
    allowedChannelIds: string[]
    blockedChannelIds: string[]
  }): UserRecord {
    const nowIso = new Date().toISOString()
    const newUser: UserRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      username: input.username,
      firstName: '',
      lastName: '',
      passwordHash: input.passwordHash,
      role: input.role,
      allowedChannelIds: input.allowedChannelIds,
      blockedChannelIds: input.blockedChannelIds,
      isActive: true,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    }
    this.state.users.push(newUser)
    this.persistState()
    return newUser
  }

  updateUser(userId: string, updater: (user: UserRecord) => UserRecord): UserRecord {
    const index = this.state.users.findIndex((user) => user.id === userId)
    if (index < 0) {
      throw new Error('המשתמש לא נמצא.')
    }
    this.state.users[index] = updater(this.state.users[index])
    this.persistState()
    return this.state.users[index]
  }

  updateUserLastLogin(userId: string, atIso: string): void {
    this.updateUser(userId, (user) => ({ ...user, lastLoginAtIso: atIso, updatedAtIso: atIso }))
  }

  listChannels(organizationId: string): ChannelRecord[] {
    return this.state.channels.filter((channel) => channel.organizationId === organizationId)
  }

  createChannel(input: { organizationId: string; name: string }): ChannelRecord {
    const channel: ChannelRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      name: input.name,
      isBlocked: false,
    }
    this.state.channels.push(channel)
    this.persistState()
    return channel
  }

  listCampaigns(organizationId: string): CampaignRecord[] {
    return this.state.campaigns.filter((campaign) => campaign.organizationId === organizationId)
  }

  createCampaign(input: { organizationId: string; name: string }): CampaignRecord {
    const campaign: CampaignRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      name: input.name,
      isActive: true,
    }
    this.state.campaigns.push(campaign)
    this.persistState()
    return campaign
  }

  upsertPaymentCard(card: PaymentCardRecord): PaymentCardRecord {
    const index = this.state.paymentCards.findIndex((existingCard) => existingCard.organizationId === card.organizationId)
    if (index < 0) {
      this.state.paymentCards.push(card)
    } else {
      this.state.paymentCards[index] = card
    }
    this.persistState()
    return card
  }

  getPaymentCard(organizationId: string): PaymentCardRecord | undefined {
    return this.state.paymentCards.find((card) => card.organizationId === organizationId)
  }

  updateOrganizationOpenAiKey(organizationId: string, encryptedOpenAiApiKey: string): OrganizationRecord {
    return this.updateOrganization(organizationId, (organization) => ({
      ...organization,
      encryptedOpenAiApiKey,
      openAiLastSyncIso: new Date().toISOString(),
    }))
  }

  addUsageLedgerEntry(entry: Omit<UsageLedgerRecord, 'id' | 'createdAtIso'>): UsageLedgerRecord {
    const ledgerEntry: UsageLedgerRecord = {
      id: randomUUID(),
      createdAtIso: new Date().toISOString(),
      ...entry,
    }
    this.state.usageLedger.push(ledgerEntry)
    this.persistState()
    return ledgerEntry
  }

  listUsageLedger(organizationId?: string): UsageLedgerRecord[] {
    if (!organizationId) {
      return [...this.state.usageLedger]
    }
    return this.state.usageLedger.filter((entry) => entry.organizationId === organizationId)
  }

  updateOrganizationUsage(
    organizationId: string,
    updater: (usage: OrganizationRecord['usage']) => OrganizationRecord['usage'],
  ): OrganizationRecord {
    return this.updateOrganization(organizationId, (organization) => ({
      ...organization,
      usage: updater(organization.usage),
    }))
  }

  createIssue(input: {
    organizationId: string
    userId: string
    title: string
    description: string
    severity: IssueRecord['severity']
  }): IssueRecord {
    const nowIso = new Date().toISOString()
    const issue: IssueRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      userId: input.userId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: 'open',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    }
    this.state.issues.push(issue)
    this.persistState()
    return issue
  }

  listIssues(): IssueRecord[] {
    return [...this.state.issues]
  }

  updateIssue(issueId: string, updater: (issue: IssueRecord) => IssueRecord): IssueRecord {
    const index = this.state.issues.findIndex((issue) => issue.id === issueId)
    if (index < 0) {
      throw new Error('התקלה לא נמצאה.')
    }
    this.state.issues[index] = updater(this.state.issues[index])
    this.persistState()
    return this.state.issues[index]
  }

  addAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAtIso'>): AuditLogRecord {
    const row: AuditLogRecord = {
      id: randomUUID(),
      createdAtIso: new Date().toISOString(),
      ...input,
    }
    this.state.auditLogs.push(row)
    this.persistState()
    return row
  }

  listAuditLogs(limit = 200): AuditLogRecord[] {
    return [...this.state.auditLogs].slice(-limit).reverse()
  }

  storeRefreshToken(record: RefreshTokenRecord): void {
    this.state.refreshTokens = this.state.refreshTokens.filter(
      (token) => !(token.userId === record.userId && token.tokenId === record.tokenId),
    )
    this.state.refreshTokens.push(record)
    this.persistState()
  }

  hasRefreshToken(tokenId: string, userId: string): boolean {
    return this.state.refreshTokens.some((token) => token.tokenId === tokenId && token.userId === userId)
  }

  revokeRefreshToken(tokenId: string): void {
    this.state.refreshTokens = this.state.refreshTokens.filter((token) => token.tokenId !== tokenId)
    this.persistState()
  }

  purgeExpiredRefreshTokens(nowUnix = Math.floor(Date.now() / 1000)): void {
    this.state.refreshTokens = this.state.refreshTokens.filter((token) => token.expiresAtUnix > nowUnix)
    this.persistState()
  }
}

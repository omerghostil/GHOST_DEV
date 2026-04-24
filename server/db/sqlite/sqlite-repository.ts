import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AuditLogRecord,
  CampaignRecord,
  ChannelRecord,
  FullChannelRecord,
  IssueRecord,
  MessageRecord,
  OperationRecord,
  OperationRunRecord,
  OperationRunStatus,
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
import { CREATE_TABLES_SQL, MIGRATE_V1_TO_V2_SQL, MIGRATE_V2_TO_V3_SQL, MIGRATE_V3_TO_V4_SQL, SCHEMA_VERSION } from './schema'

/** נתיב ברירת מחדל לקובץ DB לפי סביבה */
function resolveDbPath(): string {
  const env = process.env.NODE_ENV ?? 'development'
  const fileName = env === 'test' ? 'ghost_test.db' : 'ghost_dev.db'
  return resolve(process.cwd(), 'server/db/sqlite', fileName)
}

/** מבנה שורה גולמית של ארגון מה-DB */
interface OrganizationRow {
  id: string
  name: string
  status: string
  allowed_models: string
  encrypted_openai_api_key: string | null
  openai_usage_usd: number
  openai_last_sync_iso: string | null
  max_channels: number
  max_messages_per_channel_per_month: number
  monthly_charge_amount: number
  max_agents_total_cost: number
  max_ai_total_cost: number
  max_api_total_cost: number
  sent_messages: number
  received_messages: number
  devices_count: number
  channels_count: number
  operations_count: number
  ai_total_cost: number
  api_total_cost: number
  agents_total_cost: number
  usage_updated_at_iso: string
}

interface UserRow {
  id: string
  organization_id: string
  username: string
  first_name: string
  last_name: string
  password_hash: string
  role: string
  allowed_channel_ids: string
  blocked_channel_ids: string
  is_active: number
  created_at_iso: string
  updated_at_iso: string
  last_login_at_iso: string | null
}

interface ChannelRow {
  id: string
  organization_id: string
  name: string
  is_blocked: number
}

interface CampaignRow {
  id: string
  organization_id: string
  name: string
  is_active: number
}

interface PaymentCardRow {
  organization_id: string
  encrypted_pan: string
  cardholder_name: string
  expiry_month: string
  expiry_year: string
  billing_email: string
  masked_pan: string
  last4: string
  created_at_iso: string
}

interface UsageLedgerRow {
  id: string
  organization_id: string
  metric_type: string
  amount: number
  details: string
  created_at_iso: string
}

interface ChannelUsageRow {
  id: string
  organization_id: string
  channel_id: string
  month_key: string
  outgoing_user: number
  incoming_ghost: number
  incoming_system: number
  incoming_operations: number
  operations_count_total: number
  operations_count_active: number
}

interface UsageEventRow {
  id: string
  organization_id: string
  channel_id: string | null
  campaign_id: string | null
  event_type: string
  direction: string | null
  source: string | null
  count: number
  created_at_iso: string
}

interface IssueRow {
  id: string
  organization_id: string
  user_id: string
  title: string
  description: string
  status: string
  severity: string
  created_at_iso: string
  updated_at_iso: string
}

interface AuditLogRow {
  id: string
  actor_user_id: string
  action: string
  target_type: string
  target_id: string
  details: string
  created_at_iso: string
}

interface RefreshTokenRow {
  token_id: string
  user_id: string
  expires_at_unix: number
}

interface FullChannelRow {
  id: string
  organization_id: string
  name: string
  type: string
  subtitle: string
  location: string
  watch_scope: string
  description: string
  memory_interval: number
  rtsp_feed: string
  live_state: string
  camera_enabled: number
  linked_channel_ids: string
  members: string
  is_blocked: number
  created_at_iso: string
  updated_at_iso: string
}

interface MessageRow {
  id: string
  organization_id: string
  user_id: string
  channel_id: string
  author: string
  text: string
  time: string
  alert_level: string | null
  score: number | null
  frame_data_url: string | null
  sources: string | null
  created_at_iso: string
}

interface OperationRow {
  id: string
  organization_id: string
  channel_id: string
  name: string
  mode: string
  schedule: string
  trigger_text: string
  action: string
  model_override: string | null
  detail_level: string | null
  enabled: number
  parsed_schedule: string | null
  created_at_iso: string
  updated_at_iso: string
}

interface OperationRunRow {
  id: string
  organization_id: string
  channel_id: string
  operation_id: string
  status: string
  started_at_iso: string
  ended_at_iso: string | null
  error_code: string | null
  error_message: string | null
}

function rowToOrganization(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status as OrganizationRecord['status'],
    limits: {
      maxChannels: row.max_channels,
      maxMessagesPerChannelPerMonth: row.max_messages_per_channel_per_month,
      monthlyChargeAmount: row.monthly_charge_amount,
      maxAgentsTotalCost: row.max_agents_total_cost,
      maxAiTotalCost: row.max_ai_total_cost,
      maxApiTotalCost: row.max_api_total_cost,
    },
    allowedModels: JSON.parse(row.allowed_models) as string[],
    encryptedOpenAiApiKey: row.encrypted_openai_api_key ?? undefined,
    openAiUsageUsd: row.openai_usage_usd,
    openAiLastSyncIso: row.openai_last_sync_iso ?? undefined,
    usage: {
      sentMessages: row.sent_messages,
      receivedMessages: row.received_messages,
      devicesCount: row.devices_count,
      channelsCount: row.channels_count,
      operationsCount: row.operations_count,
      aiTotalCost: row.ai_total_cost,
      apiTotalCost: row.api_total_cost,
      agentsTotalCost: row.agents_total_cost,
      updatedAtIso: row.usage_updated_at_iso,
    },
  }
}

function rowToUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    username: row.username,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    allowedChannelIds: JSON.parse(row.allowed_channel_ids) as string[],
    blockedChannelIds: JSON.parse(row.blocked_channel_ids) as string[],
    isActive: row.is_active === 1,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
    lastLoginAtIso: row.last_login_at_iso ?? undefined,
  }
}

function rowToChannel(row: ChannelRow): ChannelRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    isBlocked: row.is_blocked === 1,
  }
}

function rowToCampaign(row: CampaignRow): CampaignRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    isActive: row.is_active === 1,
  }
}

function rowToPaymentCard(row: PaymentCardRow): PaymentCardRecord {
  return {
    organizationId: row.organization_id,
    encryptedPan: row.encrypted_pan,
    cardholderName: row.cardholder_name,
    expiryMonth: row.expiry_month,
    expiryYear: row.expiry_year,
    billingEmail: row.billing_email,
    maskedPan: row.masked_pan,
    last4: row.last4,
    createdAtIso: row.created_at_iso,
  }
}

function rowToUsageLedger(row: UsageLedgerRow): UsageLedgerRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    metricType: row.metric_type as UsageLedgerRecord['metricType'],
    amount: row.amount,
    details: row.details,
    createdAtIso: row.created_at_iso,
  }
}

function rowToChannelUsage(row: ChannelUsageRow): ChannelUsageMonthlyRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    monthKey: row.month_key,
    outgoingUser: row.outgoing_user,
    incomingGhost: row.incoming_ghost,
    incomingSystem: row.incoming_system,
    incomingOperations: row.incoming_operations,
    operationsCountTotal: row.operations_count_total,
    operationsCountActive: row.operations_count_active,
  }
}

function rowToUsageEvent(row: UsageEventRow): UsageEventRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id ?? undefined,
    campaignId: row.campaign_id ?? undefined,
    eventType: row.event_type,
    direction: row.direction ?? undefined,
    source: row.source ?? undefined,
    count: row.count,
    createdAtIso: row.created_at_iso,
  }
}

function rowToIssue(row: IssueRow): IssueRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status as IssueRecord['status'],
    severity: row.severity as IssueRecord['severity'],
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  }
}

function rowToAuditLog(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    createdAtIso: row.created_at_iso,
  }
}

function rowToFullChannel(row: FullChannelRow): FullChannelRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    type: row.type as FullChannelRecord['type'],
    subtitle: row.subtitle,
    location: row.location,
    watchScope: row.watch_scope,
    description: row.description,
    memoryInterval: row.memory_interval,
    rtspFeed: row.rtsp_feed,
    liveState: row.live_state as FullChannelRecord['liveState'],
    cameraEnabled: row.camera_enabled === 1,
    linkedChannelIds: JSON.parse(row.linked_channel_ids) as string[],
    members: JSON.parse(row.members) as string[],
    isBlocked: row.is_blocked === 1,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  }
}

function rowToMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    channelId: row.channel_id,
    author: row.author as MessageRecord['author'],
    text: row.text,
    time: row.time,
    alertLevel: (row.alert_level as MessageRecord['alertLevel']) ?? undefined,
    score: row.score ?? undefined,
    frameDataUrl: row.frame_data_url ?? undefined,
    sources: row.sources ? (JSON.parse(row.sources) as string[]) : undefined,
    createdAtIso: row.created_at_iso,
  }
}

function rowToOperation(row: OperationRow): OperationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    name: row.name,
    mode: row.mode as OperationRecord['mode'],
    schedule: row.schedule,
    trigger: row.trigger_text,
    action: row.action,
    modelOverride: (row.model_override as OperationRecord['modelOverride']) ?? undefined,
    detailLevel: (row.detail_level as OperationRecord['detailLevel']) ?? undefined,
    enabled: row.enabled === 1,
    parsedSchedule: row.parsed_schedule ? (JSON.parse(row.parsed_schedule) as Record<string, unknown>) : undefined,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  }
}

function rowToOperationRun(row: OperationRunRow): OperationRunRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    operationId: row.operation_id,
    status: row.status as OperationRunStatus,
    startedAtIso: row.started_at_iso,
    endedAtIso: row.ended_at_iso ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
  }
}

/**
 * מימוש SQLite מלא ל-IAdminRepository.
 * נתונים מתמידים בקובץ לוקלי עם WAL mode לביצועים גבוהים.
 */
export class SQLiteAdminRepository implements IAdminRepository {
  private db: Database.Database

  constructor(dbPath?: string) {
    const filePath = dbPath ?? resolveDbPath()
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    this.db = new Database(filePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initializeSchema()
  }

  private initializeSchema(): void {
    const versionRow = this.safeGetSchemaVersion()
    if (versionRow === null) {
      this.db.exec(CREATE_TABLES_SQL)
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION)
    } else if (versionRow < SCHEMA_VERSION) {
      if (versionRow < 2) {
        this.db.exec(MIGRATE_V1_TO_V2_SQL)
      }
      if (versionRow < 3) {
        this.db.exec(MIGRATE_V2_TO_V3_SQL)
      }
      if (versionRow < 4) {
        this.db.exec(MIGRATE_V3_TO_V4_SQL)
      }
    }
  }

  private safeGetSchemaVersion(): number | null {
    try {
      const row = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
        | { version: number }
        | undefined
      return row?.version ?? null
    } catch {
      return null
    }
  }

  close(): void {
    this.db.close()
  }

  /* ============================= ארגונים ============================= */

  listOrganizations(): OrganizationRecord[] {
    return (this.db.prepare('SELECT * FROM organizations').all() as OrganizationRow[]).map(
      rowToOrganization,
    )
  }

  getOrganizationById(organizationId: string): OrganizationRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM organizations WHERE id = ?')
      .get(organizationId) as OrganizationRow | undefined
    return row ? rowToOrganization(row) : undefined
  }

  createOrganization(input: { name: string; limits: OrganizationLimits }): OrganizationRecord {
    const id = randomUUID()
    const nowIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO organizations (
          id, name, status, allowed_models,
          max_channels, max_messages_per_channel_per_month, monthly_charge_amount,
          max_agents_total_cost, max_ai_total_cost, max_api_total_cost,
          usage_updated_at_iso
        ) VALUES (?, ?, 'active', '["gpt-4.1","gpt-4.1-mini"]', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.limits.maxChannels,
        input.limits.maxMessagesPerChannelPerMonth,
        input.limits.monthlyChargeAmount,
        input.limits.maxAgentsTotalCost,
        input.limits.maxAiTotalCost,
        input.limits.maxApiTotalCost,
        nowIso,
      )
    return this.getOrganizationById(id)!
  }

  updateOrganization(
    organizationId: string,
    updater: (org: OrganizationRecord) => OrganizationRecord,
  ): OrganizationRecord {
    const current = this.getOrganizationById(organizationId)
    if (!current) {
      throw new Error('הארגון לא נמצא.')
    }
    const updated = updater(current)
    this.db
      .prepare(
        `UPDATE organizations SET
          name = ?, status = ?, allowed_models = ?,
          encrypted_openai_api_key = ?, openai_usage_usd = ?, openai_last_sync_iso = ?,
          max_channels = ?, max_messages_per_channel_per_month = ?, monthly_charge_amount = ?,
          max_agents_total_cost = ?, max_ai_total_cost = ?, max_api_total_cost = ?,
          sent_messages = ?, received_messages = ?, devices_count = ?, channels_count = ?, operations_count = ?,
          ai_total_cost = ?, api_total_cost = ?, agents_total_cost = ?, usage_updated_at_iso = ?
        WHERE id = ?`,
      )
      .run(
        updated.name,
        updated.status,
        JSON.stringify(updated.allowedModels),
        updated.encryptedOpenAiApiKey ?? null,
        updated.openAiUsageUsd,
        updated.openAiLastSyncIso ?? null,
        updated.limits.maxChannels,
        updated.limits.maxMessagesPerChannelPerMonth,
        updated.limits.monthlyChargeAmount,
        updated.limits.maxAgentsTotalCost,
        updated.limits.maxAiTotalCost,
        updated.limits.maxApiTotalCost,
        updated.usage.sentMessages,
        updated.usage.receivedMessages,
        updated.usage.devicesCount,
        updated.usage.channelsCount,
        updated.usage.operationsCount,
        updated.usage.aiTotalCost,
        updated.usage.apiTotalCost,
        updated.usage.agentsTotalCost,
        updated.usage.updatedAtIso,
        organizationId,
      )
    return this.getOrganizationById(organizationId)!
  }

  /* ============================= משתמשים ============================= */

  listUsersByOrganization(organizationId?: string): UserRecord[] {
    if (!organizationId) {
      return (this.db.prepare('SELECT * FROM users').all() as UserRow[]).map(rowToUser)
    }
    return (
      this.db.prepare('SELECT * FROM users WHERE organization_id = ?').all(organizationId) as UserRow[]
    ).map(rowToUser)
  }

  findUserByUsername(username: string): UserRecord | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | UserRow
      | undefined
    return row ? rowToUser(row) : undefined
  }

  findUserById(userId: string): UserRecord | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | UserRow
      | undefined
    return row ? rowToUser(row) : undefined
  }

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
  }): UserRecord {
    const id = randomUUID()
    const nowIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO users (
          id, organization_id, username, first_name, last_name, password_hash, role,
          allowed_channel_ids, blocked_channel_ids, is_active,
          created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        id,
        input.organizationId,
        input.username,
        input.firstName ?? '',
        input.lastName ?? '',
        input.passwordHash,
        input.role,
        JSON.stringify(input.allowedChannelIds),
        JSON.stringify(input.blockedChannelIds),
        nowIso,
        nowIso,
      )
    return this.findUserById(id)!
  }

  updateUser(userId: string, updater: (user: UserRecord) => UserRecord): UserRecord {
    const current = this.findUserById(userId)
    if (!current) {
      throw new Error('המשתמש לא נמצא.')
    }
    const updated = updater(current)
    this.db
      .prepare(
        `UPDATE users SET
          organization_id = ?, username = ?, first_name = ?, last_name = ?,
          password_hash = ?, role = ?,
          allowed_channel_ids = ?, blocked_channel_ids = ?,
          is_active = ?, updated_at_iso = ?, last_login_at_iso = ?
        WHERE id = ?`,
      )
      .run(
        updated.organizationId,
        updated.username,
        updated.firstName || '',
        updated.lastName || '',
        updated.passwordHash,
        updated.role,
        JSON.stringify(updated.allowedChannelIds),
        JSON.stringify(updated.blockedChannelIds),
        updated.isActive ? 1 : 0,
        updated.updatedAtIso,
        updated.lastLoginAtIso ?? null,
        userId,
      )
    return this.findUserById(userId)!
  }

  updateUserLastLogin(userId: string, atIso: string): void {
    this.updateUser(userId, (user) => ({ ...user, lastLoginAtIso: atIso, updatedAtIso: atIso }))
  }

  /* ============================= ערוצים ============================= */

  listChannels(organizationId: string): ChannelRecord[] {
    return (
      this.db.prepare('SELECT * FROM channels WHERE organization_id = ?').all(organizationId) as ChannelRow[]
    ).map(rowToChannel)
  }

  createChannel(input: { organizationId: string; name: string }): ChannelRecord {
    const id = randomUUID()
    this.db
      .prepare('INSERT INTO channels (id, organization_id, name, is_blocked) VALUES (?, ?, ?, 0)')
      .run(id, input.organizationId, input.name)
    return rowToChannel(
      this.db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow,
    )
  }

  /* ============================= מבצעים ============================= */

  listCampaigns(organizationId: string): CampaignRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM campaigns WHERE organization_id = ?')
        .all(organizationId) as CampaignRow[]
    ).map(rowToCampaign)
  }

  createCampaign(input: { organizationId: string; name: string }): CampaignRecord {
    const id = randomUUID()
    this.db
      .prepare('INSERT INTO campaigns (id, organization_id, name, is_active) VALUES (?, ?, ?, 1)')
      .run(id, input.organizationId, input.name)
    return rowToCampaign(
      this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as CampaignRow,
    )
  }

  /* ============================= כרטיסי תשלום ============================= */

  upsertPaymentCard(card: PaymentCardRecord): PaymentCardRecord {
    this.db
      .prepare(
        `INSERT INTO payment_cards (
          organization_id, encrypted_pan, cardholder_name,
          expiry_month, expiry_year, billing_email,
          masked_pan, last4, created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id) DO UPDATE SET
          encrypted_pan = excluded.encrypted_pan,
          cardholder_name = excluded.cardholder_name,
          expiry_month = excluded.expiry_month,
          expiry_year = excluded.expiry_year,
          billing_email = excluded.billing_email,
          masked_pan = excluded.masked_pan,
          last4 = excluded.last4,
          created_at_iso = excluded.created_at_iso`,
      )
      .run(
        card.organizationId,
        card.encryptedPan,
        card.cardholderName,
        card.expiryMonth,
        card.expiryYear,
        card.billingEmail,
        card.maskedPan,
        card.last4,
        card.createdAtIso,
      )
    return this.getPaymentCard(card.organizationId)!
  }

  getPaymentCard(organizationId: string): PaymentCardRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM payment_cards WHERE organization_id = ?')
      .get(organizationId) as PaymentCardRow | undefined
    return row ? rowToPaymentCard(row) : undefined
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
    const id = randomUUID()
    const createdAtIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO usage_ledger (id, organization_id, metric_type, amount, details, created_at_iso)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, entry.organizationId, entry.metricType, entry.amount, entry.details, createdAtIso)
    return rowToUsageLedger(
      this.db.prepare('SELECT * FROM usage_ledger WHERE id = ?').get(id) as UsageLedgerRow,
    )
  }

  listUsageLedger(organizationId?: string): UsageLedgerRecord[] {
    if (!organizationId) {
      return (this.db.prepare('SELECT * FROM usage_ledger ORDER BY created_at_iso DESC').all() as UsageLedgerRow[]).map(
        rowToUsageLedger,
      )
    }
    return (
      this.db
        .prepare('SELECT * FROM usage_ledger WHERE organization_id = ? ORDER BY created_at_iso DESC')
        .all(organizationId) as UsageLedgerRow[]
    ).map(rowToUsageLedger)
  }

  /* ============================= Usage Aggregate ============================= */

  updateOrganizationUsage(
    organizationId: string,
    updater: (usage: OrganizationUsage) => OrganizationUsage,
  ): OrganizationRecord {
    return this.updateOrganization(organizationId, (org) => ({
      ...org,
      usage: updater(org.usage),
    }))
  }

  /* ============================= Channel Usage Monthly ============================= */

  getChannelUsageMonthly(organizationId: string, monthKey?: string): ChannelUsageMonthlyRecord[] {
    if (monthKey) {
      return (
        this.db
          .prepare(
            'SELECT * FROM channel_usage_monthly WHERE organization_id = ? AND month_key = ?',
          )
          .all(organizationId, monthKey) as ChannelUsageRow[]
      ).map(rowToChannelUsage)
    }
    return (
      this.db
        .prepare('SELECT * FROM channel_usage_monthly WHERE organization_id = ?')
        .all(organizationId) as ChannelUsageRow[]
    ).map(rowToChannelUsage)
  }

  incrementChannelUsage(input: {
    organizationId: string
    channelId: string
    monthKey: string
    field: ChannelUsageField
    count?: number
  }): void {
    const delta = input.count ?? 1
    const existing = this.db
      .prepare(
        'SELECT id FROM channel_usage_monthly WHERE channel_id = ? AND month_key = ?',
      )
      .get(input.channelId, input.monthKey) as { id: string } | undefined

    if (!existing) {
      const id = randomUUID()
      this.db
        .prepare(
          `INSERT INTO channel_usage_monthly (
            id, organization_id, channel_id, month_key,
            outgoing_user, incoming_ghost, incoming_system, incoming_operations,
            operations_count_total, operations_count_active
          ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`,
        )
        .run(id, input.organizationId, input.channelId, input.monthKey)
    }

    this.db
      .prepare(
        `UPDATE channel_usage_monthly
         SET ${input.field} = ${input.field} + ?
         WHERE channel_id = ? AND month_key = ?`,
      )
      .run(delta, input.channelId, input.monthKey)
  }

  /* ============================= Usage Events ============================= */

  addUsageEvent(input: Omit<UsageEventRecord, 'id' | 'createdAtIso'>): UsageEventRecord {
    const id = randomUUID()
    const createdAtIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO usage_events (
          id, organization_id, channel_id, campaign_id,
          event_type, direction, source, count, created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.organizationId,
        input.channelId ?? null,
        input.campaignId ?? null,
        input.eventType,
        input.direction ?? null,
        input.source ?? null,
        input.count,
        createdAtIso,
      )
    return rowToUsageEvent(
      this.db.prepare('SELECT * FROM usage_events WHERE id = ?').get(id) as UsageEventRow,
    )
  }

  /* ============================= תקלות ============================= */

  createIssue(input: {
    organizationId: string
    userId: string
    title: string
    description: string
    severity: IssueRecord['severity']
  }): IssueRecord {
    const id = randomUUID()
    const nowIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO issues (
          id, organization_id, user_id, title, description,
          status, severity, created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      )
      .run(id, input.organizationId, input.userId, input.title, input.description, input.severity, nowIso, nowIso)
    return rowToIssue(this.db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as IssueRow)
  }

  listIssues(): IssueRecord[] {
    return (this.db.prepare('SELECT * FROM issues ORDER BY created_at_iso DESC').all() as IssueRow[]).map(
      rowToIssue,
    )
  }

  updateIssue(issueId: string, updater: (issue: IssueRecord) => IssueRecord): IssueRecord {
    const currentRow = this.db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId) as
      | IssueRow
      | undefined
    if (!currentRow) {
      throw new Error('התקלה לא נמצאה.')
    }
    const current = rowToIssue(currentRow)
    const updated = updater(current)
    this.db
      .prepare(
        `UPDATE issues SET
          status = ?, severity = ?, title = ?, description = ?, updated_at_iso = ?
        WHERE id = ?`,
      )
      .run(updated.status, updated.severity, updated.title, updated.description, updated.updatedAtIso, issueId)
    return rowToIssue(this.db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId) as IssueRow)
  }

  /* ============================= Audit Logs ============================= */

  addAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAtIso'>): AuditLogRecord {
    const id = randomUUID()
    const createdAtIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO audit_logs (
          id, actor_user_id, action, target_type, target_id, details, created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.actorUserId, input.action, input.targetType, input.targetId, input.details, createdAtIso)
    return rowToAuditLog(
      this.db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as AuditLogRow,
    )
  }

  listAuditLogs(limit = 200): AuditLogRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM audit_logs ORDER BY created_at_iso DESC LIMIT ?')
        .all(limit) as AuditLogRow[]
    ).map(rowToAuditLog)
  }

  /* ============================= Refresh Tokens ============================= */

  storeRefreshToken(record: RefreshTokenRecord): void {
    this.db
      .prepare(
        `INSERT INTO refresh_tokens (token_id, user_id, expires_at_unix)
         VALUES (?, ?, ?)
         ON CONFLICT(token_id) DO UPDATE SET
           user_id = excluded.user_id,
           expires_at_unix = excluded.expires_at_unix`,
      )
      .run(record.tokenId, record.userId, record.expiresAtUnix)
  }

  hasRefreshToken(tokenId: string, userId: string): boolean {
    const row = this.db
      .prepare('SELECT token_id FROM refresh_tokens WHERE token_id = ? AND user_id = ?')
      .get(tokenId, userId) as RefreshTokenRow | undefined
    return row !== undefined
  }

  revokeRefreshToken(tokenId: string): void {
    this.db.prepare('DELETE FROM refresh_tokens WHERE token_id = ?').run(tokenId)
  }

  purgeExpiredRefreshTokens(nowUnix = Math.floor(Date.now() / 1000)): void {
    this.db.prepare('DELETE FROM refresh_tokens WHERE expires_at_unix <= ?').run(nowUnix)
  }

  /* ============================= ספירות אגרגטיביות ============================= */

  async countFullChannels(organizationId: string): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) AS cnt FROM channel_data WHERE organization_id = ?').get(organizationId) as { cnt: number }
    return row.cnt
  }

  async countMessages(organizationId: string): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) AS cnt FROM messages WHERE organization_id = ?').get(organizationId) as { cnt: number }
    return row.cnt
  }

  async countMessagesByAuthor(organizationId: string): Promise<{ sent: number; received: number }> {
    const rows = this.db.prepare(
      `SELECT
        SUM(CASE WHEN author = 'user' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN author != 'user' THEN 1 ELSE 0 END) AS received
       FROM messages WHERE organization_id = ?`,
    ).get(organizationId) as { sent: number | null; received: number | null }
    return { sent: rows.sent ?? 0, received: rows.received ?? 0 }
  }

  async countOperations(organizationId: string): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) AS cnt FROM channel_operations WHERE organization_id = ?').get(organizationId) as { cnt: number }
    return row.cnt
  }

  /* ============================= ערוצים עשירים ============================= */

  async listFullChannels(organizationId: string): Promise<FullChannelRecord[]> {
    return (
      this.db.prepare('SELECT * FROM channel_data WHERE organization_id = ? ORDER BY created_at_iso DESC').all(organizationId) as FullChannelRow[]
    ).map(rowToFullChannel)
  }

  async getFullChannel(organizationId: string, channelId: string): Promise<FullChannelRecord | undefined> {
    const row = this.db
      .prepare('SELECT * FROM channel_data WHERE id = ? AND organization_id = ?')
      .get(channelId, organizationId) as FullChannelRow | undefined
    return row ? rowToFullChannel(row) : undefined
  }

  async createFullChannel(
    organizationId: string,
    data: Omit<FullChannelRecord, 'id' | 'organizationId' | 'createdAtIso' | 'updatedAtIso'>,
  ): Promise<FullChannelRecord> {
    const id = randomUUID()
    const nowIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO channel_data (
          id, organization_id, name, type, subtitle, location, watch_scope,
          description, memory_interval, rtsp_feed, live_state, camera_enabled,
          linked_channel_ids, members, is_blocked, created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, organizationId, data.name, data.type, data.subtitle, data.location,
        data.watchScope, data.description, data.memoryInterval, data.rtspFeed,
        data.liveState, data.cameraEnabled ? 1 : 0,
        JSON.stringify(data.linkedChannelIds), JSON.stringify(data.members),
        data.isBlocked ? 1 : 0, nowIso, nowIso,
      )
    return this.getFullChannel(organizationId, id)!
  }

  async updateChannelData(
    organizationId: string,
    channelId: string,
    fields: Partial<Omit<FullChannelRecord, 'id' | 'organizationId' | 'createdAtIso'>>,
  ): Promise<FullChannelRecord> {
    const current = await this.getFullChannel(organizationId, channelId)
    if (!current) throw new Error('הערוץ לא נמצא.')
    const nowIso = new Date().toISOString()
    const merged = { ...current, ...fields, updatedAtIso: nowIso }
    this.db
      .prepare(
        `UPDATE channel_data SET
          name = ?, type = ?, subtitle = ?, location = ?, watch_scope = ?,
          description = ?, memory_interval = ?, rtsp_feed = ?, live_state = ?,
          camera_enabled = ?, linked_channel_ids = ?, members = ?,
          is_blocked = ?, updated_at_iso = ?
        WHERE id = ? AND organization_id = ?`,
      )
      .run(
        merged.name, merged.type, merged.subtitle, merged.location, merged.watchScope,
        merged.description, merged.memoryInterval, merged.rtspFeed, merged.liveState,
        merged.cameraEnabled ? 1 : 0,
        JSON.stringify(merged.linkedChannelIds), JSON.stringify(merged.members),
        merged.isBlocked ? 1 : 0, merged.updatedAtIso,
        channelId, organizationId,
      )
    return (await this.getFullChannel(organizationId, channelId))!
  }

  async deleteFullChannel(organizationId: string, channelId: string): Promise<void> {
    this.db.prepare('DELETE FROM operation_runs WHERE channel_id = ? AND organization_id = ?').run(channelId, organizationId)
    this.db.prepare('DELETE FROM channel_operations WHERE channel_id = ? AND organization_id = ?').run(channelId, organizationId)
    this.db.prepare('DELETE FROM messages WHERE channel_id = ? AND organization_id = ?').run(channelId, organizationId)
    this.db.prepare('DELETE FROM channel_data WHERE id = ? AND organization_id = ?').run(channelId, organizationId)
  }

  /* ============================= הודעות (פר משתמש) ============================= */

  async addMessage(
    organizationId: string,
    userId: string,
    channelId: string,
    message: Omit<MessageRecord, 'id' | 'organizationId' | 'userId' | 'channelId' | 'createdAtIso'>,
  ): Promise<MessageRecord> {
    const id = randomUUID()
    const createdAtIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO messages (
          id, organization_id, user_id, channel_id, author, text, time,
          alert_level, score, frame_data_url, sources, created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, organizationId, userId, channelId, message.author, message.text, message.time,
        message.alertLevel ?? null, message.score ?? null,
        message.frameDataUrl ?? null,
        message.sources ? JSON.stringify(message.sources) : null,
        createdAtIso,
      )
    return rowToMessage(this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow)
  }

  async listMessages(
    organizationId: string,
    userId: string,
    channelId: string,
    opts?: { limit?: number; beforeIso?: string },
  ): Promise<MessageRecord[]> {
    const limit = opts?.limit ?? 200
    if (opts?.beforeIso) {
      return (
        this.db
          .prepare(
            'SELECT * FROM messages WHERE organization_id = ? AND user_id = ? AND channel_id = ? AND created_at_iso < ? ORDER BY created_at_iso ASC LIMIT ?',
          )
          .all(organizationId, userId, channelId, opts.beforeIso, limit) as MessageRow[]
      ).map(rowToMessage)
    }
    return (
      this.db
        .prepare(
          'SELECT * FROM messages WHERE organization_id = ? AND user_id = ? AND channel_id = ? ORDER BY created_at_iso ASC LIMIT ?',
        )
        .all(organizationId, userId, channelId, limit) as MessageRow[]
    ).map(rowToMessage)
  }

  /* ============================= מבצעים פר ערוץ ============================= */

  async createChannelOperation(
    organizationId: string,
    channelId: string,
    op: Omit<OperationRecord, 'id' | 'organizationId' | 'channelId' | 'createdAtIso' | 'updatedAtIso'>,
  ): Promise<OperationRecord> {
    const id = randomUUID()
    const nowIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO channel_operations (
          id, organization_id, channel_id, name, mode, schedule, trigger_text,
          action, model_override, detail_level, enabled, parsed_schedule,
          created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, organizationId, channelId, op.name, op.mode, op.schedule, op.trigger,
        op.action, op.modelOverride ?? null, op.detailLevel ?? null,
        op.enabled ? 1 : 0,
        op.parsedSchedule ? JSON.stringify(op.parsedSchedule) : null,
        nowIso, nowIso,
      )
    return rowToOperation(this.db.prepare('SELECT * FROM channel_operations WHERE id = ?').get(id) as OperationRow)
  }

  async listChannelOperations(organizationId: string, channelId: string): Promise<OperationRecord[]> {
    return (
      this.db
        .prepare('SELECT * FROM channel_operations WHERE organization_id = ? AND channel_id = ? ORDER BY created_at_iso DESC')
        .all(organizationId, channelId) as OperationRow[]
    ).map(rowToOperation)
  }

  async updateChannelOperation(
    organizationId: string,
    channelId: string,
    opId: string,
    fields: Partial<Omit<OperationRecord, 'id' | 'organizationId' | 'channelId' | 'createdAtIso'>>,
  ): Promise<OperationRecord> {
    const row = this.db
      .prepare('SELECT * FROM channel_operations WHERE id = ? AND organization_id = ? AND channel_id = ?')
      .get(opId, organizationId, channelId) as OperationRow | undefined
    if (!row) throw new Error('המבצע לא נמצא.')
    const current = rowToOperation(row)
    const nowIso = new Date().toISOString()
    const merged = { ...current, ...fields, updatedAtIso: nowIso }
    this.db
      .prepare(
        `UPDATE channel_operations SET
          name = ?, mode = ?, schedule = ?, trigger_text = ?, action = ?,
          model_override = ?, detail_level = ?, enabled = ?, parsed_schedule = ?,
          updated_at_iso = ?
        WHERE id = ? AND organization_id = ? AND channel_id = ?`,
      )
      .run(
        merged.name, merged.mode, merged.schedule, merged.trigger, merged.action,
        merged.modelOverride ?? null, merged.detailLevel ?? null,
        merged.enabled ? 1 : 0,
        merged.parsedSchedule ? JSON.stringify(merged.parsedSchedule) : null,
        merged.updatedAtIso, opId, organizationId, channelId,
      )
    return rowToOperation(
      this.db.prepare('SELECT * FROM channel_operations WHERE id = ?').get(opId) as OperationRow,
    )
  }

  async deleteChannelOperation(organizationId: string, channelId: string, opId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM operation_runs WHERE operation_id = ? AND organization_id = ?')
      .run(opId, organizationId)
    this.db
      .prepare('DELETE FROM channel_operations WHERE id = ? AND organization_id = ? AND channel_id = ?')
      .run(opId, organizationId, channelId)
  }

  /* ============================= מבצעים + הרצות פר ארגון ============================= */

  async listAllOperations(organizationId: string): Promise<OperationRecord[]> {
    return (
      this.db
        .prepare('SELECT * FROM channel_operations WHERE organization_id = ? ORDER BY created_at_iso DESC')
        .all(organizationId) as OperationRow[]
    ).map(rowToOperation)
  }

  async listRecentOperationRuns(organizationId: string, limit = 50): Promise<OperationRunRecord[]> {
    return (
      this.db
        .prepare('SELECT * FROM operation_runs WHERE organization_id = ? ORDER BY started_at_iso DESC LIMIT ?')
        .all(organizationId, limit) as OperationRunRow[]
    ).map(rowToOperationRun)
  }

  /* ============================= Scheduler — הרצות מבצעים ============================= */

  async listRunnableOperations(): Promise<OperationRecord[]> {
    return (
      this.db
        .prepare('SELECT * FROM channel_operations WHERE enabled = 1 AND parsed_schedule IS NOT NULL')
        .all() as OperationRow[]
    ).map(rowToOperation)
  }

  async acquireOperationRunLock(organizationId: string, channelId: string, operationId: string): Promise<OperationRunRecord | null> {
    const existing = this.db
      .prepare("SELECT id FROM operation_runs WHERE operation_id = ? AND status IN ('queued', 'running')")
      .get(operationId) as { id: string } | undefined
    if (existing) return null

    const id = randomUUID()
    const nowIso = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO operation_runs (id, organization_id, channel_id, operation_id, status, started_at_iso)
         VALUES (?, ?, ?, ?, 'running', ?)`,
      )
      .run(id, organizationId, channelId, operationId, nowIso)
    return rowToOperationRun(
      this.db.prepare('SELECT * FROM operation_runs WHERE id = ?').get(id) as OperationRunRow,
    )
  }

  async completeOperationRun(runId: string): Promise<OperationRunRecord> {
    const nowIso = new Date().toISOString()
    this.db
      .prepare("UPDATE operation_runs SET status = 'success', ended_at_iso = ? WHERE id = ?")
      .run(nowIso, runId)
    return rowToOperationRun(
      this.db.prepare('SELECT * FROM operation_runs WHERE id = ?').get(runId) as OperationRunRow,
    )
  }

  async failOperationRun(runId: string, errorCode: string, errorMessage: string): Promise<OperationRunRecord> {
    const nowIso = new Date().toISOString()
    this.db
      .prepare("UPDATE operation_runs SET status = 'failed', ended_at_iso = ?, error_code = ?, error_message = ? WHERE id = ?")
      .run(nowIso, errorCode, errorMessage, runId)
    return rowToOperationRun(
      this.db.prepare('SELECT * FROM operation_runs WHERE id = ?').get(runId) as OperationRunRow,
    )
  }
}

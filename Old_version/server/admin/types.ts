export const USER_ROLES = {
  superAdmin: 'super_admin',
  systemManager: 'system_manager',
  regularUser: 'regular_user',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export interface OrganizationLimits {
  maxChannels: number
  maxMessagesPerChannelPerMonth: number
  monthlyChargeAmount: number
  maxAgentsTotalCost: number
  maxAiTotalCost: number
  maxApiTotalCost: number
}

export interface OrganizationUsage {
  sentMessages: number
  receivedMessages: number
  devicesCount: number
  channelsCount: number
  operationsCount: number
  aiTotalCost: number
  apiTotalCost: number
  agentsTotalCost: number
  updatedAtIso: string
}

export interface OrganizationRecord {
  id: string
  name: string
  status: 'active' | 'suspended'
  limits: OrganizationLimits
  allowedModels: string[]
  encryptedOpenAiApiKey?: string
  openAiUsageUsd: number
  openAiLastSyncIso?: string
  usage: OrganizationUsage
}

export interface PaymentCardRecord {
  organizationId: string
  encryptedPan: string
  cardholderName: string
  expiryMonth: string
  expiryYear: string
  billingEmail: string
  maskedPan: string
  last4: string
  createdAtIso: string
}

export interface UserRecord {
  id: string
  organizationId: string
  username: string
  firstName: string
  lastName: string
  firebaseUid?: string
  passwordHash: string
  role: UserRole
  allowedChannelIds: string[]
  blockedChannelIds: string[]
  isActive: boolean
  createdAtIso: string
  updatedAtIso: string
  lastLoginAtIso?: string
}

export interface ChannelRecord {
  id: string
  organizationId: string
  name: string
  isBlocked: boolean
}

export interface CampaignRecord {
  id: string
  organizationId: string
  name: string
  isActive: boolean
}

export interface UsageLedgerRecord {
  id: string
  organizationId: string
  metricType: 'openai' | 'api' | 'agent' | 'message'
  amount: number
  details: string
  createdAtIso: string
}

export interface IssueRecord {
  id: string
  organizationId: string
  userId: string
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved'
  severity: 'low' | 'medium' | 'high' | 'critical'
  createdAtIso: string
  updatedAtIso: string
}

export interface AuditLogRecord {
  id: string
  actorUserId: string
  action: string
  targetType: string
  targetId: string
  details: string
  createdAtIso: string
}

export interface RefreshTokenRecord {
  tokenId: string
  userId: string
  expiresAtUnix: number
}

export interface FullChannelRecord {
  id: string
  organizationId: string
  name: string
  type: 'personal' | 'group'
  subtitle: string
  location: string
  watchScope: string
  description: string
  memoryInterval: number
  rtspFeed: string
  liveState: 'LIVE' | 'SYNC' | 'DEGRADED' | 'OFFLINE'
  cameraEnabled: boolean
  linkedChannelIds: string[]
  members: string[]
  isBlocked: boolean
  createdAtIso: string
  updatedAtIso: string
}

export interface MessageRecord {
  id: string
  organizationId: string
  userId: string
  channelId: string
  author: 'user' | 'ghost' | 'system'
  text: string
  time: string
  alertLevel?: 'critical' | 'routine' | 'report' | 'rating' | 'assessment'
  score?: number
  frameDataUrl?: string
  sources?: string[]
  createdAtIso: string
}

export interface OperationRecord {
  id: string
  organizationId: string
  channelId: string
  name: string
  mode: 'alert' | 'report' | 'rating' | 'assessment'
  schedule: string
  trigger: string
  action: string
  modelOverride?: 'gpt-4.1' | 'gpt-4.1-mini'
  detailLevel?: 'low' | 'auto' | 'high'
  enabled: boolean
  parsedSchedule?: Record<string, unknown>
  createdAtIso: string
  updatedAtIso: string
}

export type OperationRunStatus = 'queued' | 'running' | 'success' | 'failed'

export interface OperationRunRecord {
  id: string
  organizationId: string
  channelId: string
  operationId: string
  status: OperationRunStatus
  startedAtIso: string
  endedAtIso?: string
  errorCode?: string
  errorMessage?: string
}

export interface AdminDataStoreState {
  organizations: OrganizationRecord[]
  users: UserRecord[]
  channels: ChannelRecord[]
  campaigns: CampaignRecord[]
  paymentCards: PaymentCardRecord[]
  usageLedger: UsageLedgerRecord[]
  issues: IssueRecord[]
  auditLogs: AuditLogRecord[]
  refreshTokens: RefreshTokenRecord[]
}

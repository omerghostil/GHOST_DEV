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

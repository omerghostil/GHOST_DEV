export interface AuthProfile {
  userId: string
  organizationId: string
  organizationName: string
  role: 'super_admin' | 'system_manager' | 'regular_user'
  username: string
  firstName: string
  lastName: string
}

export interface AuthLoginResponse {
  accessToken: string
  refreshToken: string
  profile: AuthProfile
}

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

export interface OrganizationSummary {
  id: string
  name: string
  status: 'active' | 'suspended'
  limits: OrganizationLimits
  usage: OrganizationUsage
  openAiLastSyncIso?: string
}

export interface SuperAdminOverviewResponse {
  totals: {
    organizationsCount: number
    sentMessages: number
    receivedMessages: number
    devicesCount: number
    channelsCount: number
    operationsCount: number
    aiTotalCost: number
    apiTotalCost: number
    agentsTotalCost: number
  }
  organizations: OrganizationSummary[]
}

export interface SuperAdminIssue {
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

export interface OrganizationUser {
  id: string
  organizationId: string
  username: string
  role: 'super_admin' | 'system_manager' | 'regular_user'
  allowedChannelIds: string[]
  blockedChannelIds: string[]
  isActive: boolean
  createdAtIso: string
  updatedAtIso: string
  lastLoginAtIso?: string
}

export interface OrganizationChannel {
  id: string
  organizationId: string
  name: string
  isBlocked: boolean
}

export interface OrganizationCampaign {
  id: string
  organizationId: string
  name: string
  isActive: boolean
}

export interface OrganizationUsageLedger {
  id: string
  organizationId: string
  metricType: 'openai' | 'api' | 'agent' | 'message'
  amount: number
  details: string
  createdAtIso: string
}

/** מוני שימוש חודשיים פר ערוץ */
export interface ChannelUsageMonthly {
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

export interface AdminOperationRecord {
  id: string
  organizationId: string
  channelId: string
  name: string
  mode: 'alert' | 'report' | 'rating' | 'assessment'
  schedule: string
  trigger: string
  action: string
  modelOverride?: string
  detailLevel?: string
  enabled: boolean
  createdAtIso: string
  updatedAtIso: string
}

export interface AdminOperationRunRecord {
  id: string
  organizationId: string
  channelId: string
  operationId: string
  status: 'queued' | 'running' | 'success' | 'failed'
  startedAtIso: string
  endedAtIso?: string
  errorCode?: string
  errorMessage?: string
}

export interface OrganizationDetailsResponse {
  organization: OrganizationSummary
  channels: OrganizationChannel[]
  operations: AdminOperationRecord[]
  recentRuns: AdminOperationRunRecord[]
  campaigns: OrganizationCampaign[]
  users: OrganizationUser[]
  usageLedger: OrganizationUsageLedger[]
  channelStats: ChannelUsageMonthly[]
}

import { httpRequest } from './http-client'
import type {
  OrganizationDetailsResponse,
  OrganizationLimits,
  OrganizationSummary,
  OrganizationUser,
  SuperAdminIssue,
  SuperAdminOverviewResponse,
} from '../types/admin'

interface ErrorPayload {
  error?: string
}

interface SavedPaymentCardResponse {
  organizationId: string
  maskedPan: string
  last4: string
  billingEmail: string
  createdAtIso: string
}

async function parseJson<T>(response: Response): Promise<T | null> {
  const raw = await response.text()
  if (!raw.trim()) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function expectOk<T>(response: Response): Promise<T> {
  const payload = await parseJson<T & ErrorPayload>(response)
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? `שגיאת API: ${response.status}`)
  }
  return payload
}

export async function getSuperAdminOverview(): Promise<SuperAdminOverviewResponse> {
  return expectOk(await httpRequest('/api/admin/dashboard/overview'))
}

export async function getIssues(): Promise<SuperAdminIssue[]> {
  return expectOk(await httpRequest('/api/admin/issues'))
}

export async function createOrganization(name: string, limits: OrganizationLimits): Promise<OrganizationSummary> {
  return expectOk(
    await httpRequest('/api/admin/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, limits }),
    }),
  )
}

export async function updateOrganization(
  organizationId: string,
  input: {
    name?: string
    status?: 'active' | 'suspended'
    limits?: OrganizationLimits
  },
) {
  return expectOk(
    await httpRequest(`/api/admin/organizations/${organizationId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function getOrganizationDetails(organizationId: string): Promise<OrganizationDetailsResponse> {
  return expectOk(await httpRequest(`/api/admin/dashboard/org/${organizationId}`))
}

export async function listUsers(): Promise<OrganizationUser[]> {
  return expectOk(await httpRequest('/api/admin/users'))
}

export async function createUser(input: {
  organizationId: string
  username: string
  firstName: string
  lastName: string
  password: string
  role: 'system_manager' | 'regular_user'
  allowedChannelIds?: string[]
  blockedChannelIds?: string[]
}) {
  return expectOk(
    await httpRequest('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

export async function updateUser(
  userId: string,
  input: {
    role?: 'system_manager' | 'regular_user'
    isActive?: boolean
    allowedChannelIds?: string[]
    blockedChannelIds?: string[]
  },
) {
  return expectOk(
    await httpRequest(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function updateIssue(issueId: string, status: 'open' | 'in_progress' | 'resolved') {
  return expectOk(
    await httpRequest(`/api/admin/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  )
}

export async function savePaymentCard(input: {
  organizationId: string
  pan: string
  cardholderName: string
  expiryMonth: string
  expiryYear: string
  billingEmail: string
  managerCode: string
}): Promise<SavedPaymentCardResponse> {
  return expectOk(
    await httpRequest('/api/admin/billing/payment-card', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  )
}

export async function revealPaymentCard(organizationId: string, managerCode: string): Promise<{ pan: string }> {
  return expectOk(
    await httpRequest('/api/admin/billing/reveal-card', {
      method: 'POST',
      body: JSON.stringify({ organizationId, managerCode }),
    }),
  )
}

export async function saveOrganizationAiKey(organizationId: string, aiApiKey: string) {
  return expectOk(
    await httpRequest('/api/admin/billing/openai-key', {
      method: 'PUT',
      body: JSON.stringify({ organizationId, openAiApiKey: aiApiKey }),
    }),
  )
}

/** רישום הודעה/מבצע פר ערוץ */
export async function recordChannelMessage(input: {
  organizationId: string
  channelId: string
  direction: 'outgoing' | 'incoming'
  source: 'user' | 'ghost' | 'system' | 'operation'
  campaignId?: string
  count?: number
}) {
  return expectOk(
    await httpRequest('/api/admin/usage/channel-message', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

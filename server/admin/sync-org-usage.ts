import type { IAdminRepository } from '../db/repository-types'
import type { OrganizationRecord } from './types'

/**
 * תוצאות חישוב שימוש מנתוני מקור-אמת.
 */
export interface ComputedUsage {
  channelsCount: number
  sentMessages: number
  receivedMessages: number
  operationsCount: number
}

/**
 * מחשב נתוני שימוש אמיתיים מהטבלאות הפעילות (channel_data, messages, channel_operations).
 */
export async function computeOrganizationUsage(
  store: IAdminRepository,
  organizationId: string,
): Promise<ComputedUsage> {
  const [channelsCount, messageCounts, operationsCount] = await Promise.all([
    store.countFullChannels(organizationId),
    store.countMessagesByAuthor(organizationId),
    store.countOperations(organizationId),
  ])
  return {
    channelsCount,
    sentMessages: messageCounts.sent,
    receivedMessages: messageCounts.received,
    operationsCount,
  }
}

/**
 * מסנכרן את שדות organization.usage מול הנתונים האמיתיים בטבלאות.
 * שדות עלות (AI/API/Agents) נשמרים כפי שהם כי הם מנוהלים רק דרך usage-record.
 */
export async function syncOrganizationUsage(
  store: IAdminRepository,
  organizationId: string,
): Promise<OrganizationRecord> {
  const computed = await computeOrganizationUsage(store, organizationId)
  return store.updateOrganizationUsage(organizationId, (usage) => ({
    ...usage,
    channelsCount: computed.channelsCount,
    sentMessages: computed.sentMessages,
    receivedMessages: computed.receivedMessages,
    operationsCount: computed.operationsCount,
    updatedAtIso: new Date().toISOString(),
  }))
}

/**
 * ריקונסיליאציה מלאה — מסנכרן כל הארגונים ומחזיר דוח פערים.
 */
export async function reconcileAllOrganizations(
  store: IAdminRepository,
): Promise<ReconciliationReport[]> {
  const organizations = store.listOrganizations()
  const reports: ReconciliationReport[] = []

  for (const org of organizations) {
    const computed = await computeOrganizationUsage(store, org.id)
    const diffs: ReconciliationDiff[] = []

    if (org.usage.channelsCount !== computed.channelsCount) {
      diffs.push({ field: 'channelsCount', stored: org.usage.channelsCount, actual: computed.channelsCount })
    }
    if (org.usage.sentMessages !== computed.sentMessages) {
      diffs.push({ field: 'sentMessages', stored: org.usage.sentMessages, actual: computed.sentMessages })
    }
    if (org.usage.receivedMessages !== computed.receivedMessages) {
      diffs.push({ field: 'receivedMessages', stored: org.usage.receivedMessages, actual: computed.receivedMessages })
    }
    if ((org.usage.operationsCount ?? 0) !== computed.operationsCount) {
      diffs.push({ field: 'operationsCount', stored: org.usage.operationsCount ?? 0, actual: computed.operationsCount })
    }

    if (diffs.length > 0) {
      store.updateOrganizationUsage(org.id, (usage) => ({
        ...usage,
        channelsCount: computed.channelsCount,
        sentMessages: computed.sentMessages,
        receivedMessages: computed.receivedMessages,
        operationsCount: computed.operationsCount,
        updatedAtIso: new Date().toISOString(),
      }))
    }

    reports.push({ organizationId: org.id, organizationName: org.name, diffs })
  }

  return reports
}

export interface ReconciliationDiff {
  field: string
  stored: number
  actual: number
}

export interface ReconciliationReport {
  organizationId: string
  organizationName: string
  diffs: ReconciliationDiff[]
}

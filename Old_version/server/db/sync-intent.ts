/**
 * שכבת SyncIntent — מסמנת אילו אירועים מיועדים לסנכרון ענן עתידי.
 * כרגע No-Op מלא: שום דבר לא נשלח לענן.
 * בעת מעבר ל-Firebase — המימוש כאן יוחלף בכתיבה ל-Realtime Database.
 */

export type SyncTargetType = 'realtime' | 'firestore'

export interface SyncIntentRecord {
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  target: SyncTargetType
  payload: Record<string, unknown>
}

/**
 * סימון אירוע לסנכרון ענן עתידי.
 * כרגע No-Op — אין שליחה בפועל.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function markForCloudSync(_intent: SyncIntentRecord): void {
  // No-Op: סנכרון ענן לא מומש בשלב הלוקלי.
  // כשנעבור ל-Firebase, כאן תתווסף כתיבה ל-queue או שליחה ישירה.
}

/**
 * מיפוי סכמת SQLite לוקלי לסכמת Firebase עתידית.
 *
 * Firestore (DB רגיל — ישויות ליבה):
 *   organizations/{orgId}           -> OrganizationRecord
 *   organizations/{orgId}/users/{userId}    -> UserRecord
 *   organizations/{orgId}/channels/{chId}   -> ChannelRecord
 *   organizations/{orgId}/campaigns/{cId}   -> CampaignRecord
 *   organizations/{orgId}/limits            -> OrganizationLimits (subcollection)
 *   organizations/{orgId}/payment_card      -> PaymentCardRecord (single doc)
 *   organizations/{orgId}/issues/{issueId}  -> IssueRecord
 *   audit_logs/{logId}                      -> AuditLogRecord
 *   usage_ledger/{entryId}                  -> UsageLedgerRecord
 *
 * Realtime Database (אירועים חיים וסטטוסים):
 *   live/usage_events/{eventId}             -> UsageEventRecord
 *   live/channel_usage/{orgId}/{chId}/{monthKey} -> ChannelUsageMonthlyRecord
 *   live/org_usage/{orgId}                  -> OrganizationUsage (aggregate)
 *
 * refresh_tokens -> Firebase Auth custom claims (לא ב-DB)
 */
export const FIREBASE_SCHEMA_MAP = {
  firestore: {
    organizations: 'organizations/{orgId}',
    users: 'organizations/{orgId}/users/{userId}',
    channels: 'organizations/{orgId}/channels/{chId}',
    campaigns: 'organizations/{orgId}/campaigns/{cId}',
    paymentCards: 'organizations/{orgId}/payment_card',
    issues: 'organizations/{orgId}/issues/{issueId}',
    auditLogs: 'audit_logs/{logId}',
    usageLedger: 'usage_ledger/{entryId}',
  },
  realtime: {
    usageEvents: 'live/usage_events/{eventId}',
    channelUsage: 'live/channel_usage/{orgId}/{chId}/{monthKey}',
    orgUsageAggregate: 'live/org_usage/{orgId}',
  },
} as const

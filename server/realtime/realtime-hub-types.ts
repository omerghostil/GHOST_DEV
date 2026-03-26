/**
 * אירוע חי לממשק הניהול בזמן אמת.
 */
export interface LiveEventPayload {
  eventType:
    | 'usage.updated'
    | 'billing.threshold_exceeded'
    | 'issue.created'
    | 'issue.updated'
    | 'org.health.changed'
  organizationId: string
  severity: 'info' | 'warning' | 'error'
  timestampIso: string
  payload: Record<string, unknown>
}

/**
 * חוזה אחיד לשידור אירועים בזמן אמת.
 * מאפשר החלפה בין WebSocket לבין Firebase Realtime Database.
 */
export interface IRealtimeHub {
  publish(event: LiveEventPayload): void
}

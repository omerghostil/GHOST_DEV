export interface RealtimeEvent {
  eventType: 'usage.updated' | 'billing.threshold_exceeded' | 'issue.created' | 'issue.updated' | 'org.health.changed'
  organizationId: string
  severity: 'info' | 'warning' | 'error'
  timestampIso: string
  payload: Record<string, unknown>
}

export interface RealtimeSubscription {
  close: () => void
}

/**
 * מתחבר לערוץ WebSocket של הדשבורד ומחזיר מנגנון ניתוק.
 */
export function connectAdminRealtime(onEvent: (event: RealtimeEvent) => void): RealtimeSubscription {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${window.location.host}/ws/admin-realtime`)
  ws.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(String(event.data)) as RealtimeEvent
      onEvent(parsed)
    } catch {
      // אין פעולה במקרה פענוח לא תקין.
    }
  })
  return {
    close: () => ws.close(),
  }
}

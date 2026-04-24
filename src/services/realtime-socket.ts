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

export type RealtimeMode = 'live' | 'polling' | 'disconnected'

const RECONNECT_BASE_MS = 2_000
const RECONNECT_MAX_MS = 30_000
const POLL_INTERVAL_MS = 12_000
const MAX_WS_RETRIES = 3

/**
 * מתחבר לערוץ WebSocket של הדשבורד עם reconnect אוטומטי ו-polling fallback.
 * כשה-WS מחובר — אירועים זורמים חיים (mode=live).
 * כשנותק — מפעיל polling כגיבוי (mode=polling) שמספק עדכון שוטף.
 */
export function connectAdminRealtime(
  onEvent: (event: RealtimeEvent) => void,
  onModeChange?: (mode: RealtimeMode) => void,
): RealtimeSubscription {
  let ws: WebSocket | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let closed = false
  let currentMode: RealtimeMode = 'disconnected'
  let wsGaveUp = false

  function setMode(mode: RealtimeMode) {
    if (currentMode !== mode) {
      currentMode = mode
      onModeChange?.(mode)
    }
  }

  function startPolling() {
    stopPolling()
    setMode('polling')
    pollTimer = setInterval(() => {
      onEvent({
        eventType: 'usage.updated',
        organizationId: '',
        severity: 'info',
        timestampIso: new Date().toISOString(),
        payload: { _pollFallback: true },
      })
    }, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function connect() {
    if (closed || wsGaveUp) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${protocol}://${window.location.host}/ws/admin-realtime`)

    ws.addEventListener('open', () => {
      reconnectAttempt = 0
      stopPolling()
      setMode('live')
    })

    ws.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as RealtimeEvent
        onEvent(parsed)
      } catch {
        // אין פעולה במקרה פענוח לא תקין.
      }
    })

    ws.addEventListener('close', () => {
      if (closed) return
      if (reconnectAttempt >= MAX_WS_RETRIES) {
        wsGaveUp = true
        startPolling()
        return
      }
      startPolling()
      scheduleReconnect()
    })

    ws.addEventListener('error', () => {
      ws?.close()
    })
  }

  function scheduleReconnect() {
    if (closed || wsGaveUp) return
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt), RECONNECT_MAX_MS)
    reconnectAttempt += 1
    reconnectTimer = setTimeout(connect, delay)
  }

  connect()

  return {
    close: () => {
      closed = true
      stopPolling()
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      ws?.close()
      ws = null
      setMode('disconnected')
    },
  }
}

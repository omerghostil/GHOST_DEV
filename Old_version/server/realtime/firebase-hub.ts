import { adminRtdb } from '../lib/firebase-admin'
import type { IRealtimeHub, LiveEventPayload } from './realtime-hub-types'

const EVENTS_PATH_PREFIX = 'realtime'
const EVENT_TTL_MS = 60_000

/**
 * מרכז אירועים בזמן אמת דרך Firebase Realtime Database (סביבת פרודקשן).
 * כותב אירועים תחת realtime/{orgId}/events/{pushId} עם TTL אוטומטי.
 */
export class FirebaseRealtimeHub implements IRealtimeHub {
  publish(event: LiveEventPayload): void {
    const ref = adminRtdb.ref(`${EVENTS_PATH_PREFIX}/${event.organizationId}/events`)
    const entry = {
      ...event,
      expiresAtMs: Date.now() + EVENT_TTL_MS,
    }
    ref.push(entry).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[FirebaseRealtimeHub] שגיאה בשידור אירוע: ${message}`)
    })
  }
}

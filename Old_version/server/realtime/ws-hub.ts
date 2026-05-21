import type { Server as HttpServer } from 'node:http'
import { WebSocketServer } from 'ws'
import type { IRealtimeHub, LiveEventPayload } from './realtime-hub-types'

/**
 * מרכז אירועים בזמן אמת דרך WebSocket לממשק סופר־אדמין (סביבת פיתוח).
 */
export class RealtimeHub implements IRealtimeHub {
  private readonly wss: WebSocketServer

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws/admin-realtime' })
    this.wss.on('connection', (socket) => {
      socket.send(
        JSON.stringify({
          eventType: 'org.health.changed',
          organizationId: 'system',
          severity: 'info',
          timestampIso: new Date().toISOString(),
          payload: { status: 'connected' },
        } satisfies LiveEventPayload),
      )
    })
  }

  publish(event: LiveEventPayload): void {
    const encoded = JSON.stringify(event)
    for (const socket of this.wss.clients) {
      if (socket.readyState === socket.OPEN) {
        socket.send(encoded)
      }
    }
  }
}

export type { LiveEventPayload, IRealtimeHub }

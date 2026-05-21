import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { BASE_URL, getStages } from './config.js'

const wsConnectDuration = new Trend('ws_connect_duration', true)
const wsMessageLatency = new Trend('ws_message_latency', true)
const wsErrors = new Rate('ws_errors')
const wsMessagesReceived = new Counter('ws_messages_received')

const WS_BASE = BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://')

export const options = {
  stages: getStages(),
  thresholds: {
    ws_errors: ['rate<0.10'],
    ws_connect_duration: ['p(95)<3000'],
  },
  tags: { testName: 'websocket-load' },
}

export default function () {
  const url = `${WS_BASE}/ws/admin-realtime`

  const connectStart = Date.now()
  const res = ws.connect(url, {}, function (socket) {
    wsConnectDuration.add(Date.now() - connectStart)
    wsErrors.add(0)

    socket.on('message', function (msg) {
      wsMessagesReceived.add(1)
      try {
        const parsed = JSON.parse(msg)
        if (parsed.timestamp) {
          const latency = Date.now() - new Date(parsed.timestamp).getTime()
          wsMessageLatency.add(Math.max(0, latency))
        }
      } catch {
        // הודעה לא JSON — לגיטימי
      }
    })

    socket.on('error', function () {
      wsErrors.add(1)
    })

    // שומרים חיבור פתוח 10–20 שניות
    const holdTime = 10 + Math.random() * 10
    sleep(holdTime)

    socket.close()
  })

  const connected = check(res, { 'ws status 101': (r) => r && r.status === 101 })
  if (!connected) {
    wsErrors.add(1)
  }

  sleep(1)
}

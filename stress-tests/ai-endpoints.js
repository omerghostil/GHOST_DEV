import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { BASE_URL, jsonHeaders, getStages } from './config.js'
import { login } from './helpers/auth.js'
import { tinyImageDataUrl } from './helpers/data-generators.js'

const frameRelevanceDuration = new Trend('frame_relevance_duration', true)
const visionChatDuration = new Trend('vision_chat_duration', true)
const operationScanDuration = new Trend('operation_scan_duration', true)
const aiErrors = new Rate('ai_errors')
const circuitBreakerHits = new Counter('circuit_breaker_hits')

export const options = {
  stages: getStages(),
  thresholds: {
    ai_errors: ['rate<0.30'],
    http_req_failed: ['rate<0.30'],
  },
  tags: { testName: 'ai-endpoints' },
}

export function setup() {
  const auth = login()
  if (!auth) throw new Error('Login failed in setup')
  return { token: auth.accessToken }
}

export default function (data) {
  const headers = jsonHeaders(data.token)
  const imageDataUrl = tinyImageDataUrl()

  // 1. Frame relevance
  const frStart = Date.now()
  const frRes = http.post(
    `${BASE_URL}/api/frame-relevance`,
    JSON.stringify({ frameDataUrl: imageDataUrl }),
    { headers, tags: { name: 'frame_relevance' }, timeout: '30s' },
  )
  frameRelevanceDuration.add(Date.now() - frStart)

  if (frRes.status === 200) {
    aiErrors.add(0)
  } else if (frRes.status === 503) {
    aiErrors.add(0)
  } else if (frRes.status === 429) {
    circuitBreakerHits.add(1)
    aiErrors.add(0)
  } else {
    aiErrors.add(1)
  }

  check(frRes, {
    'frame-relevance responded': (r) => r.status === 200 || r.status === 502 || r.status === 503 || r.status === 429,
  })

  sleep(1)

  // 2. Vision chat
  const vcStart = Date.now()
  const vcRes = http.post(
    `${BASE_URL}/api/chat-vision`,
    JSON.stringify({
      frameDataUrl: imageDataUrl,
      channel: {
        id: 'stress-ch-1',
        name: 'ערוץ בדיקה',
        type: 'personal',
        watchScope: 'זיהוי כללי',
        location: 'מיקום בדיקה',
        members: ['user-a'],
      },
      userMessage: 'מה אתה רואה בתמונה?',
      history: [],
    }),
    { headers, tags: { name: 'vision_chat' }, timeout: '30s' },
  )
  visionChatDuration.add(Date.now() - vcStart)
  check(vcRes, {
    'vision-chat responded': (r) => r.status === 200 || r.status === 502 || r.status === 503,
  })

  sleep(1)

  // 3. Operation scan
  const osStart = Date.now()
  const osRes = http.post(
    `${BASE_URL}/api/operation-scan`,
    JSON.stringify({
      frameDataUrl: imageDataUrl,
      channel: {
        id: 'stress-ch-1',
        name: 'ערוץ בדיקה',
        type: 'personal',
        watchScope: 'זיהוי כללי',
        location: 'מיקום בדיקה',
        members: ['user-a'],
      },
      operations: [],
    }),
    { headers, tags: { name: 'operation_scan' }, timeout: '30s' },
  )
  operationScanDuration.add(Date.now() - osStart)
  check(osRes, {
    'operation-scan responded': (r) => r.status === 200 || r.status === 502 || r.status === 503,
  })

  sleep(2)
}

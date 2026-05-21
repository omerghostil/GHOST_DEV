import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, jsonHeaders, getStages } from './config.js'
import { login, refreshAccessToken } from './helpers/auth.js'
import { randomChannelPayload, randomMessagePayload, tinyImageDataUrl } from './helpers/data-generators.js'

const mixedDuration = new Trend('mixed_request_duration', true)
const mixedErrors = new Rate('mixed_errors')

export const options = {
  stages: getStages(),
  thresholds: {
    mixed_errors: ['rate<0.10'],
    http_req_failed: ['rate<0.10'],
    mixed_request_duration: ['p(95)<3000'],
  },
  tags: { testName: 'mixed-workload' },
}

export function setup() {
  const auth = login()
  if (!auth) throw new Error('Login failed in setup')
  return { token: auth.accessToken, refreshToken: auth.refreshToken }
}

export default function (data) {
  const headers = jsonHeaders(data.token)
  const roll = Math.random()

  const start = Date.now()
  let ok = false

  if (roll < 0.1) {
    // 10% — Auth flow
    const auth = login()
    ok = !!auth
    if (auth) {
      refreshAccessToken(auth.refreshToken)
    }
  } else if (roll < 0.5) {
    // 40% — Channels
    const createRes = http.post(
      `${BASE_URL}/api/channels`,
      JSON.stringify(randomChannelPayload()),
      { headers, tags: { name: 'mixed_channel_create' } },
    )
    ok = createRes.status === 200
    if (ok) {
      const chId = createRes.json('id')
      http.post(
        `${BASE_URL}/api/channels/${chId}/messages`,
        JSON.stringify(randomMessagePayload()),
        { headers, tags: { name: 'mixed_channel_message' } },
      )
      sleep(0.2)
      http.del(`${BASE_URL}/api/channels/${chId}`, null, {
        headers,
        tags: { name: 'mixed_channel_delete' },
      })
    }
  } else if (roll < 0.8) {
    // 30% — Admin dashboard
    const ovRes = http.get(`${BASE_URL}/api/admin/dashboard/overview`, {
      headers,
      tags: { name: 'mixed_admin_overview' },
    })
    ok = ovRes.status === 200

    http.get(`${BASE_URL}/api/admin/users`, {
      headers,
      tags: { name: 'mixed_admin_users' },
    })
  } else {
    // 20% — AI endpoints
    const frRes = http.post(
      `${BASE_URL}/api/frame-relevance`,
      JSON.stringify({ frameDataUrl: tinyImageDataUrl() }),
      { headers, tags: { name: 'mixed_frame_relevance' }, timeout: '30s' },
    )
    ok = frRes.status === 200 || frRes.status === 502 || frRes.status === 503
  }

  mixedDuration.add(Date.now() - start)
  mixedErrors.add(ok ? 0 : 1)

  sleep(0.5 + Math.random())
}

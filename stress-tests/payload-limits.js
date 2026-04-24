import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'
import { BASE_URL, jsonHeaders } from './config.js'
import { login } from './helpers/auth.js'

const payloadDuration = new Trend('payload_request_duration', true)
const rejections = new Counter('payload_rejections')
const crashes = new Counter('payload_crashes')

export const options = {
  scenarios: {
    growing_payloads: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 1,
    },
  },
  thresholds: {
    payload_crashes: ['count<1'],
  },
  tags: { testName: 'payload-limits' },
}

export function setup() {
  const auth = login()
  if (!auth) throw new Error('Login failed in setup')
  return { token: auth.accessToken }
}

function generatePaddedJson(sizeKB) {
  const base = { frameDataUrl: 'data:image/png;base64,' }
  const targetBytes = sizeKB * 1024
  const currentSize = JSON.stringify(base).length
  const padding = 'A'.repeat(Math.max(0, targetBytes - currentSize))
  base.frameDataUrl += padding
  return JSON.stringify(base)
}

export default function (data) {
  const headers = jsonHeaders(data.token)
  const sizes = [1, 100, 1024, 5120, 10240, 12288, 13312, 15360]

  for (const sizeKB of sizes) {
    const label = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(0)}MB` : `${sizeKB}KB`
    const body = generatePaddedJson(sizeKB)

    const start = Date.now()
    const res = http.post(`${BASE_URL}/api/frame-relevance`, body, {
      headers,
      tags: { name: `payload_${label}` },
      timeout: '30s',
    })
    payloadDuration.add(Date.now() - start)

    if (res.status === 413 || res.status === 400) {
      rejections.add(1)
      check(res, { [`${label} gracefully rejected`]: (r) => r.status === 413 || r.status === 400 })
    } else if (res.status === 0) {
      crashes.add(1)
    } else {
      check(res, { [`${label} accepted`]: (r) => r.status >= 200 && r.status < 600 })
    }

    sleep(0.5)
  }
}

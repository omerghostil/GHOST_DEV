import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, jsonHeaders, getStages } from './config.js'
import { login, refreshAccessToken } from './helpers/auth.js'

const loginDuration = new Trend('login_duration', true)
const refreshDuration = new Trend('refresh_duration', true)
const meDuration = new Trend('me_duration', true)
const authErrors = new Rate('auth_errors')

export const options = {
  stages: getStages(),
  thresholds: {
    login_duration: ['p(95)<500'],
    refresh_duration: ['p(95)<300'],
    me_duration: ['p(95)<200'],
    auth_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.05'],
  },
  tags: { testName: 'auth-flow' },
}

export default function () {
  // 1. Login
  const loginStart = Date.now()
  const authData = login()
  loginDuration.add(Date.now() - loginStart)

  if (!authData) {
    authErrors.add(1)
    sleep(1)
    return
  }
  authErrors.add(0)

  sleep(0.5)

  // 2. GET /me
  const meStart = Date.now()
  const meRes = http.get(`${BASE_URL}/api/auth/me`, {
    headers: jsonHeaders(authData.accessToken),
    tags: { name: 'auth_me' },
  })
  meDuration.add(Date.now() - meStart)
  check(meRes, { 'GET /me status 200': (r) => r.status === 200 })

  sleep(0.5)

  // 3. Refresh token
  const refreshStart = Date.now()
  const newToken = refreshAccessToken(authData.refreshToken)
  refreshDuration.add(Date.now() - refreshStart)

  if (!newToken) {
    authErrors.add(1)
  } else {
    authErrors.add(0)
    const meRes2 = http.get(`${BASE_URL}/api/auth/me`, {
      headers: jsonHeaders(newToken),
      tags: { name: 'auth_me_after_refresh' },
    })
    check(meRes2, { 'GET /me after refresh 200': (r) => r.status === 200 })
  }

  sleep(1)
}

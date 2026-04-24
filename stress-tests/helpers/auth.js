import http from 'k6/http'
import { BASE_URL, AUTH_USERNAME, AUTH_PASSWORD, jsonHeaders } from '../config.js'

/**
 * מבצע login ומחזיר אובייקט עם accessToken, refreshToken ו-profile.
 */
export function login(username, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: username || AUTH_USERNAME, password: password || AUTH_PASSWORD }),
    { headers: jsonHeaders(), tags: { name: 'auth_login' } },
  )
  if (res.status === 200) {
    const body = res.json()
    return { accessToken: body.accessToken, refreshToken: body.refreshToken, profile: body.profile }
  }
  return null
}

/**
 * מבצע ghost-access ומחזיר טוקנים.
 */
export function ghostAccess() {
  const res = http.post(`${BASE_URL}/api/auth/ghost-access`, null, {
    headers: jsonHeaders(),
    tags: { name: 'auth_ghost_access' },
  })
  if (res.status === 200) {
    const body = res.json()
    return { accessToken: body.accessToken, refreshToken: body.refreshToken, profile: body.profile }
  }
  return null
}

/**
 * מרענן access token.
 */
export function refreshAccessToken(refreshToken) {
  const res = http.post(
    `${BASE_URL}/api/auth/refresh`,
    JSON.stringify({ refreshToken }),
    { headers: jsonHeaders(), tags: { name: 'auth_refresh' } },
  )
  if (res.status === 200) {
    return res.json().accessToken
  }
  return null
}

/**
 * שולף מטריקות בריאות מהשרת.
 */
export function fetchHealth() {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } })
  if (res.status === 200) return res.json()
  return null
}

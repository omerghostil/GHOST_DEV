/**
 * הגדרות משותפות לכל סקריפטי בדיקות העומס.
 */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787'

export const AUTH_USERNAME = __ENV.AUTH_USERNAME || 'omeradmin'
export const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'omeradmin'

export const THRESHOLDS = {
  http_req_duration: ['p(95)<2000'],
  http_req_failed: ['rate<0.05'],
}

export const STAGES = {
  medium: [
    { duration: '15s', target: 10 },
    { duration: '1m30s', target: 25 },
    { duration: '15s', target: 0 },
  ],
  high: [
    { duration: '20s', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '40s', target: 0 },
  ],
  extreme: [
    { duration: '30s', target: 200 },
    { duration: '3m', target: 500 },
    { duration: '1m30s', target: 0 },
  ],
  spike: [
    { duration: '10s', target: 300 },
    { duration: '30s', target: 300 },
    { duration: '20s', target: 0 },
  ],
}

export function getStages() {
  const level = (__ENV.LOAD_LEVEL || 'medium').toLowerCase()
  return STAGES[level] || STAGES.medium
}

export function jsonHeaders(token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

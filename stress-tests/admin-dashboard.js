import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { BASE_URL, jsonHeaders, getStages } from './config.js'
import { login } from './helpers/auth.js'

const overviewDuration = new Trend('dashboard_overview_duration', true)
const usersDuration = new Trend('dashboard_users_duration', true)
const issuesDuration = new Trend('dashboard_issues_duration', true)
const orgDashDuration = new Trend('dashboard_org_duration', true)

export const options = {
  stages: getStages(),
  thresholds: {
    dashboard_overview_duration: ['p(95)<2000'],
    dashboard_users_duration: ['p(95)<1500'],
    dashboard_issues_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.05'],
  },
  tags: { testName: 'admin-dashboard' },
}

export function setup() {
  const auth = login()
  if (!auth) throw new Error('Login failed in setup')

  const orgsRes = http.get(`${BASE_URL}/api/admin/dashboard/overview`, {
    headers: jsonHeaders(auth.accessToken),
  })
  let orgId = null
  if (orgsRes.status === 200) {
    const body = orgsRes.json()
    if (body.organizations && body.organizations.length > 0) {
      orgId = body.organizations[0].id
    }
  }

  return { token: auth.accessToken, orgId }
}

export default function (data) {
  const headers = jsonHeaders(data.token)

  // 1. Dashboard overview
  const ovStart = Date.now()
  const ovRes = http.get(`${BASE_URL}/api/admin/dashboard/overview`, {
    headers,
    tags: { name: 'admin_overview' },
  })
  overviewDuration.add(Date.now() - ovStart)
  check(ovRes, { 'overview 200': (r) => r.status === 200 })

  sleep(0.5)

  // 2. Users list
  const usersStart = Date.now()
  const usersRes = http.get(`${BASE_URL}/api/admin/users`, {
    headers,
    tags: { name: 'admin_users' },
  })
  usersDuration.add(Date.now() - usersStart)
  check(usersRes, { 'users 200': (r) => r.status === 200 })

  sleep(0.5)

  // 3. Issues list
  const issuesStart = Date.now()
  const issuesRes = http.get(`${BASE_URL}/api/admin/issues`, {
    headers,
    tags: { name: 'admin_issues' },
  })
  issuesDuration.add(Date.now() - issuesStart)
  check(issuesRes, { 'issues 200': (r) => r.status === 200 })

  sleep(0.5)

  // 4. Organization dashboard (אם יש ארגון)
  if (data.orgId) {
    const orgStart = Date.now()
    const orgRes = http.get(`${BASE_URL}/api/admin/dashboard/org/${data.orgId}`, {
      headers,
      tags: { name: 'admin_org_dashboard' },
    })
    orgDashDuration.add(Date.now() - orgStart)
    check(orgRes, { 'org dashboard 200': (r) => r.status === 200 })
  }

  sleep(1)
}

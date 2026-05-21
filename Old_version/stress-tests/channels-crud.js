import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, jsonHeaders, getStages } from './config.js'
import { login } from './helpers/auth.js'
import { randomChannelPayload, randomMessagePayload } from './helpers/data-generators.js'

const createChannelDuration = new Trend('create_channel_duration', true)
const listChannelsDuration = new Trend('list_channels_duration', true)
const sendMessageDuration = new Trend('send_message_duration', true)
const deleteChannelDuration = new Trend('delete_channel_duration', true)
const channelErrors = new Rate('channel_errors')

export const options = {
  stages: getStages(),
  thresholds: {
    create_channel_duration: ['p(95)<1000'],
    list_channels_duration: ['p(95)<1000'],
    send_message_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.05'],
  },
  tags: { testName: 'channels-crud' },
}

export function setup() {
  const auth = login()
  if (!auth) throw new Error('Login failed in setup')
  return { token: auth.accessToken }
}

export default function (data) {
  const headers = jsonHeaders(data.token)

  // 1. יצירת ערוץ
  const createStart = Date.now()
  const createRes = http.post(
    `${BASE_URL}/api/channels`,
    JSON.stringify(randomChannelPayload()),
    { headers, tags: { name: 'channel_create' } },
  )
  createChannelDuration.add(Date.now() - createStart)

  const createOk = check(createRes, {
    'POST /channels 200': (r) => r.status === 200,
  })

  if (!createOk || createRes.status !== 200) {
    channelErrors.add(1)
    sleep(1)
    return
  }
  channelErrors.add(0)

  const channelId = createRes.json('id')

  sleep(0.3)

  // 2. רשימת ערוצים
  const listStart = Date.now()
  const listRes = http.get(`${BASE_URL}/api/channels`, {
    headers,
    tags: { name: 'channel_list' },
  })
  listChannelsDuration.add(Date.now() - listStart)
  check(listRes, { 'GET /channels 200': (r) => r.status === 200 })

  sleep(0.3)

  // 3. שליחת הודעות (3 הודעות ברצף)
  for (let i = 0; i < 3; i++) {
    const msgStart = Date.now()
    const msgRes = http.post(
      `${BASE_URL}/api/channels/${channelId}/messages`,
      JSON.stringify(randomMessagePayload()),
      { headers, tags: { name: 'channel_message' } },
    )
    sendMessageDuration.add(Date.now() - msgStart)
    check(msgRes, { 'POST message 200': (r) => r.status === 200 })
    sleep(0.1)
  }

  sleep(0.3)

  // 4. עדכון ערוץ
  http.patch(
    `${BASE_URL}/api/channels/${channelId}`,
    JSON.stringify({ name: `ערוץ מעודכן ${Date.now()}` }),
    { headers, tags: { name: 'channel_update' } },
  )

  sleep(0.3)

  // 5. מחיקת ערוץ
  const deleteStart = Date.now()
  const deleteRes = http.del(`${BASE_URL}/api/channels/${channelId}`, null, {
    headers,
    tags: { name: 'channel_delete' },
  })
  deleteChannelDuration.add(Date.now() - deleteStart)
  check(deleteRes, { 'DELETE channel 200 or 204': (r) => r.status === 200 || r.status === 204 })

  sleep(0.5)
}

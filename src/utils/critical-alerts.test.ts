import { describe, expect, it } from 'vitest'
import type { Channel, Message } from '../types'
import { buildCriticalAlerts, hasPendingCriticalAlertsInChannel, parseCriticalAlertText } from './critical-alerts'

function createChannel(channelId: string, messages: Message[]): Channel {
  return {
    id: channelId,
    name: `ערוץ ${channelId}`,
    type: 'personal',
    subtitle: 'מצלמה אישית',
    location: 'לובי',
    watchScope: 'תנועת קהל',
    description: 'ערוץ בדיקות',
    memoryInterval: 30,
    rtspFeed: 'rtsp://',
    unread: 0,
    liveState: 'LIVE',
    members: [`ערוץ ${channelId}`],
    messages,
    operations: [],
  }
}

describe('critical-alerts utilities', () => {
  it('מחלץ שם מבצע וסיכום מהודעת התראה קריטית', () => {
    const parsed = parseCriticalAlertText('התראה קריטית — מבצע «שער צפוני»: אדם חצה קו אבטחה')
    expect(parsed.operationName).toBe('שער צפוני')
    expect(parsed.summary).toBe('אדם חצה קו אבטחה')
  })

  it('בונה רשימת התראות ומחיל סטטוסים לפי מזהה הודעה', () => {
    const channels = [
      createChannel('A', [
        { id: 'm-1', author: 'system', text: 'התראה קריטית — מבצע «אבטחה»: זוהתה חריגה', time: '10:00', alertLevel: 'critical' },
        { id: 'm-2', author: 'system', text: 'סריקה תקינה', time: '10:01', alertLevel: 'routine' },
      ]),
      createChannel('B', [
        { id: 'm-3', author: 'system', text: 'התראה קריטית — מבצע «כניסה»: זוהתה תנועה חריגה', time: '10:02', alertLevel: 'critical' },
      ]),
    ]

    const result = buildCriticalAlerts(channels, { 'm-3': 'approved' })
    expect(result).toHaveLength(2)
    expect(result[0].messageId).toBe('m-1')
    expect(result[0].status).toBe('pending')
    expect(result[1].messageId).toBe('m-3')
    expect(result[1].status).toBe('approved')
  })

  it('מזהה אם נשארו התראות קריטיות בטיפול בערוץ', () => {
    const channel = createChannel('A', [
      { id: 'm-1', author: 'system', text: 'התראה קריטית — מבצע «אבטחה»: זוהתה חריגה', time: '10:00', alertLevel: 'critical' },
      { id: 'm-2', author: 'system', text: 'הערכת מצב', time: '10:03', alertLevel: 'assessment' },
    ])

    expect(hasPendingCriticalAlertsInChannel(channel, {})).toBe(true)
    expect(hasPendingCriticalAlertsInChannel(channel, { 'm-1': 'approved' })).toBe(false)
    expect(hasPendingCriticalAlertsInChannel(channel, { 'm-1': 'ignored' })).toBe(false)
  })
})

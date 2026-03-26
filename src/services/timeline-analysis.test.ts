import { describe, expect, it, vi } from 'vitest'
import type { Channel } from '../types'
import { requestTimelineAnalysis } from './timeline-analysis'

const TEST_CHANNEL: Channel = {
  id: 'test-channel',
  name: 'ערוץ בדיקה',
  type: 'personal',
  subtitle: 'מצלמה אישית',
  location: 'קומה 2',
  watchScope: 'ניטור תנועה',
  description: 'תיאור בדיקה',
  memoryInterval: 30,
  rtspFeed: 'rtsp://',
  unread: 0,
  liveState: 'LIVE',
  members: ['ערוץ בדיקה'],
  messages: [],
  operations: [],
}

describe('requestTimelineAnalysis', () => {
  it('מחזיר תקציר ניתוח קולאז׳ תקין', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ summary: 'אדם נכנס, רכב עצר, ואז האזור התרוקן.' }),
      }),
    )

    const summary = await requestTimelineAnalysis(
      TEST_CHANNEL,
      'data:image/jpeg;base64,BBBB',
      ['2026-03-25T10:00:00.000Z', '2026-03-25T10:00:02.000Z'],
    )
    expect(summary).toContain('אדם נכנס')
  })

  it('זורק שגיאה על תגובת שרת שגויה', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'קלט לא תקין' }),
      }),
    )

    await expect(
      requestTimelineAnalysis(TEST_CHANNEL, 'data:image/jpeg;base64,BBBB', ['2026-03-25T10:00:00.000Z']),
    ).rejects.toThrow('קלט לא תקין')
  })
})

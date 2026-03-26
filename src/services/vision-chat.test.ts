import { describe, expect, it, vi } from 'vitest'
import type { Channel } from '../types'
import { requestVisionReply } from './vision-chat'

const TEST_CHANNEL: Channel = {
  id: 'test-1',
  name: 'ערוץ בדיקה',
  type: 'personal',
  subtitle: 'מצלמה אישית',
  location: 'קומה 1',
  watchScope: 'תנועת אנשים',
  description: 'ערוץ בדיקות',
  memoryInterval: 30,
  rtspFeed: 'rtsp://',
  unread: 0,
  liveState: 'LIVE',
  members: ['ערוץ בדיקה'],
  messages: [],
  operations: [],
}

describe('requestVisionReply', () => {
  it('מחזיר תשובה תקינה מהשרת', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            text: 'זו תשובה אמיתית',
            sources: ['ערוץ בדיקה'],
          }),
      }),
    )

    const reply = await requestVisionReply(TEST_CHANNEL, 'מה רואים?', 'data:image/webp;base64,AAAA')
    expect(reply.text).toBe('זו תשובה אמיתית')
    expect(reply.sources).toEqual(['ערוץ בדיקה'])
  })

  it('זורק שגיאה כשהשרת מחזיר כישלון', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () =>
          JSON.stringify({
            error: 'כשל שרת',
          }),
      }),
    )

    await expect(requestVisionReply(TEST_CHANNEL, 'בדיקה', 'data:image/webp;base64,AAAA')).rejects.toThrow(
      'כשל שרת',
    )
  })
})

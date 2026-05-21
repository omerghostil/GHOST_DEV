import { describe, expect, it, vi } from 'vitest'
import type { Channel, Operation } from '../types'
import { requestOperationScan } from './operation-scan'

const TEST_CHANNEL: Channel = {
  id: 'ch-1',
  name: 'ערוץ',
  type: 'personal',
  subtitle: 'מצלמה אישית',
  location: 'מיקום',
  watchScope: 'היקף',
  description: 'תיאור',
  memoryInterval: 30,
  rtspFeed: 'rtsp://',
  unread: 0,
  liveState: 'LIVE',
  members: ['ערוץ'],
  messages: [],
  operations: [],
}

const TEST_OPS: Operation[] = [
  {
    id: 'op-1',
    name: 'מבצע א',
    mode: 'alert',
    schedule: '24/7',
    trigger: 'אדם בכניסה',
    action: 'בדוק',
    enabled: true,
  },
]

describe('requestOperationScan', () => {
  it('מחזיר תוצאות סריקה מהשרת', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            results: [{ operationId: 'op-1', critical: false, summary: 'אין חריגה' }],
          }),
      }),
    )

    const results = await requestOperationScan(
      TEST_CHANNEL,
      'data:image/png;base64,AAAA',
      TEST_OPS,
    )
    expect(results).toHaveLength(1)
    expect(results[0].operationId).toBe('op-1')
    expect(results[0].critical).toBe(false)
  })
})

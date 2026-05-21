import { describe, expect, it, vi } from 'vitest'
import { checkFrameRelevance } from './frame-relevance'

describe('checkFrameRelevance', () => {
  it('מחזיר true כאשר השרת סימן פריים כרלוונטי', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ relevant: true }),
      }),
    )

    const result = await checkFrameRelevance('data:image/webp;base64,AAAA')
    expect(result).toBe(true)
  })

  it('זורק שגיאה כאשר השרת מחזיר כשלון', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ error: 'כשל בדיקה' }),
      }),
    )

    await expect(checkFrameRelevance('data:image/webp;base64,AAAA')).rejects.toThrow('כשל בדיקה')
  })
})

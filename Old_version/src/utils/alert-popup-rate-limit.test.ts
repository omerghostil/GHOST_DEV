import { describe, expect, it } from 'vitest'
import { consumeChannelAlertPopupSlot } from './alert-popup-rate-limit'

describe('consumeChannelAlertPopupSlot', () => {
  it('מאפשר פופאפ ראשון לערוץ ושומר חותמת זמן', () => {
    const lastShownMap = new Map<string, number>()

    const result = consumeChannelAlertPopupSlot(lastShownMap, 'channel-1', 1_000, 20_000)

    expect(result).toBe(true)
    expect(lastShownMap.get('channel-1')).toBe(1_000)
  })

  it('חוסם פופאפ נוסף בתוך חלון ה-cooldown', () => {
    const lastShownMap = new Map<string, number>([['channel-1', 1_000]])

    const result = consumeChannelAlertPopupSlot(lastShownMap, 'channel-1', 15_000, 20_000)

    expect(result).toBe(false)
    expect(lastShownMap.get('channel-1')).toBe(1_000)
  })

  it('מאפשר פופאפ נוסף אחרי 20 שניות ומעדכן זמן חדש', () => {
    const lastShownMap = new Map<string, number>([['channel-1', 1_000]])

    const result = consumeChannelAlertPopupSlot(lastShownMap, 'channel-1', 21_100, 20_000)

    expect(result).toBe(true)
    expect(lastShownMap.get('channel-1')).toBe(21_100)
  })
})

/**
 * בודק אם מותר להציג פופאפ התראה לערוץ נתון לפי חלון cooldown.
 * אם מותר, מעדכן את זמן ההצגה האחרון ומחזיר true.
 */
export function consumeChannelAlertPopupSlot(
  lastShownAtByChannel: Map<string, number>,
  channelId: string,
  nowMs: number,
  cooldownMs: number,
): boolean {
  const lastShownAt = lastShownAtByChannel.get(channelId)
  if (lastShownAt != null && nowMs - lastShownAt < cooldownMs) {
    return false
  }

  lastShownAtByChannel.set(channelId, nowMs)
  return true
}

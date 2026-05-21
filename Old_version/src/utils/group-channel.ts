import type { Channel } from '../types'

/**
 * מחזיר את שמות הערוצים לפי מזהים שנבחרו לצירוף לקבוצה.
 * הסדר תואם ל־linkedIds.
 */
export function memberNamesFromLinkedChannelIds(channels: Channel[], linkedIds: string[]): string[] {
  const byId = new Map(channels.map((channel) => [channel.id, channel.name]))
  return linkedIds.map((id) => byId.get(id)).filter((name): name is string => Boolean(name))
}

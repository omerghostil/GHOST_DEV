import type { ParsedSchedule, TimeSlot } from '../types'

const MIN_INTERVAL_MS = 10_000
const CONTINUOUS_INTERVAL_MS = 60_000
const CONTINUOUS_PATTERN = /^(24\s*\/\s*7|always|continuous|רציף|תמיד|non-?stop)$/i

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0, ראשון: 0,
  monday: 1, mon: 1, שני: 1,
  tuesday: 2, tue: 2, שלישי: 2,
  wednesday: 3, wed: 3, רביעי: 3,
  thursday: 4, thu: 4, חמישי: 4,
  friday: 5, fri: 5, שישי: 5,
  saturday: 6, sat: 6, שבת: 6,
}

const UNIT_MS: Record<string, number> = {
  second: 1_000, seconds: 1_000, sec: 1_000, s: 1_000,
  שניות: 1_000, שנייה: 1_000,
  minute: 60_000, minutes: 60_000, min: 60_000, m: 60_000,
  דקות: 60_000, דקה: 60_000,
  hour: 3_600_000, hours: 3_600_000, hr: 3_600_000, h: 3_600_000,
  שעות: 3_600_000, שעה: 3_600_000,
}

function extractTimes(text: string): Array<{ hour: number; minute: number }> {
  const times: Array<{ hour: number; minute: number }> = []
  const timeRegex = /(\d{1,2}):(\d{2})/g
  let match = timeRegex.exec(text)
  while (match) {
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      times.push({ hour, minute })
    }
    match = timeRegex.exec(text)
  }
  return times
}

function extractDays(text: string): number[] {
  const lower = text.toLowerCase()
  const days = new Set<number>()
  for (const [keyword, dayIndex] of Object.entries(DAY_MAP)) {
    if (lower.includes(keyword)) {
      days.add(dayIndex)
    }
  }
  return [...days].sort((a, b) => a - b)
}

/**
 * מפרסר טקסט תזמון בשפה חופשית (עברית/אנגלית) ומחזיר ParsedSchedule או null.
 */
export function parseSchedule(raw: string): ParsedSchedule | null {
  const text = raw.trim()
  if (!text) {
    return null
  }

  if (CONTINUOUS_PATTERN.test(text)) {
    return { type: 'interval', intervalMs: CONTINUOUS_INTERVAL_MS }
  }

  const intervalMatch = text.match(/(?:every|כל)\s+(\d+)\s+(\S+)/i)
  if (intervalMatch) {
    const amount = Number(intervalMatch[1])
    const unitKey = intervalMatch[2].toLowerCase().replace(/[.,]/g, '')
    const unitMs = UNIT_MS[unitKey]
    if (unitMs && amount > 0) {
      return { type: 'interval', intervalMs: Math.max(MIN_INTERVAL_MS, amount * unitMs) }
    }
  }

  const times = extractTimes(text)
  if (times.length > 0) {
    const days = extractDays(text)
    const slots: TimeSlot[] = []
    if (days.length === 0) {
      for (const t of times) {
        slots.push({ dayOfWeek: null, hour: t.hour, minute: t.minute })
      }
    } else {
      for (const day of days) {
        for (const t of times) {
          slots.push({ dayOfWeek: day, hour: t.hour, minute: t.minute })
        }
      }
    }
    return { type: 'time-slots', slots }
  }

  return null
}

/**
 * מחשב כמה מילישניות עד ההפעלה הבאה של ParsedSchedule.
 */
export function getNextRunMs(parsed: ParsedSchedule): number {
  if (parsed.type === 'interval') {
    return parsed.intervalMs
  }

  const now = new Date()
  const currentDay = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  let closest = Infinity

  for (const slot of parsed.slots) {
    if (slot.dayOfWeek === null || slot.dayOfWeek === currentDay) {
      const slotMinutes = slot.hour * 60 + slot.minute
      const diff = slotMinutes - currentMinutes
      if (diff > 0) {
        closest = Math.min(closest, diff * 60_000)
      }
    }
    const daysAhead = slot.dayOfWeek === null ? 1 : ((slot.dayOfWeek - currentDay + 7) % 7 || 7)
    const slotMinutes = slot.hour * 60 + slot.minute
    const msTillSlot = daysAhead * 86_400_000 - (currentMinutes * 60_000) + (slotMinutes * 60_000)
    if (msTillSlot > 0) {
      closest = Math.min(closest, msTillSlot)
    }
  }

  return closest === Infinity ? 60_000 : closest
}

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/**
 * מחזיר תיאור בעברית של ParsedSchedule לתצוגה בממשק.
 */
export function describeSchedule(parsed: ParsedSchedule): string {
  if (parsed.type === 'interval') {
    const ms = parsed.intervalMs
    if (ms < 60_000) {
      return `כל ${Math.round(ms / 1_000)} שניות`
    }
    if (ms < 3_600_000) {
      return `כל ${Math.round(ms / 60_000)} דקות`
    }
    return `כל ${Math.round(ms / 3_600_000)} שעות`
  }

  const days = [...new Set(parsed.slots.map((s) => s.dayOfWeek))]
  const times = [...new Set(parsed.slots.map((s) => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`))].sort()

  const daysPart =
    days.includes(null)
      ? 'כל יום'
      : days.filter((d): d is number => d !== null).map((d) => DAY_NAMES_HE[d]).join(', ')

  return `${daysPart} ב-${times.join(' וב-')}`
}

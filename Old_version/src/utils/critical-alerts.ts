import type { Channel } from '../types'

export type CriticalAlertStatus = 'pending' | 'approved' | 'ignored'

export interface CriticalAlertItem {
  messageId: string
  channelId: string
  channelName: string
  operationName: string
  summary: string
  time: string
  text: string
  frameDataUrl?: string
  status: CriticalAlertStatus
}

const OPERATION_NAME_PATTERN = /מבצע «(.+?)»/
const SUMMARY_PATTERN = /:\s*(.+)$/

/**
 * מחלץ שם מבצע וסיכום מתוך ניסוח התראת מערכת קריטית.
 */
export function parseCriticalAlertText(text: string): { operationName: string; summary: string } {
  const operationMatch = text.match(OPERATION_NAME_PATTERN)
  const summaryMatch = text.match(SUMMARY_PATTERN)

  return {
    operationName: operationMatch?.[1]?.trim() || 'מבצע לא מזוהה',
    summary: summaryMatch?.[1]?.trim() || text.trim(),
  }
}

/**
 * בונה רשימת התראות קריטיות מכל הערוצים, עם סטטוס פעולה למרכז ההתראות.
 */
export function buildCriticalAlerts(
  channels: Channel[],
  statusByMessageId: Record<string, CriticalAlertStatus>,
): CriticalAlertItem[] {
  const items: CriticalAlertItem[] = []

  for (const channel of channels) {
    for (const message of channel.messages) {
      if (message.alertLevel !== 'critical') {
        continue
      }

      const parsed = parseCriticalAlertText(message.text)
      items.push({
        messageId: message.id,
        channelId: channel.id,
        channelName: channel.name,
        operationName: parsed.operationName,
        summary: parsed.summary,
        time: message.time,
        text: message.text,
        frameDataUrl: message.frameDataUrl,
        status: statusByMessageId[message.id] ?? 'pending',
      })
    }
  }

  const statusRank: Record<CriticalAlertStatus, number> = {
    pending: 0,
    approved: 1,
    ignored: 2,
  }

  return items.sort((left, right) => {
    const statusDiff = statusRank[left.status] - statusRank[right.status]
    if (statusDiff !== 0) {
      return statusDiff
    }
    return right.messageId.localeCompare(left.messageId)
  })
}

/**
 * בודק האם לערוץ יש לפחות התראה קריטית אחת שעדיין בטיפול.
 */
export function hasPendingCriticalAlertsInChannel(
  channel: Channel,
  statusByMessageId: Record<string, CriticalAlertStatus>,
): boolean {
  return channel.messages.some(
    (message) => message.alertLevel === 'critical' && (statusByMessageId[message.id] ?? 'pending') === 'pending',
  )
}

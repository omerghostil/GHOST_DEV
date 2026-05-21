import type { NewChannelDraft, OperationDraft, OperationMode, StatusMeta } from '../types'

export const TIMELINE_INTERVALS_SECONDS = [2, 4, 8] as const
export const MAX_COLLAGE_FRAMES = 18
export const COLLAGE_GRID_COLUMNS = 6
export const COLLAGE_GRID_ROWS = 3
export const MAX_TIMELINE_HISTORY_ITEMS = 60

export const QUICK_PROMPTS = [
  'סכם את 10 הדקות האחרונות',
  'בדוק אם יש חסימה בכניסה',
  'הפוך את הבדיקה הזו למבצע',
]

export interface OperationModeMeta {
  label: string
  triggerLabel: string
  triggerHint: string
}

export const OPERATION_MODE_META: Record<OperationMode, OperationModeMeta> = {
  alert:      { label: 'התראה',     triggerLabel: 'טריגר להתראה',  triggerHint: 'תנאי שבעמידתו תישלח התראה קריטית' },
  report:     { label: 'דו"ח',      triggerLabel: 'נושא הדו"ח',    triggerHint: 'על מה לדווח מתוך הפריים' },
  rating:     { label: 'דירוג',     triggerLabel: 'קריטריון דירוג', triggerHint: 'מה לדרג בסולם 1-10' },
  assessment: { label: 'הערכת מצב', triggerLabel: 'נושא ההערכה',   triggerHint: 'מה להעריך ולפרט מתוך הפריים' },
}

export const OPERATION_MODES: OperationMode[] = ['alert', 'report', 'rating', 'assessment']

export const DEFAULT_OPERATION_DRAFT: OperationDraft = {
  name: 'מבצע חדש',
  mode: 'alert',
  schedule: 'כל 15 דקות',
  trigger: 'למשל: לפחות שני אנשים בפריים / רכב בכניסה',
  action: 'הנחיות נוספות לניתוח (אופציונלי).',
}

export const DEFAULT_NEW_CHANNEL_DRAFT: NewChannelDraft = {
  name: '',
  type: 'personal',
  subtitle: 'מצלמה אישית',
  location: '',
  watchScope: '',
  description: '',
  memoryInterval: 30,
  rtspFeed: 'rtsp://',
  linkedChannelIds: [],
}

export const LIVE_STATE_META: Record<string, StatusMeta> = {
  LIVE: { label: 'פעיל', priority: 1 },
  DEGRADED: { label: 'מוגבל', priority: 2 },
  SYNC: { label: 'סנכרון', priority: 3 },
  OFFLINE: { label: 'לא זמין', priority: 4 },
}

export const INBOX_PAGE_SIZE = 6
export const SEND_COOLDOWN_MS = 400
export const NEAR_BOTTOM_THRESHOLD_PX = 80

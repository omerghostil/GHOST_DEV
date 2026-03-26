export type MessageAuthor = 'user' | 'ghost' | 'system'

export type ChannelType = 'personal' | 'group'

export type LiveState = 'LIVE' | 'SYNC' | 'DEGRADED' | 'OFFLINE'

export type OperationMode = 'alert' | 'report' | 'rating' | 'assessment'

export interface Message {
  id: string
  author: MessageAuthor
  text: string
  time: string
  sources?: string[]
  /** סוג תגובת הסריקה: התראה בינארית, דו"ח, דירוג או הערכת מצב */
  alertLevel?: 'critical' | 'routine' | 'report' | 'rating' | 'assessment'
  /** ציון דירוג 1-10 — רלוונטי רק כאשר alertLevel === 'rating' */
  score?: number
  /** Data URL של הפריים שנלכד בעת סריקה — מוצג עד שהמשתמש לוחץ 'ראיתי' */
  frameDataUrl?: string
}

export interface TimelineSampledFrame {
  dataUrl: string
  capturedAtIso: string
}

export interface TimelineAnalysis {
  id: string
  timestampIso: string
  summary: string
  frameCount: number
  timeRangeStartIso: string
  timeRangeEndIso: string
  intervalSeconds: 2 | 4 | 8
}

export interface TimelineSamplerState {
  isActive: boolean
  intervalSeconds: 2 | 4 | 8
  sampledFrames: TimelineSampledFrame[]
  analysisHistory: TimelineAnalysis[]
}

export interface IntervalSchedule {
  type: 'interval'
  intervalMs: number
}

export interface TimeSlot {
  dayOfWeek: number | null
  hour: number
  minute: number
}

export interface TimeSlotsSchedule {
  type: 'time-slots'
  slots: TimeSlot[]
}

export type ParsedSchedule = IntervalSchedule | TimeSlotsSchedule

export interface Operation {
  id: string
  name: string
  /** סוג תגובת המבצע: alert (ברירת מחדל), report, rating, assessment */
  mode: OperationMode
  /** תזמון סריקה בשפה חופשית, מתורגם לתזמון אמיתי ב-parsedSchedule. */
  schedule: string
  /** משמעות דינמית לפי mode: טריגר התראה / נושא דו"ח / קריטריון דירוג / נושא הערכה */
  trigger: string
  /** הנחיות נוספות למודל (אופציונלי). */
  action: string
  /** בחירה ידנית של מודל לביצוע המבצע (אופציונלי). */
  modelOverride?: 'gpt-4.1' | 'gpt-4.1-mini'
  /** רמת פירוט תמונה רצויה למבצע (אופציונלי). */
  detailLevel?: 'low' | 'auto' | 'high'
  enabled: boolean
  /** לוח זמנים מפורסר מ-schedule — אם קיים, מפעיל טיימר אוטומטי */
  parsedSchedule?: ParsedSchedule
}

export interface Channel {
  id: string
  name: string
  type: ChannelType
  subtitle: string
  location: string
  watchScope: string
  description: string
  memoryInterval: number
  rtspFeed: string
  unread: number
  liveState: LiveState
  /** תמונת הפריים האחרונה שנלכדה מהמצלמה המקומית (Data URL). */
  lastFrameDataUrl?: string
  /** האם למצלמה יש הרשאה/גישה עבור הערוץ הנוכחי. */
  cameraEnabled?: boolean
  /** בצ׳אט קבוצתי: מזהי צ׳אטים קיימים שצורפו לקבוצה */
  linkedChannelIds?: string[]
  /** מצב פיצ'ר דגימת ציר-זמן והיסטוריית ניתוחי קולאז'. */
  timelineState?: TimelineSamplerState
  members: string[]
  messages: Message[]
  operations: Operation[]
}

export type MobilePanel = 'inbox' | 'chat' | 'details'

export interface OperationDraft {
  name: string
  mode: OperationMode
  schedule: string
  trigger: string
  action: string
}

export interface NewChannelDraft {
  name: string
  type: ChannelType
  subtitle: string
  location: string
  watchScope: string
  description: string
  memoryInterval: number
  rtspFeed: string
  /** מזהי צ׳אטים קיימים לצירוף — רלוונטי כש־type הוא group */
  linkedChannelIds: string[]
}

export interface StatusMeta {
  label: string
  priority: number
}

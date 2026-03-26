import type { VisionDetailLevel } from './image-optimizer'

export type VisionModelName = 'gpt-4.1' | 'gpt-4.1-mini'

export interface ModelSelectionArgs {
  task: 'chat' | 'scan'
  triggerText?: string
  modelOverride?: VisionModelName
}

export interface DetailSelectionArgs {
  task: 'chat' | 'scan'
  triggerText?: string
  detailOverride?: VisionDetailLevel
}

const COMPLEX_TRIGGER_KEYWORDS = [
  'זהה',
  'זיהוי',
  'ספר',
  'ספור',
  'ספירה',
  'אנשים',
  'רכבים',
  'רכב',
  'אובייקט',
  'אובייקטים',
  'נשק',
  'חשוד',
  'התנהגות',
  'מצב מורכב',
  'complex',
  'detect',
  'count',
  'objects',
  'situation',
  'weapon',
  'suspicious',
]

function resolveDefaultModel(task: 'chat' | 'scan'): VisionModelName {
  if (task === 'scan') {
    return (process.env.OPENAI_MODEL_COMPLEX as VisionModelName | undefined) ?? 'gpt-4.1'
  }
  return (process.env.OPENAI_MODEL_DEFAULT as VisionModelName | undefined) ?? 'gpt-4.1-mini'
}

/**
 * מזהה טריגר מורכב שדורש מודל חזק יותר להבנת סיטואציות מרובות עצמים.
 */
export function isComplexTrigger(triggerText: string | undefined): boolean {
  if (!triggerText) {
    return false
  }
  const normalized = triggerText.toLowerCase()
  return COMPLEX_TRIGGER_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

/**
 * בוחר מודל מתאים לפי סוג משימה, טריגר, והעדפה ידנית של המבצע.
 */
export function selectVisionModel(args: ModelSelectionArgs): VisionModelName {
  if (args.modelOverride) {
    return args.modelOverride
  }
  if (args.task === 'scan' && isComplexTrigger(args.triggerText)) {
    return (process.env.OPENAI_MODEL_COMPLEX as VisionModelName | undefined) ?? 'gpt-4.1'
  }
  return resolveDefaultModel(args.task)
}

/**
 * בוחר רמת פירוט תמונה מאוזנת בין איכות, מהירות ועלות.
 */
export function selectVisionDetailLevel(args: DetailSelectionArgs): VisionDetailLevel {
  if (args.detailOverride) {
    return args.detailOverride
  }
  if (args.task === 'chat') {
    return 'high'
  }
  return isComplexTrigger(args.triggerText) ? 'auto' : 'low'
}

/**
 * יצירת נתוני בדיקה אקראיים.
 */

export function randomChannelPayload() {
  const id = `stress-ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    name: `ערוץ בדיקה ${id}`,
    type: Math.random() > 0.5 ? 'personal' : 'group',
    watchScope: 'זיהוי חפצים כללי',
    location: 'מיקום בדיקה',
    members: ['user-a', 'user-b'],
  }
}

export function randomMessagePayload() {
  return {
    role: 'user',
    text: `הודעת בדיקה ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

const TINY_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export function tinyImageDataUrl() {
  return TINY_PNG_BASE64
}

/**
 * מייצר payload בגודל מבוקש (בקירוב, ב-KB).
 */
export function generatePayloadOfSize(sizeKB) {
  const char = 'A'
  const bytes = sizeKB * 1024
  let data = ''
  for (let i = 0; i < bytes; i++) {
    data += char
  }
  return { data }
}

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const HASH_SALT = 'ghost_scope_password_salt'
const KEY_LENGTH = 32
const IV_LENGTH = 12

function getEncryptionSecret(): Buffer {
  const raw = process.env.ADMIN_ENCRYPTION_SECRET?.trim() || 'ghost-default-encryption-secret-change-me'
  return scryptSync(raw, 'ghost_scope_encryption_salt', KEY_LENGTH)
}

/**
 * יוצר hash סיסמה דטרמיניסטי עם salt קבוע לסביבה המקומית.
 */
export function hashPassword(rawPassword: string): string {
  return scryptSync(rawPassword, HASH_SALT, 64).toString('hex')
}

/**
 * בודק התאמת סיסמה בצורה בטוחה לזמן.
 */
export function verifyPassword(rawPassword: string, expectedHash: string): boolean {
  const candidateHash = hashPassword(rawPassword)
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  const candidateBuffer = Buffer.from(candidateHash, 'hex')
  if (expectedBuffer.length !== candidateBuffer.length) {
    return false
  }
  return timingSafeEqual(expectedBuffer, candidateBuffer)
}

/**
 * מצפין ערך רגיש לשמירה בדאטה־סטור.
 */
export function encryptSensitiveValue(rawValue: string): string {
  const key = getEncryptionSecret()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(rawValue, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`
}

/**
 * מפענח ערך רגיש מהאחסון.
 */
export function decryptSensitiveValue(payload: string): string {
  const [ivHex, tagHex, encryptedHex] = payload.split('.')
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('פורמט הצפנה לא תקין.')
  }
  const key = getEncryptionSecret()
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function maskPan(pan: string): string {
  const digits = pan.replace(/\D+/g, '')
  const last4 = digits.slice(-4)
  return `**** **** **** ${last4}`
}

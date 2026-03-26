import { hashPassword } from '../security/crypto-utils'
import { adminAuth } from '../lib/firebase-admin'
import { USER_ROLES } from '../admin/types'
import type { IAdminRepository } from '../db/repository-types'

const FIREBASE_AUTH_DOMAIN = 'https://identitytoolkit.googleapis.com/v1'
const INTERNAL_EMAIL_SUFFIX = '@ghost.internal'

function isFirebaseAuthEnabled(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID)
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function buildInternalEmail(username: string): string {
  return `${normalizeUsername(username)}${INTERNAL_EMAIL_SUFFIX}`
}

function readFirebaseWebApiKey(): string {
  const apiKey = process.env.GHOST_FIREBASE_WEB_API_KEY?.trim() || process.env.FIREBASE_WEB_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GHOST_FIREBASE_WEB_API_KEY לא הוגדר.')
  }
  return apiKey
}

/**
 * יוצר (או מחזיר) משתמש Firebase Auth עבור username.
 */
export async function createFirebaseUser(username: string, password: string): Promise<string> {
  const email = buildInternalEmail(username)
  try {
    const existingUser = await adminAuth.getUserByEmail(email)
    await adminAuth.updateUser(existingUser.uid, {
      password,
      displayName: username,
      disabled: false,
    })
    return existingUser.uid
  } catch (error) {
    const firebaseError = error as { code?: string }
    if (firebaseError?.code !== 'auth/user-not-found') {
      throw error
    }
  }

  const created = await adminAuth.createUser({
    email,
    password,
    displayName: username,
    disabled: false,
  })
  return created.uid
}

/**
 * מאמת סיסמה מול Firebase Authentication באמצעות REST API.
 */
export async function verifyFirebasePassword(username: string, password: string): Promise<boolean> {
  const apiKey = readFirebaseWebApiKey()
  const email = buildInternalEmail(username)
  const response = await fetch(`${FIREBASE_AUTH_DOMAIN}/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: false,
    }),
  })

  if (response.ok) {
    return true
  }

  if (response.status === 400 || response.status === 401) {
    return false
  }

  const errorBody = await response.text()
  throw new Error(`Firebase Auth login נכשל: ${errorBody}`)
}

/**
 * מבטיח שמשתמש bootstrap קיים גם ב-Firebase Auth וגם ב-DB.
 */
export async function ensureFirebaseBootstrapUser(
  store: IAdminRepository,
  username: string,
  password: string,
): Promise<void> {
  if (!isFirebaseAuthEnabled()) {
    return
  }

  const firebaseUid = await createFirebaseUser(username, password)
  const existingUser = store.findUserByUsername(username)

  if (existingUser) {
    if (!existingUser.firebaseUid || existingUser.firebaseUid !== firebaseUid) {
      store.updateUser(existingUser.id, (currentUser) => ({
        ...currentUser,
        firebaseUid,
        updatedAtIso: new Date().toISOString(),
      }))
    }
    return
  }

  const organization = store.listOrganizations()[0]
  if (!organization) {
    throw new Error('לא קיים ארגון ברירת מחדל עבור bootstrap user.')
  }

  store.createUser({
    organizationId: organization.id,
    username,
    firebaseUid,
    passwordHash: hashPassword(password),
    role: USER_ROLES.superAdmin,
    allowedChannelIds: [],
    blockedChannelIds: [],
  })
}

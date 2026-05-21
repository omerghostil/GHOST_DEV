import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'
import { getAuth } from 'firebase-admin/auth'

const PROJECT_ID = 'ghost-prod-fc874'
const RTDB_URL = 'https://ghost-prod-fc874-default-rtdb.firebaseio.com'

function initAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as object
    return initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      databaseURL: RTDB_URL,
    })
  }

  // מצב ריצה על Cloud Functions — Application Default Credentials
  return initializeApp({
    projectId: PROJECT_ID,
    databaseURL: RTDB_URL,
  })
}

const adminApp = initAdminApp()

export const adminDb = getFirestore(adminApp)
export const adminRtdb = getDatabase(adminApp)
export const adminAuth = getAuth(adminApp)

export default adminApp

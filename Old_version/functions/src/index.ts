import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest } from 'firebase-functions/v2/https'
import { createApp } from '../../server/app'
import { FirestoreAdminRepository } from '../../server/db/firestore/firestore-repository'
import { FirebaseRealtimeHub } from '../../server/realtime/firebase-hub'
import { ensureFirebaseBootstrapUser } from '../../server/auth/firebase-auth-service'
import { ServerOperationScheduler } from '../../server/operations/operation-scheduler'

process.env.FIREBASE_PROJECT_ID = 'ghost-prod-fc874'

let appPromise: Promise<ReturnType<typeof createApp>> | null = null

setGlobalOptions({
  region: 'us-central1',
})

/**
 * מאתחל את ה-app פעם אחת עם Firestore + Firebase Realtime Hub.
 * Cold start בלבד — instance נשמר לבקשות הבאות.
 */
function getApp(): Promise<ReturnType<typeof createApp>> {
  if (appPromise) return appPromise
  appPromise = (async () => {
    const store = new FirestoreAdminRepository()
    await store.initialize()
    const bootstrapUsername = process.env.SUPER_ADMIN_USERNAME?.trim() || 'omeradmin'
    const bootstrapPassword = process.env.SUPER_ADMIN_PASSWORD?.trim() || 'omeradmin'
    try {
      await ensureFirebaseBootstrapUser(store, bootstrapUsername, bootstrapPassword)
    } catch (error) {
      console.warn('Firebase Auth bootstrap דילוג — משתמש bootstrap ייווצר עם hash מקומי.', error)
    }
    const realtimeHub = new FirebaseRealtimeHub()
    const scheduler = new ServerOperationScheduler(store)
    scheduler.start()
    return createApp(store, realtimeHub)
  })()
  return appPromise
}

export const api = onRequest(
  {
    memory: '512MiB',
    timeoutSeconds: 60,
    minInstances: 0,
  },
  async (req, res) => {
    const app = await getApp()
    app(req, res)
  },
)


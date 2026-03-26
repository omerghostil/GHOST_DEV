import 'dotenv/config'
import { createServer } from 'node:http'
import { createApp } from './app'
import { SQLiteAdminRepository } from './db/sqlite/sqlite-repository'
import { FirestoreAdminRepository } from './db/firestore/firestore-repository'
import { RealtimeHub } from './realtime/ws-hub'
import { FirebaseRealtimeHub } from './realtime/firebase-hub'
import type { IAdminRepository } from './db/repository-types'
import type { IRealtimeHub } from './realtime/realtime-hub-types'
import { ensureFirebaseBootstrapUser } from './auth/firebase-auth-service'

function readBootstrapCredentials(): { username: string; password: string } {
  return {
    username: process.env.SUPER_ADMIN_USERNAME?.trim() || 'omer',
    password: process.env.SUPER_ADMIN_PASSWORD?.trim() || 'ghostadmin8888',
  }
}

const SERVER_PORT = Number(process.env.PORT ?? 8787)
const IS_FIREBASE = Boolean(process.env.FIREBASE_PROJECT_ID)

async function bootstrap(): Promise<void> {
  let store: IAdminRepository
  let realtimeHub: IRealtimeHub

  if (IS_FIREBASE) {
    console.log('[server] מצב פרודקשן — Firebase Firestore + Realtime Database')
    const firestoreRepo = new FirestoreAdminRepository()
    await firestoreRepo.initialize()
    const bootstrapCredentials = readBootstrapCredentials()
    await ensureFirebaseBootstrapUser(firestoreRepo, bootstrapCredentials.username, bootstrapCredentials.password)
    store = firestoreRepo
    realtimeHub = new FirebaseRealtimeHub()
    const app = createApp(store, realtimeHub)
    const httpServer = createServer(app)
    httpServer.listen(SERVER_PORT, () => {
      console.log(`Vision proxy ready on http://localhost:${SERVER_PORT}`)
    })
  } else {
    console.log('[server] מצב פיתוח — SQLite + WebSocket')
    store = new SQLiteAdminRepository()
    const httpServer = createServer()
    realtimeHub = new RealtimeHub(httpServer)
    const app = createApp(store, realtimeHub)
    httpServer.on('request', app)
    httpServer.listen(SERVER_PORT, () => {
      console.log(`Vision proxy ready on http://localhost:${SERVER_PORT}`)
      if (!process.env.OPENAI_API_KEY) {
        console.warn('[server] אין OPENAI_API_KEY — נקודות /api יחזירו 503 עד להגדרת .env')
      }
    })
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[server] שגיאה בהפעלת השרת: ${message}`)
  process.exit(1)
})

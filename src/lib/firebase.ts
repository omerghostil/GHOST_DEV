import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyBuF9AcPj7W4iRhVuQAuyW00026i4NlhKs',
  authDomain: 'ghost-prod-fc874.firebaseapp.com',
  projectId: 'ghost-prod-fc874',
  storageBucket: 'ghost-prod-fc874.firebasestorage.app',
  messagingSenderId: '213626798667',
  appId: '1:213626798667:web:99ffd3db67cb9a7adf43ce',
  measurementId: 'G-WBPL66B3TD',
  databaseURL: 'https://ghost-prod-fc874-default-rtdb.firebaseio.com',
}

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const firebaseAuth = getAuth(firebaseApp)
export const realtimeDb = getDatabase(firebaseApp)

if (typeof window !== 'undefined') {
  void isSupported().then((supported) => {
    if (supported) {
      getAnalytics(firebaseApp)
    }
  })
}

export default firebaseApp

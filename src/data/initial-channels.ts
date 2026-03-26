import type { Channel } from '../types'

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'demo-channel',
    name: 'ערוץ להדגמה',
    type: 'personal',
    subtitle: 'מצלמה אישית',
    location: 'מיקום הדגמה',
    watchScope: 'ניטור בסיסי',
    description: 'ערוץ הדגמה יחיד לאתחול המערכת.',
    memoryInterval: 30,
    rtspFeed: 'rtsp://',
    unread: 0,
    liveState: 'LIVE',
    members: ['ערוץ להדגמה'],
    messages: [
      {
        id: 'demo-system-message',
        author: 'system',
        text: 'המערכת אותחלה עם ערוץ הדגמה יחיד.',
        time: '00:00',
      },
    ],
    operations: [],
  },
]

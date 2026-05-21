# Ghost (GPTScope) — בריף מפתחים מקיף

> **תאריך עדכון:** 27.03.2026  
> **גרסה:** `0.0.0`  
> **מקור אמת:** הקוד בפועל תחת `src/`, `server/`, `functions/`, `package.json`, `.env.example`

---

## 1) מטרת המסמך

המסמך מרכז תמונת מצב מלאה ומדויקת של מערכת Ghost כפי שהיא ממומשת — כל רכיב, כל תהליך, כל נתיב API, כל טבלה וכל שכבה ארכיטקטונית. נועד לאפשר למפתח חדש להבין את המערכת במלואה בלי לקרוא קוד.

---

## 2) תקציר מוצר

Ghost היא אפליקציית ניטור וידאו מבצעי (Camera Chat Ops) הכוללת:

- ממשק React RTL לניהול ערוצי מצלמות וצ'אט AI.
- שרת Express שמתווך בקשות ל-OpenAI לניתוח פריימים.
- לכידת פריימים מהמצלמה המקומית בדפדפן.
- סריקות מבצעים אוטומטיות לפי תזמון (alert/report/rating/assessment).
- ניתוח ציר זמן: דגימה, סינון רלוונטיות, בניית קולאז', ניתוח כרונולוגי.
- מרכז התראות קריטיות עם Flash Alert.
- פאנל סופר-אדמין לניהול ארגונים, משתמשים, חיוב ודשבורד.
- תמיכה מלאה ב-Multi-Tenant — כל ארגון מבודד עם מגבלות משלו.
- פריסה ל-Firebase Cloud Functions + Hosting בפרודקשן.

---

## 3) סטאק טכנולוגי

### Runtime

| ספריה | גרסה | תפקיד |
|-------|-------|--------|
| `react` | `^19.2.4` | ממשק משתמש |
| `react-dom` | `^19.2.4` | רנדור DOM |
| `express` | `^5.2.1` | שרת HTTP |
| `openai` | `^6.32.0` | SDK לקריאות OpenAI Responses API |
| `zod` | `^4.3.6` | ולידציית סכמות |
| `bullmq` | `^5.71.1` | תור עבודה (Redis) |
| `ioredis` | `^5.10.1` | לקוח Redis |
| `better-sqlite3` | `^12.8.0` | מסד נתונים מקומי |
| `firebase` | `^12.11.0` | SDK לקוח (Auth, RTDB) |
| `firebase-admin` | `^13.7.0` | SDK שרת (Firestore, Auth, RTDB) |
| `jsonwebtoken` | `^9.0.3` | JWT signing/verification |
| `sharp` | `^0.34.5` | אופטימיזציית תמונות |
| `ws` | `^8.20.0` | WebSocket שרת |
| `@tensorflow/tfjs` | `^4.22.0` | TensorFlow.js |
| `@tensorflow-models/coco-ssd` | `^2.2.3` | זיהוי אובייקטים |
| `cors` | `^2.8.6` | CORS middleware |
| `dotenv` | `^17.3.1` | משתני סביבה |

### Dev

| כלי | גרסה | תפקיד |
|-----|-------|--------|
| `vite` | `^8.0.1` | Bundler ו-Dev Server |
| `typescript` | `~5.9.3` | טיפוסים סטטיים |
| `vitest` | `^4.1.1` | בדיקות יחידה |
| `eslint` | `^9.39.4` | Linting |
| `tsx` | `^4.21.0` | הרצת TypeScript ב-Node |
| `concurrently` | `^9.2.1` | הרצה מקבילית |
| `jsdom` | `^29.0.1` | סביבת DOM לבדיקות |

---

## 4) סקריפטים (`package.json`)

| סקריפט | פקודה | תיאור |
|---------|-------|--------|
| `dev` | `concurrently -k "vite" "tsx watch server/index.ts"` | לקוח + שרת במקביל |
| `dev:client` | `vite` | לקוח בלבד |
| `dev:server` | `tsx watch server/index.ts` | שרת בלבד |
| `dev:all` | `npm run dev` | alias |
| `build` | `tsc -b && vite build` | בניית לקוח (ל-`dist/`) |
| `lint` | `eslint .` | בדיקת קוד |
| `test` | `vitest run` | הרצת בדיקות |
| `preview` | `vite preview` | תצוגה מקדימה של build |

---

## 5) ארכיטקטורת המערכת

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│  RootApp → LoginPage / App / SuperAdminPanel                │
│  Services: auth-api, channels-api, admin-api, vision-chat   │
│  WebSocket: realtime-socket → /ws/admin-realtime             │
└───────────────┬───────────────────────────┬─────────────────┘
                │ REST /api/*               │ WebSocket
                ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Express Server                           │
│  app.ts → Routers: auth, admin, channels, issues            │
│  AI: chat-vision, operation-scan, frame-relevance, collage  │
│  Middleware: cors, json(12MB), requireAuth, requireRoles     │
└──────┬──────────┬──────────┬──────────┬─────────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
   ┌───────┐ ┌────────┐ ┌────────┐ ┌──────────┐
   │ SQLite│ │Firestore│ │BullMQ +│ │  OpenAI  │
   │ (dev) │ │ (prod) │ │ Redis  │ │Responses │
   └───────┘ └────────┘ └────────┘ └──────────┘
                              │
                         ┌────┴────┐
                         │Realtime │
                         │Hub (WS/ │
                         │Firebase │
                         │ RTDB)   │
                         └─────────┘
```

### תהליך בחירת סביבה (`server/index.ts`)

בזמן bootstrap, השרת בוחר מימוש לפי משתני סביבה:

- **`FIREBASE_PROJECT_ID` מוגדר** → `FirestoreAdminRepository` + `FirebaseRealtimeHub` (RTDB)
- **ללא `FIREBASE_PROJECT_ID`** → `SQLiteAdminRepository` + `RealtimeHub` (WebSocket)

בשני המקרים נוצר `ServerOperationScheduler` לסריקות מתוזמנות.

---

## 6) מבנה פרויקט

### שורש

```
ghost_prod/
├── src/                    # צד לקוח (React)
├── server/                 # צד שרת (Express + Node)
├── functions/              # Firebase Cloud Functions
├── public/                 # נכסים סטטיים (PWA icons, manifest)
├── stress-tests/           # בדיקות עומס (k6)
├── index.html              # SPA entry point (RTL, he)
├── package.json            # תלויות וסקריפטים
├── firebase.json           # הגדרות Firebase (Hosting, Functions, Firestore, RTDB)
├── .firebaserc             # פרויקט Firebase: ghost-prod-fc874
├── firestore.rules         # כללי Firestore (הכל false — גישה רק מ-Functions)
├── firestore.indexes.json  # אינדקסים מורכבים
├── database.rules.json     # כללי Realtime Database
├── .env.example            # משתני סביבה לדוגמה
├── vite.config.ts          # Vite + proxy /api → localhost:8787
├── vitest.config.ts        # Vitest + jsdom + globals
├── tsconfig.json           # TypeScript composite references
├── tsconfig.app.json       # TS config ל-src/ (React)
├── tsconfig.node.json      # TS config ל-vite.config.ts
└── eslint.config.js        # ESLint flat config
```

### צד לקוח (`src/`)

```
src/
├── main.tsx                # נקודת כניסה — createRoot → RootApp
├── App.tsx                 # אורקסטרציה מרכזית — ניהול ערוצים, צ'אט, מבצעים
├── App.css / index.css     # סגנונות גלובליים
├── types.ts                # טיפוסי לקוח: Channel, Message, Operation, Timeline
├── types/
│   └── admin.ts            # טיפוסי אדמין: AuthProfile, OrganizationSummary
├── data/
│   └── constants.ts        # קבועים: TIMELINE_INTERVALS, OPERATION_MODES, QUICK_PROMPTS
├── lib/
│   └── firebase.ts         # אתחול Firebase client (Auth, RTDB, Analytics)
├── components/
│   ├── root-app.tsx        # ניתוב: Login → App / SuperAdminPanel לפי תפקיד
│   ├── login-page.tsx      # מסך התחברות עם ghost-access combo
│   ├── topbar.tsx          # סרגל עליון: מטריקות, ניווט, חיפוש
│   ├── account-menu.tsx    # תפריט חשבון (שם, תפקיד, יציאה)
│   ├── inbox-panel.tsx     # רשימת ערוצים עם חיפוש וקיבוץ
│   ├── channel-card.tsx    # כרטיס ערוץ ברשימה
│   ├── chat-panel.tsx      # צ'אט: הודעות, countdown, שליחה, timeline
│   ├── message-row.tsx     # שורת הודעה בודדת
│   ├── details-panel.tsx   # פרטי ערוץ ומבצעים
│   ├── channels-hub.tsx    # ניהול ערוצים: יצירה, עריכה, מבצעים
│   ├── timeline-controls.tsx # בקרי דגימת ציר זמן
│   ├── critical-alerts-center.tsx # מרכז התראות קריטיות
│   ├── flash-alert-overlay.tsx # התראת Flash (popup אדום)
│   ├── status-dot.tsx      # נקודת סטטוס צבעונית
│   ├── super-admin-panel.tsx # פאנל סופר-אדמין מלא
│   ├── app-footer.tsx      # פוטר עם שעון חי
│   └── *.css               # סגנונות לפי רכיב
├── hooks/
│   ├── use-operation-scheduler.ts # תזמון סריקות מבצעים (צד לקוח)
│   └── use-timeline-sampler.ts   # דגימת ציר זמן + קולאז'
├── services/
│   ├── http-client.ts      # שכבת fetch עם auth + refresh אוטומטי
│   ├── auth-api.ts         # login, ghostAccess, impersonate, me
│   ├── channels-api.ts     # CRUD ערוצים, הודעות, מבצעים
│   ├── admin-api.ts        # dashboard, organizations, users, billing, usage
│   ├── issues-api.ts       # דיווח תקלות
│   ├── realtime-socket.ts  # WebSocket + polling fallback
│   ├── camera-frame.ts     # לכידת פריים מהמצלמה
│   ├── vision-chat.ts      # צ'אט ויז'ן
│   ├── operation-scan.ts   # סריקת מבצעים
│   ├── frame-relevance.ts  # בדיקת רלוונטיות פריים
│   ├── collage-builder.ts  # בניית קולאז' מפריימים
│   ├── timeline-analysis.ts # ניתוח ציר זמן
│   └── schedule-parser.ts  # פענוח תזמונים (interval / time-slots)
└── utils/
    ├── auth-session.ts     # sessionStorage: טוקנים, פרופיל
    ├── critical-alerts.ts  # ניתוח וניהול התראות קריטיות
    ├── alert-popup-rate-limit.ts # הגבלת קצב פופאפים
    ├── group-channel.ts    # עזר לערוצים קבוצתיים
    ├── ghost-reply.ts      # בניית תגובת Ghost
    └── time.ts             # פונקציות זמן
```

### צד שרת (`server/`)

```
server/
├── index.ts                # Bootstrap: בחירת DB + Hub, הרצת שרת HTTP
├── app.ts                  # createApp: Express, routers, AI endpoints, health
├── schemas.ts              # סכמות Zod משותפות (vision, scan)
├── queue-manager.ts        # BullMQ/direct, retries, timeout, circuit breaker
├── circuit-breaker.ts      # מחלקת CircuitBreaker
├── vision-handler.ts       # קריאות OpenAI Responses API, הגנת disclosure
├── image-optimizer.ts      # Sharp: דחיסת תמונות לפי פרופיל
├── model-selector.ts       # בחירת מודל ורמת detail
├── frame-detector.ts       # זיהוי אובייקטים (TF.js + COCO-SSD)
├── frame-relevance-route.ts # route handler (לא מחובר כרגע)
├── admin/
│   ├── create-admin-router.ts   # /api/admin/* (20+ endpoints)
│   ├── create-auth-router.ts    # /api/auth/* (6 endpoints)
│   ├── schemas.ts               # סכמות Zod לאדמין
│   ├── types.ts                 # טיפוסי שרת: UserRecord, OrganizationRecord וכו'
│   └── sync-org-usage.ts        # חישוב וסנכרון שימוש ארגוני
├── auth/
│   ├── jwt-service.ts           # JWT: sign/verify access+refresh
│   └── firebase-auth-service.ts # Firebase Auth: יצירת/אימות משתמשים
├── channels/
│   ├── create-channels-router.ts # /api/channels/* (9 endpoints)
│   └── schemas.ts               # סכמות Zod לערוצים
├── issues/
│   └── create-issues-router.ts  # POST /api/issues
├── middleware/
│   ├── auth-guard.ts            # requireAuth, requireRoles
│   └── tenant-context.ts       # extractTenantContext מ-JWT
├── operations/
│   └── operation-scheduler.ts   # ServerOperationScheduler — polling 30s
├── realtime/
│   ├── realtime-hub-types.ts    # IRealtimeHub interface
│   ├── ws-hub.ts                # WebSocket hub (dev)
│   └── firebase-hub.ts         # Firebase RTDB hub (prod)
├── security/
│   └── crypto-utils.ts         # bcrypt-like hash, AES encrypt/decrypt, PAN mask
├── db/
│   ├── repository-types.ts     # IAdminRepository — חוזה 50+ מתודות
│   ├── admin-data-store.ts     # אחסון JSON מקומי (ישן)
│   ├── sync-intent.ts          # כוונת סנכרון עתידי (no-op)
│   ├── sqlite/
│   │   ├── schema.ts           # DDL: 14 טבלאות, מיגרציות v1→v4
│   │   └── sqlite-repository.ts # מימוש SQLite ל-IAdminRepository
│   └── firestore/
│       └── firestore-repository.ts # מימוש Firestore + cache
└── lib/
    └── firebase-admin.ts       # אתחול firebase-admin (Firestore, RTDB, Auth)
```

---

## 7) מסד נתונים

### מבנה כפול: SQLite (פיתוח) / Firestore (פרודקשן)

שניהם מממשים את `IAdminRepository` — חוזה של 50+ מתודות.

### טבלאות (SQLite) / אוספים (Firestore)

#### `organizations` — ארגונים

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | TEXT PK | UUID |
| `name` | TEXT | שם הארגון |
| `status` | TEXT | `active` / `suspended` |
| `allowed_models` | TEXT (JSON) | רשימת מודלים מותרים |
| `encrypted_openai_api_key` | TEXT NULL | מפתח OpenAI מוצפן |
| `openai_usage_usd` | REAL | שימוש OpenAI במסגרת הארגון |
| `max_channels` | INTEGER | מגבלת ערוצים |
| `max_messages_per_channel_per_month` | INTEGER | מגבלת הודעות חודשית |
| `monthly_charge_amount` | REAL | חיוב חודשי |
| `max_agents_total_cost` / `max_ai_total_cost` / `max_api_total_cost` | REAL | תקרות עלות |
| `sent_messages` / `received_messages` / `devices_count` / `channels_count` / `operations_count` | INTEGER | מוני שימוש אגרגטיים |
| `ai_total_cost` / `api_total_cost` / `agents_total_cost` | REAL | עלויות מצטברות |
| `usage_updated_at_iso` | TEXT | חותמת עדכון אחרון |

#### `users` — משתמשים

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | TEXT PK | UUID |
| `organization_id` | TEXT FK | ארגון |
| `username` | TEXT UNIQUE | שם משתמש |
| `first_name` / `last_name` | TEXT | שם מלא |
| `password_hash` | TEXT | סיסמה מגובבת |
| `role` | TEXT | `super_admin` / `system_manager` / `regular_user` |
| `allowed_channel_ids` / `blocked_channel_ids` | TEXT (JSON) | הרשאות ערוצים |
| `is_active` | INTEGER | פעיל/לא |
| `firebase_uid` | TEXT NULL | קישור ל-Firebase Auth (אם קיים) |
| `last_login_at_iso` | TEXT NULL | התחברות אחרונה |

#### `channel_data` — ערוצים עשירים

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | TEXT PK | UUID |
| `organization_id` | TEXT FK | ארגון |
| `name` / `subtitle` / `location` / `watch_scope` / `description` | TEXT | מטא-נתונים |
| `type` | TEXT | `personal` / `group` |
| `memory_interval` | INTEGER | מרווח זיכרון (שניות) |
| `rtsp_feed` | TEXT | כתובת RTSP |
| `live_state` | TEXT | `LIVE` / `SYNC` / `DEGRADED` / `OFFLINE` |
| `camera_enabled` | INTEGER | מצלמה פעילה |
| `linked_channel_ids` / `members` | TEXT (JSON) | ערוצים מקושרים וחברים |

#### `messages` — הודעות

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | TEXT PK | UUID |
| `organization_id` / `user_id` / `channel_id` | TEXT FK | שייכות |
| `author` | TEXT | `user` / `ghost` / `system` |
| `text` / `time` | TEXT | תוכן וחותמת |
| `alert_level` | TEXT NULL | רמת התראה |
| `score` | REAL NULL | ציון |
| `frame_data_url` / `sources` | TEXT NULL | פריים ומקורות |

#### `channel_operations` — מבצעים

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | TEXT PK | UUID |
| `organization_id` / `channel_id` | TEXT FK | שייכות |
| `name` / `mode` / `schedule` / `trigger_text` / `action` | TEXT | הגדרת מבצע |
| `model_override` / `detail_level` / `parsed_schedule` | TEXT NULL | אופציונלי |
| `enabled` | INTEGER | פעיל/לא |

#### `operation_runs` — הרצות מבצעים

| שדה | סוג | תיאור |
|-----|------|--------|
| `id` | TEXT PK | UUID |
| `organization_id` / `channel_id` / `operation_id` | TEXT FK | שייכות |
| `status` | TEXT | `queued` / `running` / `success` / `failed` |
| `started_at_iso` / `ended_at_iso` | TEXT | זמנים |
| `error_code` / `error_message` | TEXT NULL | כשל |

#### טבלאות נוספות

| טבלה | תיאור |
|------|--------|
| `channels` | ערוצים בסיסיים (admin) — `id`, `organization_id`, `name`, `is_blocked` |
| `campaigns` | קמפיינים — `id`, `organization_id`, `name`, `is_active` |
| `payment_cards` | כרטיסי תשלום — PAN מוצפן, cardholder, expiry, email |
| `usage_ledger` | יומן שימוש — `metric_type` (openai/api/agent/message), `amount`, `details` |
| `channel_usage_monthly` | מוני שימוש חודשיים פר ערוץ — `outgoing_user`, `incoming_ghost`, `incoming_system`, `incoming_operations` |
| `usage_events` | אירועי שימוש — `event_type`, `direction`, `source`, `count` |
| `issues` | תקלות — `title`, `description`, `severity`, `status` |
| `audit_logs` | לוג ביקורת — `action`, `target_type`, `target_id`, `details` |
| `refresh_tokens` | טוקני רענון — `token_id`, `user_id`, `expires_at_unix` |

### סכמת מיגרציה

גרסת סכמה נוכחית: **4**. מיגרציות:
- **v1→v2:** הוספת `channel_data`, `messages`, `channel_operations`, `operation_runs` + אינדקסים.
- **v2→v3:** הוספת `operations_count` ל-`organizations`.
- **v3→v4:** הוספת `first_name`, `last_name` ל-`users`.

### Firestore — מבנה subcollections

```
organizations/{orgId}
  ├── channel_data/{channelId}
  │   ├── operations/{opId}
  │   └── operation_runs/{runId}
  └── users/{userId}
      └── channel_data/{channelId}
          └── messages/{msgId}
```

אוספים שטוחים ברמה העליונה: `organizations`, `users`, `channels`, `campaigns`, `payment_cards`, `usage_ledger`, `channel_usage_monthly`, `usage_events`, `issues`, `audit_logs`, `refresh_tokens`.

---

## 8) כללי אבטחה (Firebase)

### Firestore Rules (`firestore.rules`)
- כל קריאה/כתיבה: **`false`** — גישה אפשרית רק דרך Admin SDK (Cloud Functions).

### Realtime Database Rules (`database.rules.json`)
```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "realtime": {
      "$orgId": { ".read": false, ".write": false }
    }
  }
}
```
גישה לכתיבה רק דרך Admin SDK ב-`FirebaseRealtimeHub`.

### Firestore Indexes (`firestore.indexes.json`)
אינדקסים מורכבים על: `users` (organizationId + __name__), `channels` (organizationId), `usage_ledger` (organizationId + createdAtIso), `issues` (organizationId + status), `audit_logs` (actorUserId + createdAtIso), `channel_usage_monthly` (organizationId + monthKey).

---

## 9) API — רשימה מלאה

### אימות (`/api/auth`)

| שיטה | נתיב | Middleware | תיאור |
|-------|-------|-----------|--------|
| POST | `/api/auth/ghost-access` | — | טוקנים למשתמש bootstrap (ללא סיסמה) |
| POST | `/api/auth/login` | — | התחברות: username + password → JWT |
| POST | `/api/auth/refresh` | — | רענון access token מ-refresh token |
| POST | `/api/auth/logout` | `requireAuth` | ביטול refresh token |
| POST | `/api/auth/impersonate` | `requireAuth` | התחזות (super_admin בלבד) |
| GET | `/api/auth/me` | `requireAuth` | פרופיל מ-JWT |

### ניהול (`/api/admin`) — כל הנתיבים דורשים `requireAuth`

| שיטה | נתיב | הרשאות | תיאור |
|-------|-------|--------|--------|
| GET | `/organizations` | superAdmin, systemManager | רשימת ארגונים |
| POST | `/organizations` | superAdmin | יצירת ארגון |
| PATCH | `/organizations/:id` | superAdmin | עדכון ארגון |
| GET | `/users` | superAdmin, systemManager | רשימת משתמשים |
| POST | `/users` | superAdmin, systemManager | יצירת משתמש (+ Firebase Auth אופציונלי) |
| PATCH | `/users/:id` | superAdmin, systemManager | עדכון משתמש |
| GET | `/channels` | superAdmin, systemManager | ערוצים בסיסיים |
| POST | `/channels` | superAdmin, systemManager | יצירת ערוץ + בדיקת מגבלת maxChannels |
| GET | `/campaigns` | superAdmin, systemManager | קמפיינים |
| POST | `/campaigns` | superAdmin, systemManager | יצירת קמפיין |
| PUT | `/billing/payment-card` | superAdmin | שמירת כרטיס (PAN מוצפן + קוד מנהל) |
| POST | `/billing/reveal-card` | superAdmin | חשיפת PAN (עם קוד מנהל) |
| PUT | `/billing/openai-key` | superAdmin | שמירת מפתח OpenAI מוצפן |
| POST | `/usage/record` | superAdmin, systemManager | עדכון מוני שימוש + ledger + realtime |
| POST | `/usage/channel-message` | superAdmin, systemManager | מוני שימוש חודשיים פר ערוץ |
| POST | `/usage/reconcile` | superAdmin | reconciliation — חישוב מחדש לכל הארגונים |
| GET | `/dashboard/overview` | superAdmin, systemManager | סיכום כולל + sync שימוש |
| GET | `/dashboard/org/:id` | superAdmin, systemManager | דשבורד ארגון מפורט |
| GET | `/issues` | superAdmin, systemManager | תקלות |
| PATCH | `/issues/:id` | superAdmin, systemManager | עדכון סטטוס תקלה |
| GET | `/audit-logs` | superAdmin | יומני ביקורת |

### ערוצים (`/api/channels`) — `requireAuth` + `extractTenantContext`

| שיטה | נתיב | תיאור |
|-------|-------|--------|
| GET | `/` | רשימת ערוצים מלאים + הודעות (50) + מבצעים |
| GET | `/:id` | ערוץ בודד + הודעות + מבצעים |
| POST | `/` | יצירת ערוץ מלא |
| PATCH | `/:id` | עדכון ערוץ |
| DELETE | `/:id` | מחיקת ערוץ + sync שימוש |
| POST | `/:id/messages` | שליחת הודעה |
| POST | `/:id/operations` | יצירת מבצע |
| PATCH | `/:id/operations/:opId` | עדכון מבצע |
| DELETE | `/:id/operations/:opId` | מחיקת מבצע |

### תקלות (`/api/issues`)

| שיטה | נתיב | Middleware | תיאור |
|-------|-------|-----------|--------|
| POST | `/` | `requireAuth` | דיווח תקלה + audit + realtime |

### AI Endpoints (ב-`app.ts`)

| שיטה | נתיב | Middleware | תיאור |
|-------|-------|-----------|--------|
| POST | `/api/chat-vision` | `requireAuth` | צ'אט ויז'ן → `enqueueVisionChat` (BullMQ/direct) |
| POST | `/api/operation-scan` | `requireAuth` | סריקת מבצעים → `enqueueOperationScan` |
| POST | `/api/frame-relevance` | `requireAuth` | בדיקת רלוונטיות פריים → OpenAI (תור סידרתי) |
| POST | `/api/collage-analysis` | `requireAuth` | ניתוח קולאז' → OpenAI (תור סידרתי) |

### מוניטורינג

| שיטה | נתיב | Middleware | תיאור |
|-------|-------|-----------|--------|
| GET | `/api/health` | — | `{ ok, uptime, memory: { heapUsed, heapTotal, rss } }` |
| GET | `/api/queue-health` | — | מצב תור, circuit breaker, קונפיגורציה |

### WebSocket

| נתיב | תיאור |
|-------|--------|
| `/ws/admin-realtime` | שידור אירועי realtime (ללא אימות) |

אירועים: `usage.updated`, `billing.threshold_exceeded`, `issue.created`, `issue.updated`, `org.health.changed`.

---

## 10) אימות והרשאות

### JWT

- **Access Token:** חתום עם `JWT_ACCESS_SECRET`, מכיל: `userId`, `organizationId`, `organizationName`, `role`, `username`, `firstName`, `lastName`.
- **Refresh Token:** חתום עם `JWT_REFRESH_SECRET`, מכיל: `tokenId`, `userId`, `expiresAtUnix`.
- **מחזור:** login → access + refresh. פקיעת access → refresh אוטומטי מהלקוח (`http-client.ts`). כשל → ניקוי סשן והפניה ל-login.

### תפקידים (`USER_ROLES`)

| תפקיד | גישה |
|--------|------|
| `super_admin` | הכל — ניהול ארגונים, משתמשים, חיוב, audit, התחזות |
| `system_manager` | ניהול בתוך הארגון שלו — משתמשים, ערוצים, דשבורד |
| `regular_user` | ערוצים, צ'אט, מבצעים — בתוך הארגון שלו בלבד |

### Bootstrap User

בעלייה ראשונה של השרת, נוצר אוטומטית משתמש `super_admin` לפי `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` מ-`.env`.

### Firebase Auth (אופציונלי)

בעת יצירת משתמש, אם Firebase Auth מוגדר — נוצר משתמש ב-Firebase וה-`firebaseUid` נשמר. ב-login, אם למשתמש יש `firebaseUid` — מנסה אימות דרך Firebase Auth, עם fallback לסיסמה מקומית.

---

## 11) תור עבודה, יציבות ועומסים

### Queue Manager (`server/queue-manager.ts`)

שני מצבים:
- **`redis`** (כש-`REDIS_URL` מוגדר): BullMQ Workers עם `limiter` — `max` = `QUEUE_RATE_LIMIT_RPM` (ברירה 50), `duration` 60s, `concurrency` מ-`QUEUE_CONCURRENCY` (ברירה 2).
- **`direct`** (ללא Redis): ביצוע ישיר עם `runWithRetries`.

### Circuit Breaker (`server/circuit-breaker.ts`)

- עוטף קריאות AI.
- `failureThreshold` → פתיחת מעגל.
- `halfOpenDelay` → ניסיון חוזר.
- `successThreshold` → סגירה.
- שלושה מצבים: `CLOSED` → `OPEN` → `HALF_OPEN` → `CLOSED`.

### Retry Logic

- תור BullMQ: `attempts: 3`.
- `runWithRetries`: exponential backoff.
- `requestFrameRelevanceWithRetry` / `requestCollageAnalysisWithRetry`: 2 retries, backoff `450ms * attempt`.

### Timeouts

- `OPENAI_TIMEOUT_MS` = 20,000ms (ויז'ן + frame relevance).
- `OPENAI_COLLAGE_TIMEOUT_MS` = 30,000ms (קולאז').
- `timeoutMs` לתור BullMQ = 25,000ms.

### תור סידרתי

`frame-relevance` ו-`collage-analysis` רצים דרך `enqueueTask` — תור סידרתי בזיכרון למניעת הצפת OpenAI.

---

## 12) Realtime

### פיתוח: WebSocket Hub

- `RealtimeHub` — `WebSocketServer` על `/ws/admin-realtime`.
- שידור JSON לכל הלקוחות המחוברים.
- **אין אימות** — כל חיבור מתקבל.

### פרודקשן: Firebase Realtime Database Hub

- `FirebaseRealtimeHub` — כתיבה ל-`realtime/{organizationId}/events` עם `expiresAtMs` (~60s TTL).
- הלקוח ב-`super-admin-panel.tsx` מתחבר ל-WebSocket או polling fallback (12s).

### אירועים

`usage.updated`, `billing.threshold_exceeded`, `issue.created`, `issue.updated`, `org.health.changed`.

---

## 13) Operation Scheduler

### צד שרת (`ServerOperationScheduler`)

- Polling כל 30 שניות.
- שולף מבצעים שזמנם הגיע (`listRunnableOperations`).
- נעילה (`acquireOperationRunLock`) → ביצוע → `completeOperationRun` / `failOperationRun`.
- Timeout הרצה: 60 שניות.
- דילוג אחרי כשלים רצופים.

### צד לקוח (`useOperationScheduler`)

- Hook שרץ בדפדפן.
- מזהה מבצעים שזמנם הגיע לפי `parseSchedule` + `getNextRunMs`.
- לוכד פריים מהמצלמה → שולח `requestOperationScan` → מפעיל callback עם תוצאות.

---

## 14) תהליך דגימת ציר זמן

1. **התחלה:** משתמש לוחץ על דגימה (2/4/8 שניות) ← `useTimelineSampler`.
2. **דגימה:** לכידת פריימים מהמצלמה בקצב הנבחר ← `captureLatestCameraFrame`.
3. **סינון רלוונטיות:** כל פריים נבדק דרך `checkFrameRelevance` → `POST /api/frame-relevance` → OpenAI.
4. **בניית קולאז':** פריימים רלוונטיים → `buildCollageFromFrames` → JPEG מרוכב עם חותמות זמן.
5. **ניתוח כרונולוגי:** `requestTimelineAnalysis` → `POST /api/collage-analysis` → OpenAI → סיכום כתוב.
6. **תוצאה:** `TimelineAnalysis` נשמר בהיסטוריה לתצוגה.

---

## 15) תהליך אימות (Auth Flow)

1. **Login:** משתמש מזין username + password → `POST /api/auth/login`.
2. **אימות:** שרת בודק סיסמה (Firebase Auth / local hash).
3. **טוקנים:** `signAccessToken` + `signRefreshToken` → נשמרים ב-`sessionStorage`.
4. **בקשות:** `http-client.ts` מצרף `Authorization: Bearer <access>` לכל בקשה.
5. **401:** ריענון אוטומטי דרך `POST /api/auth/refresh`.
6. **כשל בריענון:** `clearAuthSession()` → חזרה ל-Login.
7. **Ghost Access:** Combo key בדף ה-Login → `POST /api/auth/ghost-access` → כניסה ישירה כ-bootstrap user.
8. **Impersonation:** סופר-אדמין → `POST /api/auth/impersonate` → טוקנים של משתמש יעד. נתמך גם דרך `#impersonate=<base64>` ב-URL.

---

## 16) ניתוב צד לקוח

`RootApp` הוא שער הכניסה:

1. **אין סשן** → `LoginPage`.
2. **`super_admin`** → `SuperAdminPanel` (דשבורד ניהולי מלא).
3. **`system_manager` / `regular_user`** → `App` (ממשק ערוצים וצ'אט).

`App` עצמו מנהל ניווט פנימי (mobile/desktop):
- **Inbox** — רשימת ערוצים.
- **Chat** — צ'אט עם ערוץ נבחר.
- **Details** — פרטי ערוץ ומבצעים.
- **Channels Hub** — ניהול ערוצים.
- **Command Center** — מרכז התראות קריטיות.

---

## 17) Firebase — פריסה

### מבנה (`firebase.json`)

- **Hosting:** `dist/` → SPA rewrites + Cache headers.
- **Functions:** `functions/` → Cloud Function `api` (v2, `us-central1`, 512MiB, 60s timeout).
- **Rewrites:** `/api/**` → Function `api`; כל השאר → `index.html`.

### Cloud Function (`functions/src/index.ts`)

- קובע `FIREBASE_PROJECT_ID = 'ghost-prod-fc874'`.
- יוצר `FirestoreAdminRepository` + `FirebaseRealtimeHub` + `ServerOperationScheduler`.
- מייצא `api` כ-`onRequest` — מעביר כל בקשה לאותו Express app.
- `minInstances: 0` — cold start אפשרי.

### פרויקט Firebase

- Default: `ghost-prod-fc874` (מ-`.firebaserc`).
- Hosting target: `prod`.

---

## 18) משתני סביבה (`.env.example`)

| משתנה | ערך ברירה | תיאור |
|--------|-----------|--------|
| `OPENAI_API_KEY` | — | מפתח OpenAI (חובה לניתוח) |
| `PORT` | `8787` | פורט שרת |
| `REDIS_URL` | `redis://localhost:6379` | חיבור Redis (אופציונלי) |
| `OPENAI_MODEL_DEFAULT` | `gpt-4.1-mini` | מודל ברירת מחדל |
| `OPENAI_MODEL_COMPLEX` | `gpt-4.1` | מודל מורכב |
| `QUEUE_CONCURRENCY` | `2` | מקביליות תור |
| `QUEUE_RATE_LIMIT_RPM` | `50` | מגבלת קצב תור |
| `SUPER_ADMIN_USERNAME` | `omer` | שם משתמש bootstrap |
| `SUPER_ADMIN_PASSWORD` | `ghostadmin8888` | סיסמת bootstrap |
| `SUPER_ADMIN_MANAGER_CODE` | `1553` | קוד מנהל (חשיפת PAN) |
| `GHOST_FIREBASE_WEB_API_KEY` | — | מפתח Firebase web |
| `JWT_ACCESS_SECRET` | — | סוד JWT access |
| `JWT_REFRESH_SECRET` | — | סוד JWT refresh |
| `ADMIN_ENCRYPTION_SECRET` | — | סוד הצפנה (AES) |

---

## 19) אבטחה (`server/security/crypto-utils.ts`)

| פונקציה | תיאור |
|---------|--------|
| `hashPassword(plain)` | גיבוב סיסמה (crypto-based) |
| `verifyPassword(plain, hash)` | אימות סיסמה |
| `encryptSensitiveValue(value)` | הצפנת AES (מפתח OpenAI, PAN) |
| `decryptSensitiveValue(encrypted)` | פענוח AES |
| `maskPan(pan)` | מיסוך מספר כרטיס (****1234) |

סודות ההצפנה מ-`ADMIN_ENCRYPTION_SECRET`.

---

## 20) PWA

### Manifest (`public/manifest.webmanifest`)

- שם: `Ghost`
- Display: `standalone`, Orientation: `portrait`
- רקע/ערכת נושא: `#000000`
- אייקונים: 192px, 512px עם `purpose: "any maskable"`

### `index.html`

- `lang="he"`, `dir="rtl"`
- Theme color: `#000000`
- Apple meta tags ל-PWA
- כותרת: `Ghost | Camera Chat Ops`

---

## 21) בדיקות

### מסגרת: Vitest + jsdom

### בדיקות שרת (10 קבצים)

| קובץ | מה נבדק |
|------|---------|
| `server/circuit-breaker.test.ts` | פתיחת/סגירת מעגל, half-open, reset |
| `server/frame-detector.test.ts` | threshold, חילוץ buffer, זיהוי async |
| `server/frame-relevance-route.test.ts` | HTTP 200/400/502 |
| `server/image-optimizer.test.ts` | דחיסת JPEG, בחירת פרופיל |
| `server/model-selector.test.ts` | טריגר מורכב, בחירת מודל/detail |
| `server/queue-manager.test.ts` | מצב direct, קריאת env |
| `server/vision-handler-guard.test.ts` | הגנת disclosure |
| `server/db/sqlite/sqlite-repository.test.ts` | CRUD מלא לכל הטבלאות |
| `server/db/sqlite/sqlite-channels.test.ts` | ערוצים עשירים, הודעות, מבצעים, cascade delete |
| `server/db/sqlite/sqlite-usage-sync.test.ts` | compute, sync, reconcile שימוש |

### בדיקות לקוח (11 קבצים)

| קובץ | מה נבדק |
|------|---------|
| `src/components/login-page.test.tsx` | רנדור, שגיאות, callback |
| `src/components/critical-alerts-center.test.tsx` | הצגת פריים, כרטיסים |
| `src/services/camera-frame.test.ts` | לכידת פריים |
| `src/services/collage-builder.test.ts` | בניית קולאז' JPEG |
| `src/services/frame-relevance.test.ts` | בדיקת רלוונטיות |
| `src/services/operation-scan.test.ts` | סריקת מבצעים |
| `src/services/timeline-analysis.test.ts` | ניתוח ציר זמן |
| `src/services/vision-chat.test.ts` | צ'אט ויז'ן |
| `src/utils/auth-sess ion.test.ts` | ניהול סשן |
| `src/utils/alert-popup-rate-limit.test.ts` | הגבלת קצב פופאפים |
| `src/utils/critical-alerts.test.ts` | פענוח התראות |

### בדיקות עומס (`stress-tests/`)

7 תרחישי k6: auth-flow, channels-crud, admin-dashboard, ai-endpoints, websocket-load, mixed-workload, payload-limits. דוח אוטומטי בעברית ב-`reports/`.

---

## 22) תהליך בניית OpenAI Client

כל קריאה ל-OpenAI עוברת בחירת מפתח:

1. אם הבקשה מכילה `organizationId` → בדיקה אם לארגון יש `encryptedOpenAiApiKey`.
2. יש → פענוח ויצירת `OpenAI({ apiKey: orgKey })`.
3. אין (או כשל פענוח) → fallback למפתח הגלובלי `OPENAI_API_KEY`.
4. אין גם גלובלי → 503.

---

## 23) Image Optimization Pipeline

```
Data URL → decodeImageDataUrl → Buffer
  → sharp().resize(maxDim).jpeg({ quality }) → Buffer
  → base64 → optimized Data URL
```

פרופילים: `chat-vision` (640px, quality 60), `operation-scan` (480px, quality 55), `frame-relevance` (320px, quality 50), `collage` (1024px, quality 65).

---

## 24) Usage Sync & Reconciliation

### `syncOrganizationUsage`

1. `computeOrganizationUsage` — סופר ערוצים, הודעות (sent/received), מבצעים מה-DB.
2. מעדכן את `organization.usage` בהתאם.

### `reconcileAllOrganizations`

- מריץ `sync` לכל ארגון.
- מחזיר דוח diff לכל ארגון (ערכים לפני/אחרי).

### `recordChannelMessage`

- `incrementChannelUsage` — מונה חודשי פר ערוץ לפי direction + source.
- `addUsageEvent` — אירוע שימוש.

---

## 25) Vite Configuration

```typescript
// vite.config.ts
plugins: [react()]
server.proxy: { '/api': 'http://localhost:8787' }
```

בפיתוח, Vite מפרוקסי את כל `/api/*` לשרת ה-Express המקומי.

---

## 26) TypeScript Configuration

- **Composite** — `tsconfig.json` מפנה ל-`tsconfig.app.json` (React) + `tsconfig.node.json` (Vite).
- **App:** target ES2023, lib ES2023+DOM, jsx react-jsx, strict, noEmit, verbatimModuleSyntax.
- **Functions:** `tsconfig.json` נפרד — CommonJS, target ES2020, include `../server/**/*`, exclude SQLite + tests + `src/`.

---

## 27) פערים ותצפיות

- **WebSocket ללא אימות** — כל חיבור ל-`/ws/admin-realtime` מתקבל.
- **אין rate limiting HTTP** — אין `express-rate-limit` על נתיבי API.
- **`frame-detector.ts` ו-`frame-relevance-route.ts`** — קיימים אך לא מחוברים לנתיבים הפעילים.
- **`AdminDataStore`** — מימוש JSON ישן, לא מממש את `IAdminRepository` המלא.
- **SQLite: חיבור יחיד** — WAL mode, אבל ללא connection pooling.
- **Memory Leak פוטנציאלי** — בבדיקות עומס נצפה גידול של 446MB ב-RSS.
- **Cold Start** — `minInstances: 0` ב-Cloud Functions.
- **README.md** — עדיין טמפלט Vite גנרי.

---

## 28) כניסה מהירה למפתח חדש

1. קרא `package.json` ו-`.env.example`. העתק `.env.example` ל-`.env` והשלם ערכים.
2. `npm install && npm run dev`.
3. סרוק את `src/components/root-app.tsx` → `App.tsx` → `super-admin-panel.tsx`.
4. סרוק את `server/index.ts` → `server/app.ts` → `server/queue-manager.ts`.
5. הרץ `npm test`.
6. בחר תחום:
   - **UI/State:** `src/components/*`, `src/hooks/*`
   - **API/Auth:** `server/admin/*`, `server/auth/*`, `server/middleware/*`
   - **AI/Queue:** `server/app.ts`, `server/queue-manager.ts`, `server/vision-handler.ts`
   - **DB:** `server/db/*`
   - **ערוצים/הודעות:** `server/channels/*`, `src/services/channels-api.ts`

---

## 29) סיכום

המסמך מעודכן לגרסה הנוכחית של הקוד (27.03.2026).  
בכל שינוי מהותי ב-`app.ts`, `repository-types.ts`, `admin/types.ts`, `schemas.ts` — יש לעדכן גם את המסמך באותו PR.

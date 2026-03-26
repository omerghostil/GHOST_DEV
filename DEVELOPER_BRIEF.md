# GPTScope — בריף מפתחים מעודכן

> **תאריך עדכון:** 25.03.2026  
> **גרסת פרויקט:** `0.0.0`  
> **מקור אמת:** הקוד בפועל תחת `src/`, `server/`, `package.json`, `.env.example`

---

## 1) מטרת המסמך

המסמך מרכז תמונת מצב מדויקת של המערכת כפי שהיא ממומשת כרגע:

- יכולות מוצר בפועל.
- מבנה ארכיטקטורה לקוח/שרת.
- API פעיל בשרת.
- מנגנוני תורים, retries, timeouts ויציבות.
- מצב הבדיקות והפערים הידועים.

---

## 2) תקציר מוצר

`GPTScope` היא אפליקציית ניטור וידאו בסגנון מבצעי:

- ממשק `React + Vite` לניהול ערוצים וצ'אט.
- שרת `Express` שמתווך ל-OpenAI.
- לכידת פריימים מהמצלמה המקומית בדפדפן.
- סריקות מבצעים אוטומטיות לפי תזמון.
- ניתוח ציר זמן: דגימה, סינון רלוונטיות, בניית קולאז' וניתוח כרונולוגי.
- מרכז התראות קריטיות (אישור/התעלמות/מחיקה).

מגבלות נוכחיות:

- אין DB ואין persistence.
- אין auth והרשאות.
- אין ניגון RTSP אמיתי (השדה קיים במודל בלבד).
- הנתונים העסקיים מוחזקים ב-state ומאותחלים מ-`src/data/initial-channels.ts`.

---

## 3) סטאק טכנולוגי

### Runtime

| ספריה | גרסה |
|---|---|
| `react` | `^19.2.4` |
| `react-dom` | `^19.2.4` |
| `express` | `^5.2.1` |
| `openai` | `^6.32.0` |
| `zod` | `^4.3.6` |
| `bullmq` | `^5.71.1` |
| `ioredis` | `^5.10.1` |
| `sharp` | `^0.34.5` |
| `@tensorflow/tfjs` | `^4.22.0` |
| `@tensorflow-models/coco-ssd` | `^2.2.3` |

### Dev

| כלי | גרסה |
|---|---|
| `vite` | `^8.0.1` |
| `typescript` | `~5.9.3` |
| `vitest` | `^4.1.1` |
| `eslint` | `^9.39.4` |
| `tsx` | `^4.21.0` |
| `concurrently` | `^9.2.1` |

---

## 4) סקריפטים

- `npm run dev` — מריץ במקביל לקוח (`vite`) ושרת (`tsx watch server/index.ts`).
- `npm run dev:client` — לקוח בלבד.
- `npm run dev:server` — שרת בלבד.
- `npm run dev:all` — alias ל-`dev`.
- `npm run build` — `tsc -b && vite build` (בונה לקוח; `server/` לא נכלל בבילד הזה).
- `npm run lint` — `eslint .`
- `npm run test` — `vitest run`
- `npm run preview` — `vite preview`

---

## 5) מבנה פרויקט בפועל

### צד לקוח `src/`

- `App.tsx` — אורקסטרציה מרכזית ורוב ה-state העסקי.
- `components/` — רכיבי UI (`topbar`, `inbox-panel`, `chat-panel`, `details-panel`, `channels-hub`, `critical-alerts-center`, `flash-alert-overlay`, `timeline-controls`, ועוד).
- `hooks/`
  - `use-operation-scheduler.ts`
  - `use-timeline-sampler.ts`
- `services/`
  - `camera-frame.ts`
  - `vision-chat.ts`
  - `operation-scan.ts`
  - `frame-relevance.ts`
  - `collage-builder.ts`
  - `timeline-analysis.ts`
  - `schedule-parser.ts`
- `data/` — `constants.ts`, `initial-channels.ts`
- `utils/` — `critical-alerts.ts`, `group-channel.ts`, `ghost-reply.ts`, `time.ts`
- `types.ts` — מודל הנתונים העסקי.

### צד שרת `server/`

- `index.ts` — שרת Express וכל נתיבי `/api/*`.
- `schemas.ts` — סכמות Zod משותפות.
- `vision-handler.ts` — קריאות OpenAI Responses.
- `queue-manager.ts` — תור (`redis`/`direct`), retries, timeout, circuit breaker.
- `image-optimizer.ts` — אופטימיזציית תמונה עם Sharp.
- `model-selector.ts` — בחירת מודל ורמת detail.
- `circuit-breaker.ts` — מנגנון הגנה מכשלים רציפים.
- `frame-detector.ts`, `frame-relevance-route.ts` — קיימים, אך לא מחוברים לנתיבים הפעילים ב-`index.ts`.

---

## 6) יכולות מוצר ממומשות

- ניהול ערוצים אישיים וקבוצתיים.
- יצירת/מחיקת ערוצים, כולל קיבוץ מהיר לערוץ קבוצתי.
- צ'אט משתמש ↔ Ghost עם פריים מהמצלמה המקומית.
- מבצעים ב-4 מצבים: `alert`, `report`, `rating`, `assessment`.
- תזמון מבצעים דרך `parseSchedule`.
- סריקות אוטומטיות דרך `use-operation-scheduler`.
- Flash Alert עבור התראות `alert` קריטיות.
- מרכז התראות קריטיות עם פעולות approve / ignore / delete.
- דגימת ציר זמן 2/4/8 שניות, relevance filter, collage, ניתוח כרונולוגי.

---

## 7) API פעיל בשרת

### `POST /api/chat-vision`

- קלט: `ChatVisionRequestSchema`.
- פלט הצלחה: `{ text, sources }`.
- שגיאות: `400`, `503`, `502`.

### `POST /api/operation-scan`

- קלט: `OperationScanRequestSchema`.
- פלט הצלחה: `{ results: [...] }`.
- שגיאות: `400`, `503`, `502`.

### `POST /api/frame-relevance`

- קלט: `{ frameDataUrl }`.
- פלט הצלחה: `{ relevant: boolean }`.
- מימוש: OpenAI ב-`server/index.ts`.

### `POST /api/collage-analysis`

- קלט: `channel`, `collageDataUrl`, `frameTimestamps[]`.
- פלט הצלחה: `{ summary }`.

### `GET /api/queue-health`

- פלט: mode, counts (אם Redis), מצב circuit breaker וקונפיגורציה.

### `GET /api/health`

- פלט: `{ ok: true }`.

---

## 8) Queue, יציבות ועומסים

ב-`server/queue-manager.ts`:

- שני מצבים:
  - `redis` (אם יש `REDIS_URL`) עם BullMQ + Workers + rate limit.
  - `direct` (ללא Redis).
- `attempts: 3` למשימות תור.
- `timeoutMs: 25_000`.
- `QUEUE_CONCURRENCY` ו-`QUEUE_RATE_LIMIT_RPM` נשלטים ממשתני סביבה.
- `CircuitBreaker` עוטף קריאות AI של chat/scan.

ב-`server/index.ts`:

- `enqueueTask` סידרתי עבור `frame-relevance` ו-`collage-analysis`.
- `MAX_RETRIES=2` עם timeouts:
  - `OPENAI_TIMEOUT_MS=20_000`
  - `OPENAI_COLLAGE_TIMEOUT_MS=30_000`

---

## 9) משתני סביבה (`.env.example`)

- `OPENAI_API_KEY=`
- `PORT=8787`
- `REDIS_URL=redis://localhost:6379`
- `OPENAI_MODEL_DEFAULT=gpt-4.1-mini`
- `OPENAI_MODEL_COMPLEX=gpt-4.1`
- `QUEUE_CONCURRENCY=2`
- `QUEUE_RATE_LIMIT_RPM=50`

הערה: בנתיבי relevance/collage ב-`server/index.ts` יש גם קבוע מקומי `OPENAI_MODEL='gpt-4.1-mini'`.

---

## 10) בדיקות קיימות

### שרת

- `server/circuit-breaker.test.ts`
- `server/frame-detector.test.ts`
- `server/frame-relevance-route.test.ts`
- `server/image-optimizer.test.ts`
- `server/model-selector.test.ts`
- `server/queue-manager.test.ts`
- `server/vision-handler-guard.test.ts`

### לקוח/שירותים

- `src/services/camera-frame.test.ts`
- `src/services/collage-builder.test.ts`
- `src/services/frame-relevance.test.ts`
- `src/services/operation-scan.test.ts`
- `src/services/timeline-analysis.test.ts`
- `src/services/vision-chat.test.ts`
- `src/utils/critical-alerts.test.ts`

כיסוי חסר בולט:

- בדיקות אינטגרציה ל-`server/index.ts`.
- בדיקות E2E לזרימות מלאות.

---

## 11) פערים ותצפיות חשובות

- `README.md` עדיין טמפלט Vite גנרי ולא מתאר את המוצר.
- `frame-detector.ts` ו-`frame-relevance-route.ts` לא בשימוש בנתיבים הפעילים.
- אין שכבת auth/ACL ל-`/api/*`.
- `build` הנוכחי בונה בעיקר לקוח; אין תהליך build שרת מפורש בסקריפט הזה.

---

## 12) כניסה מהירה למפתח חדש

1. לקרוא `package.json` ו-`.env.example`.
2. לעבור על `src/App.tsx`.
3. לעבור על `server/index.ts`, `server/queue-manager.ts`, `server/vision-handler.ts`.
4. להריץ `npm run test`.
5. לבחור תחום עבודה:
   - UI/State: `src/components/*`, `src/hooks/*`
   - AI/Queue: `server/*`
   - סכמות/טיפוסים: `server/schemas.ts`, `src/types.ts`

---

## 13) סיכום

המסמך מעודכן לגרסה הנוכחית של הקוד בלבד.  
בכל שינוי מהותי ב-`App`, `index.ts`, `queue-manager`, `schemas`, `types` יש לעדכן גם את המסמך באותו PR.


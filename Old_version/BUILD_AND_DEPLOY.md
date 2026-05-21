# Ghost — הנחיות בילד ודיפלוי מקצועיות

> **תאריך:** 29.03.2026  
> **מבוסס על:** [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)  
> **פרויקט Firebase:** `ghost-prod-fc874`

---

## תוכן עניינים

1. [סקירת ארכיטקטורת הפריסה](#1-סקירת-ארכיטקטורת-הפריסה)
2. [דרישות מקדימות](#2-דרישות-מקדימות)
3. [הגדרת סביבה — לפני כל פעולה](#3-הגדרת-סביבה)
4. [בילד מקומי (פיתוח)](#4-בילד-מקומי)
5. [בילד לפרודקשן](#5-בילד-לפרודקשן)
6. [דיפלוי לפרודקשן — שלב אחר שלב](#6-דיפלוי-לפרודקשן)
7. [רשימת בדיקות לפני דיפלוי](#7-רשימת-בדיקות-לפני-דיפלוי)
8. [אימות אחרי דיפלוי](#8-אימות-אחרי-דיפלוי)
9. [Rollback — חזרה לגרסה קודמת](#9-rollback)
10. [שגיאות נפוצות ופתרונות](#10-שגיאות-נפוצות)
11. [הגדרת סודות ב-Firebase](#11-הגדרת-סודות)
12. [טיפים מתקדמים](#12-טיפים-מתקדמים)

---

## 1. סקירת ארכיטקטורת הפריסה

המערכת מורכבת מ-**שני תוצרי בילד נפרדים** שנפרסים ביחד:

```
┌─────────────────────────────────────────────────┐
│ Firebase Hosting          (קבצים סטטיים)         │
│ ← dist/  (Vite build)                           │
│ ← SPA rewrite: /** → index.html                 │
│ ← API rewrite: /api/** → Cloud Function "api"   │
├─────────────────────────────────────────────────┤
│ Cloud Function "api"      (Express server)       │
│ ← functions/lib/  (TypeScript compiled)          │
│ ← כולל: server/**/* (מלבד sqlite ו-tests)        │
│ ← Firestore + RTDB + OpenAI                      │
└─────────────────────────────────────────────────┘
```

**חשוב:** הם חולקים קוד — Cloud Function מייבאת ישירות מ-`server/` דרך נתיב יחסי `../../server/app`. לכן בילד של Functions חייב לכלול את קוד השרת.

---

## 2. דרישות מקדימות

### כלים שחייבים להיות מותקנים

| כלי | גרסה מינימלית | בדיקה | התקנה |
|------|---------------|-------|--------|
| Node.js | 20.x | `node -v` | [nodejs.org](https://nodejs.org) |
| npm | 10.x | `npm -v` | מגיע עם Node |
| Firebase CLI | 13.x+ | `firebase --version` | `npm i -g firebase-tools` |
| TypeScript | 5.9.x | `npx tsc --version` | מותקן כ-devDependency |

### הרשאות Firebase

```bash
# התחברות לחשבון Firebase
firebase login

# אימות שהפרויקט הנכון מוגדר
firebase projects:list
# צריך לראות: ghost-prod-fc874

# אימות שה-CLI מחובר לפרויקט הנכון
firebase use ghost-prod-fc874
```

### שירותים שחייבים להיות פעילים בפרויקט Firebase

- **Cloud Functions** (v2)
- **Firestore** (Native mode)
- **Realtime Database**
- **Hosting**
- **Authentication** (אם Firebase Auth בשימוש)

---

## 3. הגדרת סביבה

### 3.1 משתני סביבה מקומיים (`.env`)

```bash
# העתק את הטמפלט
cp .env.example .env
```

**ערוך את `.env` והגדר ערכים אמיתיים:**

```bash
# חובה לניתוח AI
OPENAI_API_KEY=sk-proj-...

# פורט שרת — חייב להתאים ל-vite.config.ts
PORT=8787

# סודות — חובה להחליף בפרודקשן
JWT_ACCESS_SECRET=<מחרוזת אקראית ארוכה 64+ תווים>
JWT_REFRESH_SECRET=<מחרוזת אקראית ארוכה 64+ תווים>
ADMIN_ENCRYPTION_SECRET=<מחרוזת אקראית ארוכה 64+ תווים>

# Bootstrap user — שנה מברירת מחדל
SUPER_ADMIN_USERNAME=<שם משתמש חזק>
SUPER_ADMIN_PASSWORD=<סיסמה חזקה 12+ תווים>
SUPER_ADMIN_MANAGER_CODE=<קוד 4 ספרות לא 1553>
```

**אזהרה קריטית:** אם הסודות נשארים על ברירת מחדל (`ghost-default-*`, `omeradmin`, `1553`) — המערכת פגיעה לחלוטין. ראו [SYSTEM_ARCHITECTURE.md פרק 9.5](./SYSTEM_ARCHITECTURE.md#95-סיכוני-אבטחה-ידועים).

### 3.2 משתני סביבה ב-Functions (פרודקשן)

סודות ב-Cloud Functions מוגדרים דרך Firebase environment config:

```bash
# הגדרת סודות לפרודקשן
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set JWT_ACCESS_SECRET
firebase functions:secrets:set JWT_REFRESH_SECRET
firebase functions:secrets:set ADMIN_ENCRYPTION_SECRET
firebase functions:secrets:set SUPER_ADMIN_PASSWORD
firebase functions:secrets:set SUPER_ADMIN_MANAGER_CODE
```

**לחלופין**, אם משתמשים ב-`.env` בתיקיית `functions/`:

```bash
# צור קובץ functions/.env
cat > functions/.env << 'EOF'
OPENAI_API_KEY=sk-proj-...
JWT_ACCESS_SECRET=<ערך חזק>
JWT_REFRESH_SECRET=<ערך חזק>
ADMIN_ENCRYPTION_SECRET=<ערך חזק>
SUPER_ADMIN_USERNAME=<שם חזק>
SUPER_ADMIN_PASSWORD=<סיסמה חזקה>
SUPER_ADMIN_MANAGER_CODE=<קוד ייחודי>
OPENAI_MODEL_DEFAULT=gpt-4.1-mini
OPENAI_MODEL_COMPLEX=gpt-4.1
EOF
```

---

## 4. בילד מקומי

### 4.1 התקנת תלויות

```bash
# שורש הפרויקט
npm install

# תלויות Cloud Functions (נפרדות)
cd functions && npm install && cd ..
```

### 4.2 הרצה בפיתוח

```bash
npm run dev
```

זה מריץ במקביל:
- **Vite** על `http://localhost:5173` (לקוח)
- **tsx watch** על `http://localhost:PORT` (שרת Express + SQLite + WebSocket)

Vite מפרוקסי `/api/*` → השרת המקומי אוטומטית.

### 4.3 אימות שהכל עובד מקומית

```bash
# בדיקת health
curl http://localhost:8787/api/health
# ← { "ok": true, "uptime": ..., "memory": {...} }

# בדיקת queue
curl http://localhost:8787/api/queue-health
# ← { "mode": "direct", ... }

# הרצת טסטים
npm test
```

---

## 5. בילד לפרודקשן

### 5.1 שלב 1: בילד הלקוח (Vite)

```bash
npm run build
```

**מה קורה:**
1. `tsc -b` — בודק טיפוסים (TypeScript composite build)
2. `vite build` — יוצר bundle מינימלי ב-`dist/`

**תוצר:** `dist/` — קבצי HTML, JS, CSS ותמונות מוכנים ל-Hosting.

**בדוק:**
```bash
ls -la dist/
# חייב להכיל: index.html, assets/, manifest.webmanifest
```

### 5.2 שלב 2: בילד Cloud Functions

```bash
cd functions
npm run build
cd ..
```

**מה קורה:**
1. `tsc` עם `functions/tsconfig.json`
2. מקמפל `functions/src/**/*` + `server/**/*` (מלבד SQLite וטסטים)
3. תוצר: `functions/lib/` — קבצי JavaScript מוכנים

**בדוק:**
```bash
ls functions/lib/functions/src/index.js
# חייב להיות קיים

ls functions/lib/server/app.js
# חייב להיות קיים
```

**שגיאות נפוצות בבילד Functions:**

| שגיאה | סיבה | פתרון |
|--------|-------|--------|
| `Cannot find module 'better-sqlite3'` | SQLite לא excluded | וודא ש-`../server/db/sqlite/**` ב-`exclude` של `functions/tsconfig.json` |
| Type errors על `express-serve-static-core` | חוסר התאמת גרסאות | וודא ש-`@types/express` תואם בשני ה-`package.json` |
| `Module not found: ../../server/app` | נתיב יחסי שבור | אל תשנה את מיקום `functions/src/index.ts` ביחס ל-`server/` |

### 5.3 שלב מלא — בילד הכל

```bash
# בילד לקוח
npm run build

# בילד functions
cd functions && npm run build && cd ..

# אימות
echo "--- dist/ ---" && ls dist/index.html && \
echo "--- functions/lib ---" && ls functions/lib/functions/src/index.js && \
echo "BUILD OK"
```

---

## 6. דיפלוי לפרודקשן — שלב אחר שלב

### 6.0 בדיקות חובה לפני דיפלוי

```bash
# 1. טסטים עוברים
npm test

# 2. lint נקי
npm run lint

# 3. בילד לקוח מצליח
npm run build

# 4. בילד functions מצליח
cd functions && npm run build && cd ..

# 5. אין שינויים לא committed
git status
# ← צריך להיות נקי או שהכל מ-staged
```

### 6.1 דיפלוי Hosting + Functions (מלא)

```bash
firebase deploy
```

**מה זה עושה:**
1. מעלה `dist/` ל-Firebase Hosting
2. מעלה `functions/lib/` + `functions/node_modules/` ל-Cloud Functions
3. מעדכן `firestore.rules`, `firestore.indexes.json`, `database.rules.json`

**זמן צפוי:** 2-5 דקות.

### 6.2 דיפלוי חלקי — רק Hosting (Frontend)

אם שינית **רק קוד צד לקוח** ולא נגעת בשרת:

```bash
npm run build
firebase deploy --only hosting
```

**יתרון:** מהיר יותר (30-60 שניות), לא מפריע ל-Functions פעילות.

### 6.3 דיפלוי חלקי — רק Functions (Backend)

אם שינית **רק קוד שרת** ולא נגעת בלקוח:

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions
```

**אזהרה:** דיפלוי functions מחליף את ה-instance הנוכחי. בקשות שרצות באותו רגע עלולות להיכשל (grace period קצר).

### 6.4 דיפלוי כללי אבטחה בלבד

```bash
firebase deploy --only firestore:rules,database
```

### 6.5 דיפלוי אינדקסים בלבד

```bash
firebase deploy --only firestore:indexes
```

---

## 7. רשימת בדיקות לפני דיפלוי

### בדיקות קוד

- [ ] `npm test` — כל 21 הטסטים עוברים
- [ ] `npm run lint` — ללא שגיאות
- [ ] `npm run build` — בילד לקוח מצליח ללא שגיאות
- [ ] `cd functions && npm run build` — בילד functions מצליח

### בדיקות סביבה

- [ ] `functions/.env` מכיל סודות **אמיתיים** (לא ברירות מחדל)
- [ ] `JWT_ACCESS_SECRET` לא מתחיל ב-`ghost-default`
- [ ] `JWT_REFRESH_SECRET` לא מתחיל ב-`ghost-default`
- [ ] `ADMIN_ENCRYPTION_SECRET` לא מתחיל ב-`ghost-default`
- [ ] `SUPER_ADMIN_PASSWORD` לא `omeradmin`
- [ ] `SUPER_ADMIN_MANAGER_CODE` לא `1553`
- [ ] `OPENAI_API_KEY` מוגדר וחוקי

### בדיקות אבטחה

- [ ] `firestore.rules` מכיל `allow read, write: if false`
- [ ] `database.rules.json` חוסם גישה ישירה
- [ ] אין קבצי `.env` ב-git (`git status`)

### בדיקות מבניות

- [ ] `dist/index.html` קיים ותקין
- [ ] `functions/lib/functions/src/index.js` קיים
- [ ] `functions/lib/server/app.js` קיים
- [ ] `functions/node_modules` מותקן (מכיל `express`, `openai`, `sharp`)

---

## 8. אימות אחרי דיפלוי

### 8.1 בדיקות מיידיות (0-2 דקות אחרי דיפלוי)

```bash
PROJECT_URL="https://ghost-prod-fc874.web.app"

# 1. הדף נטען
curl -s -o /dev/null -w "%{http_code}" $PROJECT_URL
# ← 200

# 2. Health check
curl -s "$PROJECT_URL/api/health" | head -c 200
# ← {"ok":true,"uptime":...,"memory":{...}}

# 3. Queue health
curl -s "$PROJECT_URL/api/queue-health" | head -c 200
# ← {"mode":"direct",...}

# 4. Login עובד
curl -s -X POST "$PROJECT_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"<YOUR_ADMIN>","password":"<YOUR_PASS>"}' | head -c 100
# ← {"accessToken":"eyJ...
```

### 8.2 בדיקות פונקציונליות (2-10 דקות)

1. **פתח את הדף בדפדפן** — `https://ghost-prod-fc874.web.app`
2. **התחבר** עם המשתמש bootstrap
3. **בדוק שהדשבורד נטען** (סופר-אדמין → דשבורד ניהולי)
4. **צור ערוץ חדש** → וודא שנשמר ומופיע
5. **שלח הודעת צ'אט** → וודא שתשובת AI חוזרת
6. **בדוק כונסול Firebase** → Firestore מכיל נתונים, Functions log נקי

### 8.3 בדיקת לוגים

```bash
# לוגי Cloud Functions בזמן אמת
firebase functions:log --only api

# או דרך GCP Console:
# https://console.cloud.google.com/functions/details/us-central1/api?project=ghost-prod-fc874
```

**מה לחפש:**
- `Vision proxy ready` — השרת עלה
- `Firebase Auth bootstrap` — משתמש bootstrap נוצר/אומת
- `[scheduler]` — מנוע מבצעים הופעל
- **שגיאות `OPENAI_API_KEY`** — אם חסר, תראה 503 בקריאות AI

---

## 9. Rollback — חזרה לגרסה קודמת

### Rollback של Hosting (Frontend)

```bash
# רשימת גרסאות קודמות
firebase hosting:channel:list

# חזרה לגרסה קודמת ספציפית
firebase hosting:rollback
```

### Rollback של Functions

**אין rollback אוטומטי ב-Firebase Functions.** הפתרון:

```bash
# חזרה ל-commit הקודם
git checkout <commit-hash>

# בילד + דיפלוי מחדש
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions
```

### Rollback חירום — השבתת Function

אם הפונקציה שבורה לחלוטין:

```bash
# מחיקת הפונקציה (הזהירו — מורידה את ה-API כולו)
firebase functions:delete api --region us-central1
```

**רק במצב חירום.** זה ימנע מ-Hosting לנתב ל-API — כל הקריאות יחזירו 404.

---

## 10. שגיאות נפוצות ופתרונות

### שגיאות בילד

| שגיאה | סיבה | פתרון |
|--------|-------|--------|
| `tsc -b` נכשל | שגיאות TypeScript בלקוח | תקן את השגיאות ב-`src/` לפני build |
| `vite build` נכשל | import חסר או שבור | בדוק import cycles, חבילות חסרות |
| Functions `tsc` נכשל | טיפוסים לא תואמים בין root ו-functions | וודא ש-`@types/express` באותה גרסה |
| `sharp` לא נמצא ב-Functions | חסר ב-`functions/package.json` | `cd functions && npm install sharp` |

### שגיאות דיפלוי

| שגיאה | סיבה | פתרון |
|--------|-------|--------|
| `Permission denied` | חשבון Firebase לא מורשה | `firebase login --reauth` |
| `Error: Functions did not deploy` | שגיאת Node version | וודא `"engines": {"node": "20"}` ב-`functions/package.json` |
| `Quota exceeded` | חריגה מ-Cloud Functions quota | בדוק quota ב-GCP Console |
| `dist/ is empty` | שכחת `npm run build` | הרץ `npm run build` לפני deploy |

### שגיאות runtime (אחרי דיפלוי)

| שגיאה בלוג | סיבה | פתרון |
|-------------|-------|--------|
| `OPENAI_API_KEY לא הוגדר` | חסר env ב-Functions | הגדר `functions/.env` או Firebase secrets |
| `שגיאה בהפעלת השרת` | חסרות dependencies | `cd functions && npm install` |
| `Cold start timeout` | אתחול ארוך מ-60s | הגדל `timeoutSeconds` או השתמש ב-`minInstances: 1` |
| `Memory limit exceeded` | Sharp/OpenAI צורכים הרבה זיכרון | הגדל `memory` ב-`functions/src/index.ts` ל-`1GiB` |

---

## 11. הגדרת סודות ב-Firebase

### אפשרות א: קובץ `.env` בתיקיית functions

```bash
# צור functions/.env (לא נכנס ל-git)
echo "functions/.env" >> .gitignore
```

הקובץ נפרס אוטומטית עם `firebase deploy --only functions`.

### אפשרות ב: Firebase Secrets Manager (מומלץ)

```bash
firebase functions:secrets:set OPENAI_API_KEY
# → תתבקש להזין את הערך

firebase functions:secrets:set JWT_ACCESS_SECRET
firebase functions:secrets:set JWT_REFRESH_SECRET
firebase functions:secrets:set ADMIN_ENCRYPTION_SECRET
```

**כדי להשתמש ב-secrets מתוך הקוד**, צריך לציין אותם ב-function definition. כרגע הקוד קורא מ-`process.env` ישירות — לכן אפשרות א (`.env`) היא הפשוטה ביותר ללא שינוי קוד.

### מה לא לעשות

- **לעולם אל תדחוף `.env` ל-Git.** וודא ש-`.gitignore` כולל `.env`.
- **לעולם אל תכניס סודות ל-`firebase.json` או ל-source code.**
- **לעולם אל תשאיר ברירות מחדל בפרודקשן** (`ghost-default-*`, `omeradmin`, `1553`).

---

## 12. טיפים מתקדמים

### 12.1 Cold Start — הפחתת זמני עלייה

Cloud Function עם `minInstances: 0` עוברת cold start בכל הפעלה אחרי תקופת חוסר שימוש. לצמצום:

**אפשרות א: minInstances** (עלות נוספת)

עריכה ב-`functions/src/index.ts`:
```typescript
export const api = onRequest(
  {
    memory: '512MiB',
    timeoutSeconds: 60,
    minInstances: 1,  // ← שומר instance אחד חי תמיד
  },
  ...
)
```

**אפשרות ב: הגדלת memory** (ל-cold starts כבדים)

```typescript
memory: '1GiB',  // ← במקום 512MiB
```

### 12.2 בדיקה מקומית עם Firebase Emulators

```bash
# הרצת emulators מקומיים
firebase emulators:start --only functions,firestore,database

# בטרמינל נפרד — בילד Functions ב-watch
cd functions && npm run build:watch
```

### 12.3 Preview Channels — דיפלוי לסביבת preview

```bash
# יצירת ערוץ preview זמני
firebase hosting:channel:deploy preview-v2 --expires 7d
# ← מחזיר URL ייחודי לבדיקות

# מחיקה אחרי בדיקות
firebase hosting:channel:delete preview-v2
```

**שימו לב:** ערוצי preview משתמשים באותן Functions ו-Firestore כמו פרודקשן. לא מספק בידוד מלא.

### 12.4 סדר פעולות מומלץ — דיפלוי שגרתי

```bash
# 1. ודא שאתה על branch נקי
git status

# 2. בדיקות
npm test && npm run lint

# 3. בילד מלא
npm run build && cd functions && npm run build && cd ..

# 4. דיפלוי
firebase deploy

# 5. אימות
curl -s "https://ghost-prod-fc874.web.app/api/health"

# 6. בדיקה בדפדפן
open "https://ghost-prod-fc874.web.app"

# 7. Tag בגיט
git tag -a "deploy-$(date +%Y%m%d-%H%M)" -m "Production deploy"
git push --tags
```

### 12.5 התמודדות עם שגיאות Firebase indexes

אם Firestore queries נכשלות עם שגיאת index חסר:

```bash
# דיפלוי אינדקסים
firebase deploy --only firestore:indexes

# זמן: אינדקסים חדשים לוקחים 1-10 דקות ליצירה ב-Firebase
```

### 12.6 בניית functions עם dependencies נקיות

אם יש בעיות תלויות מוזרות:

```bash
cd functions
rm -rf node_modules lib
npm install
npm run build
cd ..
firebase deploy --only functions
```

---

## סיכום — תהליך דיפלוי מלא מקוצר

```bash
# === PRE-DEPLOY ===
npm test                           # בדיקות
npm run lint                       # lint
npm run build                      # בילד לקוח → dist/
cd functions && npm run build && cd .. # בילד שרת → functions/lib/

# === VERIFY BUILD ===
test -f dist/index.html && test -f functions/lib/functions/src/index.js && echo "OK"

# === DEPLOY ===
firebase deploy                    # הכל

# === POST-DEPLOY ===
curl -s "https://ghost-prod-fc874.web.app/api/health"  # health check
firebase functions:log --only api  # לוגים

# === TAG ===
git tag -a "deploy-$(date +%Y%m%d-%H%M)" -m "Deploy"
git push --tags
```

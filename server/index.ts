import 'dotenv/config'
import { createServer } from 'node:http'
import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'
import { z } from 'zod'
import { enqueueOperationScan, enqueueVisionChat, getQueueHealth, JobPriority } from './queue-manager'
import {
  ChatVisionRequestSchema as SharedChatVisionRequestSchema,
  OperationScanRequestSchema as SharedOperationScanRequestSchema,
} from './schemas'
import { isOpenAiConfigured } from './vision-handler'
import { SQLiteAdminRepository } from './db/sqlite/sqlite-repository'
import { createAuthRouter } from './admin/create-auth-router'
import { createAdminRouter } from './admin/create-admin-router'
import { createIssuesRouter } from './issues/create-issues-router'
import { RealtimeHub } from './realtime/ws-hub'
import { requireAuth } from './middleware/auth-guard'

const SERVER_PORT = Number(process.env.PORT ?? 8787)
const OPENAI_MODEL = 'gpt-4.1-mini'
const OPENAI_TIMEOUT_MS = 20000
const OPENAI_COLLAGE_TIMEOUT_MS = 30000
const MAX_RETRIES = 2

const ChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['personal', 'group']),
  watchScope: z.string().min(1),
  location: z.string().min(1),
  members: z.array(z.string()),
})

const FrameRelevanceRequestSchema = z.object({
  frameDataUrl: z.string().startsWith('data:image/'),
})

const FrameRelevanceResponseSchema = z.object({
  relevant: z.boolean(),
})

type FrameRelevanceRequest = z.infer<typeof FrameRelevanceRequestSchema>

const CollageAnalysisRequestSchema = z.object({
  channel: ChannelSchema,
  collageDataUrl: z.string().startsWith('data:image/'),
  frameTimestamps: z.array(z.string().min(1)).min(1),
})

const CollageAnalysisResponseSchema = z.object({
  summary: z.string().min(1),
})

type CollageAnalysisRequest = z.infer<typeof CollageAnalysisRequestSchema>

const openaiApiKey = process.env.OPENAI_API_KEY?.trim()
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null
const app = express()
const httpServer = createServer(app)
const adminStore = new SQLiteAdminRepository()
const realtimeHub = new RealtimeHub(httpServer)

app.use(cors())
app.use(express.json({ limit: '12mb' }))
app.use('/api/auth', createAuthRouter({ store: adminStore }))
app.use('/api/admin', createAdminRouter({ store: adminStore, realtimeHub }))
app.use('/api/issues', createIssuesRouter({ store: adminStore, realtimeHub }))

let queue: Promise<unknown> = Promise.resolve()

/**
 * מריץ עבודה בתור סידרתי כדי למנוע עומס על API.
 */
function enqueueTask<T>(task: () => Promise<T>): Promise<T> {
  const nextTask = queue.then(task, task)
  queue = nextTask.then(
    () => undefined,
    () => undefined,
  )
  return nextTask
}

/**
 * מחלץ טקסט תשובה מהמבנה של Responses API.
 */
function extractResponseText(response: OpenAI.Responses.Response): string {
  const outputTexts = response.output
    .flatMap((item) => (item.type === 'message' ? item.content : []))
    .filter((contentItem) => contentItem.type === 'output_text')
    .map((contentItem) => contentItem.text.trim())
    .filter(Boolean)

  if (outputTexts.length > 0) {
    return outputTexts.join('\n')
  }

  if (response.output_text) {
    return response.output_text.trim()
  }

  return 'לא זוהתה תובנה חד-משמעית בפריים הנוכחי.'
}

/**
 * מנסה לפרק JSON מתשובת מודל (כולל גדרות קוד markdown).
 */
function parseJsonFromModelText(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    const body = fence ? fence[1].trim() : trimmed
    return JSON.parse(body) as unknown
  } catch {
    throw new Error('לא ניתן לפרק את תשובת ה-JSON מהמודל.')
  }
}

/**
 * בודק אם הפריים כולל אדם או רכב לצורך סינון קולאז'.
 */
async function requestFrameRelevanceWithRetry(payload: FrameRelevanceRequest): Promise<boolean> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY לא הוגדר בסביבה.')
  }

  let attempt = 0
  let lastError: unknown

  while (attempt <= MAX_RETRIES) {
    attempt += 1
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

    try {
      const response = await openai.responses.create(
        {
          model: OPENAI_MODEL,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    'בדוק אם בתמונה יש אדם או רכב. החזר אך ורק JSON תקין בפורמט: {"relevant": true} או {"relevant": false}.',
                },
              ],
            },
            {
              role: 'user',
              content: [{ type: 'input_image', image_url: payload.frameDataUrl }],
            },
          ],
        },
        { signal: controller.signal },
      )

      clearTimeout(timeoutId)
      const rawText = extractResponseText(response)
      const parsedUnknown = parseJsonFromModelText(rawText)
      const validated = FrameRelevanceResponseSchema.safeParse(parsedUnknown)
      if (!validated.success) {
        throw new Error('פורמט JSON לא תקין בבדיקת רלוונטיות פריים.')
      }
      return validated.data.relevant
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error
      if (attempt > MAX_RETRIES) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 450 * attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('בדיקת רלוונטיות פריים נכשלה.')
}

/**
 * מנתח קולאז' של פריימים ומחזיר תיאור כרונולוגי.
 */
async function requestCollageAnalysisWithRetry(payload: CollageAnalysisRequest): Promise<string> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY לא הוגדר בסביבה.')
  }

  const membersLabel = payload.channel.members.length > 0 ? payload.channel.members.join(', ') : payload.channel.name
  const frameTimeline = payload.frameTimestamps.map((stamp, index) => `${index + 1}. ${stamp}`).join('\n')
  let attempt = 0
  let lastError: unknown

  while (attempt <= MAX_RETRIES) {
    attempt += 1
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_COLLAGE_TIMEOUT_MS)

    try {
      const response = await openai.responses.create(
        {
          model: OPENAI_MODEL,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    'אתה אנליסט וידאו מבצעי. לפניך קולאז׳ של פריימים מסודרים כרונולוגית (משמאל לימין, מלמעלה למטה) עם חותמות זמן על כל פריים. תאר מי מופיע, מה הוא עושה, אילו רכבים נראים, ומה השתנה לאורך הזמן. ענה בעברית מקצועית, תמציתית וכרונולוגית.',
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `ערוץ: ${payload.channel.name}\nסוג: ${payload.channel.type}\nמיקום: ${payload.channel.location}\nהקשר ניטור: ${payload.channel.watchScope}\nחברים: ${membersLabel}\n\nרשימת זמנים לפי סדר הפריימים:\n${frameTimeline}`,
                },
                {
                  type: 'input_image',
                  image_url: payload.collageDataUrl,
                },
              ],
            },
          ],
        },
        { signal: controller.signal },
      )

      clearTimeout(timeoutId)
      const summary = extractResponseText(response).trim()
      const validated = CollageAnalysisResponseSchema.safeParse({ summary })
      if (!validated.success) {
        throw new Error('תשובת ניתוח קולאז׳ ריקה או לא תקינה.')
      }
      return validated.data.summary
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error
      if (attempt > MAX_RETRIES) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 450 * attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('ניתוח קולאז׳ נכשל.')
}

app.post('/api/chat-vision', requireAuth, async (request, response) => {
  const parsed = SharedChatVisionRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ error: 'קלט בקשה לא תקין.' })
  }

  if (!isOpenAiConfigured()) {
    return response.status(503).json({
      error:
        'OPENAI_API_KEY לא הוגדר. העתק .env.example לקובץ .env והדבק מפתח API תקף.',
    })
  }

  try {
    const result = await enqueueVisionChat(parsed.data, JobPriority.CRITICAL)
    return response.json({ text: result.text, sources: result.sources })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה פנימית לא ידועה.'
    return response.status(502).json({ error: `ניתוח התמונה נכשל: ${message}` })
  }
})

app.post('/api/operation-scan', requireAuth, async (request, response) => {
  const parsed = SharedOperationScanRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ error: 'קלט סריקת מבצעים לא תקין.' })
  }

  if (!isOpenAiConfigured()) {
    return response.status(503).json({
      error:
        'OPENAI_API_KEY לא הוגדר. העתק .env.example לקובץ .env והדבק מפתח API תקף.',
    })
  }

  try {
    const data = await enqueueOperationScan(parsed.data, JobPriority.NORMAL)
    return response.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה פנימית לא ידועה.'
    return response.status(502).json({ error: `סריקת מבצעים נכשלה: ${message}` })
  }
})

app.post('/api/frame-relevance', requireAuth, async (request, response) => {
  const parsed = FrameRelevanceRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ error: 'קלט בדיקת רלוונטיות פריים לא תקין.' })
  }

  if (!openai) {
    return response.status(503).json({
      error:
        'OPENAI_API_KEY לא הוגדר. העתק .env.example לקובץ .env והדבק מפתח API תקף.',
    })
  }

  try {
    const relevant = await enqueueTask(() => requestFrameRelevanceWithRetry(parsed.data))
    return response.json({ relevant })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה פנימית לא ידועה.'
    return response.status(502).json({ error: `בדיקת רלוונטיות פריים נכשלה: ${message}` })
  }
})

app.post('/api/collage-analysis', requireAuth, async (request, response) => {
  const parsed = CollageAnalysisRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ error: 'קלט ניתוח קולאז׳ לא תקין.' })
  }

  if (!openai) {
    return response.status(503).json({
      error:
        'OPENAI_API_KEY לא הוגדר. העתק .env.example לקובץ .env והדבק מפתח API תקף.',
    })
  }

  try {
    const summary = await enqueueTask(() => requestCollageAnalysisWithRetry(parsed.data))
    return response.json({ summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה פנימית לא ידועה.'
    return response.status(502).json({ error: `ניתוח קולאז׳ נכשל: ${message}` })
  }
})

app.get('/api/queue-health', async (_request, response) => {
  try {
    const health = await getQueueHealth()
    return response.json(health)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה פנימית לא ידועה.'
    return response.status(500).json({ error: `לא ניתן לקרוא סטטוס תור: ${message}` })
  }
})

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

httpServer.listen(SERVER_PORT, () => {
  console.log(`Vision proxy ready on http://localhost:${SERVER_PORT}`)
  if (!openaiApiKey) {
    console.warn('[gptscope] אין OPENAI_API_KEY — נקודות /api יחזירו 503 עד להגדרת .env')
  }
})

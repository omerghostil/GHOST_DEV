import { Job, Queue, QueueEvents, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { CircuitBreaker } from './circuit-breaker'
import { getImageProfileByTask, optimizeImageDataUrl, type VisionDetailLevel } from './image-optimizer'
import { isComplexTrigger, selectVisionDetailLevel, selectVisionModel, type VisionModelName } from './model-selector'
import type { ChatVisionRequest, OperationScanRequest, OperationScanResponse } from './schemas'
import { requestOperationScanAnalysis, requestVisionAnalysis } from './vision-handler'

export enum JobPriority {
  CRITICAL = 1,
  NORMAL = 5,
  LOW = 10,
}

type QueueMode = 'redis' | 'direct'

interface QueueRuntimeConfig {
  concurrency: number
  rateLimitRpm: number
  attempts: number
  timeoutMs: number
}

interface VisionChatJobData {
  payload: ChatVisionRequest
  apiKey?: string
}

interface OperationScanJobData {
  payload: OperationScanRequest
  apiKey?: string
}

interface VisionChatJobResult {
  text: string
  sources: string[]
  model: VisionModelName
  detail: VisionDetailLevel
}

const DEFAULT_CONFIG: QueueRuntimeConfig = {
  concurrency: Number(process.env.QUEUE_CONCURRENCY ?? 2),
  rateLimitRpm: Number(process.env.QUEUE_RATE_LIMIT_RPM ?? 50),
  attempts: 3,
  timeoutMs: 25_000,
}

const runtimeConfig = DEFAULT_CONFIG
const queueMode: QueueMode = process.env.REDIS_URL ? 'redis' : 'direct'
const circuitBreaker = new CircuitBreaker()

const redisConnection =
  queueMode === 'redis'
    ? new IORedis(process.env.REDIS_URL as string, {
        maxRetriesPerRequest: null,
      })
    : null

const visionChatQueue =
  queueMode === 'redis'
    ? new Queue<VisionChatJobData, VisionChatJobResult>('vision-chat', {
        connection: redisConnection!,
        defaultJobOptions: {
          attempts: runtimeConfig.attempts,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      })
    : null

const operationScanQueue =
  queueMode === 'redis'
    ? new Queue<OperationScanJobData, OperationScanResponse>('operation-scan', {
        connection: redisConnection!,
        defaultJobOptions: {
          attempts: runtimeConfig.attempts,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      })
    : null

const visionChatEvents =
  queueMode === 'redis' ? new QueueEvents('vision-chat', { connection: redisConnection! }) : null
const operationScanEvents =
  queueMode === 'redis' ? new QueueEvents('operation-scan', { connection: redisConnection! }) : null

/**
 * מאחד בחירת מודל/פירוט לסריקת אצווה כך שנקבל איכות לפי המקרה המורכב ביותר.
 */
function selectScanExecutionConfig(operations: OperationScanRequest['operations']) {
  const hasComplexTrigger = operations.some((operation) => isComplexTrigger(operation.alertTrigger))
  const forceStrongModel = operations.some((operation) => operation.modelOverride === 'gpt-4.1')
  const forceMiniModel = operations.length > 0 && operations.every((operation) => operation.modelOverride === 'gpt-4.1-mini')
  const detailOverride: VisionDetailLevel | undefined = operations.some((operation) => operation.detailLevel === 'high')
    ? 'high'
    : operations.some((operation) => operation.detailLevel === 'auto')
      ? 'auto'
      : operations.some((operation) => operation.detailLevel === 'low')
        ? 'low'
        : undefined

  let model: VisionModelName
  if (forceStrongModel) {
    model = 'gpt-4.1'
  } else if (forceMiniModel) {
    model = 'gpt-4.1-mini'
  } else {
    model = selectVisionModel({
      task: 'scan',
      triggerText: operations.map((item) => item.alertTrigger).join(' '),
    })
  }

  const detail = selectVisionDetailLevel({
    task: 'scan',
    triggerText: operations.map((item) => item.alertTrigger).join(' '),
    detailOverride,
  })

  const profile = getImageProfileByTask('scan', hasComplexTrigger || detail === 'high')
  return { model, detail, profile }
}

async function processVisionChatJob(data: VisionChatJobData, signal?: AbortSignal): Promise<VisionChatJobResult> {
  const model = selectVisionModel({ task: 'chat' })
  const detail = selectVisionDetailLevel({ task: 'chat' })
  const profile = getImageProfileByTask('chat', false)
  const optimized = await optimizeImageDataUrl(data.payload.frameDataUrl, profile)

  const text = await circuitBreaker.execute(() =>
    requestVisionAnalysis(data.payload, optimized.dataUrl, {
      model,
      detail,
      apiKey: data.apiKey,
      signal,
    }),
  )

  const sources = data.payload.channel.type === 'group' ? data.payload.channel.members : [data.payload.channel.name]
  return { text, sources, model, detail }
}

async function processOperationScanJob(data: OperationScanJobData, signal?: AbortSignal): Promise<OperationScanResponse> {
  const executionConfig = selectScanExecutionConfig(data.payload.operations)
  const optimized = await optimizeImageDataUrl(data.payload.frameDataUrl, executionConfig.profile)
  return circuitBreaker.execute(() =>
    requestOperationScanAnalysis(data.payload, optimized.dataUrl, {
      model: executionConfig.model,
      detail: executionConfig.detail,
      apiKey: data.apiKey,
      signal,
    }),
  )
}

function buildTimeoutSignal(timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeoutId),
  }
}

async function runWithRetries<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= runtimeConfig.attempts; attempt += 1) {
    const timeout = buildTimeoutSignal(runtimeConfig.timeoutMs)
    try {
      const result = await operation(timeout.signal)
      timeout.dispose()
      return result
    } catch (error) {
      timeout.dispose()
      lastError = error
      if (attempt >= runtimeConfig.attempts) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('QUEUE_JOB_FAILED')
}

if (queueMode === 'redis') {
  const limiter = {
    max: runtimeConfig.rateLimitRpm,
    duration: 60_000,
  }

  new Worker<VisionChatJobData, VisionChatJobResult>(
    'vision-chat',
    async (job) => {
      const timeout = buildTimeoutSignal(runtimeConfig.timeoutMs)
      try {
        return await processVisionChatJob(job.data, timeout.signal)
      } finally {
        timeout.dispose()
      }
    },
    {
      connection: redisConnection!,
      concurrency: runtimeConfig.concurrency,
      limiter,
    },
  )

  new Worker<OperationScanJobData, OperationScanResponse>(
    'operation-scan',
    async (job) => {
      const timeout = buildTimeoutSignal(runtimeConfig.timeoutMs)
      try {
        return await processOperationScanJob(job.data, timeout.signal)
      } finally {
        timeout.dispose()
      }
    },
    {
      connection: redisConnection!,
      concurrency: runtimeConfig.concurrency,
      limiter,
    },
  )
}

/**
 * מכניס בקשת צ'אט לתור ומחזיר תוצאה אחרי סיום העיבוד.
 */
export async function enqueueVisionChat(
  payload: ChatVisionRequest,
  apiKey?: string,
  priority: JobPriority = JobPriority.CRITICAL,
): Promise<VisionChatJobResult> {
  if (queueMode === 'direct') {
    return runWithRetries((signal) => processVisionChatJob({ payload, apiKey }, signal))
  }

  await visionChatEvents!.waitUntilReady()
  const job = await visionChatQueue!.add('chat', { payload, apiKey }, { priority })

  return waitForJobResult<VisionChatJobResult>(job, visionChatEvents!)
}

/**
 * מכניס בקשת סריקת מבצעים לתור ומחזיר תוצאות מאומתות.
 */
export async function enqueueOperationScan(
  payload: OperationScanRequest,
  apiKey?: string,
  priority: JobPriority = JobPriority.NORMAL,
): Promise<OperationScanResponse> {
  if (queueMode === 'direct') {
    return runWithRetries((signal) => processOperationScanJob({ payload, apiKey }, signal))
  }

  await operationScanEvents!.waitUntilReady()
  const job = await operationScanQueue!.add('scan', { payload, apiKey }, { priority })

  return waitForJobResult<OperationScanResponse>(job, operationScanEvents!)
}

async function waitForJobResult<TResult>(job: Job, events: QueueEvents): Promise<TResult> {
  const result = await job.waitUntilFinished(events, runtimeConfig.timeoutMs + 5_000)
  return result as TResult
}

export async function getQueueHealth() {
  if (queueMode === 'direct') {
    return {
      mode: queueMode,
      counts: null,
      circuitBreaker: circuitBreaker.getSnapshot(),
      config: runtimeConfig,
    }
  }

  const [chatCounts, scanCounts] = await Promise.all([
    visionChatQueue!.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    operationScanQueue!.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
  ])

  return {
    mode: queueMode,
    counts: {
      chat: chatCounts,
      scan: scanCounts,
    },
    circuitBreaker: circuitBreaker.getSnapshot(),
    config: runtimeConfig,
  }
}

export async function closeQueueResourcesForTests() {
  await Promise.all([
    visionChatQueue?.close(),
    operationScanQueue?.close(),
    visionChatEvents?.close(),
    operationScanEvents?.close(),
    redisConnection?.quit(),
  ])
}

export function getQueueModeForTests(): QueueMode {
  return queueMode
}

export function getRuntimeConfigForTests(): QueueRuntimeConfig {
  return runtimeConfig
}

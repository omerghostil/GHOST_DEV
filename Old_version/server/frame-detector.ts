interface DetectionPrediction {
  class: string
  score?: number
}

interface DetectionModel {
  detect(input: unknown): Promise<DetectionPrediction[]>
}

interface DisposableTensor {
  dispose: () => void
}

interface DetectorDependencies {
  loadModel: () => Promise<DetectionModel>
  decodeImage: (imageBuffer: Buffer) => Promise<DisposableTensor>
  nowMs: () => number
  cpuUsage: (previous?: NodeJS.CpuUsage) => NodeJS.CpuUsage
  memoryUsage: () => NodeJS.MemoryUsage
  logInfo: (message: string) => void
  logError: (message: string) => void
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.45
const MIN_CONFIDENCE_THRESHOLD = 0
const MAX_CONFIDENCE_THRESHOLD = 1
const BASE_10 = 10
const TARGET_CLASSES = new Set(['person', 'car', 'bus', 'truck', 'motorcycle'])

let cachedModelPromise: Promise<DetectionModel> | null = null
let cachedDecodeImage:
  | ((imageBuffer: Buffer) => Promise<DisposableTensor>)
  | null = null

/**
 * פותר סף ביטחון מהסביבה עם ברירת מחדל בטוחה.
 */
export function resolveConfidenceThreshold(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_CONFIDENCE_THRESHOLD
  }
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIDENCE_THRESHOLD
  }
  if (parsed < MIN_CONFIDENCE_THRESHOLD || parsed > MAX_CONFIDENCE_THRESHOLD) {
    return DEFAULT_CONFIDENCE_THRESHOLD
  }
  return parsed
}

/**
 * מחלץ בייטים מתוך data URL של תמונה ומוודא פורמט תקין.
 */
export function parseImageDataUrl(frameDataUrl: string): Buffer {
  const match = frameDataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  if (!match?.[1]) {
    throw new Error('פורמט תמונה לא תקין לזיהוי רלוונטיות.')
  }
  const imageBuffer = Buffer.from(match[1], 'base64')
  if (imageBuffer.length === 0) {
    throw new Error('תוכן תמונה ריק לזיהוי רלוונטיות.')
  }
  return imageBuffer
}

/**
 * קובע האם אחת התוצאות עומדת בסף והינה אדם/רכב.
 */
export function isFrameRelevantByDetections(
  detections: DetectionPrediction[],
  confidenceThreshold: number,
): boolean {
  return detections.some((item) => {
    const normalizedClass = item.class.toLowerCase()
    const score = item.score ?? 0
    return TARGET_CLASSES.has(normalizedClass) && score >= confidenceThreshold
  })
}

async function loadModelOnce(): Promise<DetectionModel> {
  if (!cachedModelPromise) {
    cachedModelPromise = (async () => {
      const [{ load }, tf] = await Promise.all([
        import('@tensorflow-models/coco-ssd'),
        import('@tensorflow/tfjs'),
      ])
      await tf.ready()
      return load({ base: 'lite_mobilenet_v2' }) as Promise<DetectionModel>
    })()
  }
  return cachedModelPromise
}

async function decodeImageWithTensorflowJs(imageBuffer: Buffer): Promise<DisposableTensor> {
  if (!cachedDecodeImage) {
    const [{ default: sharp }, tf] = await Promise.all([import('sharp'), import('@tensorflow/tfjs')])
    await tf.ready()
    cachedDecodeImage = async (buffer: Buffer) => {
      const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
      if (info.channels === 3) {
        return tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32') as DisposableTensor
      }
      if (info.channels === 4) {
        const rgbData = new Uint8Array(info.width * info.height * 3)
        for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex += 4, targetIndex += 3) {
          rgbData[targetIndex] = data[sourceIndex]
          rgbData[targetIndex + 1] = data[sourceIndex + 1]
          rgbData[targetIndex + 2] = data[sourceIndex + 2]
        }
        return tf.tensor3d(rgbData, [info.height, info.width, 3], 'int32') as DisposableTensor
      }
      if (info.channels === 1) {
        const rgbData = new Uint8Array(info.width * info.height * 3)
        for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex += 1, targetIndex += 3) {
          const value = data[sourceIndex]
          rgbData[targetIndex] = value
          rgbData[targetIndex + 1] = value
          rgbData[targetIndex + 2] = value
        }
        return tf.tensor3d(rgbData, [info.height, info.width, 3], 'int32') as DisposableTensor
      }
      throw new Error(`פורמט ערוצי תמונה לא נתמך: ${info.channels.toString(BASE_10)}`)
    }
  }
  return cachedDecodeImage(imageBuffer)
}

function formatMiB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2)
}

function createDefaultDependencies(): DetectorDependencies {
  return {
    loadModel: loadModelOnce,
    decodeImage: decodeImageWithTensorflowJs,
    nowMs: () => Date.now(),
    cpuUsage: (previous?: NodeJS.CpuUsage) => process.cpuUsage(previous),
    memoryUsage: () => process.memoryUsage(),
    logInfo: (message) => console.info(message),
    logError: (message) => console.error(message),
  }
}

/**
 * יוצר בודק רלוונטיות פריים עם הזרקת תלויות לצורך בדיקות.
 */
export function createFrameRelevanceDetector(overrides?: Partial<DetectorDependencies>) {
  const baseDependencies = createDefaultDependencies()
  const dependencies: DetectorDependencies = {
    ...baseDependencies,
    ...overrides,
  }

  return async (frameDataUrl: string): Promise<boolean> => {
    const startedAtMs = dependencies.nowMs()
    const startedCpu = dependencies.cpuUsage()
    const startedHeapBytes = dependencies.memoryUsage().heapUsed
    let currentStage = 'entry'
    try {
      currentStage = 'parseImageDataUrl'
      const imageBuffer = parseImageDataUrl(frameDataUrl)
      // #region agent log
      fetch('http://127.0.0.1:7626/ingest/f6fda51a-fcfa-4231-a1db-7687b6fe417d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8eb92e' },
        body: JSON.stringify({
          sessionId: '8eb92e',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'server/frame-detector.ts:139',
          message: 'image data url parsed',
          data: { bufferBytes: imageBuffer.length, dataUrlPrefix: frameDataUrl.slice(0, 24) },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      currentStage = 'loadModel'
      const model = await dependencies.loadModel()
      // #region agent log
      fetch('http://127.0.0.1:7626/ingest/f6fda51a-fcfa-4231-a1db-7687b6fe417d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8eb92e' },
        body: JSON.stringify({
          sessionId: '8eb92e',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'server/frame-detector.ts:156',
          message: 'model loaded',
          data: {
            thresholdEnv: process.env.FRAME_RELEVANCE_CONFIDENCE_THRESHOLD ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      currentStage = 'decodeImage'
      const tensor = await dependencies.decodeImage(imageBuffer)

      try {
        currentStage = 'detect'
        const detections = await model.detect(tensor)
        const confidenceThreshold = resolveConfidenceThreshold(process.env.FRAME_RELEVANCE_CONFIDENCE_THRESHOLD)
        const relevant = isFrameRelevantByDetections(detections, confidenceThreshold)
        // #region agent log
        fetch('http://127.0.0.1:7626/ingest/f6fda51a-fcfa-4231-a1db-7687b6fe417d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8eb92e' },
          body: JSON.stringify({
            sessionId: '8eb92e',
            runId: 'pre-fix',
            hypothesisId: 'H4',
            location: 'server/frame-detector.ts:185',
            message: 'detections completed',
            data: {
              detectionsCount: detections.length,
              relevant,
              threshold: confidenceThreshold,
              topDetections: detections.slice(0, 5).map((row) => ({
                class: row.class,
                score: row.score ?? null,
              })),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion

        const elapsedMs = dependencies.nowMs() - startedAtMs
        const cpuDelta = dependencies.cpuUsage(startedCpu)
        const heapDeltaBytes = dependencies.memoryUsage().heapUsed - startedHeapBytes
        dependencies.logInfo(
          `[INFO][frame-relevance] done relevant=${relevant} durationMs=${elapsedMs} cpuUserUs=${cpuDelta.user} cpuSystemUs=${cpuDelta.system} heapDeltaMiB=${formatMiB(heapDeltaBytes)} threshold=${confidenceThreshold.toString(BASE_10)}`,
        )
        return relevant
      } finally {
        tensor.dispose()
      }
    } catch (error) {
      const elapsedMs = dependencies.nowMs() - startedAtMs
      const message = error instanceof Error ? error.message : 'שגיאה לא ידועה בזיהוי פריים.'
      // #region agent log
      fetch('http://127.0.0.1:7626/ingest/f6fda51a-fcfa-4231-a1db-7687b6fe417d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8eb92e' },
        body: JSON.stringify({
          sessionId: '8eb92e',
          runId: 'pre-fix',
          hypothesisId: 'H2_H3_H5',
          location: 'server/frame-detector.ts:225',
          message: 'frame detector failed',
          data: {
            stage: currentStage,
            errorMessage: message,
            errorName: error instanceof Error ? error.name : 'unknown',
            stackTop: error instanceof Error ? (error.stack?.split('\n')[0] ?? null) : null,
            elapsedMs,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      dependencies.logError(`[ERROR][frame-relevance] failed durationMs=${elapsedMs} error="${message}"`)
      throw error instanceof Error ? error : new Error('זיהוי רלוונטיות פריים נכשל.')
    }
  }
}

/**
 * מזהה האם פריים כולל אדם/רכב באמצעות מודל COCO-SSD מקומי.
 */
export const detectFrameRelevance = createFrameRelevanceDetector()

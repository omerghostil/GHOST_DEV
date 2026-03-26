export type CaptureProfile = 'scan-low' | 'scan-standard' | 'chat-high'

interface CaptureProfileConfig {
  width: number
  height: number
  quality: number
}

const CAPTURE_PROFILE_CONFIG: Record<CaptureProfile, CaptureProfileConfig> = {
  'scan-low': {
    width: 512,
    height: 288,
    quality: 0.65,
  },
  'scan-standard': {
    width: 640,
    height: 360,
    quality: 0.75,
  },
  'chat-high': {
    width: 1024,
    height: 576,
    quality: 0.85,
  },
}

let sharedStream: MediaStream | null = null
let captureVideoElement: HTMLVideoElement | null = null
let captureCanvasElement: HTMLCanvasElement | null = null

/**
 * מחזיר stream משותף מהמצלמה המקומית.
 * נועד למנוע פתיחות חוזרות של ההתקן בכל פעולה.
 */
async function getOrCreateStream(): Promise<MediaStream> {
  if (sharedStream) {
    return sharedStream
  }

  sharedStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: CAPTURE_PROFILE_CONFIG['scan-standard'].width },
      height: { ideal: CAPTURE_PROFILE_CONFIG['scan-standard'].height },
      facingMode: 'user',
    },
  })

  return sharedStream
}

/**
 * מבטיח שאלמנט הווידאו מוכן להצגת פריים מה-stream.
 */
async function getReadyVideoElement(stream: MediaStream): Promise<HTMLVideoElement> {
  if (!captureVideoElement) {
    captureVideoElement = document.createElement('video')
    captureVideoElement.playsInline = true
    captureVideoElement.muted = true
    captureVideoElement.autoplay = true
  }

  if (captureVideoElement.srcObject !== stream) {
    captureVideoElement.srcObject = stream
  }

  if (captureVideoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup()
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error('כשל בטעינת stream המצלמה.'))
      }
      const cleanup = () => {
        captureVideoElement?.removeEventListener('loadeddata', onLoaded)
        captureVideoElement?.removeEventListener('error', onError)
      }

      captureVideoElement?.addEventListener('loadeddata', onLoaded, { once: true })
      captureVideoElement?.addEventListener('error', onError, { once: true })
    })
  }

  if (captureVideoElement.paused) {
    await captureVideoElement.play()
  }

  return captureVideoElement
}

/**
 * לוכד פריים עדכני מהמצלמה בפורמט WebP Data URL.
 */
export async function captureLatestCameraFrame(profile: CaptureProfile = 'scan-standard'): Promise<string> {
  const selectedProfile = CAPTURE_PROFILE_CONFIG[profile]
  const stream = await getOrCreateStream()
  const video = await getReadyVideoElement(stream)
  const sourceWidth = video.videoWidth || selectedProfile.width
  const sourceHeight = video.videoHeight || selectedProfile.height

  const ratio = Math.min(selectedProfile.width / sourceWidth, selectedProfile.height / sourceHeight)
  const width = Math.max(1, Math.round(sourceWidth * ratio))
  const height = Math.max(1, Math.round(sourceHeight * ratio))

  if (!captureCanvasElement) {
    captureCanvasElement = document.createElement('canvas')
  }

  captureCanvasElement.width = width
  captureCanvasElement.height = height
  const context = captureCanvasElement.getContext('2d')
  if (!context) {
    throw new Error('לא ניתן לאתחל canvas ללכידת פריים.')
  }

  context.drawImage(video, 0, 0, width, height)
  return captureCanvasElement.toDataURL('image/webp', selectedProfile.quality)
}

/**
 * משחרר את כל משאבי המצלמה כדי למנוע זליגת זיכרון.
 */
export function releaseCameraResources() {
  if (sharedStream) {
    sharedStream.getTracks().forEach((track) => track.stop())
    sharedStream = null
  }

  if (captureVideoElement) {
    try {
      captureVideoElement.pause()
    } catch {
      /* JSDOM לא מממש pause, ובדפדפן אמיתי הפעולה נתמכת */
    }
    captureVideoElement.srcObject = null
  }
}

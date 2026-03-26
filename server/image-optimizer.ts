import sharp from 'sharp'

export type VisionDetailLevel = 'low' | 'auto' | 'high'
export type ImageProfileKey = 'scan-low' | 'scan-standard' | 'chat-high'

interface ImageProfile {
  width: number
  height: number
  quality: number
  detail: VisionDetailLevel
}

const IMAGE_PROFILES: Record<ImageProfileKey, ImageProfile> = {
  'scan-low': {
    width: 512,
    height: 288,
    quality: 70,
    detail: 'low',
  },
  'scan-standard': {
    width: 640,
    height: 360,
    quality: 80,
    detail: 'auto',
  },
  'chat-high': {
    width: 1024,
    height: 576,
    quality: 85,
    detail: 'high',
  },
}

export interface OptimizedImageResult {
  dataUrl: string
  width: number
  height: number
  byteSize: number
  detail: VisionDetailLevel
}

const BASE64_DATA_URL_REGEX = /^data:image\/[a-zA-Z0-9+.-]+;base64,/

/**
 * מפרק Data URL של תמונה לבאפר לעיבוד בצד שרת.
 */
function decodeImageDataUrl(dataUrl: string): Buffer {
  if (!BASE64_DATA_URL_REGEX.test(dataUrl)) {
    throw new Error('פורמט תמונה לא נתמך. נדרש data:image/*;base64')
  }
  const [, payload] = dataUrl.split(',', 2)
  if (!payload) {
    throw new Error('קלט תמונה ריק או פגום.')
  }
  return Buffer.from(payload, 'base64')
}

/**
 * דוחס ומבצע resize לתמונה כדי להפחית עלויות טוקנים וזמן העלאה.
 */
export async function optimizeImageDataUrl(dataUrl: string, profileKey: ImageProfileKey): Promise<OptimizedImageResult> {
  const profile = IMAGE_PROFILES[profileKey]
  const inputBuffer = decodeImageDataUrl(dataUrl)

  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: profile.width,
      height: profile.height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: profile.quality,
      mozjpeg: true,
      chromaSubsampling: '4:2:0',
    })
    .toBuffer()

  return {
    dataUrl: `data:image/jpeg;base64,${outputBuffer.toString('base64')}`,
    width: profile.width,
    height: profile.height,
    byteSize: outputBuffer.byteLength,
    detail: profile.detail,
  }
}

export function getImageProfileByTask(task: 'chat' | 'scan', isComplexScan: boolean): ImageProfileKey {
  if (task === 'chat') {
    return 'chat-high'
  }
  return isComplexScan ? 'scan-standard' : 'scan-low'
}

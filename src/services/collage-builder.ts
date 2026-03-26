import {
  COLLAGE_GRID_COLUMNS,
  COLLAGE_GRID_ROWS,
  MAX_COLLAGE_FRAMES,
} from '../data/constants'
import type { TimelineSampledFrame } from '../types'

const TILE_WIDTH = 320
const TILE_HEIGHT = 180
const COLLAGE_EXPORT_QUALITY = 0.82
const STAMP_PADDING_X = 8

function formatTimestampLabel(capturedAtIso: string): string {
  const date = new Date(capturedAtIso)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${day}/${month} ${hours}:${minutes}:${seconds}`
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('טעינת פריים לקולאז׳ נכשלה.'))
    image.src = dataUrl
  })
}

function drawFrameStamp(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.font = '14px monospace'
  const textMetrics = context.measureText(text)
  const stampWidth = Math.ceil(textMetrics.width) + STAMP_PADDING_X * 2
  const stampHeight = 26
  context.fillStyle = 'rgba(0, 0, 0, 0.66)'
  context.fillRect(x + 10, y + 10, stampWidth, stampHeight)
  context.fillStyle = '#f5f7fa'
  context.textBaseline = 'middle'
  context.fillText(text, x + 10 + STAMP_PADDING_X, y + 10 + stampHeight / 2)
}

/**
 * בונה קולאז׳ מ-18 פריימים בגודל 6x3 עם חותמות זמן לכל פריים.
 */
export async function buildCollageFromFrames(frames: TimelineSampledFrame[]): Promise<string> {
  const collageCanvas = document.createElement('canvas')
  collageCanvas.width = COLLAGE_GRID_COLUMNS * TILE_WIDTH
  collageCanvas.height = COLLAGE_GRID_ROWS * TILE_HEIGHT
  const context = collageCanvas.getContext('2d')
  if (!context) {
    throw new Error('לא ניתן לאתחל canvas ליצירת קולאז׳.')
  }

  context.fillStyle = '#0d1117'
  context.fillRect(0, 0, collageCanvas.width, collageCanvas.height)

  const boundedFrames = frames.slice(-MAX_COLLAGE_FRAMES)
  const loadedImages = await Promise.all(boundedFrames.map((frame) => loadImage(frame.dataUrl)))

  for (let index = 0; index < loadedImages.length; index += 1) {
    const image = loadedImages[index]
    const frame = boundedFrames[index]
    const row = Math.floor(index / COLLAGE_GRID_COLUMNS)
    const col = index % COLLAGE_GRID_COLUMNS
    const targetX = col * TILE_WIDTH
    const targetY = row * TILE_HEIGHT

    context.drawImage(image, targetX, targetY, TILE_WIDTH, TILE_HEIGHT)
    drawFrameStamp(context, formatTimestampLabel(frame.capturedAtIso), targetX, targetY)
  }

  return collageCanvas.toDataURL('image/jpeg', COLLAGE_EXPORT_QUALITY)
}

// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CriticalAlertsCenter } from './critical-alerts-center'
import type { CriticalAlertItem } from '../utils/critical-alerts'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

interface RenderedAlertsCenter {
  container: HTMLDivElement
  unmount: () => void
}

function buildAlert(partial: Partial<CriticalAlertItem>): CriticalAlertItem {
  return {
    messageId: partial.messageId ?? 'm-1',
    channelId: partial.channelId ?? 'c-1',
    channelName: partial.channelName ?? 'ערוץ בדיקה',
    operationName: partial.operationName ?? 'זיהוי חריג',
    summary: partial.summary ?? 'אדם עם חולצה שחורה זוהה סמוך לכניסה',
    time: partial.time ?? '20:11',
    text: partial.text ?? 'התראה קריטית',
    frameDataUrl: partial.frameDataUrl,
    status: partial.status ?? 'pending',
  }
}

function renderAlertsCenter(alerts: CriticalAlertItem[]): RenderedAlertsCenter {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <CriticalAlertsCenter
        alerts={alerts}
        onApprove={vi.fn()}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onIgnore={vi.fn()}
        onSelectChannel={vi.fn()}
      />,
    )
  })

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CriticalAlertsCenter', () => {
  it('מציג פריים בתוך כרטיס התראה כאשר קיים frameDataUrl', () => {
    const { container, unmount } = renderAlertsCenter([
      buildAlert({ frameDataUrl: 'data:image/png;base64,abc123' }),
    ])

    const previewImage = container.querySelector('.alerts-center-frame-preview') as HTMLImageElement | null
    expect(previewImage).toBeTruthy()
    expect(previewImage?.getAttribute('src')).toBe('data:image/png;base64,abc123')
    unmount()
  })

  it('לא מציג פריים כאשר אין frameDataUrl', () => {
    const { container, unmount } = renderAlertsCenter([buildAlert({ frameDataUrl: undefined })])

    const previewImage = container.querySelector('.alerts-center-frame-preview')
    expect(previewImage).toBeNull()
    unmount()
  })
})

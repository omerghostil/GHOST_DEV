import { useEffect } from 'react'

const AUTO_DISMISS_MS = 8_000

interface FlashAlertData {
  channelName: string
  operationName: string
  summary: string
}

interface FlashAlertOverlayProps {
  alert: FlashAlertData
  onDismiss: () => void
}

/**
 * שכבת התראה קריטית — עוקבת אחרי שפת ה-brand-modal: רקע כהה עם blur, כרטיס מרכזי,
 * היררכיה ברורה (eyebrow → כותרת → תוכן → פעולות), סגירה אוטומטית או ידנית.
 */
export function FlashAlertOverlay({ alert, onDismiss }: FlashAlertOverlayProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <div aria-modal className="alert-flash-overlay" role="dialog">
      <div className="alert-flash-card">
        <div className="alert-flash-header">
          <span className="alert-flash-indicator" />
          <p className="eyebrow">CRITICAL ALERT</p>
        </div>

        <h3 className="alert-flash-title">התראה קריטית</h3>

        <dl className="alert-flash-details">
          <div className="alert-flash-detail-row">
            <dt>ערוץ</dt>
            <dd>{alert.channelName}</dd>
          </div>
          <div className="alert-flash-detail-row">
            <dt>מבצע</dt>
            <dd>{alert.operationName}</dd>
          </div>
        </dl>

        <p className="alert-flash-summary">{alert.summary}</p>

        <div className="alert-flash-actions">
          <button className="danger-button alert-flash-confirm" onClick={onDismiss} type="button">
            ראיתי — סגור התראה
          </button>
        </div>

        <div className="alert-flash-timer-bar" />
      </div>
    </div>
  )
}

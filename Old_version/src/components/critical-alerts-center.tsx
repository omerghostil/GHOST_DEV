import type { CriticalAlertItem } from '../utils/critical-alerts'

interface CriticalAlertsCenterProps {
  alerts: CriticalAlertItem[]
  onClose: () => void
  onSelectChannel: (channelId: string) => void
  onApprove: (alert: CriticalAlertItem) => void
  onIgnore: (alert: CriticalAlertItem) => void
  onDelete: (alert: CriticalAlertItem) => void
}

/**
 * מרכז התראות קריטיות גלובלי לפעולות אישור, התעלמות ומחיקה.
 */
export function CriticalAlertsCenter({
  alerts,
  onClose,
  onSelectChannel,
  onApprove,
  onIgnore,
  onDelete,
}: CriticalAlertsCenterProps) {
  const pendingCount = alerts.filter((alert) => alert.status === 'pending').length
  const approvedCount = alerts.filter((alert) => alert.status === 'approved').length
  const ignoredCount = alerts.filter((alert) => alert.status === 'ignored').length

  return (
    <div aria-modal className="brand-modal-overlay alerts-center-overlay" role="dialog">
      <section className="alerts-center" aria-label="מרכז התראות קריטיות">
        <header className="alerts-center-header">
          <div>
            <p className="eyebrow">מרכז התראות</p>
            <h3>התראות קריטיות</h3>
          </div>
          <div className="alerts-center-stats" aria-label="סטטוס התראות">
            <span>{pendingCount} פתוחות</span>
            <span>{approvedCount} מאושרות</span>
            <span>{ignoredCount} בהתעלמות</span>
          </div>
        </header>

        <div className="alerts-center-list" role="list">
          {alerts.length === 0 ? (
            <div className="alerts-center-empty card">
              <p className="eyebrow">תקין</p>
              <p>אין כרגע התראות קריטיות במערכת.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <article key={alert.messageId} className={`alerts-center-item alerts-center-item-${alert.status}`} role="listitem">
                <div className="alerts-center-item-head">
                  <div className="alerts-center-item-title-wrap">
                    <p className="alerts-center-item-channel">{alert.channelName}</p>
                    <h4>{alert.operationName}</h4>
                  </div>
                  <span className={`alerts-center-status-badge status-${alert.status}`}>
                    {alert.status === 'pending'
                      ? 'בטיפול'
                      : alert.status === 'approved'
                        ? 'אושר'
                        : 'בהתעלמות'}
                  </span>
                </div>

                <dl className="alerts-center-meta">
                  <div>
                    <dt>שעה</dt>
                    <dd>{alert.time}</dd>
                  </div>
                  <div>
                    <dt>ערוץ</dt>
                    <dd>{alert.channelName}</dd>
                  </div>
                </dl>

                <p className="alerts-center-summary">{alert.summary}</p>
                {alert.frameDataUrl ? (
                  <div className="alerts-center-frame-wrap">
                    <img
                      alt={`פריים התראה קריטית - ${alert.channelName}`}
                      className="alerts-center-frame-preview"
                      src={alert.frameDataUrl}
                    />
                  </div>
                ) : null}

                <div className="alerts-center-actions">
                  <button className="ghost-button" onClick={() => onSelectChannel(alert.channelId)} type="button">
                    מעבר לערוץ
                  </button>
                  <button
                    className="primary-button"
                    disabled={alert.status === 'approved'}
                    onClick={() => onApprove(alert)}
                    type="button"
                  >
                    אישור
                  </button>
                  <button
                    className="ghost-button"
                    disabled={alert.status === 'ignored'}
                    onClick={() => onIgnore(alert)}
                    type="button"
                  >
                    התעלמות
                  </button>
                  <button className="danger-button" onClick={() => onDelete(alert)} type="button">
                    מחיקה
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="alerts-center-footer">
          <button className="ghost-button" onClick={onClose} type="button">
            סגירה
          </button>
        </footer>
      </section>
    </div>
  )
}

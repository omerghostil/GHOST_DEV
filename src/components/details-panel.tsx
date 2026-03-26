import { useEffect, useRef } from 'react'
import { LIVE_STATE_META, OPERATION_MODE_META } from '../data/constants'
import type { Channel } from '../types'
import { StatusDot } from './status-dot'

interface DetailsPanelProps {
  selectedChannel: Channel
  isDetailsCollapsed: boolean
  onSetMobilePanelChat: () => void
  onExpandDetails: () => void
  onCollapseDetails: () => void
  onToggleOperation: (operationId: string) => void
  /** מעבר למסך מרכז ערוצים לעריכה מלאה */
  onOpenChannelsHub: () => void
}

/**
 * פאנל סיכום ערוץ בלוח הבקרה.
 * עריכת הגדרות ומבצעים מתבצעת במרכז ערוצים בלבד.
 */
export function DetailsPanel({
  selectedChannel,
  isDetailsCollapsed,
  onSetMobilePanelChat,
  onExpandDetails,
  onCollapseDetails,
  onToggleOperation,
  onOpenChannelsHub,
}: DetailsPanelProps) {
  const shellRef = useRef<HTMLElement>(null)

  const statusLabel = LIVE_STATE_META[selectedChannel.liveState]?.label ?? 'לא זמין'
  const enabledOpsCount = selectedChannel.operations.filter((op) => op.enabled).length

  /* Escape כשהפוקוס בתוך פאנל הפרטים — קיפול פאנל הפרטים כולו */
  useEffect(() => {
    if (isDetailsCollapsed) {
      return undefined
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      const shell = shellRef.current
      if (shell?.contains(document.activeElement)) {
        onCollapseDetails()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDetailsCollapsed, onCollapseDetails])

  return (
    <aside ref={shellRef} className={`panel details-panel ${isDetailsCollapsed ? 'collapsed' : ''}`}>
      <div className="details-collapsed-rail desktop-only">
        <button className="ghost-button" onClick={onExpandDetails} type="button">
          פתח
        </button>
        <span className="eyebrow">Settings</span>
        <strong>{selectedChannel.name}</strong>
      </div>

      <div className="details-content">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Details</p>
            <h2>{selectedChannel.name}</h2>
            <p className="details-status-line">
              <StatusDot className="channel-status-dot" liveState={selectedChannel.liveState} />
              {`${selectedChannel.liveState} · ${statusLabel}`}
            </p>
          </div>
          <div className="details-panel-actions">
            <button
              aria-label="צמצום פאנל פרטי ערוץ"
              className="ghost-button desktop-only"
              onClick={onCollapseDetails}
              type="button"
            >
              קפל
            </button>
            <button className="ghost-button mobile-only" onClick={onSetMobilePanelChat} type="button">
              חזור
            </button>
          </div>
        </div>

        <section className="card details-hub-cta-card">
          <p className="details-hub-cta-copy">
            ניהול שם ערוץ, מיקום, RTSP, זיכרון ומבצעים מתבצע ב־
            <strong>מרכז ערוצים</strong>.
          </p>
          <button className="primary-button" onClick={onOpenChannelsHub} type="button">
            פתח מרכז ערוצים
          </button>
        </section>

        <section className="card details-readonly-card">
          <div className="section-heading">
            <h3>פרטים</h3>
            <span>קריאה בלבד</span>
          </div>
          <dl className="details-readonly-dl">
            <div>
              <dt>שם</dt>
              <dd>{selectedChannel.name}</dd>
            </div>
            <div>
              <dt>מיקום</dt>
              <dd>{selectedChannel.location}</dd>
            </div>
            <div>
              <dt>היקף צפייה</dt>
              <dd>{selectedChannel.watchScope}</dd>
            </div>
            <div>
              <dt>RTSP</dt>
              <dd className="details-readonly-mono">{selectedChannel.rtspFeed}</dd>
            </div>
            <div>
              <dt>{selectedChannel.type === 'group' ? 'צ׳אטים מצורפים' : 'חברים'}</dt>
              <dd>
                <div className="source-tags">
                  {selectedChannel.members.map((member) => (
                    <span key={member}>{member}</span>
                  ))}
                </div>
              </dd>
            </div>
          </dl>
        </section>

        <section className="card details-ops-card">
          <div className="section-heading">
            <h3>מבצעים</h3>
            <span>{enabledOpsCount}/{selectedChannel.operations.length} פעילים</span>
          </div>

          {selectedChannel.operations.length === 0 ? (
            <p className="details-ops-empty">אין מבצעים מוגדרים לערוץ זה.</p>
          ) : (
            <div className="details-ops-list">
              {selectedChannel.operations.map((operation) => (
                <article
                  key={operation.id}
                  className={`details-op-item ${operation.enabled ? 'details-op-enabled' : 'details-op-paused'}`}
                >
                  <div className="details-op-head">
                    <div className="details-op-info">
                      <span className="details-op-status-label">
                        {operation.enabled ? 'פעיל' : 'מושהה'}
                      </span>
                      <strong className="details-op-name">{operation.name}</strong>
                    </div>
                    <button
                      className={`operation-toggle ${operation.enabled ? 'enabled' : ''}`}
                      onClick={() => onToggleOperation(operation.id)}
                      type="button"
                    >
                      <span className="operation-toggle-thumb" />
                    </button>
                  </div>

                  <dl className="details-op-meta">
                    <div>
                      <dt>סוג</dt>
                      <dd>{OPERATION_MODE_META[operation.mode].label}</dd>
                    </div>
                    <div>
                      <dt>תזמון</dt>
                      <dd>{operation.schedule || '—'}</dd>
                    </div>
                    <div>
                      <dt>{OPERATION_MODE_META[operation.mode].triggerLabel}</dt>
                      <dd>{operation.trigger || '—'}</dd>
                    </div>
                    {operation.action ? (
                      <div>
                        <dt>הנחיות</dt>
                        <dd>{operation.action}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}

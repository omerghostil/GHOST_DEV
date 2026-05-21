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
  onCollapseDetails,
  onToggleOperation,
  onOpenChannelsHub,
}: DetailsPanelProps) {
  const shellRef = useRef<HTMLElement>(null)

  const statusMeta = LIVE_STATE_META[selectedChannel.liveState]
  const statusLabel = statusMeta?.label ?? 'לא זמין'
  const enabledOpsCount = selectedChannel.operations.filter((op) => op.enabled).length

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
    <aside
      ref={shellRef}
      aria-hidden={isDetailsCollapsed}
      className={`panel details-panel ${isDetailsCollapsed ? 'drawer-closed' : 'drawer-open'}`}
    >

      <div className="details-content">
        {/* ── Header ── */}
        <div className="dp-header">
          <div className="dp-header-top">
            <p className="dp-eyebrow">פרטי ערוץ</p>
            <div className="dp-header-actions">
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
          <h2 className="dp-channel-name">{selectedChannel.name}</h2>
          <div className="dp-status-badge">
            <StatusDot className="channel-status-dot" liveState={selectedChannel.liveState} />
            <span className="dp-status-state">{selectedChannel.liveState}</span>
            <span className="dp-status-divider">·</span>
            <span className="dp-status-label">{statusLabel}</span>
          </div>
        </div>

        {/* ── CTA: מרכז ערוצים ── */}
        <div className="dp-section dp-hub-cta">
          <div className="dp-hub-cta-inner">
            <p className="dp-hub-cta-text">
              ניהול הגדרות, מיקום, RTSP, זיכרון ומבצעים מתבצע דרך
              <strong> מרכז ערוצים</strong>.
            </p>
            <button className="primary-button dp-hub-cta-btn" onClick={onOpenChannelsHub} type="button">
              מרכז ערוצים
            </button>
          </div>
        </div>

        {/* ── פרטים ── */}
        <div className="dp-section">
          <div className="dp-section-header">
            <h3 className="dp-section-title">פרטים</h3>
            <span className="dp-section-badge">קריאה בלבד</span>
          </div>
          <dl className="dp-fields">
            <div className="dp-field">
              <dt>שם</dt>
              <dd>{selectedChannel.name}</dd>
            </div>
            <div className="dp-field">
              <dt>מיקום</dt>
              <dd>{selectedChannel.location}</dd>
            </div>
            <div className="dp-field">
              <dt>היקף צפייה</dt>
              <dd>{selectedChannel.watchScope}</dd>
            </div>
            <div className="dp-field">
              <dt>RTSP</dt>
              <dd className="dp-field-mono">{selectedChannel.rtspFeed}</dd>
            </div>
            <div className="dp-field">
              <dt>{selectedChannel.type === 'group' ? 'צ׳אטים מצורפים' : 'חברים'}</dt>
              <dd>
                <div className="dp-tags">
                  {selectedChannel.members.map((member) => (
                    <span key={member} className="dp-tag">{member}</span>
                  ))}
                </div>
              </dd>
            </div>
          </dl>
        </div>

        {/* ── מבצעים ── */}
        <div className="dp-section">
          <div className="dp-section-header">
            <h3 className="dp-section-title">מבצעים</h3>
            <span className="dp-section-badge">
              {enabledOpsCount}/{selectedChannel.operations.length}
            </span>
          </div>

          {selectedChannel.operations.length === 0 ? (
            <p className="dp-empty-hint">אין מבצעים מוגדרים לערוץ זה.</p>
          ) : (
            <div className="dp-ops-list">
              {selectedChannel.operations.map((operation) => (
                <article
                  key={operation.id}
                  className={`dp-op-card ${operation.enabled ? 'dp-op-active' : 'dp-op-paused'}`}
                >
                  <div className="dp-op-top">
                    <div className="dp-op-identity">
                      <span className={`dp-op-indicator ${operation.enabled ? 'on' : 'off'}`} />
                      <div className="dp-op-name-wrap">
                        <strong className="dp-op-name">{operation.name}</strong>
                        <span className="dp-op-state-label">
                          {operation.enabled ? 'פעיל' : 'מושהה'}
                        </span>
                      </div>
                    </div>
                    <button
                      className={`operation-toggle ${operation.enabled ? 'enabled' : ''}`}
                      onClick={() => onToggleOperation(operation.id)}
                      type="button"
                    >
                      <span className="operation-toggle-thumb" />
                    </button>
                  </div>

                  <dl className="dp-op-meta">
                    <div className="dp-op-meta-row">
                      <dt>סוג</dt>
                      <dd>{OPERATION_MODE_META[operation.mode].label}</dd>
                    </div>
                    <div className="dp-op-meta-row">
                      <dt>תזמון</dt>
                      <dd>{operation.schedule || '—'}</dd>
                    </div>
                    <div className="dp-op-meta-row">
                      <dt>{OPERATION_MODE_META[operation.mode].triggerLabel}</dt>
                      <dd>{operation.trigger || '—'}</dd>
                    </div>
                    {operation.action ? (
                      <div className="dp-op-meta-row dp-op-meta-full">
                        <dt>הנחיות</dt>
                        <dd>{operation.action}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

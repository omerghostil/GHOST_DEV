import type { Message } from '../types'

interface MessageRowProps {
  message: Message
  onDismissFrame?: (messageId: string) => void
}

const AUTHOR_LABELS: Record<string, string> = {
  ghost: 'G',
  system: 'SYS',
  user: 'ME',
}

const ALERT_LEVEL_CLASS: Record<string, string> = {
  critical: 'alert-critical',
  routine: 'alert-routine',
  report: 'alert-report',
  rating: 'alert-rating',
  assessment: 'alert-assessment',
}

const SCAN_LABEL_MAP: Record<string, { className: string; text: string }> = {
  critical:   { className: 'scan-label-critical',   text: 'CRITICAL' },
  routine:    { className: 'scan-label-routine',    text: 'SCAN OK' },
  report:     { className: 'scan-label-report',     text: 'REPORT' },
  rating:     { className: 'scan-label-rating',     text: 'RATING' },
  assessment: { className: 'scan-label-assessment', text: 'ASSESSMENT' },
}

const AVATAR_MAP: Record<string, string> = {
  critical: '!',
  routine: '✓',
  report: '📋',
  rating: '★',
  assessment: '◉',
}

/**
 * מציג שורת הודעה בצ׳אט — מבנה היררכי ברור לפי סוג: user / ghost / system / scan.
 */
export function MessageRow({ message, onDismissFrame }: MessageRowProps) {
  const isScan = Boolean(message.alertLevel)
  const levelClass = message.alertLevel ? (ALERT_LEVEL_CLASS[message.alertLevel] ?? '') : ''
  const isGhostAvatar = message.author === 'ghost' && !message.alertLevel

  function avatarLabel() {
    if (message.alertLevel) {
      return AVATAR_MAP[message.alertLevel] ?? 'SYS'
    }
    return AUTHOR_LABELS[message.author] ?? 'U'
  }

  const scanLabelInfo = message.alertLevel ? SCAN_LABEL_MAP[message.alertLevel] : null

  return (
    <article className={`message-row ${message.author} ${levelClass}`}>
      {isGhostAvatar ? (
        <img className="message-avatar message-avatar-ghost-logo" src="/ghost-logo.png" alt="Ghost" />
      ) : (
        <div className="message-avatar">{avatarLabel()}</div>
      )}
      <div className="message-body">
        {isScan && scanLabelInfo ? (
          <span className={`message-scan-label ${scanLabelInfo.className}`}>
            {scanLabelInfo.text}
            {message.alertLevel === 'rating' && message.score != null ? ` ${message.score}/10` : ''}
          </span>
        ) : null}
        {message.sources && message.sources.length === 1 ? (
          <div className="message-camera-header">
            <span className="message-camera-badge">{message.sources[0]}</span>
          </div>
        ) : null}
        <div className="message-bubble">
          <p>{message.text}</p>
          {message.sources && message.sources.length > 1 ? (
            <div className="source-tags">
              {message.sources.map((source) => (
                <span key={source}>{source}</span>
              ))}
            </div>
          ) : null}
          <span className="timestamp">{message.time}</span>
        </div>
        {message.frameDataUrl ? (
          <div className="message-frame-wrap">
            <img
              alt="פריים סריקה"
              className="message-frame-preview"
              src={message.frameDataUrl}
            />
            {onDismissFrame ? (
              <button
                className="message-frame-dismiss"
                onClick={() => onDismissFrame(message.id)}
                title="ראיתי — הסתר פריים"
                type="button"
              >
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

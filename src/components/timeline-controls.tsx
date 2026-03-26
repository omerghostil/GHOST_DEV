import { MAX_COLLAGE_FRAMES, TIMELINE_INTERVALS_SECONDS } from '../data/constants'
import type { TimelineSamplerState } from '../types'

interface TimelineControlsProps {
  samplerState: TimelineSamplerState
  onStartSampling: (intervalSeconds: 2 | 4 | 8) => void
  onStopSampling: () => void
}

/**
 * בקרות דגימת ציר-זמן לערוץ: הפעלה, עצירה ותצוגת התקדמות פריימים.
 */
export function TimelineControls({
  samplerState,
  onStartSampling,
  onStopSampling,
}: TimelineControlsProps) {
  const sampledCount = samplerState.sampledFrames.length

  return (
    <div className="timeline-controls">
      <div className="timeline-controls-header">
        <span className={`timeline-state-dot ${samplerState.isActive ? 'active' : ''}`} />
        <strong>דגימת ציר-זמן</strong>
      </div>

      {samplerState.isActive ? (
        <div className="timeline-controls-row">
          <span className="timeline-progress-label">
            {sampledCount}/{MAX_COLLAGE_FRAMES} פריימים
          </span>
          <span className="timeline-interval-label">כל {samplerState.intervalSeconds} שנ׳</span>
          <button className="ghost-button" onClick={onStopSampling} type="button">
            עצור
          </button>
        </div>
      ) : (
        <div className="timeline-controls-row">
          <span className="timeline-progress-label">בחר קצב דגימה</span>
          <div className="timeline-interval-buttons">
            {TIMELINE_INTERVALS_SECONDS.map((intervalSeconds) => (
              <button
                key={intervalSeconds}
                className="chip-button"
                onClick={() => onStartSampling(intervalSeconds)}
                type="button"
              >
                כל {intervalSeconds} שנ׳
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="timeline-progress-track" aria-hidden>
        <div
          className="timeline-progress-fill"
          style={{ transform: `scaleX(${sampledCount / MAX_COLLAGE_FRAMES})` }}
        />
      </div>
    </div>
  )
}

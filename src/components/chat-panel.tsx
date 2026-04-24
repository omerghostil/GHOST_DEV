import { useEffect, useMemo, useState, type RefObject } from 'react'
import { LIVE_STATE_META, QUICK_PROMPTS } from '../data/constants'
import type { Channel, TimelineSamplerState } from '../types'
import { MessageRow } from './message-row'
import { StatusDot } from './status-dot'
import { TimelineControls } from './timeline-controls'

interface NextScanInfo {
  deadline: number
  operationName: string
  totalCycleMs: number
}

interface ChatPanelProps {
  selectedChannel: Channel
  isSending: boolean
  messageDraft: string
  messageStreamRef: RefObject<HTMLDivElement | null>
  activeOpsCount: number
  nextScanInfo: NextScanInfo | null
  timelineSamplerState: TimelineSamplerState
  onDismissFrame: (messageId: string) => void
  onMessageDraftChange: (value: string) => void
  onMessageSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onStartTimelineSampling: (intervalSeconds: 2 | 4 | 8) => void
  onStopTimelineSampling: () => void
  onShowInbox: () => void
  onShowDetails: () => void
  onSuggestionClick: (prompt: string) => void
  onMessageStreamScroll: () => void
}

interface CountdownState {
  minutes: number
  seconds: number
  progress: number
  operationName: string
}

export function ChatPanel({
  selectedChannel,
  isSending,
  messageDraft,
  messageStreamRef,
  activeOpsCount,
  nextScanInfo,
  timelineSamplerState,
  onDismissFrame,
  onMessageDraftChange,
  onMessageSubmit,
  onStartTimelineSampling,
  onStopTimelineSampling,
  onShowInbox,
  onShowDetails,
  onSuggestionClick,
  onMessageStreamScroll,
}: ChatPanelProps) {
  const statusLabel = LIVE_STATE_META[selectedChannel.liveState]?.label ?? 'לא זמין'
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (activeOpsCount === 0) {
      return
    }
    const timer = setInterval(() => setCountdownNowMs(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [activeOpsCount])

  useEffect(() => {
    if (!nextScanInfo) {
      return
    }
    setCountdownNowMs(Date.now())
  }, [nextScanInfo?.deadline, nextScanInfo?.operationName])

  const countdown = useMemo<CountdownState | null>(() => {
    if (!nextScanInfo || activeOpsCount === 0) {
      return null
    }
    const remaining = Math.max(0, nextScanInfo.deadline - countdownNowMs)
    const totalSec = Math.floor((remaining + 999) / 1_000)
    const progress = nextScanInfo.totalCycleMs > 0 ? Math.min(1, remaining / nextScanInfo.totalCycleMs) : 0
    return {
      minutes: Math.floor(totalSec / 60),
      seconds: totalSec % 60,
      progress,
      operationName: nextScanInfo.operationName,
    }
  }, [activeOpsCount, countdownNowMs, nextScanInfo])

  return (
    <section className="panel chat-panel">
      <div className="chat-header">
        <div className="chat-header-actions mobile-only">
          <button className="ghost-button" onClick={onShowInbox} type="button">
            שיחות
          </button>
        </div>

        <div className="chat-title-block">
          <button
            aria-label="פתיחת פאנל פרטי ערוץ"
            className="title-cluster"
            onClick={onShowDetails}
            type="button"
          >
            {selectedChannel.lastFrameDataUrl ? (
              <img
                className="channel-badge channel-badge-image"
                src={selectedChannel.lastFrameDataUrl}
                alt={`פריים אחרון של ${selectedChannel.name}`}
              />
            ) : (
              <div className="channel-badge">{selectedChannel.type === 'group' ? 'קבוצה' : 'ערוץ'}</div>
            )}
            <div className="title-cluster-text">
              <h2>{selectedChannel.name}</h2>
              <p className="route">{selectedChannel.location}</p>
            </div>
          </button>
          <div className="live-status">
            <StatusDot liveState={selectedChannel.liveState} className="live-dot" />
            <span>{`${selectedChannel.liveState} · ${statusLabel}`}</span>
          </div>
        </div>

        <TimelineControls
          samplerState={timelineSamplerState}
          onStartSampling={onStartTimelineSampling}
          onStopSampling={onStopTimelineSampling}
        />

        {activeOpsCount > 0 ? (
          <div className="ops-status-bar">
            <span className="ops-count-pill">{activeOpsCount} מבצעים פעילים</span>
            {countdown ? (
              <div className="ops-countdown">
                <div className="ops-countdown-track">
                  <div
                    className="ops-countdown-fill"
                    style={{ transform: `scaleX(${countdown.progress})` }}
                  />
                </div>
                <div className="ops-countdown-text">
                  <span className="ops-countdown-label">{countdown.operationName}</span>
                  <span className="ops-countdown-time">
                    {countdown.minutes > 0 ? `${countdown.minutes}m ` : ''}
                    <strong className="ops-countdown-seconds">
                      {String(countdown.seconds).padStart(2, '0')}s
                    </strong>
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="message-stream" onScroll={onMessageStreamScroll} ref={messageStreamRef}>
        {selectedChannel.messages.map((message) => (
          <MessageRow key={message.id} message={message} onDismissFrame={onDismissFrame} />
        ))}
      </div>

      <form className="composer" onSubmit={onMessageSubmit}>
        <textarea
          rows={2}
          value={messageDraft}
          onChange={(event) => onMessageDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="כתוב שאלה או בקשה — יישלח ניתוח פריים, ואם יש מבצעים מופעלים גם סריקת התראות..."
        />
        <div className="composer-suggestions">
          {QUICK_PROMPTS.map((prompt) => (
            <button key={prompt} className="chip-button" onClick={() => onSuggestionClick(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
        <div className="composer-actions">
          <button className="ghost-button mobile-only" onClick={onShowDetails} type="button">
            הגדרות ערוץ
          </button>
          <button className="primary-button" disabled={isSending || !messageDraft.trim()} type="submit">
            {isSending ? 'שולח...' : 'שלח'}
          </button>
        </div>
      </form>
    </section>
  )
}

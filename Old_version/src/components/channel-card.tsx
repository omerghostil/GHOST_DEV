import { LIVE_STATE_META } from '../data/constants'
import type { Channel } from '../types'
import { getMinutesSinceTimeLabel } from '../utils/time'
import { StatusDot } from './status-dot'

interface ChannelCardProps {
  channel: Channel
  isAlerting?: boolean
  isSelected: boolean
  onSelect: (channelId: string) => void
}

export function ChannelCard({ channel, isAlerting, isSelected, onSelect }: ChannelCardProps) {
  const lastMessageTime = channel.messages.at(-1)?.time ?? '--:--'
  const lastMessagePreview = channel.messages.at(-1)?.text.trim() || channel.watchScope
  const lastActiveMinutes = getMinutesSinceTimeLabel(lastMessageTime)
  const statusMeta = LIVE_STATE_META[channel.liveState]
  const isGroup = channel.type === 'group'
  const memberCount = channel.members.length

  return (
    <button
      className={`chat-list-item ${isSelected ? 'selected' : ''} ${isGroup ? 'chat-list-item-group' : ''} ${isAlerting ? 'channel-alerting' : ''}`}
      onClick={() => onSelect(channel.id)}
      type="button"
    >
      {channel.lastFrameDataUrl && !isGroup ? (
        <img
          className="chat-avatar chat-avatar-image"
          src={channel.lastFrameDataUrl}
          alt={`פריים אחרון של ${channel.name}`}
          loading="lazy"
        />
      ) : (
        <div className={`chat-avatar ${isGroup ? 'chat-avatar-group' : ''}`}>
          {isGroup ? (memberCount > 0 ? memberCount : 'ק') : 'מ'}
        </div>
      )}

      <div className="chat-list-copy">
        <div className="chat-list-row">
          <strong>{channel.name}</strong>
          <span className="timestamp">{`${lastActiveMinutes} דק׳`}</span>
        </div>

        <div className="chat-list-row secondary">
          <span>
            <StatusDot liveState={channel.liveState} className="channel-status-dot" />
            {statusMeta?.label ?? 'לא זמין'}
          </span>
          {isGroup ? (
            <span className="group-type-badge" title="שיחה קבוצתית">
              קבוצה · {memberCount}
            </span>
          ) : null}
          {channel.unread > 0 ? <span className="unread-pill">{channel.unread}</span> : null}
        </div>

        <p title={lastMessagePreview}>{lastMessagePreview}</p>
      </div>
    </button>
  )
}

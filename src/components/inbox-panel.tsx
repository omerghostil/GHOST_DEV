import type { Channel } from '../types'
import { ChannelCard } from './channel-card'

interface InboxPanelProps {
  channels: Channel[]
  selectedChannelId: string
  isGroupingMode: boolean
  groupSelectionIds: string[]
  alertingChannelIds: Set<string>
  searchQuery: string
  visibleCount: number
  hasMoreChannels: boolean
  onSelectChannel: (channelId: string) => void
  onToggleGroupingMode: () => void
  onToggleGroupSelection: (channelId: string) => void
  onCreateGroupFromSelection: () => void
  onSearchQueryChange: (value: string) => void
  onLoadMoreChannels: () => void
}

/**
 * רשימת שיחות בלוח הבקרה — חיפוש, סינון וקיבוץ מהיר.
 * יצירת ערוץ חדש מתבצעת במרכז ערוצים בלבד.
 */
export function InboxPanel({
  channels,
  selectedChannelId,
  isGroupingMode,
  groupSelectionIds,
  alertingChannelIds,
  searchQuery,
  visibleCount,
  hasMoreChannels,
  onSelectChannel,
  onToggleGroupingMode,
  onToggleGroupSelection,
  onCreateGroupFromSelection,
  onSearchQueryChange,
  onLoadMoreChannels,
}: InboxPanelProps) {
  return (
    <aside className="panel inbox-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>ערוצים</h2>
        </div>
        <div className="inbox-header-actions">
          <button className="ghost-button" onClick={onToggleGroupingMode} type="button">
            {isGroupingMode ? 'סיים קיבוץ' : 'קבץ'}
          </button>
        </div>
      </div>

      {isGroupingMode ? (
        <div className="card inbox-grouping-card">
          <p className="inbox-grouping-hint">סמן לפחות שני ערוצים אישיים ולחץ על יצירת קבוצה.</p>
          <button
            className="primary-button"
            disabled={groupSelectionIds.length < 2}
            onClick={onCreateGroupFromSelection}
            type="button"
          >
            צור קבוצה מהנבחרים ({groupSelectionIds.length})
          </button>
        </div>
      ) : null}

      <div className="inbox-search-bar">
        <input
          className="inbox-search-input"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="חפש ערוץ, קבוצה או הודעה..."
        />
      </div>

      <div className="chat-list">
        {channels.slice(0, visibleCount).map((channel) => {
          const isGroupCandidate = channel.type === 'personal'
          const isChecked = groupSelectionIds.includes(channel.id)
          return (
            <div className="chat-list-entry" key={channel.id}>
              {isGroupingMode ? (
                <label className="chat-list-group-toggle" title={isGroupCandidate ? 'בחר לקיבוץ' : 'רק ערוצים אישיים זמינים לקיבוץ'}>
                  <input
                    checked={isChecked}
                    disabled={!isGroupCandidate}
                    onChange={() => onToggleGroupSelection(channel.id)}
                    type="checkbox"
                  />
                </label>
              ) : null}

              <ChannelCard
                channel={channel}
                isAlerting={alertingChannelIds.has(channel.id)}
                isSelected={channel.id === selectedChannelId}
                onSelect={onSelectChannel}
              />

            </div>
          )
        })}
        {hasMoreChannels ? (
          <button className="ghost-button load-more-button" onClick={onLoadMoreChannels} type="button">
            טען עוד
          </button>
        ) : null}
      </div>
    </aside>
  )
}

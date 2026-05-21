import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { LIVE_STATE_META, OPERATION_MODE_META, OPERATION_MODES } from '../data/constants'
import { parseSchedule, describeSchedule } from '../services/schedule-parser'
import type { Channel, ChannelType, NewChannelDraft, Operation, OperationDraft, OperationMode } from '../types'
import { StatusDot } from './status-dot'

const SCHEDULE_QUICK_SUGGESTIONS = [
  'כל 10 שניות',
  'כל 30 שניות',
  'כל דקה',
  'כל 2 דקות',
  'כל 10 דקות',
  'כל שעה',
] as const

function GroupChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5.5" cy="5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.2 12.5c0-2.1 1.8-3.2 4.3-3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10.5" cy="5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M14.8 12.5c0-2.1-1.8-3.2-4.3-3.2s-4.3 1.1-4.3 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function CameraChannelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.2" y="3.5" width="10.6" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11.8 7l3 -2.2v6.4l-3 -2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SchedulePreview({ text }: { text: string }) {
  const parsed = parseSchedule(text)
  if (!text.trim()) {
    return null
  }
  return parsed ? (
    <p className="schedule-preview schedule-preview-ok">{describeSchedule(parsed)}</p>
  ) : (
    <p className="schedule-preview schedule-preview-warn">לא זוהתה תבנית — נסה: &quot;כל 30 שניות&quot; / &quot;כל יום ב-09:00&quot;</p>
  )
}

interface ChannelsHubProps {
  channels: Channel[]
  linkedChannelIdSet: Set<string>
  selectedChannelId: string
  selectedChannel: Channel
  showNewChannelForm: boolean
  newChannelDraft: NewChannelDraft
  availableChannelsForLink: Channel[]
  operationDraft: OperationDraft
  onSelectChannel: (channelId: string) => void
  onToggleNewChannelForm: () => void
  onNewChannelDraftChange: (field: keyof NewChannelDraft, value: string | number | ChannelType) => void
  onNewChannelSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleLinkedChannelId: (channelId: string) => void
  onUpdateSelectedChannel: <K extends keyof Channel>(field: K, value: Channel[K]) => void
  onRequestDeleteSelectedChannel: () => void
  onOperationDraftChange: (field: keyof OperationDraft, value: string) => void
  onOperationSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleOperation: (operationId: string) => void
  onDeleteOperation: (operationId: string) => void
  onUpdateOperationField: (
    operationId: string,
    field: keyof Pick<Operation, 'name' | 'mode' | 'schedule' | 'trigger' | 'action'>,
    value: string,
  ) => void
}

/**
 * מסך מרכז ערוצים: יצירת ערוץ, בחירה לעריכה, הגדרות ערוץ ומבצעים — נקודת הניהול הראשית.
 */
export function ChannelsHub({
  channels,
  linkedChannelIdSet,
  selectedChannelId,
  selectedChannel,
  showNewChannelForm,
  newChannelDraft,
  availableChannelsForLink,
  operationDraft,
  onSelectChannel,
  onToggleNewChannelForm,
  onNewChannelDraftChange,
  onNewChannelSubmit,
  onToggleLinkedChannelId,
  onUpdateSelectedChannel,
  onRequestDeleteSelectedChannel,
  onOperationDraftChange,
  onOperationSubmit,
  onToggleOperation,
  onDeleteOperation,
  onUpdateOperationField,
}: ChannelsHubProps) {
  const [listQuery, setListQuery] = useState('')

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }, [channels])

  const filteredChannels = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) {
      return sortedChannels
    }
    return sortedChannels.filter((channel) => {
      const haystack = `${channel.name} ${channel.location} ${channel.watchScope} ${channel.members.join(' ')}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [listQuery, sortedChannels])

  const statusLabel = LIVE_STATE_META[selectedChannel.liveState]?.label ?? 'לא זמין'
  const isOperationDraftValid = operationDraft.action.trim().length > 0
  const enabledOpsCount = selectedChannel.operations.filter((op) => op.enabled).length

  return (
    <main className="channels-hub-screen">
      <header className="channels-hub-header">
        <div>
          <p className="eyebrow">Channels Hub</p>
          <h2>ניהול ערוצים</h2>
        </div>
        <div className="channels-hub-stats">
          <span>{channels.length} ערוצים</span>
          <span>{selectedChannel.operations.length} מבצעים</span>
          <span>{enabledOpsCount} פעילים</span>
        </div>
      </header>

      <div className="channels-hub-body">
        <aside aria-label="רשימת ערוצים" className="chub-sidebar">
          <div className="chub-sidebar-toolbar">
            <button className="ghost-button" onClick={onToggleNewChannelForm} type="button">
              {showNewChannelForm ? 'סגור' : '+ ערוץ חדש'}
            </button>
            <input
              aria-label="חיפוש ברשימת ערוצים"
              className="chub-sidebar-search"
              onChange={(event) => setListQuery(event.target.value)}
              placeholder="חיפוש..."
              type="search"
              value={listQuery}
            />
          </div>

          {showNewChannelForm ? (
            <form className="card stacked-form chub-new-form" onSubmit={onNewChannelSubmit}>
              <div className="section-heading">
                <h3>יצירת ערוץ</h3>
                <span>הגדרות בסיס</span>
              </div>

              <label>
                שם הערוץ
                <input
                  required
                  value={newChannelDraft.name}
                  onChange={(event) => onNewChannelDraftChange('name', event.target.value)}
                  placeholder="לובי צפוני / קבוצת שערים"
                />
              </label>

              <label>
                סוג ערוץ
                <select
                  value={newChannelDraft.type}
                  onChange={(event) => onNewChannelDraftChange('type', event.target.value as ChannelType)}
                >
                  <option value="personal">ערוץ אישי</option>
                  <option value="group">צ׳אט קבוצתי</option>
                </select>
              </label>

              <label>
                מיקום
                <input
                  value={newChannelDraft.location}
                  onChange={(event) => onNewChannelDraftChange('location', event.target.value)}
                  placeholder="מפעל ברלב / שער דרומי"
                />
              </label>

              <label>
                היקף ניטור
                <textarea
                  rows={2}
                  value={newChannelDraft.watchScope}
                  onChange={(event) => onNewChannelDraftChange('watchScope', event.target.value)}
                  placeholder="רכבים, אנשים, כניסה לא מורשית..."
                />
              </label>

              <label>
                תיאור מבצעי
                <textarea
                  rows={2}
                  value={newChannelDraft.description}
                  onChange={(event) => onNewChannelDraftChange('description', event.target.value)}
                  placeholder="הקשר תפעולי קצר..."
                />
              </label>

              <label>
                RTSP feed
                <input
                  value={newChannelDraft.rtspFeed}
                  onChange={(event) => onNewChannelDraftChange('rtspFeed', event.target.value)}
                  placeholder="rtsp://camera-or-group-feed"
                />
              </label>

              {newChannelDraft.type === 'group' ? (
                <fieldset className="linked-channels-fieldset">
                  <legend className="linked-channels-legend">צירוף צ׳אטים קיימים</legend>
                  <p className="linked-channels-hint">סמן אילו מהשיחות הקיימות ייכללו בקבוצה החדשה.</p>
                  <div className="linked-channels-list" role="group" aria-label="בחירת צ׳אטים לקבוצה">
                    {availableChannelsForLink.length === 0 ? (
                      <p className="linked-channels-empty">אין עדיין צ׳אטים לצירוף.</p>
                    ) : (
                      availableChannelsForLink.map((channel) => {
                        const checked = newChannelDraft.linkedChannelIds.includes(channel.id)
                        return (
                          <label key={channel.id} className="linked-channel-option">
                            <input
                              checked={checked}
                              onChange={() => onToggleLinkedChannelId(channel.id)}
                              type="checkbox"
                            />
                            <span className="linked-channel-option-body">
                              <span className="linked-channel-name">{channel.name}</span>
                              <span className="linked-channel-meta">
                                {channel.type === 'group' ? 'קבוצה' : 'ערוץ'} · {channel.location}
                              </span>
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </fieldset>
              ) : null}

              <label>
                אינטרוול זיכרון (שניות)
                <input
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  required
                  value={newChannelDraft.memoryInterval}
                  onChange={(event) => onNewChannelDraftChange('memoryInterval', Number(event.target.value))}
                />
              </label>

              <button className="primary-button" disabled={!newChannelDraft.name.trim()} type="submit">
                צור ערוץ
              </button>
            </form>
          ) : null}

          <div className="chub-channel-list">
            {filteredChannels.length === 0 ? (
              <p className="chub-empty-hint">לא נמצאו ערוצים תואמים.</p>
            ) : (
              filteredChannels.map((channel) => {
                const meta = LIVE_STATE_META[channel.liveState]
                const isSelected = channel.id === selectedChannelId
                const isLinked = linkedChannelIdSet.has(channel.id)
                return (
                  <button
                    key={channel.id}
                    className={`chub-row ${isSelected ? 'chub-row-active' : ''}`}
                    onClick={() => onSelectChannel(channel.id)}
                    type="button"
                  >
                    <StatusDot liveState={channel.liveState} className="chub-row-dot" />
                    <span className="chub-row-type-icon" title={channel.type === 'group' ? 'צ׳אט קבוצתי' : 'מצלמה בודדת'}>
                      {channel.type === 'group' ? <GroupChatIcon /> : <CameraChannelIcon />}
                    </span>
                    <span className="chub-row-name">{channel.name}</span>
                    {isLinked ? <span className="chub-row-badge">מצורף</span> : null}
                    <span className="chub-row-meta">{meta?.label ?? 'לא זמין'}</span>
                    <span className="chub-row-location">{channel.location}</span>
                    {channel.operations.length > 0 ? (
                      <span className="chub-row-ops" title="מבצעים">
                        {channel.operations.length}
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <div className="chub-main">
          <section aria-label="הגדרות ערוץ" className="chub-zone chub-settings-zone">
            <header className="chub-zone-header">
              <div>
                <p className="eyebrow">הגדרות</p>
                <h3>{selectedChannel.name}</h3>
              </div>
              <span className="chub-zone-status">
                <StatusDot className="channel-status-dot" liveState={selectedChannel.liveState} />
                {`${selectedChannel.liveState} · ${statusLabel}`}
              </span>
            </header>

            <div className="chub-settings-grid">
              <label>
                שם הערוץ
                <input
                  value={selectedChannel.name}
                  onChange={(event) => onUpdateSelectedChannel('name', event.target.value)}
                />
              </label>

              <label>
                מיקום
                <input
                  value={selectedChannel.location}
                  onChange={(event) => onUpdateSelectedChannel('location', event.target.value)}
                />
              </label>

              <label>
                היקף ניטור
                <textarea
                  rows={2}
                  value={selectedChannel.watchScope}
                  onChange={(event) => onUpdateSelectedChannel('watchScope', event.target.value)}
                />
              </label>

              <label>
                תיאור מבצעי
                <textarea
                  rows={2}
                  value={selectedChannel.description}
                  onChange={(event) => onUpdateSelectedChannel('description', event.target.value)}
                />
              </label>

              <label>
                אינטרוול זיכרון (שניות)
                <input
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={selectedChannel.memoryInterval}
                  onChange={(event) => onUpdateSelectedChannel('memoryInterval', Number(event.target.value))}
                />
              </label>

              <label>
                RTSP feed
                <input
                  value={selectedChannel.rtspFeed}
                  onChange={(event) => onUpdateSelectedChannel('rtspFeed', event.target.value)}
                  placeholder="rtsp://camera-feed"
                />
              </label>

              <div className="channel-members chub-settings-members">
                <span className="metric-label">
                  {selectedChannel.type === 'group' ? 'צ׳אטים מצורפים' : 'חברי הערוץ'}
                </span>
                <div className="source-tags">
                  {selectedChannel.members.map((member) => (
                    <span key={member}>{member}</span>
                  ))}
                </div>
              </div>

              <div className="chub-settings-actions">
                <button className="danger-button" onClick={onRequestDeleteSelectedChannel} type="button">
                  מחק ערוץ
                </button>
              </div>
            </div>
          </section>

          <div aria-hidden="true" className="chub-zone-divider" />

          <section aria-label="מבצעים בערוץ" className="chub-zone chub-ops-zone">
            <header className="chub-zone-header">
              <div>
                <p className="eyebrow">מבצעים</p>
                <h3>מבצעי ערוץ — {selectedChannel.name}</h3>
                <p className="chub-zone-hint">{selectedChannel.operations.length} מבצעים · {enabledOpsCount} פעילים</p>
              </div>
            </header>

            <div className="chub-ops-content">
              <section className="chub-ops-create-section" aria-label="הוספת מבצע חדש">
                <p className="chub-ops-section-kicker">הוספה חדשה</p>
                <article className="card chub-ops-create-card">
                  <div className="section-heading">
                    <h3>מבצע חדש</h3>
                    <span>סוג · תזמון · טריגר · הנחיות</span>
                  </div>

                  <form className="stacked-form chub-ops-create-form" onSubmit={onOperationSubmit}>
                    <label>
                      שם מבצע
                      <input value={operationDraft.name} onChange={(event) => onOperationDraftChange('name', event.target.value)} />
                    </label>

                    <label>
                      סוג תגובה
                      <select
                        value={operationDraft.mode}
                        onChange={(event) => onOperationDraftChange('mode', event.target.value as OperationMode)}
                      >
                        {OPERATION_MODES.map((m) => (
                          <option key={m} value={m}>{OPERATION_MODE_META[m].label}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      תזמון סריקה
                      <p className="field-hint">כתוב בשפה חופשית: &quot;כל 10 שניות&quot;, &quot;כל יום ב-09:00&quot;.</p>
                      <div className="schedule-quick-suggestions" role="group" aria-label="המלצות תזמון מהירות">
                        {SCHEDULE_QUICK_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            className={`schedule-suggestion-chip ${operationDraft.schedule.trim() === suggestion ? 'active' : ''}`}
                            onClick={() => onOperationDraftChange('schedule', suggestion)}
                            type="button"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <input
                        value={operationDraft.schedule}
                        onChange={(event) => onOperationDraftChange('schedule', event.target.value)}
                      />
                      <SchedulePreview text={operationDraft.schedule} />
                    </label>

                    <label>
                      {OPERATION_MODE_META[operationDraft.mode].triggerLabel}
                      <p className="field-hint">{OPERATION_MODE_META[operationDraft.mode].triggerHint}</p>
                      <input
                        value={operationDraft.trigger}
                        onChange={(event) => onOperationDraftChange('trigger', event.target.value)}
                      />
                    </label>

                    <label>
                      מהות / הנחיות
                      <textarea
                        rows={2}
                        value={operationDraft.action}
                        onChange={(event) => onOperationDraftChange('action', event.target.value)}
                      />
                    </label>

                    <button className="primary-button" disabled={!isOperationDraftValid} type="submit">
                      שמור מבצע
                    </button>
                  </form>
                </article>
              </section>

              <section className="chub-ops-existing-section" aria-label="מבצעים קיימים">
                <div className="chub-ops-existing-head">
                  <p className="chub-ops-section-kicker">מבצעים קיימים</p>
                  <span>{selectedChannel.operations.length} סה״כ</span>
                </div>

                <div className="chub-ops-list">
                  {selectedChannel.operations.length === 0 ? (
                    <p className="chub-empty-hint">אין מבצעים בערוץ זה.</p>
                  ) : (
                    selectedChannel.operations.map((operation) => (
                      <article className="card operations-hub-item" key={operation.id}>
                      <div className="operations-hub-item-head">
                        <div>
                          <p className="eyebrow">{operation.enabled ? 'פעיל' : 'מושהה'} · {OPERATION_MODE_META[operation.mode].label}</p>
                          <h3>{operation.name}</h3>
                        </div>
                        <div className="operations-hub-item-actions">
                          <button
                            className={`operation-toggle ${operation.enabled ? 'enabled' : ''}`}
                            onClick={() => onToggleOperation(operation.id)}
                            type="button"
                          >
                            <span className="operation-toggle-thumb" />
                          </button>
                          <button className="danger-button" onClick={() => onDeleteOperation(operation.id)} type="button">
                            מחק
                          </button>
                        </div>
                      </div>

                      <div className="stacked-form operations-hub-form">
                        <label>
                          שם מבצע
                          <input
                            value={operation.name}
                            onChange={(event) => onUpdateOperationField(operation.id, 'name', event.target.value)}
                          />
                        </label>
                        <label>
                          סוג תגובה
                          <select
                            value={operation.mode}
                            onChange={(event) => onUpdateOperationField(operation.id, 'mode', event.target.value)}
                          >
                            {OPERATION_MODES.map((m) => (
                              <option key={m} value={m}>{OPERATION_MODE_META[m].label}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          תזמון סריקה
                          <p className="field-hint">כתוב בשפה חופשית.</p>
                          <input
                            value={operation.schedule}
                            onChange={(event) => onUpdateOperationField(operation.id, 'schedule', event.target.value)}
                          />
                          <SchedulePreview text={operation.schedule} />
                        </label>
                        <label>
                          {OPERATION_MODE_META[operation.mode].triggerLabel}
                          <input
                            value={operation.trigger}
                            onChange={(event) => onUpdateOperationField(operation.id, 'trigger', event.target.value)}
                          />
                        </label>
                        <label>
                          מהות / הנחיות
                          <textarea
                            rows={2}
                            value={operation.action}
                            onChange={(event) => onUpdateOperationField(operation.id, 'action', event.target.value)}
                          />
                        </label>
                      </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

import { useEffect, useRef } from 'react'

interface GroupNameModalProps {
  channelNames: string[]
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function GroupNameModal({
  channelNames,
  value,
  onChange,
  onConfirm,
  onCancel,
}: GroupNameModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && value.trim()) {
      event.preventDefault()
      onConfirm()
    }
    if (event.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div aria-modal className="brand-modal-overlay" role="dialog" onKeyDown={handleKeyDown}>
      <div className="brand-modal group-name-modal">
        <p className="eyebrow">קבוצה חדשה</p>
        <h3>תן שם לקבוצה</h3>

        <div className="group-name-members-list">
          <p className="group-name-members-label">מצלמות בקבוצה ({channelNames.length}):</p>
          <div className="group-name-members-chips">
            {channelNames.map((name) => (
              <span key={name} className="group-name-member-chip">{name}</span>
            ))}
          </div>
        </div>

        <input
          ref={inputRef}
          className="group-name-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="שם הקבוצה..."
          maxLength={60}
          autoComplete="off"
        />

        <div className="brand-modal-actions">
          <button className="ghost-button" onClick={onCancel} type="button">
            ביטול
          </button>
          <button
            className="primary-button"
            disabled={!value.trim()}
            onClick={onConfirm}
            type="button"
          >
            צור קבוצה
          </button>
        </div>
      </div>
    </div>
  )
}

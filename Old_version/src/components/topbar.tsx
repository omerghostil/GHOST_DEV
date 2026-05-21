import { useRef, useState } from 'react'
import { AccountMenu } from './account-menu'

interface TopbarProps {
  fullName: string
  organizationName: string
  role: string
  channelsCount: number
  totalOperations: number
  totalLiveFeeds: number
  totalUnreadAlerts: number
  activeNav: TopbarNavItem
  canAccessCommandCenter: boolean
  onNavChange: (item: TopbarNavItem) => void
  onOpenNotificationsCenter: () => void
  onLogout: () => void
}

const NAV_ITEMS = ['Ghost Live', 'Command Center'] as const
export type TopbarNavItem = typeof NAV_ITEMS[number]

const LONG_PRESS_MS = 4000

/**
 * אריח LIVE אינטראקטיבי עם easter-egg:
 * לחיצה ארוכה של 4 שניות פותחת את מסוף התצפית.
 */
function LiveMetricTile({ value }: { value: number }) {
  const [isCharging, setIsCharging] = useState(false)
  const pressStartRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startHold() {
    pressStartRef.current = Date.now()
    setIsCharging(true)
    timerRef.current = setTimeout(() => setIsCharging(false), LONG_PRESS_MS + 50)
  }

  function releaseHold() {
    const elapsed = pressStartRef.current !== null ? Date.now() - pressStartRef.current : 0
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsCharging(false)
    pressStartRef.current = null
    if (elapsed >= LONG_PRESS_MS) {
      window.open('/terminal.html', '_blank', 'noopener,noreferrer')
    }
  }

  function abortHold() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsCharging(false)
    pressStartRef.current = null
  }

  return (
    <button
      aria-label={`הזנות חיות: ${value}`}
      className={`topbar-metric-tile topbar-metric-live${isCharging ? ' status-pill-charging' : ''}`}
      onMouseDown={startHold}
      onMouseLeave={abortHold}
      onMouseUp={releaseHold}
      onTouchEnd={releaseHold}
      onTouchStart={startHold}
      title="הזנות חיות"
      type="button"
    >
      <span className="topbar-metric-label">Live</span>
      <span className="topbar-metric-value">{value}</span>
    </button>
  )
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.25a4.75 4.75 0 0 0-4.75 4.75v2.4L1.75 9.9v1.6h12.5V9.9L12.75 7.4V6A4.75 4.75 0 0 0 8 1.25z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path
        d="M6.1 11.8a1.9 1.9 0 0 0 3.8 0"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.4 10.4L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.5L9.4 6.6L14.5 8L9.4 9.4L8 14.5L6.6 9.4L1.5 8L6.6 6.6L8 1.5Z" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M6.55 6.2A1.65 1.65 0 0 1 8 5.3c1 0 1.75.62 1.75 1.55 0 .67-.39 1.06-1 1.43-.54.33-.84.62-.84 1.24v.18"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11.75" r="0.78" fill="currentColor" />
    </svg>
  )
}

export function Topbar({
  fullName,
  organizationName,
  role,
  channelsCount,
  totalOperations,
  totalLiveFeeds,
  totalUnreadAlerts,
  activeNav,
  canAccessCommandCenter,
  onNavChange,
  onOpenNotificationsCenter,
  onLogout,
}: TopbarProps) {
  const healthPercent = channelsCount > 0 ? Math.round((totalLiveFeeds / channelsCount) * 100) : 0

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img
          className="brand-mark"
          src="/ghost-icon-128.png"
          alt="Ghost"
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = '/favicon-64.png'
          }}
        />
      </div>

      <div className="topbar-center desktop-only">
        <button className="topbar-command-trigger" type="button">
          <SearchIcon />
          <span>Quick command</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="topbar-nav" aria-label="ניווט ראשי">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              className={`topbar-nav-item${activeNav === item ? ' active' : ''}`}
              disabled={item === 'Command Center' && !canAccessCommandCenter}
              onClick={() => onNavChange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <div className="topbar-actions">
        <div className="topbar-metrics desktop-only" aria-label="תקינות מערכת">
          <LiveMetricTile value={totalLiveFeeds} />
          <div className="topbar-metric-tile">
            <span className="topbar-metric-label">Channels</span>
            <span className="topbar-metric-value">{channelsCount}</span>
          </div>
          <div className="topbar-metric-tile">
            <span className="topbar-metric-label">Ops</span>
            <span className="topbar-metric-value">{totalOperations}</span>
          </div>
          <div className="topbar-metric-tile">
            <span className="topbar-metric-label">Health</span>
            <span className="topbar-metric-value">{healthPercent}%</span>
          </div>
        </div>

        <div className="topbar-actions-divider desktop-only" />

        <button
          aria-label="חיפוש"
          className="topbar-icon-btn mobile-only"
          title="חיפוש"
          type="button"
        >
          <SearchIcon />
        </button>

        <button
          aria-label="קיצורי מערכת"
          className="topbar-icon-btn desktop-only"
          title="קיצורי מערכת"
          type="button"
        >
          <SparkIcon />
        </button>

        <button
          aria-label={`התראות: ${totalUnreadAlerts} שלא נקראו`}
          className="topbar-icon-btn"
          onClick={onOpenNotificationsCenter}
          type="button"
        >
          <BellIcon />
          {totalUnreadAlerts > 0 && (
            <span className="notif-badge" aria-hidden>{totalUnreadAlerts > 99 ? '99+' : totalUnreadAlerts}</span>
          )}
        </button>

        <button
          aria-label="עזרה ותמיכה"
          className="topbar-icon-btn desktop-only"
          title="עזרה ותמיכה"
          type="button"
        >
          <HelpIcon />
        </button>

        <div className="topbar-actions-divider" />

        <AccountMenu fullName={fullName} organizationName={organizationName} role={role} onLogout={onLogout} onNotificationsClick={onOpenNotificationsCenter} />
      </div>
    </header>
  )
}

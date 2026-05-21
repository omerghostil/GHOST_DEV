import { useEffect, useRef, useState } from 'react'

const ACCOUNT_ITEMS = [
  { id: 'profile',       label: 'פרופיל אישי',        icon: '◈', section: 'main' },
  { id: 'team',          label: 'צוות וחברים',         icon: '⊞', section: 'main' },
  { id: 'notifications', label: 'התראות',              icon: '◉', section: 'main' },
  { id: 'billing',       label: 'חיוב ותוכנית',        icon: '⬡', section: 'main' },
  { id: 'api',           label: 'מפתחות API',          icon: '⌘', section: 'dev'  },
  { id: 'audit',         label: 'יומן פעילות',         icon: '≡', section: 'dev'  },
  { id: 'logout',        label: 'יציאה מהמערכת',       icon: '⏻', section: 'danger' },
] as const

type AccountItemId = typeof ACCOUNT_ITEMS[number]['id']

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'סופר אדמין',
  system_manager: 'מנהל מערכת',
  regular_user: 'משתמש',
}

interface AccountMenuProps {
  fullName: string
  organizationName: string
  role: string
  onNotificationsClick?: () => void
  onLogout?: () => void
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * תפריט ניהול חשבון — dropdown עם ניווט מקלדת ו-click-outside.
 */
export function AccountMenu({ fullName, organizationName, role, onNotificationsClick, onLogout }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return undefined

    function closeOnOutside(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  function handleItemClick(id: AccountItemId) {
    setIsOpen(false)
    if (id === 'notifications') {
      onNotificationsClick?.()
      return
    }
    if (id === 'logout') {
      onLogout?.()
    }
  }

  const initials = getInitials(fullName)
  const roleLabel = ROLE_LABELS[role] ?? role
  const mainItems   = ACCOUNT_ITEMS.filter((item) => item.section === 'main')
  const devItems    = ACCOUNT_ITEMS.filter((item) => item.section === 'dev')
  const dangerItems = ACCOUNT_ITEMS.filter((item) => item.section === 'danger')

  return (
    <div className="account-menu-wrap" ref={wrapRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="תפריט ניהול חשבון"
        className={`account-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        <span className="account-avatar" aria-hidden>{initials}</span>
        <span className="account-trigger-meta desktop-only">
          <span className="account-trigger-name">{fullName}</span>
          <span className="account-trigger-role">{organizationName}</span>
        </span>
        <span className={`account-caret ${isOpen ? 'open' : ''}`} aria-hidden />
      </button>

      {isOpen && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-profile">
            <span className="account-dropdown-avatar" aria-hidden>{initials}</span>
            <div className="account-dropdown-identity">
              <strong>{fullName}</strong>
              <span>{roleLabel}</span>
              <span className="account-plan-badge">{organizationName}</span>
            </div>
          </div>

          <div className="account-dropdown-section" role="group" aria-label="חשבון">
            {mainItems.map((item) => (
              <button
                key={item.id}
                className="account-dropdown-item"
                onClick={() => handleItemClick(item.id)}
                role="menuitem"
                type="button"
              >
                <span className="account-item-icon" aria-hidden>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="account-dropdown-divider" />

          <div className="account-dropdown-section" role="group" aria-label="פיתוח ואבחון">
            {devItems.map((item) => (
              <button
                key={item.id}
                className="account-dropdown-item"
                onClick={() => handleItemClick(item.id)}
                role="menuitem"
                type="button"
              >
                <span className="account-item-icon" aria-hidden>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="account-dropdown-divider" />

          {dangerItems.map((item) => (
            <button
              key={item.id}
              className="account-dropdown-item danger"
              onClick={() => handleItemClick(item.id)}
              role="menuitem"
              type="button"
            >
              <span className="account-item-icon" aria-hidden>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

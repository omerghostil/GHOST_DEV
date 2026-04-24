import { useEffect, useMemo, useState } from 'react'
import type {
  AdminOperationRecord,
  AdminOperationRunRecord,
  AuthProfile,
  ChannelUsageMonthly,
  OrganizationDetailsResponse,
  OrganizationLimits,
  OrganizationUser,
  SuperAdminIssue,
  SuperAdminOverviewResponse,
} from '../types/admin'
import {
  createOrganization,
  createUser,
  getOrganizationDetails,
  getIssues,
  getSuperAdminOverview,
  listUsers,
  revealPaymentCard,
  saveOrganizationAiKey,
  savePaymentCard,
  updateOrganization,
  updateIssue,
  updateUser,
} from '../services/admin-api'
import { impersonateUser } from '../services/auth-api'
import { connectAdminRealtime, type RealtimeEvent, type RealtimeMode } from '../services/realtime-socket'
import './super-admin-panel.css'

interface SuperAdminPanelProps {
  profile: AuthProfile
  onLogout: () => void
}

const ORGANIZATION_STATUS_LABELS: Record<'active' | 'suspended', string> = {
  active: 'פעיל',
  suspended: 'מושהה',
}

const USER_STATUS_LABELS: Record<'active' | 'inactive', string> = {
  active: 'פעיל',
  inactive: 'לא פעיל',
}

const USER_ROLE_LABELS: Record<'system_manager' | 'regular_user', string> = {
  system_manager: 'מנהל מערכת',
  regular_user: 'משתמש רגיל',
}

const ISSUE_STATUS_LABELS: Record<'open' | 'in_progress' | 'resolved', string> = {
  open: 'פתוח',
  in_progress: 'בטיפול',
  resolved: 'נפתר',
}

const ISSUE_SEVERITY_LABELS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
  critical: 'קריטית',
}

const OP_MODE_LABELS: Record<string, string> = {
  alert: 'התרעה',
  report: 'דוח',
  rating: 'דירוג',
  assessment: 'הערכה',
}

const RUN_STATUS_LABELS: Record<string, string> = {
  queued: 'בתור',
  running: 'רץ',
  success: 'הצלחה',
  failed: 'נכשל',
}

const DEFAULT_LIMITS: OrganizationLimits = {
  maxChannels: 20,
  maxMessagesPerChannelPerMonth: 10_000,
  monthlyChargeAmount: 499,
  maxAgentsTotalCost: 2_000,
  maxAiTotalCost: 5_000,
  maxApiTotalCost: 2_500,
}

/**
 * מסך ניהול־על מרכזי לסופר־אדמין עם מדדים חיים ופעולות תפעוליות.
 */
export function SuperAdminPanel({ profile, onLogout }: SuperAdminPanelProps) {
  const [overview, setOverview] = useState<SuperAdminOverviewResponse | null>(null)
  const [allUsers, setAllUsers] = useState<OrganizationUser[]>([])
  const [issues, setIssues] = useState<SuperAdminIssue[]>([])
  const [organizationDetails, setOrganizationDetails] = useState<OrganizationDetailsResponse | null>(null)
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [selectedTab, setSelectedTab] = useState<'overview' | 'users' | 'billing' | 'usage' | 'issues' | 'events'>('overview')
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [realtimeMode, setRealtimeMode] = useState<RealtimeMode>('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [organizationSearch, setOrganizationSearch] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationStatusDraft, setOrganizationStatusDraft] = useState<'active' | 'suspended'>('active')
  const [organizationLimitsDraft, setOrganizationLimitsDraft] = useState<OrganizationLimits>(DEFAULT_LIMITS)
  const [newUserOrgId, setNewUserOrgId] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newUserFirstName, setNewUserFirstName] = useState('')
  const [newUserLastName, setNewUserLastName] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'system_manager' | 'regular_user'>('regular_user')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserRoleDraft, setSelectedUserRoleDraft] = useState<'system_manager' | 'regular_user'>('regular_user')
  const [selectedUserActiveDraft, setSelectedUserActiveDraft] = useState(true)
  const [billingOrgId, setBillingOrgId] = useState('')
  const [cardPan, setCardPan] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [managerCode, setManagerCode] = useState('')
  const [revealedPan, setRevealedPan] = useState('')
  const [savedCardPreview, setSavedCardPreview] = useState<{ maskedPan: string; last4: string; expiryMonth: string; expiryYear: string } | null>(null)
  const [aiKeyOrgId, setAiKeyOrgId] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [issueFilterOrgId, setIssueFilterOrgId] = useState('')

  async function reloadData() {
    const [nextOverview, nextIssues, nextUsers] = await Promise.all([getSuperAdminOverview(), getIssues(), listUsers()])
    setOverview(nextOverview)
    setIssues(nextIssues)
    setAllUsers(nextUsers)
    setIsInitialLoad(false)
    setSelectedOrganizationId((currentOrganizationId) => {
      if (currentOrganizationId && nextOverview.organizations.some((organization) => organization.id === currentOrganizationId)) {
        return currentOrganizationId
      }
      return nextOverview.organizations[0]?.id ?? ''
    })
  }

  async function reloadOrganizationDetails(organizationId: string) {
    if (!organizationId) {
      setOrganizationDetails(null)
      return
    }
    const details = await getOrganizationDetails(organizationId)
    setOrganizationDetails(details)
    setOrganizationName(details.organization.name)
    setOrganizationStatusDraft(details.organization.status)
    setOrganizationLimitsDraft(details.organization.limits)
    setNewUserOrgId(organizationId)
    setBillingOrgId(organizationId)
    setAiKeyOrgId(organizationId)
    setIssueFilterOrgId(organizationId)
    setManagerCode('')
    setRevealedPan('')
  }

  useEffect(() => {
    void reloadData().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'טעינת נתונים נכשלה.')
    })
    const subscription = connectAdminRealtime(
      (event) => {
        setEvents((currentEvents) => [event, ...currentEvents].slice(0, 40))
        if (event.eventType === 'usage.updated' || event.eventType === 'issue.created' || event.eventType === 'issue.updated') {
          void reloadData().catch(() => undefined)
        }
      },
      (mode) => setRealtimeMode(mode),
    )
    return () => subscription.close()
  }, [])

  useEffect(() => {
    if (!selectedOrganizationId) {
      return
    }
    void reloadOrganizationDetails(selectedOrganizationId).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'טעינת ארגון נכשלה.')
    })
  }, [selectedOrganizationId])

  useEffect(() => {
    if (managerCode !== '1553' || !billingOrgId) {
      setRevealedPan('')
      return
    }
    void (async () => {
      try {
        const result = await revealPaymentCard(billingOrgId, managerCode)
        setRevealedPan(result.pan)
      } catch {
        setRevealedPan('')
      }
    })()
  }, [billingOrgId, managerCode])

  const organizations = useMemo(() => overview?.organizations ?? [], [overview])
  const filteredOrganizations = useMemo(() => {
    const normalizedSearch = organizationSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return organizations
    }
    return organizations.filter((organization) => {
      return `${organization.name} ${organization.status}`.toLowerCase().includes(normalizedSearch)
    })
  }, [organizationSearch, organizations])
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId) ?? null,
    [selectedOrganizationId, organizations],
  )
  const selectedOrganizationUsers = useMemo(
    () => allUsers.filter((user) => user.organizationId === selectedOrganizationId),
    [allUsers, selectedOrganizationId],
  )
  const filteredIssues = useMemo(() => {
    if (!issueFilterOrgId) {
      return issues
    }
    return issues.filter((issue) => issue.organizationId === issueFilterOrgId)
  }, [issueFilterOrgId, issues])

  async function handleCreateOrganization() {
    if (!organizationName.trim()) {
      setErrorMessage('נדרש שם ארגון.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const createdOrganization = await createOrganization(organizationName.trim(), DEFAULT_LIMITS)
      setOrganizationName('')
      setSuccessMessage('הארגון נוצר בהצלחה.')
      await reloadData()
      setSelectedOrganizationId(createdOrganization.id)
      await reloadOrganizationDetails(createdOrganization.id)
      setSelectedTab('overview')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'יצירת ארגון נכשלה.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleUpdateOrganization() {
    if (!selectedOrganizationId) {
      setErrorMessage('יש לבחור ארגון לעריכה.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await updateOrganization(selectedOrganizationId, {
        name: organizationName.trim(),
        status: organizationStatusDraft,
        limits: organizationLimitsDraft,
      })
      setSuccessMessage('פרטי הארגון עודכנו בהצלחה.')
      await reloadData()
      await reloadOrganizationDetails(selectedOrganizationId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'עדכון ארגון נכשל.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSoftDeleteOrganization() {
    if (!selectedOrganizationId) {
      setErrorMessage('יש לבחור ארגון למחיקה.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await updateOrganization(selectedOrganizationId, { status: 'suspended' })
      setSuccessMessage('בוצעה מחיקה לוגית: הארגון הושעה.')
      await reloadData()
      await reloadOrganizationDetails(selectedOrganizationId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'מחיקה לוגית לארגון נכשלה.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleCreateUser() {
    if (!newUserOrgId || !newUsername.trim() || !newUserFirstName.trim() || !newUserLastName.trim() || !newUserPassword.trim()) {
      setErrorMessage('נדרש למלא ארגון, שם פרטי, שם משפחה, שם משתמש וסיסמה.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await createUser({
        organizationId: newUserOrgId,
        username: newUsername.trim(),
        firstName: newUserFirstName.trim(),
        lastName: newUserLastName.trim(),
        password: newUserPassword,
        role: newUserRole,
      })
      setNewUsername('')
      setNewUserFirstName('')
      setNewUserLastName('')
      setNewUserPassword('')
      setSuccessMessage('המשתמש נוצר בהצלחה.')
      await reloadData()
      if (newUserOrgId) {
        await reloadOrganizationDetails(newUserOrgId)
      }
      setSelectedTab('users')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'יצירת משתמש נכשלה.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleUpdateUser() {
    if (!selectedUserId) {
      setErrorMessage('יש לבחור משתמש לעריכה.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await updateUser(selectedUserId, {
        role: selectedUserRoleDraft,
        isActive: selectedUserActiveDraft,
      })
      setSuccessMessage('פרטי המשתמש עודכנו בהצלחה.')
      await reloadData()
      if (selectedOrganizationId) {
        await reloadOrganizationDetails(selectedOrganizationId)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'עדכון משתמש נכשל.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSoftDeleteUser() {
    if (!selectedUserId) {
      setErrorMessage('יש לבחור משתמש למחיקה.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await updateUser(selectedUserId, { isActive: false })
      setSuccessMessage('בוצעה מחיקה לוגית: המשתמש הושבת.')
      await reloadData()
      if (selectedOrganizationId) {
        await reloadOrganizationDetails(selectedOrganizationId)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'מחיקה לוגית למשתמש נכשלה.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleImpersonateUser(userId: string) {
    setIsBusy(true)
    setErrorMessage('')
    try {
      const payload = await impersonateUser(userId)
      const jsonBytes = new TextEncoder().encode(JSON.stringify(payload))
      const encoded = btoa(String.fromCharCode(...jsonBytes))
      window.open(`${window.location.origin}#impersonate=${encoded}`, '_blank', 'noopener')
      setSuccessMessage('נפתח חלון חדש כמשתמש המבוקש.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'התחזות למשתמש נכשלה.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSavePaymentCard() {
    if (!billingOrgId || !cardPan || !cardholderName || !expiryMonth || !expiryYear || !billingEmail || !managerCode) {
      setErrorMessage('נדרש למלא את כל פרטי הכרטיס.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const result = await savePaymentCard({
        organizationId: billingOrgId,
        pan: cardPan,
        cardholderName,
        expiryMonth,
        expiryYear,
        billingEmail,
        managerCode,
      })
      setSavedCardPreview({
        maskedPan: result.maskedPan,
        last4: result.last4,
        expiryMonth,
        expiryYear,
      })
      setCardPan('')
      setRevealedPan('')
      setSuccessMessage('אמצעי התשלום נשמר בהצלחה.')
      if (billingOrgId) {
        await reloadOrganizationDetails(billingOrgId)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'שמירת הכרטיס נכשלה.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSaveAiKey() {
    if (!aiKeyOrgId || !aiApiKey.trim()) {
      setErrorMessage('יש לבחור ארגון ולהזין מפתח AI.')
      return
    }
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await saveOrganizationAiKey(aiKeyOrgId, aiApiKey.trim())
      setAiApiKey('')
      setSuccessMessage('מפתח AI נשמר בהצלחה.')
      await reloadData()
      await reloadOrganizationDetails(aiKeyOrgId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'שמירת מפתח AI נכשלה.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleIssueStatusChange(issueId: string, status: 'open' | 'in_progress' | 'resolved') {
    setIsBusy(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await updateIssue(issueId, status)
      setSuccessMessage('סטטוס התקלה עודכן.')
      await reloadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'עדכון תקלה נכשל.')
    } finally {
      setIsBusy(false)
    }
  }

  function handleSelectUserForEdit(user: OrganizationUser) {
    setSelectedUserId(user.id)
    setSelectedUserRoleDraft(user.role === 'regular_user' ? 'regular_user' : 'system_manager')
    setSelectedUserActiveDraft(user.isActive)
  }

  function renderTabContent() {
    if (!selectedOrganization) {
      return (
        <div className="sa-empty-state">
          <h3>לא נבחר ארגון</h3>
          <p>בחר ארגון מהרשימה כדי לצפות בפרטים, לערוך ולנהל את כל ההגדרות שלו.</p>
        </div>
      )
    }

    if (selectedTab === 'overview') {
      return (
        <div className="sa-tab-grid">
          <section className="sa-card">
            <h3>פרטי ארגון</h3>
            <div className="sa-form-grid">
              <label>
                שם ארגון
                <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
              </label>
              <label>
                סטטוס
                <select
                  value={organizationStatusDraft}
                  onChange={(event) => setOrganizationStatusDraft(event.target.value as 'active' | 'suspended')}
                >
                  <option value="active">פעיל</option>
                  <option value="suspended">מושהה</option>
                </select>
              </label>
            </div>
          </section>

          <section className="sa-card">
            <h3>מגבלות ותקרות</h3>
            <div className="sa-form-grid">
              <label>
                מספר ערוצים
                <input
                  type="number"
                  value={organizationLimitsDraft.maxChannels}
                  onChange={(event) =>
                    setOrganizationLimitsDraft((currentLimits) => ({ ...currentLimits, maxChannels: Number(event.target.value) || 0 }))
                  }
                />
              </label>
              <label>
                הודעות לערוץ בחודש
                <input
                  type="number"
                  value={organizationLimitsDraft.maxMessagesPerChannelPerMonth}
                  onChange={(event) =>
                    setOrganizationLimitsDraft((currentLimits) => ({
                      ...currentLimits,
                      maxMessagesPerChannelPerMonth: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label>
                חיוב חודשי
                <input
                  type="number"
                  value={organizationLimitsDraft.monthlyChargeAmount}
                  onChange={(event) =>
                    setOrganizationLimitsDraft((currentLimits) => ({
                      ...currentLimits,
                      monthlyChargeAmount: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label>
                תקרת עלות Agents
                <input
                  type="number"
                  value={organizationLimitsDraft.maxAgentsTotalCost}
                  onChange={(event) =>
                    setOrganizationLimitsDraft((currentLimits) => ({
                      ...currentLimits,
                      maxAgentsTotalCost: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label>
                תקרת עלות AI
                <input
                  type="number"
                  value={organizationLimitsDraft.maxAiTotalCost}
                  onChange={(event) =>
                    setOrganizationLimitsDraft((currentLimits) => ({
                      ...currentLimits,
                      maxAiTotalCost: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label>
                תקרת עלות API
                <input
                  type="number"
                  value={organizationLimitsDraft.maxApiTotalCost}
                  onChange={(event) =>
                    setOrganizationLimitsDraft((currentLimits) => ({
                      ...currentLimits,
                      maxApiTotalCost: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="sa-card">
            <h3>נתוני שימוש חיים</h3>
            <div className="sa-kpi-grid">
              <div><span>ערוצים</span><strong>{selectedOrganization.usage.channelsCount}</strong></div>
              <div><span>מבצעים</span><strong>{selectedOrganization.usage.operationsCount ?? 0}</strong></div>
              <div><span>הודעות יוצאות</span><strong>{selectedOrganization.usage.sentMessages}</strong></div>
              <div><span>הודעות נכנסות</span><strong>{selectedOrganization.usage.receivedMessages}</strong></div>
              <div><span>עלות AI</span><strong>${`${selectedOrganization.usage.aiTotalCost.toFixed(2)}`}</strong></div>
              <div><span>עלות API</span><strong>${`${selectedOrganization.usage.apiTotalCost.toFixed(2)}`}</strong></div>
            </div>
          </section>

          <section className="sa-card sa-card-actions">
            <button className="primary-button" type="button" disabled={isBusy} onClick={() => void handleUpdateOrganization()}>
              שמור שינויים בארגון
            </button>
            <button className="danger-button" type="button" disabled={isBusy} onClick={() => void handleSoftDeleteOrganization()}>
              מחיקה לוגית לארגון
            </button>
          </section>
        </div>
      )
    }

    if (selectedTab === 'users') {
      return (
        <div className="sa-tab-grid">
          <section className="sa-card">
            <h3>רשימת משתמשים מלאה בארגון</h3>
            <ul className="sa-list">
              {selectedOrganizationUsers.map((user) => (
                <li key={user.id} className={selectedUserId === user.id ? 'active' : ''}>
                  <button type="button" className="sa-user-select-btn" onClick={() => handleSelectUserForEdit(user)}>
                    <strong>{user.username}</strong>
                    <span>{USER_ROLE_LABELS[user.role === 'regular_user' ? 'regular_user' : 'system_manager']}</span>
                    <span>{user.isActive ? USER_STATUS_LABELS.active : USER_STATUS_LABELS.inactive}</span>
                  </button>
                  {user.isActive && user.role !== 'super_admin' && (
                    <button
                      type="button"
                      className="ghost-button sa-impersonate-btn"
                      disabled={isBusy}
                      onClick={() => void handleImpersonateUser(user.id)}
                    >
                      פתח כ
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="sa-card">
            <h3>עריכת משתמש</h3>
            <div className="sa-form-grid">
              <label>
                תפקיד
                <select
                  value={selectedUserRoleDraft}
                  onChange={(event) => setSelectedUserRoleDraft(event.target.value as 'system_manager' | 'regular_user')}
                >
                  <option value="system_manager">מנהל מערכת</option>
                  <option value="regular_user">משתמש רגיל</option>
                </select>
              </label>
              <label>
                מצב משתמש
                <select
                  value={selectedUserActiveDraft ? 'active' : 'inactive'}
                  onChange={(event) => setSelectedUserActiveDraft(event.target.value === 'active')}
                >
                  <option value="active">פעיל</option>
                  <option value="inactive">לא פעיל</option>
                </select>
              </label>
            </div>
            <div className="sa-inline-actions">
              <button className="primary-button" type="button" disabled={isBusy || !selectedUserId} onClick={() => void handleUpdateUser()}>
                שמור משתמש
              </button>
              <button className="danger-button" type="button" disabled={isBusy || !selectedUserId} onClick={() => void handleSoftDeleteUser()}>
                מחיקה לוגית למשתמש
              </button>
            </div>
          </section>

          <section className="sa-card">
            <h3>יצירת משתמש חדש</h3>
            <div className="sa-form-grid">
              <label>
                שם פרטי
                <input value={newUserFirstName} onChange={(event) => setNewUserFirstName(event.target.value)} />
              </label>
              <label>
                שם משפחה
                <input value={newUserLastName} onChange={(event) => setNewUserLastName(event.target.value)} />
              </label>
              <label>
                שם משתמש (להתחברות)
                <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} />
              </label>
              <label>
                סיסמה
                <input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
              </label>
              <label>
                תפקיד
                <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as 'system_manager' | 'regular_user')}>
                  <option value="system_manager">מנהל מערכת</option>
                  <option value="regular_user">משתמש רגיל</option>
                </select>
              </label>
            </div>
            <div className="sa-inline-actions">
              <button className="primary-button" type="button" disabled={isBusy} onClick={() => void handleCreateUser()}>
                צור משתמש
              </button>
            </div>
          </section>
        </div>
      )
    }

    if (selectedTab === 'billing') {
      return (
        <div className="sa-tab-grid">
          <section className="sa-card">
            <h3>אמצעי תשלום וגבייה</h3>
            <div className="sa-form-grid">
              <label>מספר כרטיס מלא<input value={cardPan} onChange={(event) => setCardPan(event.target.value)} /></label>
              <label>שם בעל הכרטיס<input value={cardholderName} onChange={(event) => setCardholderName(event.target.value)} /></label>
              <label>חודש MM<input value={expiryMonth} onChange={(event) => setExpiryMonth(event.target.value)} /></label>
              <label>שנה YY/YYYY<input value={expiryYear} onChange={(event) => setExpiryYear(event.target.value)} /></label>
              <label>מייל חיוב<input value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} /></label>
              <label>
                קוד מנהל
                <input
                  className={managerCode === '1553' ? 'sa-manager-code-authorized' : ''}
                  value={managerCode}
                  onChange={(event) => setManagerCode(event.target.value)}
                />
              </label>
            </div>
            <div className="sa-inline-actions">
              <button className="primary-button" type="button" disabled={isBusy} onClick={() => void handleSavePaymentCard()}>
                שמור כרטיס
              </button>
            </div>
            {savedCardPreview ? (
              <p className="sa-subtle">
                כרטיס שמור: {savedCardPreview.maskedPan} | תוקף: {savedCardPreview.expiryMonth}/{savedCardPreview.expiryYear} | 4 ספרות אחרונות: {savedCardPreview.last4}
              </p>
            ) : null}
            {managerCode === '1553' && revealedPan ? <p className="sa-mono">כרטיס מלא: {revealedPan}</p> : null}
          </section>

          <section className="sa-card">
            <h3>מפתח AI לארגון</h3>
            <div className="sa-form-grid">
              <label>
                מפתח AI ארגוני
                <input value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} placeholder="sk-..." />
              </label>
            </div>
            <div className="sa-inline-actions">
              <button className="primary-button" type="button" disabled={isBusy} onClick={() => void handleSaveAiKey()}>
                שמור מפתח
              </button>
            </div>
            <p className="sa-subtle">סנכרון אחרון: {selectedOrganization.openAiLastSyncIso ? new Date(selectedOrganization.openAiLastSyncIso).toLocaleString() : 'לא עודכן'}</p>
          </section>
        </div>
      )
    }

    if (selectedTab === 'usage') {
      return (
        <div className="sa-tab-grid">
          <section className="sa-card">
            <h3>יומן שימוש ועלויות</h3>
            <ul className="sa-list">
              {(organizationDetails?.usageLedger ?? []).map((ledger) => (
                <li key={ledger.id}>
                  <div className="sa-ledger-row">
                    <strong>{{ openai: 'ניתוח תמונה', api: 'API', agent: 'סוכן', message: 'הודעה' }[ledger.metricType] ?? ledger.metricType}</strong>
                    <span>${ledger.amount.toFixed(2)}</span>
                    <span>{new Date(ledger.createdAtIso).toLocaleString()}</span>
                  </div>
                  <p>{ledger.details}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="sa-card">
            <h3>ערוצים — מוני שימוש חודשיים מפורטים</h3>
            {(organizationDetails?.channels ?? []).length === 0 ? (
              <p className="sa-subtle">אין ערוצים בארגון זה.</p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-stats-table">
                  <thead>
                    <tr>
                      <th>ערוץ</th>
                      <th>יוצאות (user)</th>
                      <th>נכנסות (ghost)</th>
                      <th>נכנסות (system)</th>
                      <th>נכנסות (מבצעים)</th>
                      <th>סה"כ הודעות</th>
                      <th>מבצעים פעילים</th>
                      <th>סה"כ מבצעים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(organizationDetails?.channels ?? []).map((channel) => {
                      const stats = (organizationDetails?.channelStats ?? []).find(
                        (stat: ChannelUsageMonthly) => stat.channelId === channel.id,
                      )
                      const totalMessages = (stats?.outgoingUser ?? 0) + (stats?.incomingGhost ?? 0) + (stats?.incomingSystem ?? 0) + (stats?.incomingOperations ?? 0)
                      return (
                        <tr key={channel.id}>
                          <td><strong>{channel.name}</strong>{channel.isBlocked ? ' (חסום)' : ''}</td>
                          <td>{stats?.outgoingUser ?? 0}</td>
                          <td>{stats?.incomingGhost ?? 0}</td>
                          <td>{stats?.incomingSystem ?? 0}</td>
                          <td>{stats?.incomingOperations ?? 0}</td>
                          <td><strong>{totalMessages}</strong></td>
                          <td>{stats?.operationsCountActive ?? 0}</td>
                          <td>{stats?.operationsCountTotal ?? 0}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sa-card">
            <h3>מבצעים בארגון ({(organizationDetails?.operations ?? []).length})</h3>
            {(organizationDetails?.operations ?? []).length === 0 ? (
              <p className="sa-subtle">אין מבצעים בארגון זה.</p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-stats-table">
                  <thead>
                    <tr>
                      <th>שם</th>
                      <th>ערוץ</th>
                      <th>מצב</th>
                      <th>תזמון</th>
                      <th>סטטוס</th>
                      <th>הרצה אחרונה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(organizationDetails?.operations ?? []).map((op: AdminOperationRecord) => {
                      const channelName = (organizationDetails?.channels ?? []).find((c) => c.id === op.channelId)?.name ?? '—'
                      const lastRun = (organizationDetails?.recentRuns ?? []).find(
                        (r: AdminOperationRunRecord) => r.operationId === op.id,
                      )
                      return (
                        <tr key={op.id}>
                          <td><strong>{op.name}</strong></td>
                          <td>{channelName}</td>
                          <td>{OP_MODE_LABELS[op.mode] ?? op.mode}</td>
                          <td>{op.schedule || '—'}</td>
                          <td>
                            <span className={`sa-org-status ${op.enabled ? 'active' : 'suspended'}`}>
                              {op.enabled ? 'פעיל' : 'מושבת'}
                            </span>
                          </td>
                          <td>
                            {lastRun ? (
                              <span className={`sa-run-status ${lastRun.status}`}>
                                {RUN_STATUS_LABELS[lastRun.status]}
                                {lastRun.endedAtIso ? ` (${new Date(lastRun.endedAtIso).toLocaleString('he-IL')})` : ''}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {(organizationDetails?.recentRuns ?? []).length > 0 && (
            <section className="sa-card">
              <h3>היסטוריית הרצות אחרונות ({(organizationDetails?.recentRuns ?? []).length})</h3>
              <div className="sa-table-wrap">
                <table className="sa-stats-table">
                  <thead>
                    <tr>
                      <th>מבצע</th>
                      <th>סטטוס</th>
                      <th>התחלה</th>
                      <th>סיום</th>
                      <th>שגיאה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(organizationDetails?.recentRuns ?? []).map((run: AdminOperationRunRecord) => {
                      const opName = (organizationDetails?.operations ?? []).find((o) => o.id === run.operationId)?.name ?? run.operationId.slice(0, 8)
                      return (
                        <tr key={run.id}>
                          <td><strong>{opName}</strong></td>
                          <td><span className={`sa-run-status ${run.status}`}>{RUN_STATUS_LABELS[run.status]}</span></td>
                          <td>{new Date(run.startedAtIso).toLocaleString('he-IL')}</td>
                          <td>{run.endedAtIso ? new Date(run.endedAtIso).toLocaleString('he-IL') : '—'}</td>
                          <td>{run.errorMessage ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )
    }

    if (selectedTab === 'issues') {
      return (
        <section className="sa-card">
          <h3>תקלות ובאגים בארגון</h3>
          <ul className="sa-list">
            {filteredIssues.map((issue) => (
              <li key={issue.id}>
                <div className="sa-ledger-row">
                  <strong>{issue.title}</strong>
                  <span>{ISSUE_SEVERITY_LABELS[issue.severity]}</span>
                  <span>{ISSUE_STATUS_LABELS[issue.status]}</span>
                </div>
                <p>{issue.description}</p>
                <div className="sa-inline-actions">
                  <button className="ghost-button" type="button" onClick={() => void handleIssueStatusChange(issue.id, 'in_progress')}>
                    העבר לטיפול
                  </button>
                  <button className="primary-button" type="button" onClick={() => void handleIssueStatusChange(issue.id, 'resolved')}>
                    סמן כנפתר
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )
    }

    return (
      <section className="sa-card">
        <h3>אירועים חיים (WebSocket)</h3>
        <ul className="sa-list">
          {events.map((event, index) => (
            <li key={`${event.timestampIso}_${index}`}>
              <div className="sa-ledger-row">
                <strong>{event.eventType}</strong>
                <span>{event.severity}</span>
                <span>{new Date(event.timestampIso).toLocaleString()}</span>
              </div>
              <p>מזהה ארגון: {event.organizationId}</p>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <main className="sa-shell">
      <aside className="sa-sidebar">
        <header className="sa-sidebar-header">
          <p className="eyebrow">סופר אדמין</p>
          <h2>חדר בקרה Ghost</h2>
          <p className="sa-subtle">מחובר כ־{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username}</p>
          <div className="sa-sidebar-header-actions">
            <button className="ghost-button" type="button" onClick={onLogout}>
              התנתקות
            </button>
          </div>
        </header>

        <section className="sa-sidebar-create">
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="שם ארגון חדש"
          />
          <button className="primary-button" type="button" disabled={isBusy} onClick={() => void handleCreateOrganization()}>
            צור ארגון
          </button>
        </section>

        <section className="sa-sidebar-search">
          <input
            value={organizationSearch}
            onChange={(event) => setOrganizationSearch(event.target.value)}
            placeholder="חיפוש ארגון..."
          />
        </section>

        <section className="sa-org-list-wrap">
          <h3>כל הארגונים ({filteredOrganizations.length})</h3>
          <ul className="sa-org-list">
            {filteredOrganizations.map((organization) => (
              <li key={organization.id} className={selectedOrganizationId === organization.id ? 'active' : ''}>
                <button type="button" onClick={() => setSelectedOrganizationId(organization.id)}>
                  <div className="sa-org-list-title">
                    <strong>{organization.name}</strong>
                    <span className={`sa-org-status ${organization.status}`}>{ORGANIZATION_STATUS_LABELS[organization.status]}</span>
                  </div>
                  <div className="sa-org-list-meta">
                    <span>ערוצים: {isInitialLoad ? '--' : organization.usage.channelsCount}</span>
                    <span>מבצעים: {isInitialLoad ? '--' : (organization.usage.operationsCount ?? 0)}</span>
                    <span>הודעות: {isInitialLoad ? '--' : organization.usage.sentMessages + organization.usage.receivedMessages}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-sidebar-kpis">
          <h3>מדדי מערכת כלליים</h3>
          <div className="sa-kpi-grid">
            <div><span>ארגונים</span><strong>{isInitialLoad ? '--' : (overview?.totals.organizationsCount ?? 0)}</strong></div>
            <div><span>משתמשים</span><strong>{isInitialLoad ? '--' : allUsers.length}</strong></div>
            <div><span>הודעות יוצאות</span><strong>{isInitialLoad ? '--' : (overview?.totals.sentMessages ?? 0)}</strong></div>
            <div><span>עלות AI</span><strong>{isInitialLoad ? '--' : `$${overview?.totals.aiTotalCost.toFixed(2) ?? '0.00'}`}</strong></div>
          </div>
          <div className="sa-realtime-indicator">
            <span className={`sa-realtime-dot ${realtimeMode}`} />
            <span>{realtimeMode === 'live' ? 'חי' : realtimeMode === 'polling' ? 'סנכרון אוטומטי' : 'מנותק'}</span>
          </div>
        </section>
      </aside>

      <section className="sa-content">
        <header className="sa-content-header">
          <div>
            <p className="eyebrow">עמוד ארגון</p>
            <h2>{selectedOrganization?.name ?? 'בחר ארגון'}</h2>
          </div>
          <nav className="sa-tabs">
            <button className={selectedTab === 'overview' ? 'active' : ''} onClick={() => setSelectedTab('overview')} type="button">סקירה</button>
            <button className={selectedTab === 'users' ? 'active' : ''} onClick={() => setSelectedTab('users')} type="button">משתמשים</button>
            <button className={selectedTab === 'billing' ? 'active' : ''} onClick={() => setSelectedTab('billing')} type="button">תשלומים</button>
            <button className={selectedTab === 'usage' ? 'active' : ''} onClick={() => setSelectedTab('usage')} type="button">שימוש</button>
            <button className={selectedTab === 'issues' ? 'active' : ''} onClick={() => setSelectedTab('issues')} type="button">תקלות</button>
            <button className={selectedTab === 'events' ? 'active' : ''} onClick={() => setSelectedTab('events')} type="button">אירועים חיים</button>
          </nav>
        </header>

        {errorMessage ? <p className="sa-feedback error">{errorMessage}</p> : null}
        {successMessage ? <p className="sa-feedback success">{successMessage}</p> : null}

        <div className="sa-content-scroll">{renderTabContent()}</div>
      </section>
    </main>
  )
}

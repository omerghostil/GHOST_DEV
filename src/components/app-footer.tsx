import { useEffect, useState } from 'react'

function useLiveClock() {
  const [time, setTime] = useState(() => formatTime(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setTime(formatTime(new Date())), 1_000)
    return () => clearInterval(timer)
  }, [])
  return time
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('he-IL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * פוטר HUD מבצעי — שעון חי, סטטוס מערכת, קואורדינטות, גרסה.
 * מוצג בדסקטופ בלבד.
 */
export function AppFooter() {
  const clock = useLiveClock()

  return (
    <footer className="app-footer desktop-only">
      <div className="footer-cluster">
        <span className="footer-pill">
          <span className="footer-pill-label">Version</span>
          <strong className="footer-pill-value">v0.8.3</strong>
        </span>
        <span className="footer-pill">
          <span className="footer-pill-label">Build</span>
          <strong className="footer-pill-value">2026.03</strong>
        </span>
        <span className="footer-pill">
          <span className="footer-pill-label">Geo</span>
          <strong className="footer-pill-value">34.7843°N 32.0853°E</strong>
        </span>
      </div>

      <div className="footer-cluster footer-cluster-status">
        <span className="footer-pill">
          <span className="footer-live-dot" aria-hidden />
          <span className="footer-pill-label">System</span>
          <strong className="footer-pill-value">OK</strong>
        </span>
        <span className="footer-pill">
          <span className="footer-pill-label">Time</span>
          <strong className="footer-pill-value footer-clock">{clock}</strong>
        </span>
        <span className="footer-live-tag">Live</span>
      </div>

      <nav className="footer-links" aria-label="קישורי פוטר">
        <a href="#" className="footer-link">עזרה</a>
        <a href="#" className="footer-link">פרטיות</a>
        <a href="#" className="footer-link">תנאים</a>
      </nav>
    </footer>
  )
}

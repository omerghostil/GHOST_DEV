#!/usr/bin/env node

/**
 * מחולל דוח סיכום אוטומטי — מפרסר פלטי k6 summary-export ומייצר דוח Markdown בעברית פשוטה.
 *
 * שימוש: node helpers/report-generator.js [results-dir] [reports-dir] [health-before.json] [health-after.json]
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const RESULTS_DIR = process.argv[2] || join(import.meta.dirname, '..', 'results')
const REPORTS_DIR = process.argv[3] || join(import.meta.dirname, '..', 'reports')
const HEALTH_BEFORE_PATH = process.argv[4] || null
const HEALTH_AFTER_PATH = process.argv[5] || null

const ERROR_THRESHOLD = 0.05
const SLOW_THRESHOLD_MS = 2000

const TEST_NAMES_HEB = {
  'auth-flow': 'התחברות (Auth Flow)',
  'channels-crud': 'ערוצים והודעות (Channels)',
  'admin-dashboard': 'לוח בקרה ניהולי (Admin Dashboard)',
  'ai-endpoints': 'נקודות AI (Vision / Scan)',
  'websocket-load': 'חיבורי WebSocket (Realtime)',
  'mixed-workload': 'עומס משולב (Mixed Workload)',
  'payload-limits': 'גבולות גודל (Payload Limits)',
}

function speedLabel(ms) {
  if (ms < 200) return 'מהיר מאוד'
  if (ms < 500) return 'מהיר'
  if (ms < 1000) return 'סביר'
  if (ms < 2000) return 'איטי'
  if (ms < 5000) return 'איטי מאוד'
  return 'קרס / לא תקין'
}

function pct(val) {
  return `${(val * 100).toFixed(1)}%`
}

function msLabel(val) {
  if (val < 1000) return `${Math.round(val)}ms`
  return `${(val / 1000).toFixed(1)}s`
}

function tryReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * שליפת ערך ממטריקה — k6 summary-export שם מספרים ישירות (avg, p(95), max, value, count, rate).
 */
function getMetricVal(metric, key) {
  if (!metric) return 0
  if (metric[key] !== undefined) return metric[key]
  if (metric.values && metric.values[key] !== undefined) return metric.values[key]
  return 0
}

/**
 * מפרסר את פלט --summary-export של k6 (JSON).
 */
function parseSummaryFile(filePath) {
  const raw = tryReadJson(filePath)
  if (!raw || !raw.metrics) return null

  const m = raw.metrics
  const result = {
    file: basename(filePath),
    testName: basename(filePath, '.json'),
    vus_max: getMetricVal(m.vus_max, 'value') || getMetricVal(m.vus_max, 'max') || getMetricVal(m.vus, 'max') || 0,
    requests: getMetricVal(m.http_reqs, 'count') || 0,
    duration: {},
    errorRate: 0,
    thresholdsPassed: true,
    customMetrics: {},
  }

  const reqDur = m.http_req_duration
  if (reqDur) {
    result.duration = {
      avg: getMetricVal(reqDur, 'avg'),
      med: getMetricVal(reqDur, 'med'),
      p90: getMetricVal(reqDur, 'p(90)'),
      p95: getMetricVal(reqDur, 'p(95)'),
      p99: getMetricVal(reqDur, 'p(99)'),
      max: getMetricVal(reqDur, 'max'),
    }
  }

  const failed = m.http_req_failed
  if (failed) {
    result.errorRate = getMetricVal(failed, 'value') || getMetricVal(failed, 'rate') || 0
  }

  for (const [key, metric] of Object.entries(m)) {
    if (metric && metric.thresholds) {
      for (const thVal of Object.values(metric.thresholds)) {
        if (thVal === true || (typeof thVal === 'object' && thVal.ok === false)) {
          // k6 summary-export: thresholds are boolean (true = crossed, false = ok) in some versions
          // or {ok: bool} in others
        }
        if (thVal === true) {
          result.thresholdsPassed = false
        }
        if (typeof thVal === 'object' && thVal.ok === false) {
          result.thresholdsPassed = false
        }
      }
    }
    if (key.endsWith('_duration') && key !== 'http_req_duration' && key !== 'iteration_duration') {
      result.customMetrics[key] = {
        avg: getMetricVal(metric, 'avg'),
        p95: getMetricVal(metric, 'p(95)'),
        max: getMetricVal(metric, 'max'),
      }
    }
    if (key.endsWith('_errors') && metric) {
      const rate = getMetricVal(metric, 'value') || getMetricVal(metric, 'rate') || 0
      result.customMetrics[key] = { rate }
    }
  }

  return result
}

function detectBreakingPoint(result) {
  if (result.errorRate >= ERROR_THRESHOLD) {
    return `אחוז שגיאות ${pct(result.errorRate)} — מעל סף ${pct(ERROR_THRESHOLD)}`
  }
  if (result.duration.p95 > SLOW_THRESHOLD_MS) {
    return `זמן תגובה p95 = ${msLabel(result.duration.p95)} — מעל סף ${msLabel(SLOW_THRESHOLD_MS)}`
  }
  return null
}

function generateReport(results, healthBefore, healthAfter) {
  const now = new Date()
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const totalTests = results.length
  const passed = results.filter((r) => r.thresholdsPassed).length
  const failed = totalTests - passed
  const breakingPoints = []

  let md = ''
  md += `# דוח בדיקות עומס — Ghost\n`
  md += `# תאריך: ${dateStr}, שעה: ${timeStr}\n\n`

  md += `## סיכום כללי\n`
  md += `המערכת נבדקה ב-${totalTests} תרחישים שונים.\n`
  md += `מתוכם: ${passed} עברו בהצלחה, ${failed} נכשלו.\n\n`
  md += `---\n\n`

  md += `## תוצאות לפי תרחיש\n\n`

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const hebName = TEST_NAMES_HEB[r.testName] || r.testName
    const status = r.thresholdsPassed ? 'עבר' : 'נכשל'

    md += `### ${i + 1}. ${hebName}\n`
    md += `- משתמשים בו-זמנית (שיא): ${r.vus_max}\n`
    md += `- סה"כ בקשות: ${r.requests}\n`

    if (r.duration.avg) {
      md += `- זמן תגובה ממוצע: ${msLabel(r.duration.avg)} (${speedLabel(r.duration.avg)})\n`
      md += `- זמן תגובה p95: ${msLabel(r.duration.p95)} (${speedLabel(r.duration.p95)})\n`
      md += `- זמן תגובה מקסימלי: ${msLabel(r.duration.max)}\n`
    }

    md += `- אחוז שגיאות: ${pct(r.errorRate)}\n`

    const bp = detectBreakingPoint(r)
    if (bp) {
      md += `- סף קריסה: ${bp}\n`
      breakingPoints.push({ test: hebName, detail: bp, vus: r.vus_max })
    }

    for (const [metricName, metricData] of Object.entries(r.customMetrics)) {
      const label = metricName.replace(/_/g, ' ')
      if (metricData.rate !== undefined) {
        md += `- ${label}: ${pct(metricData.rate)}\n`
      } else if (metricData.p95 !== undefined) {
        md += `- ${label}: avg=${msLabel(metricData.avg)}, p95=${msLabel(metricData.p95)}\n`
      }
    }

    md += `- סטטוס: **${status}**\n\n`
  }

  md += `---\n\n`

  md += `## נקודות שבירה שזוהו\n`
  if (breakingPoints.length === 0) {
    md += `לא זוהו נקודות שבירה — המערכת עמדה בכל הסיפים.\n\n`
  } else {
    for (let i = 0; i < breakingPoints.length; i++) {
      const bp = breakingPoints[i]
      md += `${i + 1}. **${bp.test}** (${bp.vus} VUs): ${bp.detail}\n`
    }
    md += `\n`
  }

  md += `## צריכת זיכרון\n`
  if (healthBefore && healthAfter) {
    md += `- תחילת הבדיקות: ${healthBefore.memory?.rss || '?'} MB (RSS), ${healthBefore.memory?.heapUsed || '?'} MB (Heap)\n`
    md += `- סוף הבדיקות: ${healthAfter.memory?.rss || '?'} MB (RSS), ${healthAfter.memory?.heapUsed || '?'} MB (Heap)\n`
    const diff = (healthAfter.memory?.rss || 0) - (healthBefore.memory?.rss || 0)
    if (diff > 50) {
      md += `- **אזהרה:** גידול של ${diff} MB ב-RSS — ייתכן memory leak\n`
    } else if (diff > 0) {
      md += `- גידול סביר של ${diff} MB ב-RSS\n`
    }
  } else {
    md += `- נתוני זיכרון לא זמינים (health endpoint לא נדגם לפני/אחרי)\n`
  }
  md += `\n`

  md += `## המלצות\n`
  const recommendations = []

  if (breakingPoints.some((bp) => bp.detail.includes('שגיאות'))) {
    recommendations.push('להוסיף rate limiting לשרת (express-rate-limit) כדי למנוע הצפה')
  }
  if (breakingPoints.some((bp) => bp.detail.includes('זמן תגובה'))) {
    recommendations.push('לבדוק אופטימיזציות ב-DB — אינדקסים, connection pooling, או מעבר מ-SQLite ל-PostgreSQL בפרודקשן')
  }
  if (results.some((r) => r.testName === 'websocket-load' && !r.thresholdsPassed)) {
    recommendations.push('להוסיף אימות WebSocket ולהגביל מספר חיבורים בו-זמניים')
  }
  if (results.some((r) => r.testName === 'ai-endpoints' && r.errorRate > 0.1)) {
    recommendations.push('לשפר ניהול תור AI — להגדיל concurrency או להוסיף בקרת קצב חכמה יותר')
  }
  if (healthAfter && healthBefore && (healthAfter.memory?.rss - healthBefore.memory?.rss) > 50) {
    recommendations.push('לחקור memory leak — צריכת הזיכרון גדלה משמעותית במהלך הבדיקות')
  }

  if (recommendations.length === 0) {
    recommendations.push('המערכת עמדה בסיפים — אין המלצות דחופות כרגע')
  }

  for (const rec of recommendations) {
    md += `- ${rec}\n`
  }
  md += `\n`

  return md
}

function main() {
  if (!existsSync(RESULTS_DIR)) {
    console.error(`תיקיית תוצאות לא נמצאה: ${RESULTS_DIR}`)
    process.exit(1)
  }

  mkdirSync(REPORTS_DIR, { recursive: true })

  const files = readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('health-'))
  if (files.length === 0) {
    console.error('לא נמצאו קבצי תוצאות JSON')
    process.exit(1)
  }

  const results = []
  for (const file of files) {
    const parsed = parseSummaryFile(join(RESULTS_DIR, file))
    if (parsed) {
      results.push(parsed)
    }
  }

  if (results.length === 0) {
    console.error('לא ניתן לפרסר אף קובץ תוצאות')
    process.exit(1)
  }

  const healthBefore = HEALTH_BEFORE_PATH ? tryReadJson(HEALTH_BEFORE_PATH) : null
  const healthAfter = HEALTH_AFTER_PATH ? tryReadJson(HEALTH_AFTER_PATH) : null

  const report = generateReport(results, healthBefore, healthAfter)

  const now = new Date()
  const ts = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
  const reportPath = join(REPORTS_DIR, `stress-report-${ts}.md`)

  writeFileSync(reportPath, report, 'utf-8')
  console.log(`דוח נכתב: ${reportPath}`)
}

main()

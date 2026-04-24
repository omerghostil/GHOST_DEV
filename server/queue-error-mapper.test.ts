import { describe, expect, it } from 'vitest'
import { mapQueueErrorToHttp } from './queue-error-mapper'

describe('queue-error-mapper', () => {
  it('ממיר AI_CIRCUIT_OPEN לתשובת 503 ידידותית', () => {
    const result = mapQueueErrorToHttp(new Error('AI_CIRCUIT_OPEN'), 'ניתוח התמונה נכשל')

    expect(result.statusCode).toBe(503)
    expect(result.errorMessage).toBe('ניתוח התמונה נכשל: שירות ה-AI עמוס זמנית. נסו שוב בעוד כ-30 שניות.')
    expect(result.errorMessage.includes('AI_CIRCUIT_OPEN')).toBe(false)
  })

  it('משאיר שגיאה כללית כ-502 עם תוכן ההודעה', () => {
    const result = mapQueueErrorToHttp(new Error('timeout'), 'סריקת מבצעים נכשלה')

    expect(result.statusCode).toBe(502)
    expect(result.errorMessage).toBe('סריקת מבצעים נכשלה: timeout')
  })

  it('מטפל בערך שאינו Error כהודעת שגיאה פנימית', () => {
    const result = mapQueueErrorToHttp('unexpected', 'ניתוח התמונה נכשל')

    expect(result.statusCode).toBe(502)
    expect(result.errorMessage).toBe('ניתוח התמונה נכשל: שגיאה פנימית לא ידועה.')
  })
})

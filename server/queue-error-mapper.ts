export interface QueueHttpErrorMapping {
  statusCode: number
  errorMessage: string
}

const AI_CIRCUIT_OPEN_CODE = 'AI_CIRCUIT_OPEN'
const UNKNOWN_INTERNAL_ERROR_MESSAGE = 'שגיאה פנימית לא ידועה.'

/**
 * ממיר שגיאות תור/AI לתגובת HTTP ברורה למשתמש, בלי לחשוף קודי שגיאה פנימיים.
 */
export function mapQueueErrorToHttp(error: unknown, actionLabel: string): QueueHttpErrorMapping {
  const rawMessage = error instanceof Error ? error.message : UNKNOWN_INTERNAL_ERROR_MESSAGE
  if (rawMessage === AI_CIRCUIT_OPEN_CODE) {
    return {
      statusCode: 503,
      errorMessage: `${actionLabel}: שירות ה-AI עמוס זמנית. נסו שוב בעוד כ-30 שניות.`,
    }
  }

  return {
    statusCode: 502,
    errorMessage: `${actionLabel}: ${rawMessage}`,
  }
}

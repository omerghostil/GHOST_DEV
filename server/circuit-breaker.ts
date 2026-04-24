export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
  halfOpenMaxAttempts: number
}

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState
  consecutiveFailures: number
  openedAt: number | null
  halfOpenAttempts: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 1,
}

/**
 * מגן על קריאות לספק חיצוני בזמן תקלות מתמשכות, כדי למנוע עומס ותקיעות.
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig
  private state: CircuitBreakerState = 'closed'
  private consecutiveFailures = 0
  private openedAt: number | null = null
  private halfOpenAttempts = 0

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    }
  }

  /**
   * מריץ פעולה תחת מעקב Circuit Breaker ומחליט האם לחסום או לאפשר אותה.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.transitionStateIfNeeded()
    if (this.state === 'open') {
      throw new Error('AI_CIRCUIT_OPEN')
    }

    if (this.state === 'half-open') {
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        throw new Error('AI_CIRCUIT_OPEN')
      }
      this.halfOpenAttempts += 1
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  getSnapshot(): CircuitBreakerSnapshot {
    this.transitionStateIfNeeded()
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      openedAt: this.openedAt,
      halfOpenAttempts: this.halfOpenAttempts,
    }
  }

  /**
   * מיועד לבדיקות כדי לאפס את מצב המנגנון בצורה נקייה.
   */
  resetForTests() {
    this.state = 'closed'
    this.consecutiveFailures = 0
    this.openedAt = null
    this.halfOpenAttempts = 0
  }

  private onSuccess() {
    this.consecutiveFailures = 0
    if (this.state === 'half-open' || this.state === 'open') {
      this.state = 'closed'
      this.openedAt = null
      this.halfOpenAttempts = 0
    }
  }

  private onFailure() {
    this.consecutiveFailures += 1
    if (this.state === 'half-open') {
      this.openCircuit()
      return
    }
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.openCircuit()
    }
  }

  private openCircuit() {
    this.state = 'open'
    this.openedAt = Date.now()
    this.halfOpenAttempts = 0
  }

  private transitionStateIfNeeded() {
    if (this.state !== 'open' || this.openedAt === null) {
      return
    }
    const elapsedMs = Date.now() - this.openedAt
    if (elapsedMs >= this.config.resetTimeoutMs) {
      this.state = 'half-open'
      this.halfOpenAttempts = 0
    }
  }
}

import { describe, expect, it, vi } from 'vitest'
import { CircuitBreaker } from './circuit-breaker'

describe('CircuitBreaker', () => {
  it('פותח מעגל לאחר מספר כשלונות רצופים', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1_000,
      halfOpenMaxAttempts: 1,
    })

    await expect(breaker.execute(async () => Promise.reject(new Error('fail-1')))).rejects.toThrow('fail-1')
    await expect(breaker.execute(async () => Promise.reject(new Error('fail-2')))).rejects.toThrow('fail-2')
    await expect(breaker.execute(async () => 'should-not-run')).rejects.toThrow('AI_CIRCUIT_OPEN')

    expect(breaker.getSnapshot().state).toBe('open')
  })

  it('עובר ל-half-open ואז נסגר מחדש אחרי הצלחה', async () => {
    vi.useFakeTimers()
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 200,
      halfOpenMaxAttempts: 1,
    })

    await expect(breaker.execute(async () => Promise.reject(new Error('fail')))).rejects.toThrow('fail')
    expect(breaker.getSnapshot().state).toBe('open')

    await vi.advanceTimersByTimeAsync(250)
    const result = await breaker.execute(async () => 'ok')
    expect(result).toBe('ok')
    expect(breaker.getSnapshot().state).toBe('closed')
    vi.useRealTimers()
  })
})

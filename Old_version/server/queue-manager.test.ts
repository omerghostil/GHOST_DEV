import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('queue-manager', () => {
  function mockHeavyDependencies() {
    vi.doMock('./image-optimizer', () => ({
      getImageProfileByTask: () => ({ maxWidth: 1280, quality: 80, format: 'jpeg' }),
      optimizeImageDataUrl: async (input: string) => ({ dataUrl: input }),
    }))
    vi.doMock('./model-selector', () => ({
      isComplexTrigger: () => false,
      selectVisionDetailLevel: () => 'low',
      selectVisionModel: () => 'gpt-4.1-mini',
    }))
    vi.doMock('./vision-handler', () => ({
      requestVisionAnalysis: async () => 'ok',
      requestOperationScanAnalysis: async () => ({ results: [] }),
    }))
  }

  it('עובר למצב direct כאשר REDIS_URL לא מוגדר', async () => {
    vi.resetModules()
    mockHeavyDependencies()
    delete process.env.REDIS_URL
    const module = await import('./queue-manager')
    expect(module.getQueueModeForTests()).toBe('direct')
  }, 15000)

  it('קורא הגדרות runtime מה-env', async () => {
    vi.resetModules()
    mockHeavyDependencies()
    delete process.env.REDIS_URL
    process.env.QUEUE_CONCURRENCY = '4'
    process.env.QUEUE_RATE_LIMIT_RPM = '90'

    const module = await import('./queue-manager')
    const config = module.getRuntimeConfigForTests()
    expect(config.concurrency).toBe(4)
    expect(config.rateLimitRpm).toBe(90)
  }, 15000)
})

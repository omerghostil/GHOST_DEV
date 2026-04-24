import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { SQLiteAdminRepository } from './sqlite-repository'
import { syncOrganizationUsage, reconcileAllOrganizations, computeOrganizationUsage } from '../../admin/sync-org-usage'

const TEST_DB_PATH = resolve(process.cwd(), 'server/db/sqlite/test_usage_sync.db')

function createTestRepo(): SQLiteAdminRepository {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH)
  mkdirSync(resolve(process.cwd(), 'server/db/sqlite'), { recursive: true })
  return new SQLiteAdminRepository(TEST_DB_PATH)
}

const DEFAULT_LIMITS = {
  maxChannels: 20,
  maxMessagesPerChannelPerMonth: 10000,
  monthlyChargeAmount: 499,
  maxAgentsTotalCost: 2000,
  maxAiTotalCost: 5000,
  maxApiTotalCost: 2500,
}

const CHANNEL_SEED = {
  name: 'ערוץ', type: 'personal' as const, subtitle: '', location: '',
  watchScope: '', description: '', memoryInterval: 30, rtspFeed: '',
  liveState: 'LIVE' as const, cameraEnabled: false, linkedChannelIds: [] as string[],
  members: [] as string[], isBlocked: false,
}

describe('Usage Sync — אגרגציה וריקונסיליאציה', () => {
  let repo: SQLiteAdminRepository

  beforeEach(() => { repo = createTestRepo() })
  afterEach(() => {
    repo.close()
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH)
  })

  describe('computeOrganizationUsage', () => {
    it('ארגון ריק מחזיר אפסים', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })
      const usage = await computeOrganizationUsage(repo, org.id)

      expect(usage.channelsCount).toBe(0)
      expect(usage.sentMessages).toBe(0)
      expect(usage.receivedMessages).toBe(0)
      expect(usage.operationsCount).toBe(0)
    })

    it('סופר ערוצים, הודעות ומבצעים בפועל', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })
      const ch1 = await repo.createFullChannel(org.id, { ...CHANNEL_SEED, name: 'ערוץ 1' })
      const ch2 = await repo.createFullChannel(org.id, { ...CHANNEL_SEED, name: 'ערוץ 2' })

      await repo.addMessage(org.id, 'user-1', ch1.id, { author: 'user', text: 'יוצאת', time: '10:00' })
      await repo.addMessage(org.id, 'user-1', ch1.id, { author: 'ghost', text: 'נכנסת', time: '10:01' })
      await repo.addMessage(org.id, 'user-1', ch2.id, { author: 'user', text: 'יוצאת 2', time: '10:02' })
      await repo.addMessage(org.id, 'user-1', ch2.id, { author: 'system', text: 'מערכת', time: '10:03' })

      await repo.createChannelOperation(org.id, ch1.id, {
        name: 'מבצע', mode: 'alert', schedule: '24/7', trigger: '', action: 'scan', enabled: true,
      })

      const usage = await computeOrganizationUsage(repo, org.id)

      expect(usage.channelsCount).toBe(2)
      expect(usage.sentMessages).toBe(2)
      expect(usage.receivedMessages).toBe(2)
      expect(usage.operationsCount).toBe(1)
    })
  })

  describe('syncOrganizationUsage', () => {
    it('מעדכן organization.usage מנתונים אמיתיים', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })

      expect(org.usage.channelsCount).toBe(0)
      expect(org.usage.sentMessages).toBe(0)

      const ch = await repo.createFullChannel(org.id, CHANNEL_SEED)
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'user', text: 'הודעה', time: '10:00' })
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'ghost', text: 'תשובה', time: '10:01' })

      const updated = await syncOrganizationUsage(repo, org.id)

      expect(updated.usage.channelsCount).toBe(1)
      expect(updated.usage.sentMessages).toBe(1)
      expect(updated.usage.receivedMessages).toBe(1)
    })

    it('שומר עלויות AI/API ללא שינוי', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })
      repo.updateOrganizationUsage(org.id, (u) => ({
        ...u, aiTotalCost: 42.5, apiTotalCost: 10, agentsTotalCost: 5,
      }))

      const updated = await syncOrganizationUsage(repo, org.id)

      expect(updated.usage.aiTotalCost).toBe(42.5)
      expect(updated.usage.apiTotalCost).toBe(10)
      expect(updated.usage.agentsTotalCost).toBe(5)
    })
  })

  describe('reconcileAllOrganizations', () => {
    it('מזהה ומתקן פערים בין stored לבין actual', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })
      const ch = await repo.createFullChannel(org.id, CHANNEL_SEED)
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'user', text: 'test', time: '10:00' })

      const reports = await reconcileAllOrganizations(repo)
      const report = reports.find((r) => r.organizationId === org.id)!

      expect(report.diffs.length).toBeGreaterThan(0)
      expect(report.diffs.some((d) => d.field === 'channelsCount')).toBe(true)

      const afterReconcile = repo.getOrganizationById(org.id)!
      expect(afterReconcile.usage.channelsCount).toBe(1)
      expect(afterReconcile.usage.sentMessages).toBe(1)
    })

    it('אין פערים כשהנתונים מסונכרנים', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })
      const ch = await repo.createFullChannel(org.id, CHANNEL_SEED)
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'user', text: 'test', time: '10:00' })
      await syncOrganizationUsage(repo, org.id)

      const reports = await reconcileAllOrganizations(repo)
      const report = reports.find((r) => r.organizationId === org.id)!
      expect(report.diffs).toHaveLength(0)
    })
  })

  describe('countMessagesByAuthor', () => {
    it('מפריד נכון בין sent (user) ל-received (ghost/system)', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })
      const ch = await repo.createFullChannel(org.id, CHANNEL_SEED)

      await repo.addMessage(org.id, 'u1', ch.id, { author: 'user', text: 'a', time: '10:00' })
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'user', text: 'b', time: '10:01' })
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'ghost', text: 'c', time: '10:02' })
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'system', text: 'd', time: '10:03' })
      await repo.addMessage(org.id, 'u1', ch.id, { author: 'ghost', text: 'e', time: '10:04' })

      const counts = await repo.countMessagesByAuthor(org.id)
      expect(counts.sent).toBe(2)
      expect(counts.received).toBe(3)
    })
  })

  describe('רגרסיה — מחיקת ערוץ מעדכנת מונים', () => {
    it('channelsCount יורד לאחר מחיקה', async () => {
      const org = repo.createOrganization({ name: 'Org', limits: DEFAULT_LIMITS })
      await repo.createFullChannel(org.id, { ...CHANNEL_SEED, name: 'A' })
      const chB = await repo.createFullChannel(org.id, { ...CHANNEL_SEED, name: 'B' })

      await syncOrganizationUsage(repo, org.id)
      expect(repo.getOrganizationById(org.id)!.usage.channelsCount).toBe(2)

      await repo.deleteFullChannel(org.id, chB.id)
      await syncOrganizationUsage(repo, org.id)
      expect(repo.getOrganizationById(org.id)!.usage.channelsCount).toBe(1)
    })
  })
})

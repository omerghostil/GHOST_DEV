import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { SQLiteAdminRepository } from './sqlite-repository'

const TEST_DB_PATH = resolve(process.cwd(), 'server/db/sqlite/test_channels.db')

function createTestRepo(): SQLiteAdminRepository {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH)
  mkdirSync(resolve(process.cwd(), 'server/db/sqlite'), { recursive: true })
  return new SQLiteAdminRepository(TEST_DB_PATH)
}

function createTestOrg(repo: SQLiteAdminRepository) {
  return repo.createOrganization({
    name: 'Test Org',
    limits: {
      maxChannels: 20,
      maxMessagesPerChannelPerMonth: 10000,
      monthlyChargeAmount: 499,
      maxAgentsTotalCost: 2000,
      maxAiTotalCost: 5000,
      maxApiTotalCost: 2500,
    },
  })
}

const CHANNEL_SEED = {
  name: 'ערוץ', type: 'personal' as const, subtitle: '', location: '',
  watchScope: '', description: '', memoryInterval: 30, rtspFeed: '',
  liveState: 'LIVE' as const, cameraEnabled: false, linkedChannelIds: [] as string[],
  members: [] as string[], isBlocked: false,
}

describe('SQLiteAdminRepository — ערוצים עשירים, הודעות, מבצעים', () => {
  let repo: SQLiteAdminRepository

  beforeEach(() => { repo = createTestRepo() })
  afterEach(() => {
    repo.close()
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH)
  })

  describe('FullChannels', () => {
    it('יצירה וטעינה של ערוץ עשיר', async () => {
      const org = createTestOrg(repo)
      const channel = await repo.createFullChannel(org.id, { ...CHANNEL_SEED, name: 'ערוץ ראשי', cameraEnabled: true })

      expect(channel.id).toBeTruthy()
      expect(channel.organizationId).toBe(org.id)
      expect(channel.name).toBe('ערוץ ראשי')
      expect(channel.cameraEnabled).toBe(true)

      const fetched = await repo.getFullChannel(org.id, channel.id)
      expect(fetched).toBeDefined()
      expect(fetched!.name).toBe('ערוץ ראשי')
    })

    it('רשימת ערוצים מסוננת לפי ארגון', async () => {
      const orgA = createTestOrg(repo)
      const orgB = repo.createOrganization({ name: 'Org B', limits: orgA.limits })

      await repo.createFullChannel(orgA.id, { ...CHANNEL_SEED, name: 'ערוץ A' })
      await repo.createFullChannel(orgB.id, { ...CHANNEL_SEED, name: 'ערוץ B' })

      const listA = await repo.listFullChannels(orgA.id)
      const listB = await repo.listFullChannels(orgB.id)

      expect(listA).toHaveLength(1)
      expect(listA[0].name).toBe('ערוץ A')
      expect(listB).toHaveLength(1)
      expect(listB[0].name).toBe('ערוץ B')
    })

    it('עדכון ומחיקת ערוץ', async () => {
      const org = createTestOrg(repo)
      const channel = await repo.createFullChannel(org.id, { ...CHANNEL_SEED, name: 'ערוץ למחיקה' })

      const updated = await repo.updateChannelData(org.id, channel.id, { name: 'ערוץ מעודכן' })
      expect(updated.name).toBe('ערוץ מעודכן')

      await repo.deleteFullChannel(org.id, channel.id)
      expect(await repo.getFullChannel(org.id, channel.id)).toBeUndefined()
    })

    it('ארגון לא יכול לגשת לערוץ של ארגון אחר', async () => {
      const orgA = createTestOrg(repo)
      const orgB = repo.createOrganization({ name: 'Org B', limits: orgA.limits })
      const channel = await repo.createFullChannel(orgA.id, { ...CHANNEL_SEED, name: 'ערוץ A' })

      expect(await repo.getFullChannel(orgB.id, channel.id)).toBeUndefined()
    })
  })

  describe('Messages (per-user)', () => {
    it('שמירה וטעינה של הודעות פר משתמש', async () => {
      const org = createTestOrg(repo)
      const channel = await repo.createFullChannel(org.id, CHANNEL_SEED)

      await repo.addMessage(org.id, 'user-a', channel.id, { author: 'user', text: 'הודעה של A', time: '10:00' })
      await repo.addMessage(org.id, 'user-b', channel.id, { author: 'user', text: 'הודעה של B', time: '10:01' })
      await repo.addMessage(org.id, 'user-a', channel.id, { author: 'ghost', text: 'תשובה ל-A', time: '10:02' })

      const msgsA = await repo.listMessages(org.id, 'user-a', channel.id)
      const msgsB = await repo.listMessages(org.id, 'user-b', channel.id)

      expect(msgsA).toHaveLength(2)
      expect(msgsB).toHaveLength(1)
      expect(msgsA[0].text).toBe('הודעה של A')
      expect(msgsA[1].text).toBe('תשובה ל-A')
    })

    it('הודעות לא דולפות בין ארגונים', async () => {
      const orgA = createTestOrg(repo)
      const orgB = repo.createOrganization({ name: 'Org B', limits: orgA.limits })
      const channelA = await repo.createFullChannel(orgA.id, CHANNEL_SEED)

      await repo.addMessage(orgA.id, 'user-1', channelA.id, { author: 'user', text: 'סודי', time: '10:00' })

      const leaked = await repo.listMessages(orgB.id, 'user-1', channelA.id)
      expect(leaked).toHaveLength(0)
    })
  })

  describe('Operations', () => {
    it('יצירה, רשימה, עדכון ומחיקה של מבצעים', async () => {
      const org = createTestOrg(repo)
      const channel = await repo.createFullChannel(org.id, CHANNEL_SEED)

      const op = await repo.createChannelOperation(org.id, channel.id, {
        name: 'מבצע ראשון', mode: 'alert', schedule: '24/7',
        trigger: 'אדם', action: 'התרע', enabled: true,
      })
      expect(op.id).toBeTruthy()
      expect(op.name).toBe('מבצע ראשון')

      const list = await repo.listChannelOperations(org.id, channel.id)
      expect(list).toHaveLength(1)

      const updated = await repo.updateChannelOperation(org.id, channel.id, op.id, { name: 'מבצע מעודכן' })
      expect(updated.name).toBe('מבצע מעודכן')

      await repo.deleteChannelOperation(org.id, channel.id, op.id)
      expect(await repo.listChannelOperations(org.id, channel.id)).toHaveLength(0)
    })
  })

  describe('Operation Runs (scheduler)', () => {
    it('נעילה, השלמה וכשלון של ריצות מבצעים', async () => {
      const org = createTestOrg(repo)
      const channel = await repo.createFullChannel(org.id, CHANNEL_SEED)
      const op = await repo.createChannelOperation(org.id, channel.id, {
        name: 'מבצע', mode: 'alert', schedule: '24/7', trigger: '', action: 'scan', enabled: true,
      })

      const run = await repo.acquireOperationRunLock(org.id, channel.id, op.id)
      expect(run).toBeDefined()
      expect(run!.status).toBe('running')

      const dup = await repo.acquireOperationRunLock(org.id, channel.id, op.id)
      expect(dup).toBeNull()

      const completed = await repo.completeOperationRun(run!.id)
      expect(completed.status).toBe('success')

      const run2 = await repo.acquireOperationRunLock(org.id, channel.id, op.id)
      expect(run2).toBeDefined()

      const failed = await repo.failOperationRun(run2!.id, 'TIMEOUT', 'זמן הריצה עבר.')
      expect(failed.status).toBe('failed')
      expect(failed.errorCode).toBe('TIMEOUT')
    })

    it('listRunnableOperations מחזיר רק מבצעים פעילים עם schedule', async () => {
      const org = createTestOrg(repo)
      const channel = await repo.createFullChannel(org.id, CHANNEL_SEED)

      await repo.createChannelOperation(org.id, channel.id, {
        name: 'פעיל עם schedule', mode: 'alert', schedule: '24/7',
        trigger: '', action: 'scan', enabled: true,
        parsedSchedule: { type: 'interval', intervalMs: 60000 },
      })
      await repo.createChannelOperation(org.id, channel.id, {
        name: 'כבוי', mode: 'alert', schedule: '24/7',
        trigger: '', action: 'scan', enabled: false,
      })
      await repo.createChannelOperation(org.id, channel.id, {
        name: 'ללא schedule', mode: 'alert', schedule: '',
        trigger: '', action: 'scan', enabled: true,
      })

      const runnable = await repo.listRunnableOperations()
      expect(runnable).toHaveLength(1)
      expect(runnable[0].name).toBe('פעיל עם schedule')
    })
  })

  describe('Cascade delete', () => {
    it('מחיקת ערוץ מוחקת הודעות, מבצעים וריצות', async () => {
      const org = createTestOrg(repo)
      const channel = await repo.createFullChannel(org.id, CHANNEL_SEED)

      await repo.addMessage(org.id, 'user-1', channel.id, { author: 'user', text: 'הודעה', time: '10:00' })
      const op = await repo.createChannelOperation(org.id, channel.id, {
        name: 'מבצע', mode: 'alert', schedule: '24/7', trigger: '', action: 'scan', enabled: true,
      })
      await repo.acquireOperationRunLock(org.id, channel.id, op.id)

      await repo.deleteFullChannel(org.id, channel.id)

      expect(await repo.listMessages(org.id, 'user-1', channel.id)).toHaveLength(0)
      expect(await repo.listChannelOperations(org.id, channel.id)).toHaveLength(0)
    })
  })
})

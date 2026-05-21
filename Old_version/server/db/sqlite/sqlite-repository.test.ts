import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { SQLiteAdminRepository } from './sqlite-repository'

const TEST_DB_PATH = resolve(process.cwd(), 'server/db/sqlite/test_repo.db')

function createTestRepo(): SQLiteAdminRepository {
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH)
  }
  mkdirSync(resolve(process.cwd(), 'server/db/sqlite'), { recursive: true })
  return new SQLiteAdminRepository(TEST_DB_PATH)
}

describe('SQLiteAdminRepository', () => {
  let repo: SQLiteAdminRepository

  beforeEach(() => {
    repo = createTestRepo()
  })

  afterEach(() => {
    repo.close()
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH)
    }
  })

  describe('Organizations', () => {
    it('should create and list organizations', () => {
      const org = repo.createOrganization({
        name: 'Test Org',
        limits: {
          maxChannels: 10,
          maxMessagesPerChannelPerMonth: 5000,
          monthlyChargeAmount: 100,
          maxAgentsTotalCost: 500,
          maxAiTotalCost: 1000,
          maxApiTotalCost: 500,
        },
      })

      expect(org.id).toBeTruthy()
      expect(org.name).toBe('Test Org')
      expect(org.status).toBe('active')
      expect(org.limits.maxChannels).toBe(10)
      expect(org.usage.sentMessages).toBe(0)

      const all = repo.listOrganizations()
      expect(all.length).toBe(1)
      expect(all[0].id).toBe(org.id)
    })

    it('should update organization', () => {
      const org = repo.createOrganization({
        name: 'Orig',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const updated = repo.updateOrganization(org.id, (o) => ({
        ...o,
        name: 'Updated',
        status: 'suspended',
      }))

      expect(updated.name).toBe('Updated')
      expect(updated.status).toBe('suspended')
    })
  })

  describe('Users', () => {
    it('should create, find and list users', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const user = repo.createUser({
        organizationId: org.id,
        username: 'testuser',
        passwordHash: 'hash123',
        role: 'system_manager',
        allowedChannelIds: ['ch1'],
        blockedChannelIds: [],
      })

      expect(user.username).toBe('testuser')
      expect(user.role).toBe('system_manager')
      expect(user.allowedChannelIds).toEqual(['ch1'])
      expect(user.isActive).toBe(true)

      const found = repo.findUserByUsername('testuser')
      expect(found?.id).toBe(user.id)

      const foundById = repo.findUserById(user.id)
      expect(foundById?.username).toBe('testuser')

      const orgUsers = repo.listUsersByOrganization(org.id)
      expect(orgUsers.length).toBe(1)
    })
  })

  describe('Channels', () => {
    it('should create and list channels', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const ch = repo.createChannel({ organizationId: org.id, name: 'Channel 1' })
      expect(ch.name).toBe('Channel 1')
      expect(ch.isBlocked).toBe(false)

      const channels = repo.listChannels(org.id)
      expect(channels.length).toBe(1)
    })
  })

  describe('Campaigns', () => {
    it('should create and list campaigns', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const camp = repo.createCampaign({ organizationId: org.id, name: 'Campaign A' })
      expect(camp.name).toBe('Campaign A')
      expect(camp.isActive).toBe(true)

      const campaigns = repo.listCampaigns(org.id)
      expect(campaigns.length).toBe(1)
    })
  })

  describe('Channel Usage Monthly', () => {
    it('should increment and retrieve channel usage', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const ch = repo.createChannel({ organizationId: org.id, name: 'Ch1' })
      const monthKey = '2026-03'

      repo.incrementChannelUsage({
        organizationId: org.id,
        channelId: ch.id,
        monthKey,
        field: 'outgoing_user',
        count: 3,
      })

      repo.incrementChannelUsage({
        organizationId: org.id,
        channelId: ch.id,
        monthKey,
        field: 'incoming_ghost',
        count: 2,
      })

      repo.incrementChannelUsage({
        organizationId: org.id,
        channelId: ch.id,
        monthKey,
        field: 'incoming_operations',
        count: 5,
      })

      const stats = repo.getChannelUsageMonthly(org.id, monthKey)
      expect(stats.length).toBe(1)
      expect(stats[0].outgoingUser).toBe(3)
      expect(stats[0].incomingGhost).toBe(2)
      expect(stats[0].incomingOperations).toBe(5)
      expect(stats[0].incomingSystem).toBe(0)
    })

    it('should accumulate increments correctly', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const ch = repo.createChannel({ organizationId: org.id, name: 'Ch1' })
      const monthKey = '2026-03'

      repo.incrementChannelUsage({ organizationId: org.id, channelId: ch.id, monthKey, field: 'outgoing_user' })
      repo.incrementChannelUsage({ organizationId: org.id, channelId: ch.id, monthKey, field: 'outgoing_user' })
      repo.incrementChannelUsage({ organizationId: org.id, channelId: ch.id, monthKey, field: 'outgoing_user' })

      const stats = repo.getChannelUsageMonthly(org.id, monthKey)
      expect(stats[0].outgoingUser).toBe(3)
    })
  })

  describe('Usage Events', () => {
    it('should add and retrieve usage events', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const event = repo.addUsageEvent({
        organizationId: org.id,
        channelId: 'ch-1',
        eventType: 'channel_message',
        direction: 'outgoing',
        source: 'user',
        count: 1,
      })

      expect(event.id).toBeTruthy()
      expect(event.direction).toBe('outgoing')
      expect(event.source).toBe('user')
    })
  })

  describe('Organization Usage Aggregate', () => {
    it('should update aggregate usage', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const updated = repo.updateOrganizationUsage(org.id, (usage) => ({
        ...usage,
        sentMessages: usage.sentMessages + 5,
        receivedMessages: usage.receivedMessages + 3,
        updatedAtIso: new Date().toISOString(),
      }))

      expect(updated.usage.sentMessages).toBe(5)
      expect(updated.usage.receivedMessages).toBe(3)
    })
  })

  describe('Persistence', () => {
    it('should persist data across repo instances', () => {
      const org = repo.createOrganization({
        name: 'Persist Test',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })
      const orgId = org.id
      repo.close()

      const repo2 = new SQLiteAdminRepository(TEST_DB_PATH)
      const reloaded = repo2.getOrganizationById(orgId)
      expect(reloaded).toBeTruthy()
      expect(reloaded!.name).toBe('Persist Test')
      repo2.close()

      repo = new SQLiteAdminRepository(TEST_DB_PATH)
    })
  })

  describe('Issues', () => {
    it('should create, list and update issues', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const user = repo.createUser({
        organizationId: org.id,
        username: 'reporter',
        passwordHash: 'hash',
        role: 'regular_user',
        allowedChannelIds: [],
        blockedChannelIds: [],
      })

      const issue = repo.createIssue({
        organizationId: org.id,
        userId: user.id,
        title: 'Bug',
        description: 'Something broken',
        severity: 'high',
      })

      expect(issue.status).toBe('open')
      expect(issue.severity).toBe('high')

      const updated = repo.updateIssue(issue.id, (i) => ({
        ...i,
        status: 'resolved',
        updatedAtIso: new Date().toISOString(),
      }))
      expect(updated.status).toBe('resolved')

      const all = repo.listIssues()
      expect(all.length).toBe(1)
    })
  })

  describe('Audit Logs', () => {
    it('should add and list audit logs', () => {
      const log = repo.addAuditLog({
        actorUserId: 'user-1',
        action: 'test.action',
        targetType: 'test',
        targetId: 'target-1',
        details: 'Test log',
      })

      expect(log.action).toBe('test.action')

      const logs = repo.listAuditLogs(10)
      expect(logs.length).toBe(1)
    })
  })

  describe('Refresh Tokens', () => {
    it('should store, check and revoke refresh tokens', () => {
      repo.storeRefreshToken({ tokenId: 'tok-1', userId: 'u-1', expiresAtUnix: Math.floor(Date.now() / 1000) + 3600 })

      expect(repo.hasRefreshToken('tok-1', 'u-1')).toBe(true)
      expect(repo.hasRefreshToken('tok-1', 'u-2')).toBe(false)

      repo.revokeRefreshToken('tok-1')
      expect(repo.hasRefreshToken('tok-1', 'u-1')).toBe(false)
    })

    it('should purge expired tokens', () => {
      const past = Math.floor(Date.now() / 1000) - 100
      repo.storeRefreshToken({ tokenId: 'expired', userId: 'u-1', expiresAtUnix: past })
      repo.storeRefreshToken({ tokenId: 'valid', userId: 'u-1', expiresAtUnix: Math.floor(Date.now() / 1000) + 3600 })

      repo.purgeExpiredRefreshTokens()
      expect(repo.hasRefreshToken('expired', 'u-1')).toBe(false)
      expect(repo.hasRefreshToken('valid', 'u-1')).toBe(true)
    })
  })

  describe('Payment Cards', () => {
    it('should upsert and retrieve payment cards', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      const card = repo.upsertPaymentCard({
        organizationId: org.id,
        encryptedPan: 'enc123',
        cardholderName: 'Test User',
        expiryMonth: '12',
        expiryYear: '2028',
        billingEmail: 'test@test.com',
        maskedPan: '****1234',
        last4: '1234',
        createdAtIso: new Date().toISOString(),
      })

      expect(card.last4).toBe('1234')

      const retrieved = repo.getPaymentCard(org.id)
      expect(retrieved?.maskedPan).toBe('****1234')
    })
  })

  describe('Usage Ledger', () => {
    it('should add and list ledger entries', () => {
      const org = repo.createOrganization({
        name: 'Org',
        limits: {
          maxChannels: 5, maxMessagesPerChannelPerMonth: 1000,
          monthlyChargeAmount: 50, maxAgentsTotalCost: 100,
          maxAiTotalCost: 200, maxApiTotalCost: 100,
        },
      })

      repo.addUsageLedgerEntry({
        organizationId: org.id,
        metricType: 'openai',
        amount: 1.5,
        details: 'Test cost',
      })

      const entries = repo.listUsageLedger(org.id)
      expect(entries.length).toBe(1)
      expect(entries[0].amount).toBe(1.5)
    })
  })
})

import type { IAdminRepository } from '../db/repository-types'
import type { OperationRecord } from '../admin/types'
import { enqueueOperationScan, JobPriority } from '../queue-manager'
import { decryptSensitiveValue } from '../security/crypto-utils'

const POLL_INTERVAL_MS = 30_000
const RUN_TIMEOUT_MS = 60_000
const MAX_CONSECUTIVE_FAILURES = 3

interface SchedulerState {
  timer: ReturnType<typeof setInterval> | null
  running: boolean
  failureCounts: Map<string, number>
  lastRunTimestamps: Map<string, number>
}

/**
 * מנוע הרצת מבצעים שרתי — רץ ברקע גם ללא משתמש מחובר.
 * סורק מבצעים פעילים עם schedule ומריץ אותם דרך pipeline קיים.
 */
export class ServerOperationScheduler {
  private state: SchedulerState = {
    timer: null,
    running: false,
    failureCounts: new Map(),
    lastRunTimestamps: new Map(),
  }

  constructor(private store: IAdminRepository) {}

  start(): void {
    if (this.state.timer) return
    console.log('[scheduler] מנוע מבצעים שרתי הופעל.')
    this.state.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS)
    void this.tick()
  }

  stop(): void {
    if (this.state.timer) {
      clearInterval(this.state.timer)
      this.state.timer = null
      console.log('[scheduler] מנוע מבצעים שרתי נעצר.')
    }
  }

  private async tick(): Promise<void> {
    if (this.state.running) return
    this.state.running = true
    try {
      const operations = await this.store.listRunnableOperations()
      const now = Date.now()
      for (const op of operations) {
        if (this.shouldSkip(op)) continue
        if (!this.isScheduleDue(op, now)) continue
        await this.executeOperation(op, now)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[scheduler] שגיאה בלולאת הסריקה: ${msg}`)
    } finally {
      this.state.running = false
    }
  }

  private shouldSkip(op: OperationRecord): boolean {
    const failures = this.state.failureCounts.get(op.id) ?? 0
    return failures >= MAX_CONSECUTIVE_FAILURES
  }

  private isScheduleDue(op: OperationRecord, nowMs: number): boolean {
    if (!op.parsedSchedule) return false
    const lastRun = this.state.lastRunTimestamps.get(op.id) ?? 0
    const schedule = op.parsedSchedule as Record<string, unknown>

    if (schedule.type === 'interval') {
      const intervalMs = schedule.intervalMs as number
      return (nowMs - lastRun) >= intervalMs
    }

    if (schedule.type === 'time-slots') {
      const now = new Date()
      const slots = schedule.slots as Array<{ dayOfWeek: number | null; hour: number; minute: number }>
      for (const slot of slots) {
        if (slot.dayOfWeek !== null && slot.dayOfWeek !== now.getDay()) continue
        if (slot.hour === now.getHours() && slot.minute === now.getMinutes()) {
          return (nowMs - lastRun) >= 60_000
        }
      }
    }

    return false
  }

  private async executeOperation(op: OperationRecord, nowMs: number): Promise<void> {
    const run = await this.store.acquireOperationRunLock(op.organizationId, op.channelId, op.id)
    if (!run) return

    this.state.lastRunTimestamps.set(op.id, nowMs)

    const apiKey = this.resolveApiKey(op.organizationId)
    if (!apiKey) {
      await this.store.failOperationRun(run.id, 'NO_API_KEY', 'לא הוגדר מפתח OpenAI לארגון.')
      return
    }

    const channel = await this.store.getFullChannel(op.organizationId, op.channelId)
    if (!channel) {
      await this.store.failOperationRun(run.id, 'CHANNEL_NOT_FOUND', 'הערוץ לא נמצא.')
      return
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS)

      await enqueueOperationScan(
        {
          channel: {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            watchScope: channel.watchScope,
            location: channel.location,
            members: channel.members,
          },
          frameDataUrl: 'data:image/png;base64,',
          operations: [
            {
              id: op.id,
              name: op.name,
              schedule: op.schedule,
              mode: op.mode,
              alertTrigger: op.trigger,
              action: op.action,
              modelOverride: op.modelOverride,
              detailLevel: op.detailLevel,
            },
          ],
        },
        apiKey,
        JobPriority.LOW,
      )

      clearTimeout(timeout)
      await this.store.completeOperationRun(run.id)
      this.state.failureCounts.set(op.id, 0)
      console.log(`[scheduler] מבצע ${op.name} (${op.id}) הושלם בהצלחה.`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      await this.store.failOperationRun(run.id, 'EXECUTION_ERROR', msg)
      const failures = (this.state.failureCounts.get(op.id) ?? 0) + 1
      this.state.failureCounts.set(op.id, failures)
      console.error(`[scheduler] מבצע ${op.name} (${op.id}) נכשל (${failures}/${MAX_CONSECUTIVE_FAILURES}): ${msg}`)
    }
  }

  private resolveApiKey(organizationId: string): string | undefined {
    const org = this.store.getOrganizationById(organizationId)
    if (org?.encryptedOpenAiApiKey) {
      try {
        return decryptSensitiveValue(org.encryptedOpenAiApiKey)
      } catch { /* fallthrough to global key */ }
    }
    return process.env.OPENAI_API_KEY?.trim() || undefined
  }
}

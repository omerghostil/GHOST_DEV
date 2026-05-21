import { useEffect, useRef, useState } from 'react'
import type { Channel, Operation, OperationMode } from '../types'
import { captureLatestCameraFrame } from '../services/camera-frame'
import { requestOperationScan } from '../services/operation-scan'
import type { OperationScanResult } from '../services/operation-scan'
import { getNextRunMs } from '../services/schedule-parser'

const TIMESLOT_TICK_MS = 10_000
const TIMESLOT_WINDOW_MS = TIMESLOT_TICK_MS + 2_000
const BATCH_WINDOW_MS = 2_000

export interface OperationFiredPayload {
  channelId: string
  channelName: string
  operationId: string
  operationName: string
  mode: OperationMode
  critical: boolean
  score?: number
  summary: string
  frameDataUrl: string
}

interface SchedulerArgs {
  channels: Channel[]
  onOperationFired: (payload: OperationFiredPayload) => void
}

/**
 * מנגנון תזמון אוטומטי לכלל המבצעים: interval / time-slots.
 * מחזיר מפת nextRunAt — timestamp מוחלט של ההפעלה הבאה לכל (channelId_opId).
 */
export function useOperationScheduler({ channels, onOperationFired }: SchedulerArgs) {
  const [nextRunAt, setNextRunAt] = useState<Map<string, number>>(new Map())
  const callbackRef = useRef(onOperationFired)
  callbackRef.current = onOperationFired
  const channelsRef = useRef(channels)
  channelsRef.current = channels

  useEffect(() => {
    const intervalTimers = new Map<string, ReturnType<typeof setInterval>>()
    const lastExecutionTimes = new Map<string, number>()
    const pendingByChannel = new Map<string, Map<string, Operation>>()
    const flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
    const runningChannels = new Set<string>()

    function resolveOperation(channelId: string, operationId: string) {
      const latestChannel = channelsRef.current.find((channel) => channel.id === channelId)
      const latestOperation = latestChannel?.operations.find((operation) => operation.id === operationId)
      if (!latestChannel || !latestOperation?.enabled) {
        return null
      }
      return { channel: latestChannel, operation: latestOperation }
    }

    function scheduleBatchFlush(channelId: string, delayMs: number = BATCH_WINDOW_MS) {
      if (flushTimers.has(channelId)) {
        return
      }
      const timer = setTimeout(() => {
        flushTimers.delete(channelId)
        void flushChannelBatch(channelId)
      }, delayMs)
      flushTimers.set(channelId, timer)
    }

    function pushOperationToBatch(channel: Channel, operation: Operation) {
      const resolved = resolveOperation(channel.id, operation.id)
      if (!resolved) {
        return
      }
      const queuedOperations = pendingByChannel.get(channel.id) ?? new Map<string, Operation>()
      queuedOperations.set(resolved.operation.id, resolved.operation)
      pendingByChannel.set(channel.id, queuedOperations)
      scheduleBatchFlush(channel.id)
    }

    function emitFailure(channel: Channel, operation: Operation) {
      callbackRef.current({
        channelId: channel.id,
        channelName: channel.name,
        operationId: operation.id,
        operationName: operation.name,
        mode: operation.mode,
        critical: false,
        summary: 'שגיאה בביצוע סריקה אוטומטית.',
        frameDataUrl: '',
      })
      lastExecutionTimes.set(`${channel.id}_${operation.id}`, Date.now())
    }

    async function flushChannelBatch(channelId: string) {
      const queuedOperations = pendingByChannel.get(channelId)
      if (!queuedOperations || queuedOperations.size === 0) {
        return
      }

      if (runningChannels.has(channelId)) {
        scheduleBatchFlush(channelId, 600)
        return
      }

      runningChannels.add(channelId)
      pendingByChannel.set(channelId, new Map())

      const operationList = [...queuedOperations.values()]
      const channel = channelsRef.current.find((item) => item.id === channelId)
      if (!channel) {
        runningChannels.delete(channelId)
        return
      }

      try {
        const hasComplexOperation = operationList.some(
          (operation) => operation.mode !== 'alert' || operation.detailLevel === 'high',
        )
        const frameDataUrl = await captureLatestCameraFrame(hasComplexOperation ? 'scan-standard' : 'scan-low')
        const results: OperationScanResult[] = await requestOperationScan(channel, frameDataUrl, operationList)
        const resultByOperationId = new Map(results.map((result) => [result.operationId, result]))

        for (const operation of operationList) {
          const row = resultByOperationId.get(operation.id)
          callbackRef.current({
            channelId: channel.id,
            channelName: channel.name,
            operationId: operation.id,
            operationName: operation.name,
            mode: operation.mode,
            critical: row?.critical ?? false,
            score: row?.score,
            summary: row?.summary ?? '',
            frameDataUrl,
          })
          lastExecutionTimes.set(`${channel.id}_${operation.id}`, Date.now())
        }
      } catch {
        for (const operation of operationList) {
          emitFailure(channel, operation)
        }
      } finally {
        runningChannels.delete(channelId)
        const pending = pendingByChannel.get(channelId)
        if (pending && pending.size > 0) {
          scheduleBatchFlush(channelId, 150)
        }
      }
    }

    function setupIntervalTimers() {
      for (const channel of channelsRef.current) {
        for (const op of channel.operations) {
          if (!op.enabled || !op.parsedSchedule || op.parsedSchedule.type !== 'interval') {
            continue
          }
          const key = `${channel.id}_${op.id}`
          if (intervalTimers.has(key)) {
            continue
          }
          const ms = op.parsedSchedule.intervalMs
          lastExecutionTimes.set(key, Date.now())
          const timer = setInterval(() => {
            const freshChannel = channelsRef.current.find((c) => c.id === channel.id)
            const freshOp = freshChannel?.operations.find((o) => o.id === op.id)
            if (!freshChannel || !freshOp?.enabled) {
              return
            }
            pushOperationToBatch(freshChannel, freshOp)
          }, ms)
          intervalTimers.set(key, timer)
        }
      }
    }

    setupIntervalTimers()

    const slotTickTimer = setInterval(() => {
      const now = new Date()
      const currentDay = now.getDay()
      const currentMs = now.getHours() * 3_600_000 + now.getMinutes() * 60_000 + now.getSeconds() * 1_000

      for (const channel of channelsRef.current) {
        for (const op of channel.operations) {
          if (!op.enabled || !op.parsedSchedule || op.parsedSchedule.type !== 'time-slots') {
            continue
          }
          for (const slot of op.parsedSchedule.slots) {
            if (slot.dayOfWeek !== null && slot.dayOfWeek !== currentDay) {
              continue
            }
            const slotMs = slot.hour * 3_600_000 + slot.minute * 60_000
            const diff = Math.abs(currentMs - slotMs)
            if (diff < TIMESLOT_WINDOW_MS) {
              pushOperationToBatch(channel, op)
            }
          }
        }
      }
    }, TIMESLOT_TICK_MS)

    const countdownTimer = setInterval(() => {
      const map = new Map<string, number>()
      const now = Date.now()
      for (const channel of channelsRef.current) {
        for (const op of channel.operations) {
          if (!op.enabled || !op.parsedSchedule) {
            continue
          }
          const key = `${channel.id}_${op.id}`

          if (op.parsedSchedule.type === 'interval') {
            const startTime = lastExecutionTimes.get(key) ?? now
            const elapsed = now - startTime
            const cycle = op.parsedSchedule.intervalMs
            const remaining = cycle - (elapsed % cycle)
            map.set(key, now + remaining)
          } else {
            map.set(key, now + getNextRunMs(op.parsedSchedule))
          }
        }
      }
      setNextRunAt(map)
    }, 1_000)

    return () => {
      for (const timer of intervalTimers.values()) {
        clearInterval(timer)
      }
      intervalTimers.clear()
      for (const timer of flushTimers.values()) {
        clearTimeout(timer)
      }
      flushTimers.clear()
      clearInterval(slotTickTimer)
      clearInterval(countdownTimer)
    }
  }, [
    channels
      .flatMap((c) => c.operations.filter((o) => o.enabled && o.parsedSchedule).map((o) => `${c.id}_${o.id}_${JSON.stringify(o.parsedSchedule)}`))
      .join('|'),
  ])

  return { nextRunAt }
}

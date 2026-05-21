import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_COLLAGE_FRAMES, MAX_TIMELINE_HISTORY_ITEMS } from '../data/constants'
import { captureLatestCameraFrame } from '../services/camera-frame'
import { buildCollageFromFrames } from '../services/collage-builder'
import { checkFrameRelevance } from '../services/frame-relevance'
import { requestTimelineAnalysis } from '../services/timeline-analysis'
import type {
  Channel,
  TimelineAnalysis,
  TimelineSampledFrame,
  TimelineSamplerState,
} from '../types'

interface TimelineSamplerArgs {
  channels: Channel[]
  onAnalysisComplete: (payload: {
    channelId: string
    analysis: TimelineAnalysis
  }) => void
}

const DEFAULT_INTERVAL_SECONDS: 2 | 4 | 8 = 4

function buildIdleSamplerState(): TimelineSamplerState {
  return {
    isActive: false,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    sampledFrames: [],
    analysisHistory: [],
  }
}

/**
 * מנהל דגימת פריימים מחזורית לכל ערוץ, כולל בניית קולאז' ושליחה לניתוח.
 */
export function useTimelineSampler({ channels, onAnalysisComplete }: TimelineSamplerArgs) {
  const [samplerStates, setSamplerStates] = useState<Map<string, TimelineSamplerState>>(new Map())
  const samplerStatesRef = useRef(samplerStates)
  const channelsRef = useRef(channels)
  const onAnalysisCompleteRef = useRef(onAnalysisComplete)
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const runningChannelIdsRef = useRef<Set<string>>(new Set())

  samplerStatesRef.current = samplerStates
  channelsRef.current = channels
  onAnalysisCompleteRef.current = onAnalysisComplete

  const updateSamplerState = useCallback(
    (channelId: string, updater: (current: TimelineSamplerState) => TimelineSamplerState) => {
      setSamplerStates((currentMap) => {
        const nextMap = new Map(currentMap)
        const currentState = nextMap.get(channelId) ?? buildIdleSamplerState()
        nextMap.set(channelId, updater(currentState))
        samplerStatesRef.current = nextMap
        return nextMap
      })
    },
    [],
  )

  const stopSampling = useCallback(
    (channelId: string) => {
      const existingTimer = timersRef.current.get(channelId)
      if (existingTimer) {
        clearInterval(existingTimer)
        timersRef.current.delete(channelId)
      }
      runningChannelIdsRef.current.delete(channelId)
      updateSamplerState(channelId, (currentState) => ({
        ...currentState,
        isActive: false,
        sampledFrames: [],
      }))
    },
    [updateSamplerState],
  )

  const runSampleTick = useCallback(
    async (channelId: string) => {
      if (runningChannelIdsRef.current.has(channelId)) {
        return
      }
      runningChannelIdsRef.current.add(channelId)

      try {
        const channel = channelsRef.current.find((item) => item.id === channelId)
        if (!channel) {
          stopSampling(channelId)
          return
        }

        const capturedFrameDataUrl = await captureLatestCameraFrame('scan-standard')
        const isRelevantFrame = await checkFrameRelevance(capturedFrameDataUrl)
        if (!isRelevantFrame) {
          return
        }

        const sampledFrame: TimelineSampledFrame = {
          dataUrl: capturedFrameDataUrl,
          capturedAtIso: new Date().toISOString(),
        }

        const currentState = samplerStatesRef.current.get(channelId) ?? buildIdleSamplerState()
        const intervalSecondsForAnalysis = currentState.intervalSeconds
        const nextFrames = [...currentState.sampledFrames, sampledFrame].slice(-MAX_COLLAGE_FRAMES)

        updateSamplerState(channelId, (stateBeforeUpdate) => ({
          ...stateBeforeUpdate,
          sampledFrames: nextFrames,
        }))

        if (nextFrames.length < MAX_COLLAGE_FRAMES) {
          return
        }

        const collageDataUrl = await buildCollageFromFrames(nextFrames)
        const frameTimestamps = nextFrames.map((frame) => frame.capturedAtIso)
        const summary = await requestTimelineAnalysis(channel, collageDataUrl, frameTimestamps)
        const nowIso = new Date().toISOString()
        const analysis: TimelineAnalysis = {
          id: crypto.randomUUID(),
          timestampIso: nowIso,
          summary,
          frameCount: nextFrames.length,
          timeRangeStartIso: nextFrames[0].capturedAtIso,
          timeRangeEndIso: nextFrames[nextFrames.length - 1].capturedAtIso,
          intervalSeconds: intervalSecondsForAnalysis,
        }

        updateSamplerState(channelId, (currentState) => ({
          ...currentState,
          sampledFrames: [],
          analysisHistory: [analysis, ...currentState.analysisHistory].slice(0, MAX_TIMELINE_HISTORY_ITEMS),
        }))

        onAnalysisCompleteRef.current({
          channelId,
          analysis,
        })
      } catch {
        updateSamplerState(channelId, (currentState) => ({
          ...currentState,
          sampledFrames: currentState.sampledFrames.slice(1),
        }))
      } finally {
        runningChannelIdsRef.current.delete(channelId)
      }
    },
    [stopSampling, updateSamplerState],
  )

  const startSampling = useCallback(
    (channelId: string, intervalSeconds: 2 | 4 | 8) => {
      const currentTimer = timersRef.current.get(channelId)
      if (currentTimer) {
        clearInterval(currentTimer)
      }

      updateSamplerState(channelId, (currentState) => ({
        ...currentState,
        isActive: true,
        intervalSeconds,
      }))

      const timer = setInterval(() => {
        void runSampleTick(channelId)
      }, intervalSeconds * 1000)
      timersRef.current.set(channelId, timer)
    },
    [runSampleTick, updateSamplerState],
  )

  const getSamplerState = useCallback((channelId: string): TimelineSamplerState => {
    return samplerStatesRef.current.get(channelId) ?? buildIdleSamplerState()
  }, [])

  useEffect(() => {
    const existingChannelIds = new Set(channels.map((channel) => channel.id))
    for (const channelId of timersRef.current.keys()) {
      if (!existingChannelIds.has(channelId)) {
        stopSampling(channelId)
      }
    }
  }, [channels, stopSampling])

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearInterval(timer)
      }
      timersRef.current.clear()
      runningChannelIdsRef.current.clear()
    }
  }, [])

  return {
    samplerStates,
    startSampling,
    stopSampling,
    getSamplerState,
  }
}

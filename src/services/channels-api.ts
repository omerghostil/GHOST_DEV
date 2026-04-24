import { httpRequest } from './http-client'
import type { Channel, Message, Operation } from '../types'

const BASE = '/api/channels'

interface ChannelApiResponse extends Record<string, unknown> {
  id: string
  name: string
  messages: Message[]
  operations: Operation[]
}

function mapServerChannelToClient(raw: ChannelApiResponse): Channel {
  return {
    id: raw.id as string,
    name: raw.name as string,
    type: (raw.type as Channel['type']) ?? 'personal',
    subtitle: (raw.subtitle as string) ?? '',
    location: (raw.location as string) ?? '',
    watchScope: (raw.watchScope as string) ?? '',
    description: (raw.description as string) ?? '',
    memoryInterval: (raw.memoryInterval as number) ?? 30,
    rtspFeed: (raw.rtspFeed as string) ?? 'rtsp://',
    unread: 0,
    liveState: (raw.liveState as Channel['liveState']) ?? 'LIVE',
    cameraEnabled: (raw.cameraEnabled as boolean) ?? false,
    linkedChannelIds: (raw.linkedChannelIds as string[]) ?? undefined,
    members: (raw.members as string[]) ?? [],
    messages: (raw.messages ?? []).map(mapServerMessageToClient),
    operations: (raw.operations ?? []).map(mapServerOperationToClient),
  }
}

function mapServerMessageToClient(raw: Message | Record<string, unknown>): Message {
  return {
    id: raw.id as string,
    author: raw.author as Message['author'],
    text: raw.text as string,
    time: raw.time as string,
    alertLevel: (raw as Record<string, unknown>).alertLevel as Message['alertLevel'],
    score: (raw as Record<string, unknown>).score as number | undefined,
    frameDataUrl: (raw as Record<string, unknown>).frameDataUrl as string | undefined,
    sources: (raw as Record<string, unknown>).sources as string[] | undefined,
  }
}

function mapServerOperationToClient(raw: Operation | Record<string, unknown>): Operation {
  const r = raw as Record<string, unknown>
  return {
    id: r.id as string,
    name: r.name as string,
    mode: r.mode as Operation['mode'],
    schedule: r.schedule as string,
    trigger: r.trigger as string,
    action: r.action as string,
    modelOverride: r.modelOverride as Operation['modelOverride'],
    detailLevel: r.detailLevel as Operation['detailLevel'],
    enabled: r.enabled as boolean,
    parsedSchedule: r.parsedSchedule as Operation['parsedSchedule'],
  }
}

export async function fetchChannels(): Promise<Channel[]> {
  const res = await httpRequest(BASE)
  if (!res.ok) throw new Error('טעינת ערוצים נכשלה.')
  const data = (await res.json()) as ChannelApiResponse[]
  return data.map(mapServerChannelToClient)
}

export async function fetchChannel(channelId: string): Promise<Channel> {
  const res = await httpRequest(`${BASE}/${channelId}`)
  if (!res.ok) throw new Error('טעינת ערוץ נכשלה.')
  const data = (await res.json()) as ChannelApiResponse
  return mapServerChannelToClient(data)
}

export async function createChannel(
  channel: Omit<Channel, 'id' | 'unread' | 'messages' | 'operations' | 'timelineState' | 'lastFrameDataUrl'>,
): Promise<Channel> {
  const res = await httpRequest(BASE, {
    method: 'POST',
    body: JSON.stringify({
      name: channel.name,
      type: channel.type,
      subtitle: channel.subtitle,
      location: channel.location,
      watchScope: channel.watchScope,
      description: channel.description,
      memoryInterval: channel.memoryInterval,
      rtspFeed: channel.rtspFeed,
      liveState: channel.liveState,
      cameraEnabled: channel.cameraEnabled ?? false,
      linkedChannelIds: channel.linkedChannelIds ?? [],
      members: channel.members,
    }),
  })
  if (!res.ok) throw new Error('יצירת ערוץ נכשלה.')
  const data = (await res.json()) as ChannelApiResponse
  return mapServerChannelToClient(data)
}

export async function updateChannel(
  channelId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const res = await httpRequest(`${BASE}/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error('עדכון ערוץ נכשל.')
}

export async function deleteChannelApi(channelId: string): Promise<void> {
  const res = await httpRequest(`${BASE}/${channelId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('מחיקת ערוץ נכשלה.')
}

export async function saveMessage(
  channelId: string,
  message: Omit<Message, 'id'>,
): Promise<void> {
  await httpRequest(`${BASE}/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  })
}

export async function createOperationApi(
  channelId: string,
  operation: Omit<Operation, 'id'>,
): Promise<Operation> {
  const res = await httpRequest(`${BASE}/${channelId}/operations`, {
    method: 'POST',
    body: JSON.stringify({
      name: operation.name,
      mode: operation.mode,
      schedule: operation.schedule,
      trigger: operation.trigger,
      action: operation.action,
      modelOverride: operation.modelOverride,
      detailLevel: operation.detailLevel,
      enabled: operation.enabled,
      parsedSchedule: operation.parsedSchedule,
    }),
  })
  if (!res.ok) throw new Error('יצירת מבצע נכשלה.')
  return mapServerOperationToClient((await res.json()) as Record<string, unknown>)
}

export async function updateOperationApi(
  channelId: string,
  operationId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await httpRequest(`${BASE}/${channelId}/operations/${operationId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
}

export async function deleteOperationApi(
  channelId: string,
  operationId: string,
): Promise<void> {
  await httpRequest(`${BASE}/${channelId}/operations/${operationId}`, {
    method: 'DELETE',
  })
}

import { z } from 'zod'

export const CreateChannelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['personal', 'group']),
  subtitle: z.string().default(''),
  location: z.string().default(''),
  watchScope: z.string().default(''),
  description: z.string().default(''),
  memoryInterval: z.number().int().min(5).max(300).default(30),
  rtspFeed: z.string().default('rtsp://'),
  liveState: z.enum(['LIVE', 'SYNC', 'DEGRADED', 'OFFLINE']).default('LIVE'),
  cameraEnabled: z.boolean().default(false),
  linkedChannelIds: z.array(z.string()).default([]),
  members: z.array(z.string()).default([]),
  isBlocked: z.boolean().default(false),
})

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['personal', 'group']).optional(),
  subtitle: z.string().optional(),
  location: z.string().optional(),
  watchScope: z.string().optional(),
  description: z.string().optional(),
  memoryInterval: z.number().int().min(5).max(300).optional(),
  rtspFeed: z.string().optional(),
  liveState: z.enum(['LIVE', 'SYNC', 'DEGRADED', 'OFFLINE']).optional(),
  cameraEnabled: z.boolean().optional(),
  linkedChannelIds: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),
  isBlocked: z.boolean().optional(),
})

export const CreateMessageSchema = z.object({
  author: z.enum(['user', 'ghost', 'system']),
  text: z.string().min(1),
  time: z.string().min(1),
  alertLevel: z.enum(['critical', 'routine', 'report', 'rating', 'assessment']).optional(),
  score: z.number().optional(),
  frameDataUrl: z.string().optional(),
  sources: z.array(z.string()).optional(),
})

export const CreateOperationSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(['alert', 'report', 'rating', 'assessment']),
  schedule: z.string().default('24/7'),
  trigger: z.string().default(''),
  action: z.string().min(1),
  modelOverride: z.enum(['gpt-4.1', 'gpt-4.1-mini']).optional(),
  detailLevel: z.enum(['low', 'auto', 'high']).optional(),
  enabled: z.boolean().default(true),
  parsedSchedule: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateOperationSchema = z.object({
  name: z.string().min(1).optional(),
  mode: z.enum(['alert', 'report', 'rating', 'assessment']).optional(),
  schedule: z.string().optional(),
  trigger: z.string().optional(),
  action: z.string().optional(),
  modelOverride: z.enum(['gpt-4.1', 'gpt-4.1-mini']).nullable().optional(),
  detailLevel: z.enum(['low', 'auto', 'high']).nullable().optional(),
  enabled: z.boolean().optional(),
  parsedSchedule: z.record(z.string(), z.unknown()).nullable().optional(),
})

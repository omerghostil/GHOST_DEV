import { z } from 'zod'

export const ChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['personal', 'group']),
  watchScope: z.string().min(1),
  location: z.string().min(1),
  members: z.array(z.string()),
})

export const ChatVisionRequestSchema = z.object({
  channel: ChannelSchema,
  prompt: z.string().min(1),
  frameDataUrl: z.string().startsWith('data:image/'),
  analysisContext: z.string().max(6000).optional(),
})

export type ChatVisionRequest = z.infer<typeof ChatVisionRequestSchema>

export const OperationScanRequestSchema = z.object({
  channel: ChannelSchema,
  frameDataUrl: z.string().startsWith('data:image/'),
  operations: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        schedule: z.string(),
        mode: z.enum(['alert', 'report', 'rating', 'assessment']),
        alertTrigger: z.string(),
        action: z.string(),
        modelOverride: z.enum(['gpt-4.1', 'gpt-4.1-mini']).optional(),
        detailLevel: z.enum(['low', 'auto', 'high']).optional(),
      }),
    )
    .min(1),
})

export type OperationScanRequest = z.infer<typeof OperationScanRequestSchema>

export const OperationScanResponseSchema = z.object({
  results: z.array(
    z.object({
      operationId: z.string(),
      mode: z.enum(['alert', 'report', 'rating', 'assessment']),
      critical: z.boolean().optional(),
      score: z.number().min(1).max(10).optional(),
      summary: z.string(),
    }),
  ),
})

export type OperationScanResponse = z.infer<typeof OperationScanResponseSchema>

import { z } from 'zod'
import { USER_ROLES } from './types'

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(10),
})

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2),
  limits: z.object({
    maxChannels: z.number().int().positive(),
    maxMessagesPerChannelPerMonth: z.number().int().positive(),
    monthlyChargeAmount: z.number().nonnegative(),
    maxAgentsTotalCost: z.number().nonnegative(),
    maxAiTotalCost: z.number().nonnegative(),
    maxApiTotalCost: z.number().nonnegative(),
  }),
})

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  limits: z
    .object({
      maxChannels: z.number().int().positive(),
      maxMessagesPerChannelPerMonth: z.number().int().positive(),
      monthlyChargeAmount: z.number().nonnegative(),
      maxAgentsTotalCost: z.number().nonnegative(),
      maxAiTotalCost: z.number().nonnegative(),
      maxApiTotalCost: z.number().nonnegative(),
    })
    .optional(),
})

export const CreateUserSchema = z.object({
  organizationId: z.string().uuid(),
  username: z.string().min(3),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum([USER_ROLES.systemManager, USER_ROLES.regularUser]),
  allowedChannelIds: z.array(z.string()).default([]),
  blockedChannelIds: z.array(z.string()).default([]),
})

export const UpdateUserSchema = z.object({
  role: z.enum([USER_ROLES.systemManager, USER_ROLES.regularUser]).optional(),
  isActive: z.boolean().optional(),
  allowedChannelIds: z.array(z.string()).optional(),
  blockedChannelIds: z.array(z.string()).optional(),
})

export const CreateChannelSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
})

export const CreateCampaignSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
})

export const PaymentCardSchema = z.object({
  organizationId: z.string().uuid(),
  pan: z.string().min(12),
  cardholderName: z.string().min(2),
  expiryMonth: z.string().regex(/^\d{2}$/),
  expiryYear: z.string().regex(/^\d{2,4}$/),
  billingEmail: z.string().email(),
  managerCode: z.string().length(4),
})

export const RevealPaymentCardSchema = z.object({
  organizationId: z.string().uuid(),
  managerCode: z.string().length(4),
})

export const SetOpenAiKeySchema = z.object({
  organizationId: z.string().uuid(),
  openAiApiKey: z.string().min(20),
})

export const RecordUsageSchema = z.object({
  organizationId: z.string().uuid(),
  sentMessages: z.number().int().nonnegative().default(0),
  receivedMessages: z.number().int().nonnegative().default(0),
  devicesCount: z.number().int().nonnegative().default(0),
  channelsCount: z.number().int().nonnegative().default(0),
  operationsCount: z.number().int().nonnegative().default(0),
  aiTotalCost: z.number().nonnegative().default(0),
  apiTotalCost: z.number().nonnegative().default(0),
  agentsTotalCost: z.number().nonnegative().default(0),
})

/** רישום הודעה/מבצע בודד פר ערוץ */
export const RecordChannelMessageSchema = z.object({
  organizationId: z.string().uuid(),
  channelId: z.string().min(1),
  direction: z.enum(['outgoing', 'incoming']),
  source: z.enum(['user', 'ghost', 'system', 'operation']),
  campaignId: z.string().optional(),
  count: z.number().int().positive().default(1),
})

export const CreateIssueSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
})

export const UpdateIssueSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']),
})

import { Router } from 'express'
import type { IAdminRepository } from '../db/repository-types'
import { requireAuth } from '../middleware/auth-guard'
import { CreateIssueSchema } from '../admin/schemas'
import type { IRealtimeHub } from '../realtime/realtime-hub-types'

interface CreateIssuesRouterOptions {
  store: IAdminRepository
  realtimeHub: IRealtimeHub
}

/**
 * נתיבי דיווח תקלות מהמשתמשים בזמן אמת.
 */
export function createIssuesRouter({ store, realtimeHub }: CreateIssuesRouterOptions): Router {
  const router = Router()
  router.use(requireAuth)

  router.post('/', (request, response) => {
    const parsed = CreateIssueSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ error: 'בקשת דיווח תקלה לא תקינה.' })
    }
    if (!request.auth) {
      return response.status(401).json({ error: 'משתמש לא מזוהה.' })
    }

    const issue = store.createIssue({
      organizationId: request.auth.organizationId,
      userId: request.auth.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      severity: parsed.data.severity,
    })

    store.addAuditLog({
      actorUserId: request.auth.userId,
      action: 'issue.created',
      targetType: 'issue',
      targetId: issue.id,
      details: `נפתחה תקלה: ${issue.title}`,
    })

    realtimeHub.publish({
      eventType: 'issue.created',
      organizationId: issue.organizationId,
      severity: issue.severity === 'critical' ? 'error' : 'warning',
      timestampIso: new Date().toISOString(),
      payload: issue as unknown as Record<string, unknown>,
    })

    return response.status(201).json(issue)
  })

  return router
}

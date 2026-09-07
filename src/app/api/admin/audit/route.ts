import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  actorId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
})

// سجل التدقيق (PLAN ق45/46) — من فعل ماذا ومتى ولماذا
export async function GET(req: Request) {
  try {
    await requirePermission('audit.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.action) where.action = { contains: q.action }
    if (q.entityType) where.entityType = q.entityType
    if (q.actorId) where.actorId = q.actorId
    if (q.search) {
      where.OR = [
        { action: { contains: q.search } },
        { entityId: { contains: q.search } },
        { reason: { contains: q.search } },
      ]
    }

    const [total, logs, actionTypes] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { actor: { select: { name: true, role: true } } },
      }),
      db.auditLog.groupBy({ by: ['action'], _count: { _all: true }, take: 50, orderBy: { _count: { action: 'desc' } } }),
    ])

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit),
      logs: logs.map((l) => ({
        ...l,
        oldValues: l.oldValuesJson ? JSON.parse(l.oldValuesJson) : null,
        newValues: l.newValuesJson ? JSON.parse(l.newValuesJson) : null,
      })),
      actionTypes: actionTypes.map((a) => ({ action: a.action, count: a._count._all })),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

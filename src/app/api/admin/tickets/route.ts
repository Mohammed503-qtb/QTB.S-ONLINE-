import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// تذاكر الدعم (الإدارة — PLAN ق43)
export async function GET(req: Request) {
  try {
    await requirePermission('support.manage')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.status) where.status = q.status

    const [total, tickets] = await Promise.all([
      db.supportTicket.count({ where }),
      db.supportTicket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          customer: { include: { user: { select: { name: true, phone: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
    ])
    return ok({ total, page: q.page, pages: Math.ceil(total / q.limit), tickets })
  } catch (e) {
    return handleRouteError(e)
  }
}

import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  search: z.string().optional(),
  tier: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// العملاء (PLAN ق62)
export async function GET(req: Request) {
  try {
    await requirePermission('customers.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.tier) where.tier = q.tier
    if (q.search) {
      where.OR = [
        { user: { name: { contains: q.search } } },
        { user: { phone: { contains: q.search } } },
        { user: { email: { contains: q.search } } },
      ]
    }

    const [total, customers] = await Promise.all([
      db.customer.count({ where }),
      db.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          user: { select: { name: true, phone: true, email: true, status: true, createdAt: true } },
          _count: { select: { orders: true, returnRequests: true, tickets: true } },
        },
      }),
    ])

    return ok({ total, page: q.page, pages: Math.ceil(total / q.limit), customers })
  } catch (e) {
    return handleRouteError(e)
  }
}

import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// طلبات الإرجاع (الإدارة)
export async function GET(req: Request) {
  try {
    await requirePermission('returns.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.status) where.status = q.status
    if (q.search) {
      where.OR = [
        { returnNumber: { contains: q.search.toUpperCase() } },
        { order: { orderNumber: { contains: q.search } } },
        { customer: { user: { name: { contains: q.search } } } },
      ]
    }

    const [total, returns, statusCounts] = await Promise.all([
      db.returnRequest.count({ where }),
      db.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          order: { select: { id: true, orderNumber: true, grandTotal: true, status: true } },
          customer: { include: { user: { select: { name: true, phone: true } } } },
          items: { include: { orderItem: { select: { productName: true, imageUrl: true, unitPrice: true, quantity: true } } } },
          refunds: true,
        },
      }),
      db.returnRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit), returns,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

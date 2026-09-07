import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { ORDER_STATUSES } from '@/lib/shared/constants'
import type { Prisma } from '@prisma/client'

const querySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  paymentStatus: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// قائمة الطلبات للإدارة مع فلاتر (PLAN ق61)
export async function GET(req: Request) {
  try {
    await requirePermission('orders.view')
    const q = parseQuery(req, querySchema)

    const where: Prisma.OrderWhereInput = {}
    if (q.status && ORDER_STATUSES.includes(q.status as never)) where.status = q.status
    if (q.paymentStatus) where.paymentStatus = q.paymentStatus
    if (q.search) {
      where.OR = [
        { orderNumber: { contains: q.search } },
        { paymentReference: { contains: q.search.toUpperCase() } },
        { trackingCode: { contains: q.search.toUpperCase() } },
        { customer: { user: { name: { contains: q.search } } } },
        { customer: { user: { phone: { contains: q.search } } } },
      ]
    }

    const [total, orders, statusCounts] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          customer: { include: { user: { select: { name: true, phone: true } } } },
          items: { select: { productName: true, quantity: true, imageUrl: true } },
        },
      }),
      db.order.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    return ok({
      total,
      page: q.page,
      pages: Math.ceil(total / q.limit),
      orders,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

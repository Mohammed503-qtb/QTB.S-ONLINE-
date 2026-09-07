import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

const querySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  risk: z.enum(['all', 'flagged']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// طابور المدفوعات (PLAN ق13/18)
export async function GET(req: Request) {
  try {
    await requirePermission('payments.view')
    const q = parseQuery(req, querySchema)

    const where: Prisma.PaymentWhereInput = {}
    if (q.status) where.status = q.status
    if (q.risk === 'flagged') where.riskFlags = { not: '' }
    if (q.search) {
      where.OR = [
        { paymentNumber: { contains: q.search.toUpperCase() } },
        { customerTransferRef: { contains: q.search } },
        { order: { orderNumber: { contains: q.search } } },
        { order: { customer: { user: { name: { contains: q.search } } } } },
        { order: { customer: { user: { phone: { contains: q.search } } } } },
      ]
    }

    const [total, payments, statusCounts] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { submittedAt: 'asc' },
        ],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          order: {
            select: {
              orderNumber: true, grandTotal: true, status: true,
              customer: { include: { user: { select: { name: true, phone: true } } } },
            },
          },
        },
      }),
      db.payment.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit), payments,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

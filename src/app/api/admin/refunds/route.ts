import { z } from 'zod'
import { ok, handleRouteError, parseQuery, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { createRefund } from '@/lib/server/returns'

const querySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// سجلات الاسترداد
export async function GET(req: Request) {
  try {
    await requirePermission('accounting.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.status) where.status = q.status

    const [total, refunds, banks] = await Promise.all([
      db.refund.count({ where }),
      db.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          order: { select: { orderNumber: true, grandTotal: true } },
          returnRequest: { select: { returnNumber: true, status: true } },
        },
      }),
      db.bankAccount.findMany({ where: { active: true }, select: { id: true, name: true } }),
    ])

    return ok({ total, page: q.page, pages: Math.ceil(total / q.limit), refunds, banks })
  } catch (e) {
    return handleRouteError(e)
  }
}

const createSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().optional(),
  amount: z.number().int().min(1, 'المبلغ مطلوب'),
  method: z.enum(['BANK', 'CASH', 'CREDIT']).default('BANK'),
  bankAccountId: z.string().optional(),
  reason: z.string().min(3, 'السبب إلزامي').max(200),
})

// إنشاء استرداد يدوي (إلغاء بعد الدفع مثلًا — PLAN ق27)
export async function POST(req: Request) {
  try {
    const actor = await requirePermission('refunds.approve')
    const body = await parseBody(req, createSchema)
    const refund = await createRefund({ ...body, actor })
    return ok(refund)
  } catch (e) {
    return handleRouteError(e)
  }
}

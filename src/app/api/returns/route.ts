import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { createReturnRequest } from '@/lib/server/returns'
import { getFlag } from '@/lib/server/flags'

const createSchema = z.object({
  orderId: z.string().min(1),
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().min(1) })).min(1, 'حدد المنتجات'),
  reason: z.string().min(2, 'سبب الإرجاع مطلوب').max(200),
  note: z.string().max(500).optional(),
  photos: z.array(z.string()).max(5).optional(),
  replacement: z.object({ variantId: z.string(), orderItemId: z.string() }).nullable().optional(),
})

// GET: طلبات الإرجاع الخاصة بي
export async function GET() {
  try {
    const user = await requireUser()
    const returns = await db.returnRequest.findMany({
      where: { customerId: user.customerId ?? '' },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNumber: true, grandTotal: true } },
        items: { include: { orderItem: { select: { productName: true, imageUrl: true, unitPrice: true } } } },
        refunds: true,
      },
    })
    return ok(returns)
  } catch (e) {
    return handleRouteError(e)
  }
}

// POST: طلب إرجاع جديد (PLAN ق28)
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const returnsEnabled = await getFlag('returns_enabled')
    if (!returnsEnabled) {
      const { ApiError } = await import('@/lib/server/api')
      throw new ApiError('PERMISSION_ERROR', 'الإرجاع متوقف حاليًا من الإدارة', 403)
    }
    const body = await parseBody(req, createSchema)
    const rr = await createReturnRequest({ ...body, customerUserId: user.id })
    return ok({ id: rr.id, returnNumber: rr.returnNumber, status: rr.status })
  } catch (e) {
    return handleRouteError(e)
  }
}

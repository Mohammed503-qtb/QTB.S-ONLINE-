import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { transitionOrder } from '@/lib/server/orders'
import { ORDER_STATUSES } from '@/lib/shared/constants'

const schema = z.object({
  to: z.enum(ORDER_STATUSES as never),
  reason: z.string().max(300).optional(),
  note: z.string().max(300).optional(),
  provider: z.string().max(80).optional(),
})

// انتقال حالة الطلب — مع آثار جانبية كاملة (PLAN ق1.7/ق24/ق25)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('orders.update')
    const { id } = await ctx.params
    const body = await parseBody(req, schema)

    // صلاحيات خاصة لبعض الانتقالات
    if (body.to === 'CANCELLED') {
      await requirePermission('orders.cancel')
    }

    const result = await transitionOrder({
      orderId: id, to: body.to, actor,
      reason: body.reason, note: body.note, extra: { provider: body.provider },
    })

    return ok({ status: result.status, version: result.version })
  } catch (e) {
    return handleRouteError(e)
  }
}

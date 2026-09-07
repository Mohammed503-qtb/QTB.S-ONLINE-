import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { customerCancelOrder } from '@/lib/server/orders'

const schema = z.object({ reason: z.string().min(3, 'اذكر سبب الإلغاء').max(300) })

// إلغاء الطلب من العميل — قبل الدفع فقط (PLAN ق27)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const { reason } = await parseBody(req, schema)
    await customerCancelOrder(id, user.id, reason)
    return ok({ cancelled: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

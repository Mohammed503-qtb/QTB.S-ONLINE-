import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { transitionReturn, createRefund } from '@/lib/server/returns'
import { RETURN_STATUSES } from '@/lib/shared/constants'

const schema = z.object({
  to: z.enum(RETURN_STATUSES as never),
  reason: z.string().max(300).optional(),
  note: z.string().max(500).optional(),
  refundMethod: z.enum(['BANK', 'CASH', 'CREDIT']).optional(),
  bankAccountId: z.string().optional(),
})

// انتقالات الإرجاع + إنشاء الاسترداد عند REFUND_PENDING (PLAN ق28/106)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('returns.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, schema)

    const rr = await db.returnRequest.findUnique({
      where: { id },
      include: { items: { include: { orderItem: true } }, order: true, refunds: true },
    })
    if (!rr) return fail('VALIDATION_ERROR', 'طلب الإرجاع غير موجود', 404)

    // الانتقال عبر المحرك (بكل الآثار)
    await transitionReturn({ returnId: id, to: body.to, actor, reason: body.reason, note: body.note })

    // عند الوصول لمرحلة الاسترداد → إنشاء سجل استرداد قابل للتدقيق (PLAN ق30)
    if (body.to === 'REFUND_PENDING' && rr.refunds.length === 0) {
      const refundAmount = rr.items.reduce((s, i) => s + i.orderItem.unitPrice * i.quantity, 0)
      await createRefund({
        orderId: rr.orderId,
        returnRequestId: id,
        amount: refundAmount,
        method: body.refundMethod ?? 'BANK',
        reason: `استرداد مرتجع ${rr.returnNumber}`,
        actor,
        bankAccountId: body.bankAccountId,
      })
    }

    return ok({ status: body.to })
  } catch (e) {
    return handleRouteError(e)
  }
}

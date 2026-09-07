import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { verifyPayment, rejectPayment, requestClarification, settleOverpayment, markUnderReview } from '@/lib/server/payments'

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('verify'),
    bankAccountId: z.string().optional(),
    confirmAmount: z.number().int().positive().optional(),
    note: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().min(3, 'سبب الرفض إلزامي').max(300),
    note: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('clarify'),
    message: z.string().min(3, 'رسالة التوضيح مطلوبة').max(500),
  }),
  z.object({
    action: z.literal('review'),
  }),
  z.object({
    action: z.literal('settle_overpayment'),
    method: z.enum(['CREDIT', 'REFUND']),
  }),
])

// إجراءات الدفعة: اعتماد/رفض/توضيح/تسوية الزائد (PLAN ق18/19)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('payments.review')
    const { id } = await ctx.params
    const body = await parseBody(req, schema)

    switch (body.action) {
      case 'verify': {
        const result = await verifyPayment({
          paymentId: id, actor,
          bankAccountId: body.bankAccountId, note: body.note, confirmAmount: body.confirmAmount,
        })
        return ok(result)
      }
      case 'reject': {
        await rejectPayment({ paymentId: id, actor, reason: body.reason, note: body.note })
        return ok({ rejected: true })
      }
      case 'clarify': {
        await requestClarification({ paymentId: id, actor, message: body.message })
        return ok({ clarified: true })
      }
      case 'review': {
        const p = await markUnderReview(id, actor)
        return ok({ status: p.status })
      }
      case 'settle_overpayment': {
        const result = await settleOverpayment({ paymentId: id, actor, method: body.method })
        return ok(result)
      }
    }
  } catch (e) {
    return handleRouteError(e)
  }
}

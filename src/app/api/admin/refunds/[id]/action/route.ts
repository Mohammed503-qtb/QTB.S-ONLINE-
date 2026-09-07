import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { completeRefund } from '@/lib/server/returns'

const schema = z.object({
  action: z.enum(['approve', 'complete', 'cancel']),
  note: z.string().max(300).optional(),
})

// تنفيذ الاسترداد — أثر مالي حقيقي لا "Refunded" كاذبة (PLAN ق30/106)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('refunds.process')
    const { id } = await ctx.params
    const body = await parseBody(req, schema)

    if (body.action === 'approve') {
      const { db } = await import('@/lib/db')
      const refund = await db.refund.findUnique({ where: { id } })
      if (!refund) {
        const { ApiError } = await import('@/lib/server/api')
        throw new ApiError('VALIDATION_ERROR', 'سجل الاسترداد غير موجود', 404)
      }
      await db.refund.update({ where: { id }, data: { status: 'APPROVED', approvedById: actor.id } })
      return ok({ status: 'APPROVED' })
    }

    if (body.action === 'cancel') {
      const { db } = await import('@/lib/db')
      await db.refund.update({ where: { id }, data: { status: 'CANCELLED' } })
      return ok({ status: 'CANCELLED' })
    }

    await completeRefund({ refundId: id, actor, note: body.note })
    return ok({ status: 'COMPLETED' })
  } catch (e) {
    return handleRouteError(e)
  }
}

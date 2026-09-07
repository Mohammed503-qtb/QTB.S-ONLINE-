import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { submitPayment } from '@/lib/server/payments'

const schema = z.object({
  amount: z.number().int().min(1, 'أدخل المبلغ المحوّل').max(100_000_000),
  paymentAccountId: z.string().optional(),
  customerTransferRef: z.string().max(60).optional(),
  transferDate: z.string().optional(),
  senderName: z.string().max(80).optional(),
  proofUrl: z.string().optional(),
  notes: z.string().max(400).optional(),
})

// تسجيل بيانات التحويل من العميل (PLAN ق12/18)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const body = await parseBody(req, schema)
    const payment = await submitPayment({ paymentId: id, customerUserId: user.id, ...body })
    return ok({ paymentId: payment.id, status: payment.status, submittedAmount: payment.submittedAmount })
  } catch (e) {
    return handleRouteError(e)
  }
}

import { ok, fail, handleRouteError } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

// تفاصيل دفعة + أحداثها + الحركات البنكية المرتبطة
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('payments.view')
    const { id } = await ctx.params

    const payment = await db.payment.findFirst({
      where: { OR: [{ id }, { paymentNumber: id }] },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        order: {
          include: {
            items: true,
            customer: { include: { user: { select: { name: true, phone: true } } } },
          },
        },
      },
    })
    if (!payment) return fail('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)

    const bankTxns = await db.bankTransaction.findMany({ where: { refType: 'payment', refId: payment.id } })
    const duplicateOf = payment.duplicateOfId
      ? await db.payment.findUnique({ where: { id: payment.duplicateOfId }, select: { paymentNumber: true, status: true, orderId: true } })
      : null
    const banks = await db.bankAccount.findMany({ where: { active: true }, select: { id: true, name: true, institution: true } })
    const actorNames = await (async () => {
      const ids = payment.events.map((e) => e.actorId).filter(Boolean) as string[]
      if (!ids.length) return {}
      const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      return Object.fromEntries(users.map((u) => [u.id, u.name]))
    })()

    return ok({
      payment,
      order: {
        id: payment.order.id, orderNumber: payment.order.orderNumber, grandTotal: payment.order.grandTotal,
        status: payment.order.status, items: payment.order.items,
      },
      customer: payment.order.customer.user,
      account: payment.accountSnapshotJson ? JSON.parse(payment.accountSnapshotJson) : null,
      events: payment.events,
      actorNames,
      bankTxns,
      duplicateOf,
      banks,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

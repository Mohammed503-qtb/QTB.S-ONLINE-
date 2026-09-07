import { ok, fail, handleRouteError } from '@/lib/server/api'
import { db } from '@/lib/db'
import { ORDER_STATUS_LABELS } from '@/lib/shared/constants'

// تتبع عام بكود — يعمل بدون تسجيل دخول (PLAN ق19/ق25)
// يقبل: رقم الطلب أو كود الدفع أو كود التتبع
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params
    const clean = decodeURIComponent(code).trim().toUpperCase()

    const order = await db.order.findFirst({
      where: {
        OR: [
          { orderNumber: clean },
          { paymentReference: clean },
          { trackingCode: clean },
        ],
      },
      include: {
        items: { select: { productName: true, quantity: true } },
        events: { where: { customerVisible: true }, orderBy: { createdAt: 'asc' } },
        shipments: true,
        payments: { select: { status: true, expectedAmount: true } },
      },
    })
    if (!order) return fail('VALIDATION_ERROR', 'لم نجد طلبًا بهذا الكود — تأكد من الرقم', 404)

    return ok({
      orderNumber: order.orderNumber,
      trackingCode: order.trackingCode,
      paymentReference: order.paymentReference,
      status: order.status,
      statusLabel: ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status,
      paymentStatus: order.paymentStatus,
      grandTotal: order.grandTotal,
      itemsCount: order.items.length,
      placedAt: order.placedAt,
      timeline: order.events.map((e) => ({ type: e.type, at: e.createdAt })),
      customerName: (await db.customer.findUnique({ where: { id: order.customerId }, include: { user: true } }))?.user.name ?? '',
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

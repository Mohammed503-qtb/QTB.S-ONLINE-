import { ok, fail, handleRouteError } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

// ملف العميل الكامل: طلبات + مدفوعات + عناوين + مرتجعات + رصيد (PLAN ق62)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('customers.view')
    const { id } = await ctx.params

    const customer = await db.customer.findFirst({
      where: { OR: [{ id }, { user: { phone: id } }] },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, status: true, role: true, createdAt: true, lastLoginAt: true } },
        addresses: true,
        favorites: { include: { product: { select: { name: true } } } },
      },
    })
    if (!customer) return fail('VALIDATION_ERROR', 'العميل غير موجود', 404)

    const [orders, payments, returns, refunds, reviews] = await Promise.all([
      db.order.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, createdAt: true, trackingCode: true },
      }),
      db.payment.findMany({
        where: { order: { customerId: customer.id } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { paymentNumber: true, status: true, expectedAmount: true, paidAmount: true, createdAt: true },
      }),
      db.returnRequest.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { returnNumber: true, status: true, reason: true, createdAt: true },
      }),
      db.refund.findMany({
        where: { order: { customerId: customer.id } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { refundNumber: true, status: true, amount: true, method: true, createdAt: true },
      }),
      db.review.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { product: { select: { name: true } } },
      }),
    ])

    const ordersTotal = orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.grandTotal, 0)

    return ok({
      customer: {
        ...customer,
        ordersTotal,
        ordersCount: orders.length,
        cancellations: orders.filter((o) => o.status === 'CANCELLED').length,
      },
      orders, payments, returns, refunds, reviews,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

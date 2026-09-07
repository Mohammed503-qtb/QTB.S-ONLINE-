import { ok, fail, handleRouteError } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { ORDER_TRANSITIONS, type OrderStatus } from '@/lib/shared/constants'

// تفاصيل الطلب الكاملة للإدارة (كل السلاسل المترابطة — PLAN ق100)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('orders.view')
    const { id } = await ctx.params

    const order = await db.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: {
        items: true,
        customer: { include: { user: { select: { name: true, phone: true, email: true } } } },
        statusHistory: { orderBy: { createdAt: 'asc' }, include: {} },
        events: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        shipments: { include: { events: { orderBy: { createdAt: 'asc' } }, attempts: { orderBy: { createdAt: 'desc' } } } },
        returnRequests: { include: { items: { include: { orderItem: true } }, refunds: true } },
        invoice: true,
        reservations: true,
      },
    })
    if (!order) return fail('VALIDATION_ERROR', 'الطلب غير موجود', 404)

    // الحالات المتاحة التالية حسب آلة الحالة
    const nextStatuses = ORDER_TRANSITIONS[order.status as OrderStatus] ?? []

    // حركات المخزون المرتبطة
    const movements = await db.stockMovement.findMany({
      where: { OR: [{ refId: order.id }, { refNumber: order.orderNumber }] },
      orderBy: { createdAt: 'asc' },
      include: { variant: { include: { product: { select: { name: true } } } }, warehouse: { select: { name: true } } },
    })

    return ok({
      order,
      address: JSON.parse(order.addressJson ?? '{}'),
      nextStatuses,
      movements,
      changedByNames: await (async () => {
        const ids = order.statusHistory.map((h) => h.changedById).filter(Boolean) as string[]
        if (ids.length === 0) return {}
        const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
        return Object.fromEntries(users.map((u) => [u.id, u.name]))
      })(),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

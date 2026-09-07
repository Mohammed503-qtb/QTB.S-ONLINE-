import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { createOrder } from '@/lib/server/orders'
import { db } from '@/lib/db'
import { expireStaleOrders } from '@/lib/server/orders'

const createSchema = z.object({
  addressId: z.string().min(1),
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(99) })).min(1, 'السلة فارغة'),
  shippingMethodCode: z.string().min(1),
  paymentMethodCode: z.enum(['BANK_TRANSFER', 'COD']),
  couponCode: z.string().optional(),
  customerNote: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).optional(),
})

// GET: طلباتي
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    await expireStaleOrders().catch(() => {})
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const limit = Math.min(24, Number(url.searchParams.get('limit') ?? 10))

    const customerId = user.customerId ?? ''
    const [total, orders] = await Promise.all([
      db.order.count({ where: { customerId } }),
      db.order.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true,
          trackingCode: true, paymentReference: true, createdAt: true, placedAt: true,
          items: { select: { productName: true, quantity: true, imageUrl: true, lineTotal: true } },
          payments: { select: { paymentNumber: true, status: true, expectedAmount: true, paidAmount: true } },
        },
      }),
    ])

    return ok({ total, page, orders })
  } catch (e) {
    return handleRouteError(e)
  }
}

// POST: إنشاء طلب (PLAN ق15 — معاملة ذرية + Idempotency)
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(req, createSchema)
    if (!user.customerId) throw new Error('ملف العميل غير موجود')

    const { order, duplicated } = await createOrder({
      customerId: user.customerId,
      customerUserId: user.id,
      addressId: body.addressId,
      items: body.items,
      shippingMethodCode: body.shippingMethodCode,
      paymentMethodCode: body.paymentMethodCode,
      couponCode: body.couponCode,
      customerNote: body.customerNote,
      idempotencyKey: body.idempotencyKey,
    })

    return ok({
      duplicated,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentReference: order.paymentReference,
      trackingCode: order.trackingCode,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

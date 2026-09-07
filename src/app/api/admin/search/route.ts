import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({ q: z.string().min(1, 'أدخل كلمة البحث') })

// البحث الشامل للإدارة (PLAN ق47) — طلبات/دفعات/عملاء/منتجات/أكواد
export async function GET(req: Request) {
  try {
    await requireAdmin()
    const { q } = parseQuery(req, querySchema)
    const s = q.trim()
    const upper = s.toUpperCase()

    const [orders, payments, customers, products, returns, shipments] = await Promise.all([
      db.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: upper } },
            { paymentReference: { contains: upper } },
            { trackingCode: { contains: upper } },
            { customer: { user: { name: { contains: s } } } },
            { customer: { user: { phone: { contains: s } } } },
          ],
        },
        take: 10,
        select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, trackingCode: true, paymentReference: true, customer: { include: { user: { select: { name: true } } } } },
      }),
      db.payment.findMany({
        where: {
          OR: [
            { paymentNumber: { contains: upper } },
            { customerTransferRef: { contains: s } },
            { order: { orderNumber: { contains: upper } } },
          ],
        },
        take: 10,
        select: { id: true, paymentNumber: true, status: true, expectedAmount: true, submittedAmount: true, order: { select: { orderNumber: true } } },
      }),
      db.customer.findMany({
        where: { OR: [{ user: { name: { contains: s } } }, { user: { phone: { contains: s } } }] },
        take: 10,
        include: { user: { select: { name: true, phone: true } } },
      }),
      db.product.findMany({
        where: { OR: [{ name: { contains: s } }, { sku: { contains: upper } }, { barcode: { contains: s } }] },
        take: 10,
        select: { id: true, name: true, basePrice: true, status: true, imageUrl: true },
      }),
      db.returnRequest.findMany({
        where: { returnNumber: { contains: upper } },
        take: 5,
        select: { id: true, returnNumber: true, status: true, order: { select: { orderNumber: true } } },
      }),
      db.shipment.findMany({
        where: { OR: [{ trackingCode: { contains: upper } }, { shipmentNumber: { contains: upper } }] },
        take: 5,
        select: { id: true, trackingCode: true, status: true, order: { select: { orderNumber: true } } },
      }),
    ])

    return ok({ orders, payments, customers, products, returns, shipments, query: s })
  } catch (e) {
    return handleRouteError(e)
  }
}

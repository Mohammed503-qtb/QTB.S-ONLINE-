import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { getFlag } from '@/lib/server/flags'

const schema = z.object({
  productId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

// تقييم بعد التسليم فقط (PLAN ق42)
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(req, schema)

    const reviewsEnabled = await getFlag('reviews_enabled')
    if (!reviewsEnabled) return fail('PERMISSION_ERROR', 'التقييمات معطلة حاليًا', 403)
    if (!user.customerId) return fail('VALIDATION_ERROR', 'ملف العميل غير موجود', 400)

    const order = await db.order.findFirst({
      where: { id: body.orderId, customerId: user.customerId, status: { in: ['DELIVERED', 'COMPLETED'] } },
      include: { items: true },
    })
    if (!order) return fail('CONFLICT', 'يمكن التقييم فقط بعد تسليم الطلب', 409)
    if (!order.items.some((i) => i.productId === body.productId)) {
      return fail('VALIDATION_ERROR', 'هذا المنتج ليس ضمن الطلب', 400)
    }

    const existing = await db.review.findFirst({ where: { customerId: user.customerId, orderId: body.orderId, productId: body.productId } })
    if (existing) return fail('CONFLICT', 'قيّمت هذا المنتج في هذا الطلب مسبقًا', 409)

    const review = await db.review.create({
      data: {
        productId: body.productId, customerId: user.customerId, orderId: body.orderId,
        rating: body.rating, comment: body.comment ?? null, status: 'PENDING',
      },
    })
    return ok({ id: review.id, status: review.status, note: 'سيظهر تقييمك بعد مراجعة الإدارة' })
  } catch (e) {
    return handleRouteError(e)
  }
}

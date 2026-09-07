import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { db } from '@/lib/db'
import { evaluateCoupon } from '@/lib/server/pricing'
import { getFlag } from '@/lib/server/flags'
import { getCurrentUser } from '@/lib/server/auth'
import { getAvailability } from '@/lib/server/inventory'

const schema = z.object({
  code: z.string().min(2).max(30),
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1) })).min(1),
})

// التحقق من الكوبون من الخادم فقط (PLAN ق41)
export async function POST(req: Request) {
  try {
    const { code, items } = await parseBody(req, schema)
    const couponsEnabled = await getFlag('coupons_enabled')
    if (!couponsEnabled) {
      const { ApiError } = await import('@/lib/server/api')
      throw new ApiError('PERMISSION_ERROR', 'الكوبونات معطلة حاليًا', 403)
    }

    const user = await getCurrentUser()
    if (!user?.customerId) {
      const { ApiError } = await import('@/lib/server/api')
      throw new ApiError('AUTH_ERROR', 'سجّل الدخول لاستخدام الكوبون', 401)
    }

    // إجمالي السلة من أسعار الخادم
    const variants = await db.productVariant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      include: { product: true },
    })
    const lines = variants.map((v) => ({
      productId: v.productId,
      lineTotal: (v.priceOverride ?? v.product.basePrice) * (items.find((i) => i.variantId === v.id)?.quantity ?? 1),
    }))
    const itemsTotal = lines.reduce((s, l) => s + l.lineTotal, 0)

    const { coupon, discount } = await evaluateCoupon(code, itemsTotal, user.customerId, lines as never)
    return ok({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
      label: coupon.type === 'PERCENT' ? `خصم ${coupon.value}%` : `خصم ${coupon.value} ريال`,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

void getAvailability

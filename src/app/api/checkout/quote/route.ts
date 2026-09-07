import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { quote } from '@/lib/server/pricing'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/server/auth'

const schema = z.object({
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(99) })).min(1),
  addressId: z.string().optional(),
  shippingMethodCode: z.string().optional(),
  couponCode: z.string().optional(),
})

// عرض سعر من الخادم — إعادة حساب كاملة للأسعار والشحن (PLAN ق1.6/ق10)
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema)

    let governorate: string | undefined
    if (body.addressId) {
      const user = await requireUser()
      const addr = await db.customerAddress.findFirst({
        where: { id: body.addressId, customerId: user.customerId ?? '' },
      })
      if (addr) governorate = addr.governorate
    }

    const user = await getCurrentUserSafe()
    const q = await quote({
      items: body.items,
      governorate,
      shippingMethodCode: body.shippingMethodCode,
      couponCode: body.couponCode,
      customerId: user?.customerId ?? undefined,
    })

    // لا نكشف التكلفة الداخلية للعميل
    return ok({
      items: q.items.map(({ costPrice, ...rest }) => rest),
      itemsTotal: q.itemsTotal,
      discountTotal: q.discountTotal,
      couponCode: q.couponCode,
      couponDiscount: q.couponDiscount,
      shippingFee: q.shippingFee,
      grandTotal: q.grandTotal,
      currency: q.currency,
      warnings: q.warnings,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

async function getCurrentUserSafe() {
  const { getCurrentUser } = await import('@/lib/server/auth')
  return getCurrentUser()
}

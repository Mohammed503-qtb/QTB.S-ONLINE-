import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'

const toggleSchema = z.object({ productId: z.string().min(1) })

// GET: مفضلتي
export async function GET() {
  try {
    const user = await requireUser()
    const favorites = await db.favorite.findMany({
      where: { customerId: user.customerId ?? '' },
      include: {
        product: {
          select: {
            id: true, name: true, basePrice: true, compareAtPrice: true, imageUrl: true, slug: true,
            variants: { where: { active: true }, select: { id: true, priceOverride: true, discountPercent: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(favorites.map((f) => f.product))
  } catch (e) {
    return handleRouteError(e)
  }
}

// POST: تبديل المفضلة
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (!user.customerId) {
      const { ApiError } = await import('@/lib/server/api')
      throw new ApiError('VALIDATION_ERROR', 'ملف العميل غير موجود')
    }
    const { productId } = await parseBody(req, toggleSchema)

    const existing = await db.favorite.findUnique({
      where: { customerId_productId: { customerId: user.customerId, productId } },
    })
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } })
      return ok({ favorited: false })
    }
    await db.favorite.create({ data: { customerId: user.customerId, productId } })
    return ok({ favorited: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

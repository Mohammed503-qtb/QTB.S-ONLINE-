import { ok, fail, handleRouteError } from '@/lib/server/api'
import { db } from '@/lib/db'
import { getAvailability } from '@/lib/server/inventory'
import { getFlag } from '@/lib/server/flags'

// تفاصيل المنتج + المتغيرات + التقييمات المعتمدة (PLAN ق5/9)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const catalogEnabled = await getFlag('catalog_enabled')

    const product = await db.product.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { customer: { include: { user: { select: { name: true } } } } },
        },
      },
    })

    if (!product || (product.status !== 'ACTIVE' && !catalogEnabled)) {
      return fail('VALIDATION_ERROR', 'المنتج غير موجود', 404)
    }

    const variants = await db.productVariant.findMany({
      where: { productId: product.id, active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, attributesJson: true, sku: true, priceOverride: true, costOverride: true,
        discountPercent: true, imageUrl: true, active: true,
      },
    })

    const availability = await getAvailability(variants.map((v) => v.id))

    const reviewsSummary = {
      count: product.reviews.length,
      average: product.reviews.length ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length : 0,
    }

    return ok({
      product: {
        id: product.id, name: product.name, slug: product.slug, description: product.description,
        basePrice: product.basePrice, compareAtPrice: product.compareAtPrice,
        imageUrl: product.imageUrl, images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
        category: product.category, brand: product.brand, salesCount: product.salesCount,
        weightGrams: product.weightGrams, videoUrl: product.videoUrl,
      },
      variants: variants.map((v) => ({
        id: v.id,
        attributes: JSON.parse(v.attributesJson ?? '{}'),
        price: v.priceOverride ?? product.basePrice,
        discountPercent: v.discountPercent,
        imageUrl: v.imageUrl ?? product.imageUrl,
        available: availability[v.id]?.available ?? 0,
      })),
      reviews: product.reviews.map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt,
        customerName: r.customer.user.name,
      })),
      reviewsSummary,
      related: await db.product.findMany({
        where: { categoryId: product.categoryId, status: 'ACTIVE', id: { not: product.id } },
        take: 6,
        select: { id: true, name: true, basePrice: true, compareAtPrice: true, imageUrl: true, slug: true },
      }),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

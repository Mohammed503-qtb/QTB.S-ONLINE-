import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { db } from '@/lib/db'
import { getAvailability } from '@/lib/server/inventory'
import type { Prisma } from '@prisma/client'

const querySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(), // slug
  brand: z.string().optional(), // slug
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'best_selling', 'featured']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(48).default(12),
})

// قائمة المنتجات — بحث وفلاتر وترتيب وصفحات (PLAN ق37/49/79)
export async function GET(req: Request) {
  try {
    const q = parseQuery(req, querySchema)

    const where: Prisma.ProductWhereInput = { status: 'ACTIVE' }
    if (q.search) {
      where.OR = [
        { name: { contains: q.search } },
        { description: { contains: q.search } },
        { sku: { contains: q.search } },
      ]
    }
    if (q.category) {
      const cat = await db.category.findUnique({ where: { slug: q.category } })
      if (cat) where.categoryId = cat.id
    }
    if (q.brand) {
      const brand = await db.brand.findUnique({ where: { slug: q.brand } })
      if (brand) where.brandId = brand.id
    }
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      where.basePrice = {
        ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
        ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
      }
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === 'price_asc' ? { basePrice: 'asc' }
      : q.sort === 'price_desc' ? { basePrice: 'desc' }
      : q.sort === 'best_selling' ? { salesCount: 'desc' }
      : q.sort === 'featured' ? { sortOrder: 'asc' }
      : { createdAt: 'desc' }

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true, name: true, slug: true, basePrice: true, compareAtPrice: true, imageUrl: true,
          isFeatured: true, salesCount: true, createdAt: true, categoryId: true,
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
          variants: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, attributesJson: true, priceOverride: true, discountPercent: true, imageUrl: true, active: true },
          },
        },
      }),
    ])

    // التوفر الكلي لكل منتج (أول variant متاح أو مجموع)
    const allVariantIds = products.flatMap((p) => p.variants.map((v) => v.id))
    const availability = await getAvailability(allVariantIds)

    return ok({
      total,
      page: q.page,
      pages: Math.ceil(total / q.limit),
      products: products.map((p) => {
        const available = p.variants.reduce((s, v) => s + (availability[v.id]?.available ?? 0), 0)
        return { ...p, available }
      }),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

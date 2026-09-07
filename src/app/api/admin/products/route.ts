import { z } from 'zod'
import { ok, handleRouteError, parseQuery, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'
import type { Prisma } from '@prisma/client'

const querySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  lowStock: z.enum(['0', '1']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// قائمة المنتجات للإدارة
export async function GET(req: Request) {
  try {
    await requirePermission('products.update')
    const q = parseQuery(req, querySchema)

    const where: Prisma.ProductWhereInput = {}
    if (q.search) {
      where.OR = [
        { name: { contains: q.search } },
        { sku: { contains: q.search } },
        { barcode: { contains: q.search } },
      ]
    }
    if (q.category) {
      const cat = await db.category.findUnique({ where: { slug: q.category } })
      if (cat) where.categoryId = cat.id
    }
    if (q.status) where.status = q.status

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
          variants: { where: {}, include: {} },
        },
      }),
    ])

    // توفر كل منتج
    const availabilityMap: Record<string, number> = {}
    const variantIds = products.flatMap((p) => p.variants.map((v) => v.id))
    if (variantIds.length) {
      const balances = await db.inventoryBalance.findMany({ where: { variantId: { in: variantIds } } })
      for (const b of balances) {
        availabilityMap[b.variantId] = (availabilityMap[b.variantId] ?? 0) + (b.onHand - b.reserved)
      }
    }
    const productAvailability: Record<string, number> = {}
    for (const p of products) {
      productAvailability[p.id] = p.variants.reduce((s, v) => s + (availabilityMap[v.id] ?? 0), 0)
    }

    const categories = await db.category.findMany({ orderBy: { sortOrder: 'asc' } })
    const brands = await db.brand.findMany({ orderBy: { sortOrder: 'asc' } })

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit),
      products: products.map((p) => ({
        ...p,
        variants: p.variants.map((v) => ({ ...v, available: availabilityMap[v.id] ?? 0 })),
        totalAvailable: productAvailability[p.id] ?? 0,
      })),
      categories, brands,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

const createSchema = z.object({
  name: z.string().min(2, 'اسم المنتج مطلوب').max(120),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'المعرف بأحرف إنجليزية صغيرة وشرطات فقط').optional(),
  description: z.string().max(3000).default(''),
  categoryId: z.string().min(1, 'اختر التصنيف'),
  brandId: z.string().optional().nullable(),
  basePrice: z.number().int().min(1, 'السعر مطلوب'),
  compareAtPrice: z.number().int().optional().nullable(),
  costPrice: z.number().int().optional().nullable(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  weightGrams: z.number().int().optional().nullable(),
  imageUrl: z.string().optional(),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  variants: z.array(z.object({
    id: z.string().optional(),
    attributes: z.record(z.string(), z.string()).default({}),
    sku: z.string().optional().nullable(),
    priceOverride: z.number().int().optional().nullable(),
    costOverride: z.number().int().optional().nullable(),
    discountPercent: z.number().int().min(0).max(90).default(0),
    imageUrl: z.string().optional().nullable(),
    active: z.boolean().default(true),
  })).min(1, 'أضف متغيرًا واحدًا على الأقل'),
})

// إنشاء/تحديث منتج (مع Audit — PLAN ق62)
export async function POST(req: Request) {
  try {
    const actor = await requirePermission('products.update')
    const body = await parseBody(req, createSchema)

    const slug = body.slug ?? `p-${Date.now().toString(36)}`
    const dup = await db.product.findFirst({ where: { OR: [{ slug }, { name: body.name }] } })
    if (dup) {
      const { ApiError } = await import('@/lib/server/api')
      throw new ApiError('CONFLICT', 'يوجد منتج بنفس الاسم أو المعرف', 409)
    }

    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: body.name, slug, description: body.description,
          categoryId: body.categoryId, brandId: body.brandId ?? null,
          basePrice: body.basePrice, compareAtPrice: body.compareAtPrice ?? null,
          costPrice: body.costPrice ?? null, sku: body.sku ?? null, barcode: body.barcode ?? null,
          status: body.status, weightGrams: body.weightGrams ?? null,
          imageUrl: body.imageUrl ?? null, isFeatured: body.isFeatured, sortOrder: body.sortOrder,
        },
      })
      for (const [i, v] of body.variants.entries()) {
        await tx.productVariant.create({
          data: {
            productId: p.id, attributesJson: JSON.stringify(v.attributes),
            sku: v.sku ?? `${slug.toUpperCase().slice(0, 10)}-${i}`,
            priceOverride: v.priceOverride ?? null, costOverride: v.costOverride ?? null,
            discountPercent: v.discountPercent, imageUrl: v.imageUrl ?? body.imageUrl ?? null,
            active: v.active, sortOrder: i,
          },
        })
      }
      if (body.imageUrl) {
        await tx.productImage.create({ data: { productId: p.id, url: body.imageUrl, alt: body.name, sortOrder: 0 } })
      }
      return p
    })

    await writeAudit({
      actor, action: 'product.create', entityType: 'product', entityId: product.id,
      newValues: { name: body.name, basePrice: body.basePrice, variants: body.variants.length },
    })

    return ok(product)
  } catch (e) {
    return handleRouteError(e)
  }
}

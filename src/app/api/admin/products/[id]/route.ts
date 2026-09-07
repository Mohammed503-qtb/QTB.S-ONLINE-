import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(3000).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().nullable().optional(),
  basePrice: z.number().int().min(1).optional(),
  compareAtPrice: z.number().int().nullable().optional(),
  costPrice: z.number().int().nullable().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  weightGrams: z.number().int().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  variants: z.array(z.object({
    id: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
    sku: z.string().nullable().optional(),
    priceOverride: z.number().int().nullable().optional(),
    costOverride: z.number().int().nullable().optional(),
    discountPercent: z.number().int().min(0).max(90).optional(),
    imageUrl: z.string().nullable().optional(),
    active: z.boolean().optional(),
  })).optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('products.update')
    const { id } = await ctx.params
    const product = await db.product.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        category: true, brand: true, images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { sortOrder: 'asc' } },
        reviews: { orderBy: { createdAt: 'desc' }, include: { customer: { include: { user: { select: { name: true } } } } } },
      },
    })
    if (!product) return fail('VALIDATION_ERROR', 'المنتج غير موجود', 404)
    return ok(product)
  } catch (e) {
    return handleRouteError(e)
  }
}

// تحديث منتج — تعديل السعر لا يمس الطلبات القديمة (PLAN ق105)
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('products.update')
    const { id } = await ctx.params
    const body = await parseBody(req, updateSchema)

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return fail('VALIDATION_ERROR', 'المنتج غير موجود', 404)

    const updated = await db.$transaction(async (tx) => {
      const { variants, ...productData } = body
      const p = await tx.product.update({ where: { id }, data: productData })

      if (variants) {
        // حذف غير الموجود، تحديث/إضافة الباقي
        const keepIds = variants.filter((v) => v.id).map((v) => v.id!)
        await tx.productVariant.updateMany({ where: { productId: id, id: { notIn: keepIds } }, data: { active: false } })
        for (const [i, v] of variants.entries()) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                ...(v.attributes ? { attributesJson: JSON.stringify(v.attributes) } : {}),
                ...(v.sku !== undefined ? { sku: v.sku } : {}),
                ...(v.priceOverride !== undefined ? { priceOverride: v.priceOverride } : {}),
                ...(v.costOverride !== undefined ? { costOverride: v.costOverride } : {}),
                ...(v.discountPercent !== undefined ? { discountPercent: v.discountPercent } : {}),
                ...(v.imageUrl !== undefined ? { imageUrl: v.imageUrl } : {}),
                ...(v.active !== undefined ? { active: v.active } : {}),
                sortOrder: i,
              },
            })
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                attributesJson: JSON.stringify(v.attributes ?? {}),
                sku: v.sku ?? `${existing.slug.toUpperCase().slice(0, 10)}-${Date.now().toString(36)}`,
                priceOverride: v.priceOverride ?? null, costOverride: v.costOverride ?? null,
                discountPercent: v.discountPercent ?? 0, imageUrl: v.imageUrl ?? null,
                active: v.active ?? true, sortOrder: i,
              },
            })
          }
        }
      }
      return p
    })

    await writeAudit({
      actor, action: 'product.update', entityType: 'product', entityId: id,
      oldValues: existing.basePrice !== body.basePrice ? { basePrice: existing.basePrice } : undefined,
      newValues: { ...body, variants: body.variants?.length },
      reason: body.basePrice !== existing.basePrice ? `تغيير السعر من ${existing.basePrice} إلى ${body.basePrice}` : undefined,
    })

    return ok(updated)
  } catch (e) {
    return handleRouteError(e)
  }
}

// أرشفة بدل الحذف (عدم الحذف المدمر — PLAN ق1.4/92)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('products.archive')
    const { id } = await ctx.params
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return fail('VALIDATION_ERROR', 'المنتج غير موجود', 404)

    const hasOrders = await db.orderItem.count({ where: { productId: id } })
    if (hasOrders > 0) {
      await db.product.update({ where: { id }, data: { status: 'ARCHIVED' } })
      await writeAudit({ actor, action: 'product.archive', entityType: 'product', entityId: id, reason: 'المنتج مرتبط بطلبات — أرشفة بدل الحذف' })
      return ok({ archived: true })
    }

    await db.productVariant.deleteMany({ where: { productId: id } })
    await db.productImage.deleteMany({ where: { productId: id } })
    await db.product.delete({ where: { id } })
    await writeAudit({ actor, action: 'product.delete', entityType: 'product', entityId: id, reason: 'لا طلبات مرتبطة — حذف مباشر' })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

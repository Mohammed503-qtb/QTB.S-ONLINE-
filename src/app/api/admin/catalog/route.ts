import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'

const querySchema = z.object({ type: z.enum(['category', 'brand']).default('category') })
const idSchema = z.object({ type: z.enum(['category', 'brand']), id: z.string().min(1) })

const createSchema = z.object({
  type: z.enum(['category', 'brand']),
  name: z.string().min(2, 'الاسم مطلوب').max(60),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'المعرف بحروف صغيرة وشرطات').optional(),
  imageUrl: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
})

// التصنيفات والماركات (CRUD موحد)
export async function GET(req: Request) {
  try {
    await requirePermission('products.update')
    const { type } = parseQuery(req, querySchema)
    if (type === 'category') {
      const items = await db.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } })
      return ok(items)
    }
    const items = await db.brand.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } })
    return ok(items)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('categories.manage')
    const body = await parseBody(req, createSchema)
    const slug = body.slug ?? `s-${Date.now().toString(36)}`

    const item =
      body.type === 'category'
        ? await db.category.create({
            data: { name: body.name, slug, imageUrl: body.imageUrl ?? null, parentId: body.parentId ?? null, sortOrder: body.sortOrder, active: body.active },
          })
        : await db.brand.create({ data: { name: body.name, slug, logoUrl: body.imageUrl ?? null, sortOrder: body.sortOrder, active: body.active } })

    await writeAudit({ actor, action: `${body.type}.create`, entityType: body.type, entityId: item.id, newValues: { name: body.name } })
    return ok(item)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(req: Request) {
  try {
    const actor = await requirePermission('categories.manage')
    const { type, id } = await parseQuery(req, idSchema)
    const body = await parseBody(req, createSchema.partial().omit({ type: true }))

    const item =
      type === 'category'
        ? await db.category.update({
            where: { id },
            data: {
              ...(body.name ? { name: body.name } : {}),
              ...(body.slug ? { slug: body.slug } : {}),
              ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
              ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
              ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
              ...(body.active !== undefined ? { active: body.active } : {}),
            },
          })
        : await db.brand.update({
            where: { id },
            data: {
              ...(body.name ? { name: body.name } : {}),
              ...(body.slug ? { slug: body.slug } : {}),
              ...(body.imageUrl !== undefined ? { logoUrl: body.imageUrl } : {}),
              ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
              ...(body.active !== undefined ? { active: body.active } : {}),
            },
          })

    await writeAudit({ actor, action: `${type}.update`, entityType: type, entityId: id, newValues: body })
    return ok(item)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission('categories.manage')
    const { type, id } = parseQuery(req, idSchema)

    const count = type === 'category'
      ? await db.product.count({ where: { categoryId: id } })
      : await db.product.count({ where: { brandId: id } })
    if (count > 0) return fail('CONFLICT', `لا يمكن الحذف — ${count} منتج مرتبط. عطّله بدلًا من ذلك`, 409)

    if (type === 'category') await db.category.delete({ where: { id } })
    else await db.brand.delete({ where: { id } })
    await writeAudit({ actor, action: `${type}.delete`, entityType: type, entityId: id })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

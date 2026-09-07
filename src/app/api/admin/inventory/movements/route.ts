import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  variantId: z.string().optional(),
  warehouseId: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
})

// سجل حركات المخزون (PLAN ق21/63) — لماذا أصبحت الكمية ما هي عليه
export async function GET(req: Request) {
  try {
    await requirePermission('inventory.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.variantId) where.variantId = q.variantId
    if (q.warehouseId) where.warehouseId = q.warehouseId
    if (q.type) where.movementType = q.type

    const [total, movements] = await Promise.all([
      db.stockMovement.count({ where }),
      db.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          variant: { include: { product: { select: { name: true } } } },
          warehouse: { select: { name: true } },
        },
      }),
    ])

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit),
      movements: movements.map((m) => ({
        ...m,
        attributes: JSON.parse(m.variant.attributesJson ?? '{}'),
        productName: m.variant.product.name,
      })),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

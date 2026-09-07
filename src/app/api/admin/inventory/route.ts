import { z } from 'zod'
import { ok, handleRouteError, parseQuery, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { adjustStock, damageStock, transferStock } from '@/lib/server/inventory'
import { writeAudit } from '@/lib/server/audit'

const querySchema = z.object({
  search: z.string().optional(),
  warehouseId: z.string().optional(),
  lowOnly: z.enum(['0', '1']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
})

// أرصدة المخزون (PLAN ق22/23/48)
export async function GET(req: Request) {
  try {
    await requirePermission('inventory.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.warehouseId) where.warehouseId = q.warehouseId

    let balances = await db.inventoryBalance.findMany({
      where,
      include: {
        variant: { include: { product: { select: { id: true, name: true, imageUrl: true, basePrice: true, status: true } } } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { onHand: 'asc' },
    })

    if (q.search) {
      const s = q.search
      balances = balances.filter((b) => b.variant.product.name.includes(s) || (b.variant.sku ?? '').includes(s.toUpperCase()))
    }
    if (q.lowOnly === '1') {
      balances = balances.filter((b) => b.onHand <= b.reorderLevel)
    }

    const total = balances.length
    const pageBalances = balances.slice((q.page - 1) * q.limit, q.page * q.limit)
    const warehouses = await db.warehouse.findMany({ where: { active: true } })
    const [totalVariants, totalOnHand, totalReserved] = await Promise.all([
      db.productVariant.count(),
      db.inventoryBalance.aggregate({ _sum: { onHand: true } }),
      db.inventoryBalance.aggregate({ _sum: { reserved: true } }),
    ])

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit),
      balances: pageBalances.map((b) => ({
        ...b,
        attributes: JSON.parse(b.variant.attributesJson ?? '{}'),
        available: b.onHand - b.reserved,
      })),
      warehouses,
      summary: {
        totalVariants,
        totalOnHand: totalOnHand._sum.onHand ?? 0,
        totalReserved: totalReserved._sum.reserved ?? 0,
        lowCount: balances.filter((b) => b.onHand <= b.reorderLevel).length,
      },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('adjust'),
    variantId: z.string().min(1),
    warehouseId: z.string().min(1),
    newOnHand: z.number().int().min(0),
    reason: z.string().min(3, 'سبب التعديل إلزامي').max(200),
  }),
  z.object({
    action: z.literal('damage'),
    variantId: z.string().min(1),
    warehouseId: z.string().min(1),
    quantity: z.number().int().min(1),
    reason: z.string().min(3, 'السبب إلزامي').max(200),
  }),
  z.object({
    action: z.literal('transfer'),
    variantId: z.string().min(1),
    fromWarehouseId: z.string().min(1),
    toWarehouseId: z.string().min(1),
    quantity: z.number().int().min(1),
    reason: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal('reorder_level'),
    variantId: z.string().min(1),
    warehouseId: z.string().min(1),
    reorderLevel: z.number().int().min(0),
  }),
])

// تعديل المخزون — لا رصيد يتغير دون حركة (PLAN ق63)
export async function POST(req: Request) {
  try {
    const actor = await requirePermission('inventory.adjust')
    const body = await parseBody(req, actionSchema)

    if (body.action === 'adjust') {
      const result = await db.$transaction((tx) => adjustStock(tx, {
        variantId: body.variantId, warehouseId: body.warehouseId,
        newOnHand: body.newOnHand, reason: body.reason, userId: actor.id,
      }))
      await writeAudit({ actor, action: 'inventory.adjust', entityType: 'variant', entityId: body.variantId, reason: body.reason, newValues: { onHand: result.onHand } })
      return ok(result)
    }

    if (body.action === 'damage') {
      const result = await db.$transaction((tx) => damageStock(tx, {
        variantId: body.variantId, warehouseId: body.warehouseId,
        quantity: body.quantity, reason: body.reason, userId: actor.id,
      }))
      await writeAudit({ actor, action: 'inventory.damage', entityType: 'variant', entityId: body.variantId, reason: body.reason, newValues: { quantity: body.quantity } })
      return ok(result)
    }

    if (body.action === 'transfer') {
      const result = await db.$transaction((tx) => transferStock(tx, {
        variantId: body.variantId, fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId, quantity: body.quantity, reason: body.reason, userId: actor.id,
      }))
      await writeAudit({ actor, action: 'inventory.transfer', entityType: 'variant', entityId: body.variantId, newValues: { from: body.fromWarehouseId, to: body.toWarehouseId, quantity: body.quantity } })
      return ok({ transferred: true })
    }

    // reorder level
    await db.inventoryBalance.update({
      where: { variantId_warehouseId: { variantId: body.variantId, warehouseId: body.warehouseId } },
      data: { reorderLevel: body.reorderLevel },
    })
    await writeAudit({ actor, action: 'inventory.reorder_level', entityType: 'variant', entityId: body.variantId, newValues: { reorderLevel: body.reorderLevel } })
    return ok({ updated: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

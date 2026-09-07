import { z } from 'zod'
import { ok, handleRouteError, parseQuery, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'

const createSchema = z.object({
  name: z.string().min(2).max(60),
  code: z.string().max(20).optional(),
  city: z.string().max(40).default(''),
  isDefault: z.boolean().default(false),
})

// المخازن
export async function GET() {
  try {
    await requirePermission('inventory.view')
    const warehouses = await db.warehouse.findMany({
      include: { _count: { select: { balances: true, movements: true, purchases: true } } },
      orderBy: { isDefault: 'desc' },
    })
    return ok(warehouses)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('warehouses.manage')
    const body = await parseBody(req, createSchema)
    if (body.isDefault) {
      await db.warehouse.updateMany({ data: { isDefault: false } })
    }
    const wh = await db.warehouse.create({ data: body })
    await writeAudit({ actor, action: 'warehouse.create', entityType: 'warehouse', entityId: wh.id, newValues: body })
    return ok(wh)
  } catch (e) {
    return handleRouteError(e)
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(60).optional(),
  code: z.string().max(20).optional(),
  city: z.string().max(40).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
})

export async function PUT(req: Request) {
  try {
    const actor = await requirePermission('warehouses.manage')
    const { id, ...data } = await parseBody(req, updateSchema)
    if (data.isDefault) {
      await db.warehouse.updateMany({ data: { isDefault: false } })
    }
    const wh = await db.warehouse.update({ where: { id }, data })
    await writeAudit({ actor, action: 'warehouse.update', entityType: 'warehouse', entityId: id, newValues: data })
    return ok(wh)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission('warehouses.manage')
    const { id } = parseQuery(req, z.object({ id: z.string().min(1) }))
    const hasMovements = await db.stockMovement.count({ where: { warehouseId: id } })
    if (hasMovements > 0) {
      await db.warehouse.update({ where: { id }, data: { active: false } })
      return ok({ deactivated: true })
    }
    await db.warehouse.delete({ where: { id } })
    await writeAudit({ actor, action: 'warehouse.delete', entityType: 'warehouse', entityId: id })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

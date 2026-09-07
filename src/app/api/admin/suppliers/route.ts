import { z } from 'zod'
import { ok, handleRouteError, parseBody, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'

const createSchema = z.object({
  name: z.string().min(2, 'اسم المورد مطلوب').max(80),
  phone: z.string().regex(/^7\d{8}$/).optional(),
  email: z.string().email().optional(),
  address: z.string().max(200).optional(),
  notes: z.string().max(400).optional(),
  active: z.boolean().default(true),
})

// الموردون + كشوف حساباتهم (PLAN ق24/31)
export async function GET(req: Request) {
  try {
    await requirePermission('purchases.view')
    const { detail } = parseQuery(req, z.object({ detail: z.string().optional() }))

    if (detail) {
      const supplier = await db.supplier.findFirst({
        where: { OR: [{ id: detail }, { name: { contains: detail } }] },
        include: {
          purchases: { orderBy: { date: 'desc' }, take: 50, select: { id: true, purchaseNumber: true, date: true, total: true, paid: true, status: true } },
          payments: { orderBy: { date: 'desc' }, take: 50 },
        },
      })
      return ok(supplier)
    }

    const suppliers = await db.supplier.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { purchases: true } },
        purchases: { select: { total: true }, take: 1000 },
      },
    })
    return ok(suppliers.map((s) => ({
      ...s,
      totalPurchases: s.purchases.reduce((sum, p) => sum + p.total, 0),
      purchases: undefined,
    })))
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('suppliers.manage')
    const body = await parseBody(req, createSchema)
    const supplier = await db.supplier.create({ data: body })
    await writeAudit({ actor, action: 'supplier.create', entityType: 'supplier', entityId: supplier.id, newValues: { name: body.name } })
    return ok(supplier)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(req: Request) {
  try {
    const actor = await requirePermission('suppliers.manage')
    const { id, ...data } = await parseBody(req, z.object({ id: z.string().min(1) }).and(createSchema.partial()))
    const supplier = await db.supplier.update({ where: { id }, data })
    await writeAudit({ actor, action: 'supplier.update', entityType: 'supplier', entityId: id, newValues: data })
    return ok(supplier)
  } catch (e) {
    return handleRouteError(e)
  }
}

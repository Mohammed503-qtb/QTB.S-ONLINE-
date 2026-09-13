import { z } from 'zod'
import { ok, fail, handleRouteError, parseQuery, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { nextPurchaseNumber } from '@/lib/server/codes'
import { receiveStock } from '@/lib/server/inventory'
import { paySupplier } from '@/lib/server/accounting'
import { writeAudit } from '@/lib/server/audit'
import { notifyWarehouseTeam } from '@/lib/server/notifications'

const querySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(15),
})

// المشتريات (PLAN ق31) — الاستلام يزيد المخزون فعليًا
export async function GET(req: Request) {
  try {
    await requirePermission('purchases.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.status) where.status = q.status
    if (q.search) {
      where.OR = [
        { purchaseNumber: { contains: q.search.toUpperCase() } },
        { invoiceRef: { contains: q.search } },
        { supplier: { name: { contains: q.search } } },
      ]
    }

    const [total, purchases] = await Promise.all([
      db.purchase.count({ where }),
      db.purchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          warehouse: { select: { id: true, name: true } },
          items: { include: { variant: { include: { product: { select: { name: true } } } } } },
        },
      }),
    ])

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit),
      purchases: purchases.map((p) => ({
        ...p,
        items: p.items.map((i) => ({ ...i, productName: i.variant.product.name, attributes: JSON.parse(i.variant.attributesJson ?? '{}') })),
      })),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

const createSchema = z.object({
  supplierId: z.string().min(1, 'اختر المورد'),
  warehouseId: z.string().min(1, 'اختر المخزن'),
  invoiceRef: z.string().max(60).optional(),
  date: z.string().optional(),
  notes: z.string().max(400).optional(),
  paidNow: z.number().int().min(0).default(0),
  bankAccountId: z.string().optional(),
  paymentMethod: z.enum(['BANK', 'CASH']).default('CASH'),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1),
    unitCost: z.number().int().min(1),
  })).min(1, 'أضف أصنافًا للفاتورة'),
})

// إنشاء شراء + استلام مباشر (زيادة مخزون + التزام مورد إن لم يُدفع كاملًا)
export async function POST(req: Request) {
  try {
    const actor = await requirePermission('purchases.create')
    const body = await parseBody(req, createSchema)

    const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
    const total = subtotal

    const purchase = await db.$transaction(async (tx) => {
      const purchaseNumber = await nextPurchaseNumber(tx)
      const p = await tx.purchase.create({
        data: {
          purchaseNumber, supplierId: body.supplierId, warehouseId: body.warehouseId,
          invoiceRef: body.invoiceRef ?? null, date: body.date ? new Date(body.date) : new Date(),
          subtotal, total, paid: 0, status: 'RECEIVED', notes: body.notes ?? null,
        },
      })

      // استلام الأصناف في المخزون
      for (const item of body.items) {
        await tx.purchaseItem.create({
          data: { purchaseId: p.id, variantId: item.variantId, quantity: item.quantity, unitCost: item.unitCost, lineTotal: item.quantity * item.unitCost },
        })
        await receiveStock(tx, {
          variantId: item.variantId, warehouseId: body.warehouseId,
          quantity: item.quantity, refType: 'purchase', refId: p.id, refNumber: purchaseNumber,
          unitCost: item.unitCost, userId: actor.id,
        })
      }

      return p
    }, { timeout: 30_000, maxWait: 10_000 })

    // الدفعة (خارج معاملة المخزون — معاملة محاسبية مستقلة)
    if (body.paidNow > 0) {
      await paySupplier({
        supplierId: body.supplierId, purchaseId: purchase.id,
        bankAccountId: body.paymentMethod === 'BANK' ? body.bankAccountId : null,
        amount: Math.min(body.paidNow, total), method: body.paymentMethod,
        note: `دفعة على فاتورة ${purchase.purchaseNumber}`,
      }, actor)
    }

    // التزام المورد بالمتبقي
    const remaining = total - Math.min(body.paidNow, total)
    if (remaining > 0) {
      await db.supplier.update({ where: { id: body.supplierId }, data: { balance: { increment: remaining } } })
    }

    await notifyWarehouseTeam({
      type: 'PURCHASE_RECEIVED', title: 'وصول مشتريات جديدة',
      body: `${purchase.purchaseNumber} — ${body.items.length} صنف إلى ${body.warehouseId ? 'المخزن' : ''}`,
      linkView: 'admin-purchases', linkParam: purchase.id,
    })
    await writeAudit({
      actor, action: 'purchase.create', entityType: 'purchase', entityId: purchase.id,
      newValues: { total, items: body.items.length, paid: body.paidNow },
    })

    return ok(purchase)
  } catch (e) {
    return handleRouteError(e)
  }
}

const paymentSchema = z.object({
  action: z.literal('pay'),
  purchaseId: z.string().min(1),
  amount: z.number().int().min(1),
  bankAccountId: z.string().optional(),
  method: z.enum(['BANK', 'CASH']).default('CASH'),
  reference: z.string().max(60).optional(),
  note: z.string().max(200).optional(),
})

// دفعة مورد على فاتورة قائمة
export async function PUT(req: Request) {
  try {
    const actor = await requirePermission('purchases.view')
    const body = await parseBody(req, paymentSchema)
    const purchase = await db.purchase.findUnique({ where: { id: body.purchaseId } })
    if (!purchase) return fail('VALIDATION_ERROR', 'فاتورة الشراء غير موجودة', 404)

    const remaining = purchase.total - purchase.paid
    if (body.amount > remaining) {
      return fail('VALIDATION_ERROR', `المتبقي على الفاتورة ${remaining} فقط`, 400)
    }

    await paySupplier({
      supplierId: purchase.supplierId, purchaseId: purchase.id,
      bankAccountId: body.method === 'BANK' ? body.bankAccountId : null,
      amount: body.amount, method: body.method, reference: body.reference, note: body.note,
    }, actor)

    return ok({ paid: body.amount })
  } catch (e) {
    return handleRouteError(e)
  }
}

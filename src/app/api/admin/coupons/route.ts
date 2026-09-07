import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'

const querySchema = z.object({ id: z.string().optional() })

const createSchema = z.object({
  code: z.string().min(2, 'كود الخصم مطلوب').max(30).regex(/^[A-Za-z0-9]+$/, 'أحرف إنجليزية وأرقام فقط'),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().min(1, 'القيمة مطلوبة'),
  minCart: z.number().int().min(0).default(0),
  maxDiscount: z.number().int().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  perCustomerLimit: z.number().int().min(0).default(1),
  startsAt: z.string().optional(),
  endsAt: z.string().optional().nullable(),
  appliesTo: z.enum(['ALL', 'PRODUCTS', 'CATEGORIES']).default('ALL'),
  targets: z.array(z.string()).default([]),
  active: z.boolean().default(true),
})

// الكوبونات (PLAN ق41)
export async function GET(req: Request) {
  try {
    await requirePermission('content.manage')
    const { id } = parseQuery(req, querySchema)

    if (id) {
      const coupon = await db.coupon.findUnique({
        where: { id },
        include: { redemptions: { orderBy: { createdAt: 'desc' }, take: 50, include: { customer: { include: { user: { select: { name: true } } } } } } },
      })
      return ok(coupon)
    }

    const coupons = await db.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    })
    return ok(coupons)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('coupons.manage')
    const body = await parseBody(req, createSchema)

    const dup = await db.coupon.findUnique({ where: { code: body.code.toUpperCase() } })
    if (dup) return fail('CONFLICT', 'هذا الكود مستخدم مسبقًا', 409)

    const coupon = await db.coupon.create({
      data: {
        code: body.code.toUpperCase(), type: body.type, value: body.value,
        minCart: body.minCart, maxDiscount: body.maxDiscount ?? null,
        usageLimit: body.usageLimit ?? null, perCustomerLimit: body.perCustomerLimit,
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        appliesTo: body.appliesTo, targetsJson: JSON.stringify(body.targets),
        active: body.active,
      },
    })
    await writeAudit({ actor, action: 'coupon.create', entityType: 'coupon', entityId: coupon.id, newValues: { code: body.code, value: body.value } })
    return ok(coupon)
  } catch (e) {
    return handleRouteError(e)
  }
}

const updateSchema = z.object({ id: z.string().min(1) }).and(createSchema.partial())

export async function PUT(req: Request) {
  try {
    const actor = await requirePermission('coupons.manage')
    const { id, targets, startsAt, endsAt, ...rest } = await parseBody(req, updateSchema)

    const coupon = await db.coupon.update({
      where: { id },
      data: {
        ...rest,
        ...(targets ? { targetsJson: JSON.stringify(targets) } : {}),
        ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
        ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
      },
    })
    await writeAudit({ actor, action: 'coupon.update', entityType: 'coupon', entityId: id, newValues: rest })
    return ok(coupon)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission('coupons.manage')
    const { id } = parseQuery(req, z.object({ id: z.string().min(1) }))
    const used = await db.couponRedemption.count({ where: { couponId: id } })
    if (used > 0) {
      // لا حذف إن استُخدم — تعطيل فقط (عدم الحذف المدمر)
      await db.coupon.update({ where: { id }, data: { active: false } })
      await writeAudit({ actor, action: 'coupon.deactivate', entityType: 'coupon', entityId: id, reason: `استُخدم ${used} مرة` })
      return ok({ deactivated: true })
    }
    await db.coupon.delete({ where: { id } })
    await writeAudit({ actor, action: 'coupon.delete', entityType: 'coupon', entityId: id })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

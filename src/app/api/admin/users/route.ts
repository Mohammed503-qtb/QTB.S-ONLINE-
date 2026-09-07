import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody, parseQuery } from '@/lib/server/api'
import { requirePermission, requireAdmin } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'
import { revokeSession } from '@/lib/server/auth'
import { ROLES } from '@/lib/shared/constants'

const querySchema = z.object({ role: z.string().optional(), search: z.string().optional() })

// إدارة المستخدمين (PLAN ق59/61)
export async function GET(req: Request) {
  try {
    await requireAdmin()
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.role && ROLES.includes(q.role as never)) where.role = q.role
    if (q.search) {
      where.OR = [{ name: { contains: q.search } }, { phone: { contains: q.search } }]
    }

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: { where: { revokedAt: null }, orderBy: { lastActiveAt: 'desc' }, take: 5 },
        _count: { select: { notifications: true } },
      },
    })
    return ok(users)
  } catch (e) {
    return handleRouteError(e)
  }
}

const createSchema = z.object({
  phone: z.string().regex(/^7\d{8}$/, 'رقم هاتف يمني غير صحيح'),
  name: z.string().min(2).max(60),
  role: z.enum(ROLES as never),
})

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('users.manage')
    const body = await parseBody(req, createSchema)

    const dup = await db.user.findUnique({ where: { phone: body.phone } })
    if (dup) return fail('CONFLICT', 'رقم الهاتف مسجل مسبقًا', 409)

    const user = await db.user.create({ data: { phone: body.phone, name: body.name, role: body.role } })
    if (body.role === 'CUSTOMER') {
      await db.customer.create({ data: { userId: user.id } })
    }
    await writeAudit({ actor, action: 'user.create', entityType: 'user', entityId: user.id, newValues: { phone: body.phone, role: body.role } })
    return ok(user)
  } catch (e) {
    return handleRouteError(e)
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(60).optional(),
  role: z.enum(ROLES as never).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']).optional(),
})

export async function PUT(req: Request) {
  try {
    const actor = await requirePermission('users.manage')
    const { id, ...data } = await parseBody(req, updateSchema)

    if (id === actor.id && data.status && data.status !== 'ACTIVE') {
      return fail('VALIDATION_ERROR', 'لا يمكنك تعطيل حسابك الخاص', 400)
    }
    if (id === actor.id && data.role && data.role !== actor.role) {
      return fail('VALIDATION_ERROR', 'لا يمكنك تغيير دورك الخاص', 400)
    }

    // حماية آخر Super Admin (PLAN ق102)
    if (data.role && data.role !== 'SUPER_ADMIN') {
      const target = await db.user.findUnique({ where: { id } })
      if (target?.role === 'SUPER_ADMIN') {
        const superCount = await db.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } })
        if (superCount <= 1) return fail('CONFLICT', 'لا يمكن تخفيض دور آخر مدير نظام نشط', 409)
      }
    }

    const user = await db.user.update({ where: { id }, data })
    // تعطيل الجلسات عند الحظر/الإيقاف
    if (data.status && data.status !== 'ACTIVE') {
      await db.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: `status:${data.status}` },
      })
    }
    await writeAudit({ actor, action: 'user.update', entityType: 'user', entityId: id, newValues: data })
    return ok(user)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission('users.manage')
    const { id, action } = parseQuery(req, z.object({ id: z.string().min(1), action: z.enum(['revoke_sessions']).default('revoke_sessions') }))
    void action
    if (id === actor.id) return fail('VALIDATION_ERROR', 'لا يمكنك إلغاء جلساتك الحالية', 400)

    await db.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'manual_revoke' },
    })
    await writeAudit({ actor, action: 'user.sessions.revoke', entityType: 'user', entityId: id })
    return ok({ revoked: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

void revokeSession

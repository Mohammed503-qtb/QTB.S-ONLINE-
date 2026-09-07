import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { notifyRole } from '@/lib/server/notifications'
import { writeAudit } from '@/lib/server/audit'

const schema = z.object({
  title: z.string().min(2, 'العنوان مطلوب').max(80),
  body: z.string().min(2, 'النص مطلوب').max(500),
  target: z.enum(['CUSTOMERS', 'ALL_ADMINS', 'MANAGERS', 'ACCOUNTANTS', 'WAREHOUSE']).default('CUSTOMERS'),
})

// بث إشعارات عامة (PLAN ق83)
export async function POST(req: Request) {
  try {
    const actor = await requirePermission('notifications.send')
    const body = await parseBody(req, schema)

    let count = 0
    if (body.target === 'CUSTOMERS') {
      const users = await db.user.findMany({ where: { role: 'CUSTOMER', status: 'ACTIVE' }, select: { id: true } })
      if (users.length) {
        await db.notification.createMany({
          data: users.map((u) => ({ userId: u.id, type: 'BROADCAST', title: body.title, body: body.body })),
        })
        count = users.length
      }
    } else {
      const roleMap: Record<string, string> = {
        ALL_ADMINS: 'ALL',
        MANAGERS: 'MANAGER',
        ACCOUNTANTS: 'ACCOUNTANT',
        WAREHOUSE: 'WAREHOUSE',
      }
      const role = roleMap[body.target]
      if (role === 'ALL') {
        for (const r of ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'WAREHOUSE', 'CONTENT_MANAGER', 'DELIVERY_OPERATOR']) {
          await notifyRole({ role: r, type: 'BROADCAST', title: body.title, body: body.body })
        }
        const admins = await db.user.count({ where: { status: 'ACTIVE', role: { not: 'CUSTOMER' } } })
        count = admins
      } else {
        await notifyRole({ role, type: 'BROADCAST', title: body.title, body: body.body })
        const admins = await db.user.count({ where: { status: 'ACTIVE', role } })
        count = admins
      }
    }

    await writeAudit({ actor, action: 'notification.broadcast', entityType: 'notification', entityId: 'broadcast', newValues: { title: body.title, target: body.target, count } })
    return ok({ sent: count })
  } catch (e) {
    return handleRouteError(e)
  }
}

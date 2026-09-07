import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'

const readSchema = z.object({ ids: z.array(z.string()).optional() })

// GET: إشعاراتي
export async function GET() {
  try {
    const user = await requireUser()
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return ok({ notifications, unread: notifications.filter((n) => !n.read).length })
  } catch (e) {
    return handleRouteError(e)
  }
}

// POST: تعليم كمقروء
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { ids } = await parseBody(req, readSchema)
    if (ids && ids.length > 0) {
      await db.notification.updateMany({ where: { id: { in: ids }, userId: user.id }, data: { read: true } })
    } else {
      await db.notification.updateMany({ where: { userId: user.id }, data: { read: true } })
    }
    return ok({ updated: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

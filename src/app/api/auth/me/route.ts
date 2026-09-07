import { ok, handleRouteError } from '@/lib/server/api'
import { getCurrentUser } from '@/lib/server/auth'
import { db } from '@/lib/db'

// بيانات الجلسة الحالية + بيانات العميل المرتبطة
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return ok(null)

    const customer = user.customerId
      ? await db.customer.findUnique({
          where: { id: user.customerId },
          select: { id: true, tier: true, creditBalance: true, totalSpent: true, ordersCount: true },
        })
      : null

    const unreadNotifications = await db.notification.count({ where: { userId: user.id, read: false } })

    return ok({ user, customer, unreadNotifications })
  } catch (e) {
    return handleRouteError(e)
  }
}

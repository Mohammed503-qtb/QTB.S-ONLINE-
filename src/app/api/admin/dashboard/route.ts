import { ok, handleRouteError } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { expireStaleOrders } from '@/lib/server/orders'

// لوحة الإدارة الرئيسية (PLAN ق46) — كل رقم له مصدر قابل للفتح
export async function GET() {
  try {
    await requireAdmin()
    await expireStaleOrders().catch(() => {})

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const last7 = new Date(Date.now() - 7 * 86400000)

    const [
      todayOrders, todaySales, pendingPayments, reviewPayments, processingOrders, shippingOrders,
      todayReturns, lowStock, todayCollected, todayExpenses, customersCount, activeProducts,
      orders7d, banks,
    ] = await Promise.all([
      db.order.count({ where: { createdAt: { gte: today } } }),
      db.order.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: today }, status: { not: 'CANCELLED' } } }),
      db.payment.count({ where: { status: 'UNPAID' } }),
      db.payment.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      db.order.count({ where: { status: { in: ['CONFIRMED', 'STOCK_RESERVED', 'PROCESSING', 'PICKED', 'PACKED', 'READY_TO_SHIP'] } } }),
      db.order.count({ where: { status: { in: ['SHIPPED', 'OUT_FOR_DELIVERY'] } } }),
      db.returnRequest.count({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW'] } } }),
      db.inventoryBalance.count({ where: { onHand: { lte: 5 } } }),
      db.bankTransaction.aggregate({ _sum: { amount: true }, where: { direction: 'IN', txnType: 'CUSTOMER_PAYMENT', date: { gte: today } } }),
      db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: today } } }),
      db.customer.count(),
      db.product.count({ where: { status: 'ACTIVE' } }),
      db.order.findMany({ where: { createdAt: { gte: last7 }, status: { not: 'CANCELLED' } }, select: { grandTotal: true, createdAt: true } }),
      db.bankAccount.findMany({ select: { name: true, currentBalance: true, institution: true, type: true } }),
    ])

    // مبيعات آخر 7 أيام (للرسم)
    const salesByDay: { day: string; total: number; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const dayOrders = orders7d.filter((o) => o.createdAt >= d && o.createdAt < next)
      salesByDay.push({
        day: `${d.getDate()}/${d.getMonth() + 1}`,
        total: dayOrders.reduce((s, o) => s + o.grandTotal, 0),
        count: dayOrders.length,
      })
    }

    return ok({
      today: {
        orders: todayOrders,
        sales: todaySales._sum.grandTotal ?? 0,
        collected: todayCollected._sum.amount ?? 0,
        expenses: todayExpenses._sum.amount ?? 0,
        net: (todayCollected._sum.amount ?? 0) - (todayExpenses._sum.amount ?? 0),
      },
      queues: {
        pendingPayments, reviewPayments, processingOrders, shippingOrders,
        pendingReturns: todayReturns, lowStock,
      },
      totals: { customers: customersCount, activeProducts, orders7d: orders7d.length },
      banks,
      salesByDay,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

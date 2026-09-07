import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  type: z.enum(['orders', 'products', 'customers', 'payments', 'inventory', 'expenses']).default('orders'),
})

// تصدير CSV (PLAN ق53) — Backup/Export
export async function GET(req: Request) {
  try {
    await requirePermission('backup.export')
    const { type } = parseQuery(req, querySchema)

    let rows: Record<string, unknown>[] = []
    let headers: string[] = []

    if (type === 'orders') {
      rows = await db.order.findMany({ orderBy: { createdAt: 'desc' } }) as never
      headers = ['orderNumber', 'status', 'paymentStatus', 'itemsTotal', 'shippingFee', 'grandTotal', 'paymentReference', 'trackingCode', 'placedAt', 'cancelledAt']
    } else if (type === 'products') {
      rows = await db.product.findMany() as never
      headers = ['name', 'slug', 'basePrice', 'compareAtPrice', 'costPrice', 'status', 'salesCount', 'createdAt']
    } else if (type === 'customers') {
      const customers = await db.customer.findMany({ include: { user: { select: { name: true, phone: true, status: true } } } })
      rows = customers.map((c) => ({ name: c.user.name, phone: c.user.phone, status: c.user.status, tier: c.tier, totalSpent: c.totalSpent, ordersCount: c.ordersCount, creditBalance: c.creditBalance })) as never
      headers = ['name', 'phone', 'status', 'tier', 'totalSpent', 'ordersCount', 'creditBalance']
    } else if (type === 'payments') {
      rows = await db.payment.findMany({ orderBy: { createdAt: 'desc' } }) as never
      headers = ['paymentNumber', 'status', 'expectedAmount', 'submittedAmount', 'paidAmount', 'refundedAmount', 'customerTransferRef', 'createdAt', 'verifiedAt']
    } else if (type === 'inventory') {
      const balances = await db.inventoryBalance.findMany({ include: { variant: { include: { product: { select: { name: true } } } }, warehouse: { select: { name: true } } } })
      rows = balances.map((b) => ({ product: b.variant.product.name, warehouse: b.warehouse.name, onHand: b.onHand, reserved: b.reserved, available: b.onHand - b.reserved })) as never
      headers = ['product', 'warehouse', 'onHand', 'reserved', 'available']
    } else if (type === 'expenses') {
      rows = await db.expense.findMany({ orderBy: { date: 'desc' } }) as never
      headers = ['expenseNumber', 'category', 'description', 'amount', 'date']
    }

    // CSV مع BOM لدعم العربية في Excel
    const csvLines = [headers.join(',')]
    for (const row of rows.slice(0, 5000)) {
      csvLines.push(headers.map((h) => {
        const v = (row as Record<string, unknown>)[h]
        const s = v === null || v === undefined ? '' : String(v)
        return `"${s.replace(/"/g, '""')}"`
      }).join(','))
    }
    const csv = '\uFEFF' + csvLines.join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="export-${type}-${Date.now()}.csv"`,
      },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

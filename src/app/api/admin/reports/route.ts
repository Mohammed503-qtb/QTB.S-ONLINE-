import { z } from 'zod'
import { ok, handleRouteError, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  type: z.enum(['sales', 'inventory', 'payments', 'financial', 'products']).default('sales'),
  from: z.string().optional(),
  to: z.string().optional(),
})

// التقارير (PLAN ق48) — يحدد كل تقرير مصدره بوضوح
export async function GET(req: Request) {
  try {
    await requirePermission('reports.view')
    const q = parseQuery(req, querySchema)

    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000)
    const to = q.to ? new Date(q.to) : new Date()

    if (q.type === 'sales') {
      const orders = await db.order.findMany({
        where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        include: { items: true },
      })
      const byStatus = await db.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { grandTotal: true }, where: { createdAt: { gte: from, lte: to } } })
      const byMethod = await db.order.groupBy({ by: ['paymentMethod'], _count: { _all: true }, _sum: { grandTotal: true }, where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } } })

      // المنتجات الأكثر بيعًا
      const items = orders.flatMap((o) => o.items.map((i) => ({ productId: i.productId, name: i.productName, qty: i.quantity, total: i.lineTotal })))
      const productMap = new Map<string, { name: string; qty: number; total: number }>()
      for (const it of items) {
        const cur = productMap.get(it.productId) ?? { name: it.name, qty: 0, total: 0 }
        cur.qty += it.qty
        cur.total += it.total
        productMap.set(it.productId, cur)
      }

      // مبيعات يومية
      const byDay = new Map<string, { total: number; count: number }>()
      for (const o of orders) {
        const d = new Date(o.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const cur = byDay.get(key) ?? { total: 0, count: 0 }
        cur.total += o.grandTotal
        cur.count += 1
        byDay.set(key, cur)
      }

      return ok({
        type: 'sales',
        note: 'Order-based: الطلبات غير الملغاة في الفترة',
        summary: {
          ordersCount: orders.length,
          grossSales: orders.reduce((s, o) => s + o.itemsTotal, 0),
          shippingCollected: orders.reduce((s, o) => s + o.shippingFee, 0),
          grandTotal: orders.reduce((s, o) => s + o.grandTotal, 0),
          discountGiven: orders.reduce((s, o) => s + (o.couponCode ? o.discountTotal : 0), 0),
          avgOrder: orders.length ? Math.round(orders.reduce((s, o) => s + o.grandTotal, 0) / orders.length) : 0,
        },
        byStatus, byMethod,
        topProducts: [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 15),
        daily: [...byDay.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
      })
    }

    if (q.type === 'inventory') {
      const balances = await db.inventoryBalance.findMany({
        include: {
          variant: { include: { product: { select: { name: true, basePrice: true, costPrice: true, status: true } } } },
          warehouse: { select: { name: true } },
        },
      })
      const totalValue = balances.reduce((s, b) => s + b.onHand * ((b.variant.product.costPrice ?? 0)), 0)
      const totalRetail = balances.reduce((s, b) => s + b.onHand * (b.variant.product.basePrice ?? 0), 0)
      return ok({
        type: 'inventory',
        note: 'Snapshot: الرصيد الحالي لكل متغير في كل مخزن',
        summary: {
          skus: balances.length,
          totalOnHand: balances.reduce((s, b) => s + b.onHand, 0),
          totalReserved: balances.reduce((s, b) => s + b.reserved, 0),
          lowStock: balances.filter((b) => b.onHand <= b.reorderLevel).length,
          outOfStock: balances.filter((b) => b.onHand === 0).length,
          totalCostValue: totalValue,
          totalRetailValue: totalRetail,
        },
        lowStockItems: balances
          .filter((b) => b.onHand <= b.reorderLevel)
          .map((b) => ({ product: b.variant.product.name, warehouse: b.warehouse.name, onHand: b.onHand, reorderLevel: b.reorderLevel }))
          .slice(0, 30),
      })
    }

    if (q.type === 'payments') {
      const byStatus = await db.payment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { paidAmount: true } })
      const byRisk = await db.payment.findMany({ where: { riskFlags: { not: '' } }, take: 20 })
      const verified = await db.payment.findMany({ where: { status: 'VERIFIED', verifiedAt: { gte: from, lte: to } } })
      return ok({
        type: 'payments',
        note: 'Payment-based: حالة كل سجلات الدفع',
        summary: {
          verifiedCount: verified.length,
          verifiedAmount: verified.reduce((s, p) => s + p.paidAmount, 0),
          overpayments: (await db.payment.findMany({ where: { overpayment: { gt: 0 } } })).reduce((s, p) => s + p.overpayment, 0),
        },
        byStatus, flagged: byRisk,
      })
    }

    if (q.type === 'financial') {
      const [bankTxns, expenses, refunds, purchases] = await Promise.all([
        db.bankTransaction.findMany({ where: { date: { gte: from, lte: to } }, include: { bankAccount: { select: { name: true } } } }),
        db.expense.findMany({ where: { date: { gte: from, lte: to } } }),
        db.refund.findMany({ where: { completedAt: { gte: from, lte: to }, status: 'COMPLETED' } }),
        db.purchase.findMany({ where: { date: { gte: from, lte: to } } }),
      ])
      const banks = await db.bankAccount.findMany({ select: { name: true, institution: true, currentBalance: true, openingBalance: true } })
      return ok({
        type: 'financial',
        note: 'Cash/Accounting-based: الحركات النقدية الفعلية',
        summary: {
          totalIn: bankTxns.filter((t) => t.direction === 'IN').reduce((s, t) => s + t.amount, 0),
          totalOut: bankTxns.filter((t) => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0),
          customerPayments: bankTxns.filter((t) => t.txnType === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0),
          expenses: expenses.reduce((s, e) => s + e.amount, 0),
          refunds: refunds.reduce((s, r) => s + r.amount, 0),
          purchases: purchases.reduce((s, p) => s + p.total, 0),
        },
        banks,
        expensesByCategory: await db.expense.groupBy({ by: ['category'], _sum: { amount: true }, where: { date: { gte: from, lte: to } } }),
      })
    }

    // products
    const products = await db.product.findMany({
      include: {
        category: { select: { name: true } },
        variants: { include: { balances: true } },
      },
      orderBy: { salesCount: 'desc' },
      take: 100,
    })
    return ok({
      type: 'products',
      note: 'ربحية تقديرية: (متوسط سعر البيع - التكلفة) × المبيعات',
      products: products.map((p) => {
        const onHand = p.variants.reduce((s, v) => s + v.balances.reduce((s2, b) => s2 + b.onHand, 0), 0)
        const revenue = p.salesCount * p.basePrice
        const cost = p.salesCount * (p.costPrice ?? 0)
        return {
          id: p.id, name: p.name, category: p.category.name,
          basePrice: p.basePrice, costPrice: p.costPrice,
          salesCount: p.salesCount, onHand,
          marginPercent: p.basePrice > 0 && p.costPrice ? Math.round(((p.basePrice - p.costPrice) / p.basePrice) * 100) : null,
          estimatedProfit: revenue - cost,
          status: p.status,
        }
      }),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

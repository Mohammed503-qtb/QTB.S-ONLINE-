import { ok, handleRouteError } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/auth'
import { db } from '@/lib/db'

// مركز العمليات (PLAN ق43/47) — كل ما يحتاج تدخلًا في مكان واحد
export async function GET() {
  try {
    await requireAdmin()

    const [
      paymentsQueue, orderIssues, lowStockItems, returnsQueue, failedDeliveries, openTickets,
    ] = await Promise.all([
      db.payment.findMany({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        orderBy: { submittedAt: 'asc' },
        take: 30,
        include: { order: { select: { id: true, orderNumber: true, grandTotal: true, customer: { include: { user: { select: { name: true, phone: true } } } } } } },
      }),
      db.order.findMany({
        where: { status: { in: ['PAYMENT_ISSUE', 'FAILED_DELIVERY'] } },
        orderBy: { updatedAt: 'asc' },
        take: 20,
        select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true },
      }),
      db.inventoryBalance.findMany({
        where: { onHand: { lte: 5 } },
        take: 30,
        include: {
          variant: { include: { product: { select: { name: true, imageUrl: true } } } },
          warehouse: { select: { name: true } },
        },
      }),
      db.returnRequest.findMany({
        where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'RECEIVED'] } },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: { order: { select: { orderNumber: true } } },
      }),
      db.shipment.findMany({
        where: { status: { in: ['FAILED', 'RETURNING'] } },
        take: 15,
        include: { order: { select: { orderNumber: true, customer: { include: { user: { select: { name: true, phone: true } } } } } } },
      }),
      db.supportTicket.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'asc' },
        take: 15,
      }),
    ])

    return ok({
      payments: paymentsQueue.map((p) => ({
        id: p.id, paymentNumber: p.paymentNumber, status: p.status,
        expectedAmount: p.expectedAmount, submittedAmount: p.submittedAmount,
        riskFlags: p.riskFlags, submittedAt: p.submittedAt,
        order: { id: p.order.id, orderNumber: p.order.orderNumber },
        customer: p.order.customer.user,
      })),
      orderIssues,
      lowStock: lowStockItems.map((l) => ({
        variantId: l.variantId, product: l.variant.product.name, image: l.variant.product.imageUrl,
        attributes: JSON.parse(l.variant.attributesJson ?? '{}'),
        warehouse: l.warehouse.name, onHand: l.onHand, reserved: l.reserved, reorderLevel: l.reorderLevel,
      })),
      returns: returnsQueue.map((r) => ({
        id: r.id, returnNumber: r.returnNumber, status: r.status, reason: r.reason, createdAt: r.createdAt,
        orderNumber: r.order.orderNumber,
      })),
      failedDeliveries: failedDeliveries.map((s) => ({
        id: s.id, trackingCode: s.trackingCode, status: s.status,
        orderNumber: s.order.orderNumber, customer: s.order.customer.user,
      })),
      tickets: openTickets.map((t) => ({
        id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, status: t.status, createdAt: t.createdAt,
      })),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

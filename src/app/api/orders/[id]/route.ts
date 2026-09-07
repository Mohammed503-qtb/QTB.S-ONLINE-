import { ok, fail, handleRouteError } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'

// تفاصيل الطلب + الخط الزمني + الدفع + الشحنة (PLAN ق71/82)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params

    const order = await db.order.findFirst({
      where: { id, customer: { userId: user.id } },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        events: { where: { customerVisible: true }, orderBy: { createdAt: 'asc' } },
        payments: true,
        shipments: { include: { events: { orderBy: { createdAt: 'asc' } }, attempts: { orderBy: { createdAt: 'desc' } } } },
        returnRequests: { include: { items: { include: { orderItem: true } }, refunds: true } },
        invoice: true,
      },
    })
    if (!order) return fail('VALIDATION_ERROR', 'الطلب غير موجود', 404)

    const address = JSON.parse(order.addressJson ?? '{}')

    return ok({
      order: {
        id: order.id, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus,
        itemsTotal: order.itemsTotal, discountTotal: order.discountTotal, couponCode: order.couponCode,
        shippingFee: order.shippingFee, grandTotal: order.grandTotal, currency: order.currency,
        shippingMethod: order.shippingMethod, paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference, trackingCode: order.trackingCode,
        customerNote: order.customerNote, placedAt: order.placedAt,
        confirmedAt: order.confirmedAt, shippedAt: order.shippedAt, deliveredAt: order.deliveredAt,
        completedAt: order.completedAt, cancelledAt: order.cancelledAt, cancelReason: order.cancelReason,
      },
      address,
      items: order.items.map((i) => ({
        id: i.id, productName: i.productName, attributes: JSON.parse(i.attributesJson ?? '{}'),
        imageUrl: i.imageUrl, unitPrice: i.unitPrice, comparePrice: i.comparePrice,
        discountPercent: i.discountPercent, quantity: i.quantity, lineTotal: i.lineTotal,
        productId: i.productId, variantId: i.variantId,
      })),
      timeline: order.events.map((e) => ({ type: e.type, at: e.createdAt, data: JSON.parse(e.dataJson ?? '{}') })),
      statusHistory: order.statusHistory.map((h) => ({
        from: h.fromStatus, to: h.toStatus, reason: h.reason, note: h.note, at: h.createdAt,
      })),
      payment: order.payments[0] ? {
        id: order.payments[0].id, paymentNumber: order.payments[0].paymentNumber,
        status: order.payments[0].status, expectedAmount: order.payments[0].expectedAmount,
        submittedAmount: order.payments[0].submittedAmount, paidAmount: order.payments[0].paidAmount,
        rejectReason: order.payments[0].rejectReason, expiresAt: order.payments[0].expiresAt,
        proofUrl: order.payments[0].proofUrl, riskFlags: order.payments[0].riskFlags,
        account: order.payments[0].accountSnapshotJson ? JSON.parse(order.payments[0].accountSnapshotJson) : null,
      } : null,
      shipment: order.shipments[0] ? {
        shipmentNumber: order.shipments[0].shipmentNumber, trackingCode: order.shipments[0].trackingCode,
        status: order.shipments[0].status, provider: order.shipments[0].providerName,
        shippedAt: order.shipments[0].shippedAt, deliveredAt: order.shipments[0].deliveredAt,
        events: order.shipments[0].events.map((e) => ({ status: e.status, note: e.note, at: e.createdAt })),
      } : null,
      returns: order.returnRequests.map((r) => ({
        id: r.id, returnNumber: r.returnNumber, status: r.status, reason: r.reason,
        items: r.items.map((ri) => ({ productName: ri.orderItem.productName, quantity: ri.quantity })),
      })),
      invoice: order.invoice ? { invoiceNumber: order.invoice.invoiceNumber, total: order.invoice.total, issuedAt: order.invoice.issuedAt } : null,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

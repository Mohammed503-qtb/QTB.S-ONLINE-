import { db } from '@/lib/db'
import { ApiError } from '@/lib/server/api'
import type { SessionUser } from '@/lib/server/auth'
import { writeAudit } from '@/lib/server/audit'
import { nextReturnNumber, nextRefundNumber } from '@/lib/server/codes'
import { notifyUser, notifyFinanceTeam, notifyWarehouseTeam } from '@/lib/server/notifications'
import { postBankTransaction } from '@/lib/server/accounting'
import { returnStock } from '@/lib/server/inventory'
import { RETURNABLE_STATUSES, RETURN_TRANSITIONS, type ReturnStatus, type RefundStatus } from '@/lib/shared/constants'

// ============================================================
// محرك الإرجاع والاسترداد (PLAN ق28/29/30/106)
// التدفق: طلب → موافقة → استلام → فحص → استرداد → تحديث المخزون/المالية
// لا يُكتب "Refunded" قبل سجل استرداد قابل للتدقيق (ق30)
// ============================================================

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

// ---------- العميل يطلب إرجاعًا ----------
export async function createReturnRequest(input: {
  orderId: string
  customerUserId: string
  items: { orderItemId: string; quantity: number }[]
  reason: string
  note?: string
  photos?: string[]
  replacement?: { variantId: string; orderItemId: string } | null
}) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { items: true, customer: { include: { user: true } } },
  })
  if (!order) throw new ApiError('VALIDATION_ERROR', 'الطلب غير موجود', 404)
  if (order.customer.user.id !== input.customerUserId) {
    throw new ApiError('PERMISSION_ERROR', 'لا تملك صلاحية على هذا الطلب', 403)
  }
  if (!RETURNABLE_STATUSES.includes(order.status as never)) {
    throw new ApiError('CONFLICT', 'لا يمكن طلب الإرجاع لهذا الطلب في حالته الحالية', 409)
  }
  if (input.items.length === 0) throw new ApiError('VALIDATION_ERROR', 'حدد المنتجات المطلوب إرجاعها')

  // نافذة الإرجاع
  const windowDays = Number((await db.appSetting.findUnique({ where: { key: 'return_window_days' } }))?.value ?? 7)
  const deliveredAt = order.deliveredAt ?? order.completedAt
  if (deliveredAt && Date.now() - deliveredAt.getTime() > windowDays * 86400000) {
    throw new ApiError('CONFLICT', `انتهت مدة الإرجاع (${windowDays} أيام من التسليم)`, 409)
  }

  // التحقق من الكميات
  for (const ri of input.items) {
    const item = order.items.find((i) => i.id === ri.orderItemId)
    if (!item) throw new ApiError('VALIDATION_ERROR', 'صنف غير موجود في الطلب')
    if (ri.quantity < 1 || ri.quantity > item.quantity) {
      throw new ApiError('VALIDATION_ERROR', `كمية الإرجاع غير صحيحة للصنف "${item.productName}"`)
    }
  }

  const returnRequest = await db.$transaction(async (tx) => {
    const returnNumber = await nextReturnNumber(tx)
    const rr = await tx.returnRequest.create({
      data: {
        returnNumber,
        orderId: input.orderId,
        customerId: order.customerId,
        reason: input.reason,
        customerNote: input.note ?? null,
        photosJson: JSON.stringify(input.photos ?? []),
        replacementJson: input.replacement ? JSON.stringify(input.replacement) : null,
        status: 'REQUESTED',
      },
    })
    for (const ri of input.items) {
      const item = order.items.find((i) => i.id === ri.orderItemId)!
      await tx.returnItem.create({
        data: { returnRequestId: rr.id, orderItemId: ri.orderItemId, quantity: ri.quantity },
      })
      void item
    }
    await tx.order.update({ where: { id: input.orderId }, data: { status: 'RETURN_IN_PROGRESS' } })
    await tx.orderEvent.create({
      data: { orderId: input.orderId, type: 'RETURN_REQUESTED', dataJson: JSON.stringify({ returnNumber, reason: input.reason }) },
    })
    return rr
  }, { timeout: 30_000, maxWait: 10_000 })

  await notifyUser(db, {
    userId: input.customerUserId,
    type: 'RETURN_REQUESTED',
    title: 'تم استلام طلب الإرجاع',
    body: `طلب الإرجاع ${returnRequest.returnNumber} قيد المراجعة`,
    linkView: 'returns',
  })
  await notifyWarehouseTeam({
    type: 'RETURN_REQUESTED',
    title: 'طلب إرجاع جديد',
    body: `${returnRequest.returnNumber} — طلب ${order.orderNumber}`,
    linkView: 'admin-returns',
    linkParam: returnRequest.id,
  })
  await writeAudit({
    action: 'return.request',
    entityType: 'return',
    entityId: returnRequest.id,
    newValues: { orderId: input.orderId, items: input.items, reason: input.reason },
  })

  return returnRequest
}

// ---------- انتقالات الإرجاع (الإدارة) ----------
export async function transitionReturn(input: { returnId: string; to: ReturnStatus; actor: SessionUser; reason?: string; note?: string }) {
  const rr = await db.returnRequest.findUnique({
    where: { id: input.returnId },
    include: { items: { include: { orderItem: true } }, order: true },
  })
  if (!rr) throw new ApiError('VALIDATION_ERROR', 'طلب الإرجاع غير موجود', 404)

  const from = rr.status as ReturnStatus
  const allowed = RETURN_TRANSITIONS[from] ?? []
  if (!allowed.includes(input.to)) {
    throw new ApiError('CONFLICT', `لا يمكن الانتقال إلى هذه الحالة من الوضع الحالي`, 409)
  }

  await db.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: input.returnId },
      data: {
        status: input.to,
        reviewedById: ['APPROVED', 'REJECTED', 'UNDER_REVIEW'].includes(input.to) ? input.actor.id : rr.reviewedById,
        reviewedAt: ['APPROVED', 'REJECTED', 'UNDER_REVIEW'].includes(input.to) ? new Date() : rr.reviewedAt,
        rejectReason: input.to === 'REJECTED' ? input.reason ?? input.note : rr.rejectReason,
        receivedAt: input.to === 'RECEIVED' ? new Date() : rr.receivedAt,
        inspectedAt: input.to === 'INSPECTED' ? new Date() : rr.inspectedAt,
        inspectionNote: input.note ?? rr.inspectionNote,
      },
    })

    // استلام المنتج المرتجع → زيادة المخزون (إن كان قابلًا لإعادة البيع)
    if (input.to === 'RECEIVED') {
      const warehouse = await tx.warehouse.findFirst({ where: { active: true, isDefault: true } })
        ?? await tx.warehouse.findFirst({ where: { active: true } })
      if (warehouse) {
        for (const item of rr.items) {
          await returnStock(tx, {
            variantId: item.orderItem.variantId,
            warehouseId: warehouse.id,
            quantity: item.quantity,
            refType: 'return',
            refId: input.returnId,
            refNumber: rr.returnNumber,
            reason: 'مرتجع عميل',
            userId: input.actor.id,
          })
        }
      }
    }

    // رفض → الطلب يعود لحالته
    if (input.to === 'REJECTED' && rr.order.status === 'RETURN_IN_PROGRESS') {
      await tx.order.update({ where: { id: rr.orderId }, data: { status: 'DELIVERED' } })
      await tx.orderEvent.create({ data: { orderId: rr.orderId, type: 'RETURN_REJECTED', dataJson: JSON.stringify({ reason: input.reason }) } })
    }
  }, { timeout: 30_000, maxWait: 10_000 })

  const customer = await db.customer.findUnique({ where: { id: rr.customerId }, include: { user: true } })
  if (customer) {
    const labels: Record<string, string> = {
      UNDER_REVIEW: 'قيد المراجعة', APPROVED: 'تمت الموافقة', REJECTED: `تم الرفض: ${input.reason ?? ''}`,
      RECEIVED: 'تم استلام المنتج', INSPECTED: 'تم الفحص', REFUND_PENDING: 'الاسترداد قيد التنفيذ', COMPLETED: 'اكتمل الإرجاع',
    }
    await notifyUser(db, {
      userId: customer.user.id,
      type: `RETURN_${input.to}`,
      title: `تحديث طلب الإرجاع ${rr.returnNumber}`,
      body: labels[input.to] ?? input.to,
      linkView: 'returns',
    })
  }

  await writeAudit({
    actor: input.actor,
    action: `return.transition:${from}:${input.to}`,
    entityType: 'return',
    entityId: input.returnId,
    reason: input.reason ?? input.note,
  })

  return { ok: true }
}

// ---------- إنشاء سجل استرداد (لا ينفذ التحويل) ----------
export async function createRefund(input: {
  orderId?: string
  returnRequestId?: string
  paymentId?: string
  amount: number
  method: 'BANK' | 'CASH' | 'CREDIT'
  reason: string
  actor: SessionUser
  bankAccountId?: string
}) {
  if (input.amount <= 0) throw new ApiError('VALIDATION_ERROR', 'مبلغ الاسترداد غير صحيح')

  const refund = await db.$transaction(async (tx) => {
    const refundNumber = await nextRefundNumber(tx)
    return tx.refund.create({
      data: {
        refundNumber,
        orderId: input.orderId ?? null,
        returnRequestId: input.returnRequestId ?? null,
        paymentId: input.paymentId ?? null,
        amount: input.amount,
        method: input.method,
        bankAccountId: input.bankAccountId ?? null,
        status: 'REQUESTED',
        reason: input.reason,
      },
    })
  }, { timeout: 30_000, maxWait: 10_000 })

  await notifyFinanceTeam({
    type: 'REFUND_REQUESTED',
    title: 'طلب استرداد جديد',
    body: `${refund.refundNumber} — ${input.amount} ريال — ${input.reason}`,
    linkView: 'admin-refunds',
    linkParam: refund.id,
  })
  await writeAudit({
    actor: input.actor,
    action: 'refund.create',
    entityType: 'refund',
    entityId: refund.id,
    newValues: { amount: input.amount, method: input.method, reason: input.reason },
  })
  return refund
}

// ---------- تنفيذ الاسترداد (أثر مالي حقيقي) ----------
export async function completeRefund(input: { refundId: string; actor: SessionUser; note?: string }) {
  if (!['SUPER_ADMIN', 'ACCOUNTANT', 'MANAGER'].includes(input.actor.role)) {
    throw new ApiError('PERMISSION_ERROR', 'المحاسب أو المدير فقط ينفذ الاسترداد', 403)
  }
  const refund = await db.refund.findUnique({ where: { id: input.refundId }, include: { order: true, returnRequest: true } })
  if (!refund) throw new ApiError('VALIDATION_ERROR', 'سجل الاسترداد غير موجود', 404)
  if (refund.status === 'COMPLETED') throw new ApiError('CONFLICT', 'تم تنفيذ هذا الاسترداد مسبقًا', 409)
  if (refund.status !== 'APPROVED' && refund.status !== 'PROCESSING') {
    // نجعله APPROVED تلقائيًا إن كان REQUESTED (الموافقة الضمنية من المنفذ)
    if (refund.status !== 'REQUESTED') throw new ApiError('CONFLICT', 'لا يمكن التنفيذ من الحالة الحالية', 409)
    await db.refund.update({ where: { id: refund.id }, data: { status: 'APPROVED', approvedById: input.actor.id } })
  }

  await db.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: { status: 'COMPLETED', processedById: input.actor.id, completedAt: new Date() },
    })
    await tx.refundEvent.create({
      data: { refundId: refund.id, type: 'COMPLETED', dataJson: JSON.stringify({ note: input.note }), actorId: input.actor.id },
    })

    // الأثر المالي (PLAN ق30/106)
    if (refund.method === 'BANK' && refund.bankAccountId) {
      await postBankTransaction(tx, {
        bankAccountId: refund.bankAccountId,
        direction: 'OUT',
        amount: refund.amount,
        txnType: 'REFUND',
        refType: 'refund',
        refId: refund.id,
        refNumber: refund.refundNumber,
        description: `استرداد — ${refund.reason}`,
      })
    } else if (refund.method === 'BANK') {
      const first = await tx.bankAccount.findFirst({ where: { active: true } })
      if (first) {
        await postBankTransaction(tx, {
          bankAccountId: first.id,
          direction: 'OUT',
          amount: refund.amount,
          txnType: 'REFUND',
          refType: 'refund',
          refId: refund.id,
          refNumber: refund.refundNumber,
          description: `استرداد — ${refund.reason}`,
        })
      }
    } else if (refund.method === 'CREDIT') {
      if (refund.order) {
        await tx.customer.update({
          where: { id: refund.order.customerId },
          data: { creditBalance: { increment: refund.amount } },
        })
      }
    }

    // تحديث حالة الدفع الأصلية للطلب
    if (refund.order && refund.paymentId) {
      const payment = await tx.payment.findUnique({ where: { id: refund.paymentId } })
      if (payment) {
        const newRefunded = payment.refundedAmount + refund.amount
        const fullyRefunded = newRefunded >= payment.paidAmount
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            refundedAmount: newRefunded,
            status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          },
        })
        await tx.order.update({
          where: { id: refund.order.id },
          data: { paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        })
      }
    } else if (refund.order) {
      await tx.order.update({ where: { id: refund.order.id }, data: { paymentStatus: 'REFUNDED' } })
    }

    // إغلاق سلسلة الإرجاع إن كان مرتبطًا بها
    if (refund.returnRequest && refund.returnRequest.status === 'REFUND_PENDING') {
      await tx.returnRequest.update({ where: { id: refund.returnRequest.id }, data: { status: 'COMPLETED' } })
      await tx.order.update({ where: { id: refund.orderId! }, data: { status: 'COMPLETED' } })
      await tx.orderEvent.create({ data: { orderId: refund.orderId!, type: 'RETURN_COMPLETED' } })
    }
  }, { timeout: 30_000, maxWait: 10_000 })

  if (refund.order) {
    const customer = await db.customer.findUnique({ where: { id: refund.order.customerId }, include: { user: true } })
    if (customer) {
      await notifyUser(db, {
        userId: customer.user.id,
        type: 'REFUND_COMPLETED',
        title: 'تم تنفيذ الاسترداد',
        body: `تم استرداد ${refund.amount} ريال — ${refund.refundNumber}`,
        linkView: 'returns',
      })
    }
  }
  await writeAudit({
    actor: input.actor,
    action: 'refund.complete',
    entityType: 'refund',
    entityId: refund.id,
    reason: input.note,
    newValues: { amount: refund.amount, method: refund.method },
  })

  return { ok: true }
}

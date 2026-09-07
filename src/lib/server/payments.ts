import { db } from '@/lib/db'
import { ApiError } from '@/lib/server/api'
import type { SessionUser } from '@/lib/server/auth'
import { writeAudit } from '@/lib/server/audit'
import { postBankTransaction } from '@/lib/server/accounting'
import { notifyUser, notifyFinanceTeam } from '@/lib/server/notifications'
import { transitionOrder, ensureInvoice } from '@/lib/server/orders'
import { hasPermission } from '@/lib/shared/constants'

// ============================================================
// محرك الدفع بالتحويل البنكي/المحافظ (PLAN ق17/18/19)
// التدفق: UNPAID → SUBMITTED → UNDER_REVIEW → VERIFIED/REJECTED
// عند VERIFY: أثر مالي + حالة الطلب + إشعار + فاتورة + Audit
// ============================================================

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

// ---------- تسجيل العميل لبيانات التحويل ----------
export async function submitPayment(
  input: {
    paymentId: string
    customerUserId: string
    amount: number
    paymentAccountId?: string
    customerTransferRef?: string
    transferDate?: string
    senderName?: string
    proofUrl?: string
    notes?: string
  }
) {
  const payment = await db.payment.findUnique({ where: { id: input.paymentId }, include: { order: { include: { customer: { include: { user: true } } } } } })
  if (!payment) throw new ApiError('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)
  if (payment.order.customer.user.id !== input.customerUserId) {
    throw new ApiError('PERMISSION_ERROR', 'لا تملك صلاحية على هذا الدفع', 403)
  }
  if (payment.order.status === 'CANCELLED' || payment.status === 'EXPIRED') {
    throw new ApiError('CONFLICT', 'لا يمكن تسجيل دفع لطلب ملغي أو منتهي الصلاحية', 409)
  }
  if (['VERIFIED', 'UNDER_REVIEW'].includes(payment.status) && input.amount === 0) {
    throw new ApiError('CONFLICT', 'تم تسجيل التحويل مسبقًا وهو قيد المراجعة', 409)
  }
  if (input.amount <= 0) throw new ApiError('VALIDATION_ERROR', 'المبلغ غير صحيح')

  // كشف التكرار (PLAN ق19 — Duplicate)
  const riskFlags: string[] = []
  let duplicateOfId: string | null = null
  if (input.customerTransferRef) {
    const dup = await db.payment.findFirst({
      where: {
        customerTransferRef: input.customerTransferRef,
        id: { not: payment.id },
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'] },
      },
    })
    if (dup) {
      riskFlags.push('DUPLICATE')
      duplicateOfId = dup.id
    }
  }

  // حساب الدفع المختار + snapshot (PLAN ق71)
  let accountSnapshot: string | null = null
  if (input.paymentAccountId) {
    const account = await db.paymentAccount.findUnique({ where: { id: input.paymentAccountId } })
    if (account && account.active && account.displayToCustomers) {
      accountSnapshot = JSON.stringify(account)
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const prev = await tx.payment.findUnique({ where: { id: input.paymentId } })
    if (!prev) throw new ApiError('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)
    if (prev.status === 'VERIFIED') throw new ApiError('CONFLICT', 'تم اعتماد هذا الدفع مسبقًا', 409)

    // تراكمي: استكمال المبلغ (PLAN ق19 — دفع ناقص ثم استكمال)
    const newSubmitted = (prev.status === 'REJECTED' || prev.status === 'UNPAID' ? 0 : prev.submittedAmount ?? 0) + input.amount

    const p = await tx.payment.update({
      where: { id: input.paymentId },
      data: {
        status: 'SUBMITTED',
        submittedAmount: newSubmitted,
        paymentAccountId: input.paymentAccountId ?? prev.paymentAccountId,
        accountSnapshotJson: accountSnapshot ?? prev.accountSnapshotJson,
        customerTransferRef: input.customerTransferRef ?? prev.customerTransferRef,
        transferDate: input.transferDate ? new Date(input.transferDate) : prev.transferDate,
        senderName: input.senderName ?? prev.senderName,
        proofUrl: input.proofUrl ?? prev.proofUrl,
        notes: input.notes ?? prev.notes,
        riskFlags: riskFlags.length ? riskFlags.join(',') : prev.riskFlags,
        duplicateOfId,
        submittedAt: new Date(),
      },
    })

    await tx.paymentEvent.create({
      data: {
        paymentId: input.paymentId,
        type: 'SUBMITTED',
        dataJson: JSON.stringify({ amount: input.amount, total: newSubmitted, proof: !!input.proofUrl }),
      },
    })

    // الطلب ينتقل لمراجعة الدفع
    if (payment.order.status === 'PENDING_PAYMENT') {
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, fromStatus: 'PENDING_PAYMENT', toStatus: 'PAYMENT_REVIEW' },
      })
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'PAYMENT_REVIEW', paymentStatus: 'SUBMITTED' } })
      await tx.orderEvent.create({ data: { orderId: payment.orderId, type: 'PAYMENT_SUBMITTED' } })
    } else {
      await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'SUBMITTED' } })
    }

    return p
  })

  await notifyUser(db, {
    userId: input.customerUserId,
    type: 'PAYMENT_SUBMITTED',
    title: 'تم تسجيل تحويلك',
    body: `تم استلام بيانات التحويل وسيتم مراجعتها من الإدارة قريبًا. كود الدفع: ${payment.paymentNumber}`,
    linkView: 'order-details',
    linkParam: payment.orderId,
  })
  await notifyFinanceTeam({
    type: 'PAYMENT_SUBMITTED',
    title: 'تحويل جديد بانتظار المراجعة',
    body: `${payment.paymentNumber} — طلب ${payment.order.orderNumber} — المبلغ المسجل: ${input.amount}${duplicateOfId ? ' ⚠️ تحويل مكرر مشتبه' : ''}`,
    linkView: 'admin-payments',
    linkParam: payment.id,
  })
  await writeAudit({
    action: 'payment.submit',
    entityType: 'payment',
    entityId: input.paymentId,
    newValues: { amount: input.amount, transferRef: input.customerTransferRef, proof: !!input.proofUrl },
  })

  return updated
}

// ---------- اعتماد الدفع (الإدارة — أثر مالي كامل) ----------
export async function verifyPayment(
  input: { paymentId: string; actor: SessionUser; bankAccountId?: string; note?: string; confirmAmount?: number }
) {
  if (!hasPermission(input.actor.role, 'payments.verify')) {
    throw new ApiError('PERMISSION_ERROR', 'لا تملك صلاحية اعتماد الدفع', 403)
  }

  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: { order: { include: { customer: { include: { user: true } } } } },
  })
  if (!payment) throw new ApiError('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)
  if (payment.status === 'VERIFIED') throw new ApiError('CONFLICT', 'تم اعتماد هذا الدفع مسبقًا', 409)
  if (!['SUBMITTED', 'UNDER_REVIEW', 'PARTIALLY_PAID', 'REJECTED', 'UNPAID'].includes(payment.status)) {
    throw new ApiError('CONFLICT', `لا يمكن الاعتماد من حالة "${payment.status}"`, 409)
  }

  const submittedAmount = input.confirmAmount ?? payment.submittedAmount ?? 0
  if (submittedAmount <= 0) throw new ApiError('VALIDATION_ERROR', 'لا يوجد مبلغ مسجل للاعتماد')

  const expected = payment.expectedAmount
  const remaining = Math.max(0, expected - submittedAmount)
  const overpayment = Math.max(0, submittedAmount - expected)

  // الحساب البنكي: من الإدخال أو من snapshot الدفع أو الأول النشط
  const bankAccountId =
    input.bankAccountId ??
    (await (async () => {
      const snap = payment.accountSnapshotJson ? JSON.parse(payment.accountSnapshotJson) : null
      if (snap?.institution) {
        const acc = await db.bankAccount.findFirst({ where: { institution: snap.institution, active: true } })
        if (acc) return acc.id
      }
      const first = await db.bankAccount.findFirst({ where: { active: true } })
      return first?.id ?? null
    })())

  const isFullPayment = remaining === 0

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: input.paymentId },
      data: {
        status: isFullPayment ? 'VERIFIED' : 'PARTIALLY_PAID',
        paidAmount: submittedAmount,
        overpayment,
        reviewedById: input.actor.id,
        reviewedAt: new Date(),
        verifiedAt: isFullPayment ? new Date() : null,
      },
    })
    await tx.paymentEvent.create({
      data: {
        paymentId: input.paymentId,
        type: isFullPayment ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
        dataJson: JSON.stringify({ amount: submittedAmount, remaining, overpayment, actor: input.actor.id, note: input.note }),
        actorId: input.actor.id,
      },
    })

    // الأثر المالي: إيداع بنكي (سياسة worklog — Revenue عند VERIFY)
    if (bankAccountId) {
      await postBankTransaction(tx, {
        bankAccountId,
        direction: 'IN',
        amount: submittedAmount,
        txnType: 'CUSTOMER_PAYMENT',
        refType: 'payment',
        refId: input.paymentId,
        refNumber: payment.paymentNumber,
        description: `تحصيل دفعة عميل — ${payment.paymentNumber} — طلب ${payment.order.orderNumber}`,
      })
    }

    // حالة الطلب
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: isFullPayment ? 'VERIFIED' : 'PARTIALLY_PAID' },
    })
    if (isFullPayment && ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'PAYMENT_ISSUE'].includes(payment.order.status)) {
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, fromStatus: payment.order.status, toStatus: 'CONFIRMED', changedById: input.actor.id },
      })
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      })
      await tx.orderEvent.create({ data: { orderId: payment.orderId, type: 'PAYMENT_VERIFIED' } })
    }
  })

  // الفاتورة + الإشعارات + Audit (خارج المعاملة)
  if (isFullPayment) {
    await ensureInvoice(payment.orderId).catch((e) => console.error('[INVOICE FAILED]', e))
  }

  await notifyUser(db, {
    userId: payment.order.customer.user.id,
    type: isFullPayment ? 'PAYMENT_VERIFIED' : 'PAYMENT_PARTIAL',
    title: isFullPayment ? 'تم اعتماد الدفع ✅' : 'تم اعتماد دفعة جزئية',
    body: isFullPayment
      ? `تم اعتماد دفعتك للطلب ${payment.order.orderNumber} وسيبدأ تجهيز طلبك الآن`
      : `تم اعتماد ${submittedAmount} من أصل ${expected}. المتبقي: ${remaining} ريال`,
    linkView: 'order-details',
    linkParam: payment.orderId,
  })
  if (overpayment > 0) {
    await notifyFinanceTeam({
      type: 'OVERPAYMENT',
      title: 'دفعة زائدة تحتاج قرارًا',
      body: `${payment.paymentNumber}: ورد ${submittedAmount} والمطلوب ${expected} — الفائض ${overpayment}`,
      linkView: 'admin-payments',
      linkParam: payment.id,
    })
  }
  await writeAudit({
    actor: input.actor,
    action: 'payment.verify',
    entityType: 'payment',
    entityId: input.paymentId,
    reason: input.note,
    newValues: { paidAmount: submittedAmount, remaining, overpayment, bankAccountId },
  })

  return { verified: isFullPayment, remaining, overpayment }
}

// ---------- رفض الدفع (سبب إلزامي — PLAN ق18) ----------
export async function rejectPayment(input: { paymentId: string; actor: SessionUser; reason: string; note?: string }) {
  if (!hasPermission(input.actor.role, 'payments.reject')) {
    throw new ApiError('PERMISSION_ERROR', 'لا تملك صلاحية رفض الدفع', 403)
  }
  if (!input.reason || input.reason.trim().length < 2) {
    throw new ApiError('VALIDATION_ERROR', 'سبب الرفض إلزامي')
  }

  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: { order: { include: { customer: { include: { user: true } } } } },
  })
  if (!payment) throw new ApiError('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)
  if (payment.status === 'VERIFIED') throw new ApiError('CONFLICT', 'لا يمكن رفض دفعة معتمدة — استخدم الاسترداد', 409)

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: input.paymentId },
      data: {
        status: 'REJECTED',
        rejectReason: input.reason,
        reviewedById: input.actor.id,
        reviewedAt: new Date(),
        submittedAmount: 0, // إعادة تعيين ليسمح بإعادة التقديم
      },
    })
    await tx.paymentEvent.create({
      data: { paymentId: input.paymentId, type: 'REJECTED', dataJson: JSON.stringify({ reason: input.reason }), actorId: input.actor.id },
    })
    // الطلب يبقى قادرًا على الدفع (PAYMENT_ISSUE) — PLAN ق18: "order stays payable"
    if (['PENDING_PAYMENT', 'PAYMENT_REVIEW'].includes(payment.order.status)) {
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, fromStatus: payment.order.status, toStatus: 'PAYMENT_ISSUE', changedById: input.actor.id, reason: input.reason },
      })
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'PAYMENT_ISSUE', paymentStatus: 'REJECTED' } })
      await tx.orderEvent.create({
        data: { orderId: payment.orderId, type: 'PAYMENT_REJECTED', dataJson: JSON.stringify({ reason: input.reason }) },
      })
    } else {
      await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'REJECTED' } })
    }
  })

  await notifyUser(db, {
    userId: payment.order.customer.user.id,
    type: 'PAYMENT_REJECTED',
    title: 'تعذّر اعتماد التحويل',
    body: `سبب الرفض: ${input.reason}. يمكنك إعادة تسجيل التحويل من صفحة الطلب أو التواصل معنا عبر واتساب.`,
    linkView: 'order-details',
    linkParam: payment.orderId,
  })
  await writeAudit({
    actor: input.actor,
    action: 'payment.reject',
    entityType: 'payment',
    entityId: input.paymentId,
    reason: input.reason,
  })

  return { rejected: true }
}

// ---------- طلب توضيح إضافي ----------
export async function requestClarification(input: { paymentId: string; actor: SessionUser; message: string }) {
  if (!hasPermission(input.actor.role, 'payments.review')) {
    throw new ApiError('PERMISSION_ERROR', 'لا تملك صلاحية طلب توضيح', 403)
  }
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: { order: { include: { customer: { include: { user: true } } } } },
  })
  if (!payment) throw new ApiError('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)

  await db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: input.paymentId }, data: { status: 'UNDER_REVIEW' } })
    await tx.paymentEvent.create({
      data: { paymentId: input.paymentId, type: 'CLARIFICATION_REQUESTED', dataJson: JSON.stringify({ message: input.message }), actorId: input.actor.id },
    })
  })

  await notifyUser(db, {
    userId: payment.order.customer.user.id,
    type: 'PAYMENT_CLARIFICATION',
    title: 'طلب توضيح بخصوص تحويلك',
    body: input.message,
    linkView: 'order-details',
    linkParam: payment.orderId,
  })
  await writeAudit({ actor: input.actor, action: 'payment.clarification', entityType: 'payment', entityId: input.paymentId })

  return { ok: true }
}

// ---------- تسوية الدفعة الزائدة (رصيد عميل — PLAN ق19) ----------
export async function settleOverpayment(input: { paymentId: string; actor: SessionUser; method: 'CREDIT' | 'REFUND' }) {
  const payment = await db.payment.findUnique({ where: { id: input.paymentId }, include: { order: true } })
  if (!payment) throw new ApiError('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)
  if (payment.overpayment <= 0) throw new ApiError('VALIDATION_ERROR', 'لا توجد دفعة زائدة على هذا السجل')

  if (input.method === 'CREDIT') {
    await db.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: payment.order.customerId },
        data: { creditBalance: { increment: payment.overpayment } },
      })
      await tx.payment.update({ where: { id: payment.id }, data: { overpayment: 0 } })
      await tx.paymentEvent.create({
        data: { paymentId: payment.id, type: 'OVERPAYMENT_CREDITED', dataJson: JSON.stringify({ amount: payment.overpayment }), actorId: input.actor.id },
      })
    })
    await writeAudit({
      actor: input.actor,
      action: 'payment.overpayment_credit',
      entityType: 'payment',
      entityId: payment.id,
      newValues: { credited: payment.overpayment },
    })
    return { credited: payment.overpayment }
  }

  // REFUND → ينشأ سجل استرداد (محرك الاسترداد)
  const { createRefund } = await import('@/lib/server/returns')
  const refund = await createRefund({
    orderId: payment.orderId,
    paymentId: payment.id,
    amount: payment.overpayment,
    method: 'BANK',
    reason: 'تسوية دفعة زائدة',
    actor: input.actor,
  })
  return { refundId: refund.id }
}

// ---------- وضع الدفعة قيد المراجعة (عند العرض في طابور) ----------
export async function markUnderReview(paymentId: string, actor: SessionUser) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw new ApiError('VALIDATION_ERROR', 'سجل الدفع غير موجود', 404)
  if (payment.status !== 'SUBMITTED') return payment
  const updated = await db.payment.update({ where: { id: paymentId }, data: { status: 'UNDER_REVIEW' } })
  await db.paymentEvent.create({ data: { paymentId, type: 'UNDER_REVIEW', actorId: actor.id } })
  return updated
}

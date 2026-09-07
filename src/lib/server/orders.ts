import { db } from '@/lib/db'
import { ApiError } from '@/lib/server/api'
import type { SessionUser } from '@/lib/server/auth'
import { nextOrderNumber, nextPaymentNumber, nextTrackingCode, nextInvoiceNumber, nextShipmentNumber } from '@/lib/server/codes'
import { writeAudit } from '@/lib/server/audit'
import { reserveForOrder, releaseOrderReservation, convertReservationToSale } from '@/lib/server/inventory'
import { quote } from '@/lib/server/pricing'
import { notifyUser, notifyRole, notifyFinanceTeam, notifyWarehouseTeam } from '@/lib/server/notifications'
import { getNumberSetting, getFlag } from '@/lib/server/flags'
import { ORDER_TRANSITIONS, ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/shared/constants'

// ============================================================
// محرك الطلبات (PLAN ق14/15/69/85)
// - إنشاء الطلب: معاملة ذرية واحدة (لا طلب يتيم ولا حجز يتيم)
// - Idempotency Key ضد التكرار (PLAN ق56/86)
// - آلة حالة رسمية لكل انتقال شروط وآثار (ق1.7)
// ============================================================

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export type CreateOrderInput = {
  customerId: string
  customerUserId: string
  addressId: string
  items: { variantId: string; quantity: number }[]
  shippingMethodCode: string
  paymentMethodCode: string // BANK_TRANSFER | COD
  couponCode?: string
  customerNote?: string
  idempotencyKey?: string
}

export async function createOrder(input: CreateOrderInput) {
  // ---------- Idempotency (منع الطلب المكرر — PLAN ق56) ----------
  if (input.idempotencyKey) {
    const existing = await db.idempotencyKey.findUnique({ where: { key: `order:${input.idempotencyKey}` } })
    if (existing) {
      const orderId = JSON.parse(existing.responseJson ?? '{}').orderId
      if (orderId) {
        const order = await db.order.findUnique({ where: { id: orderId } })
        if (order) return { order, duplicated: true }
      }
    }
  }

  // ---------- قراءة العنوان (snapshot — PLAN ق12) ----------
  const address = await db.customerAddress.findFirst({
    where: { id: input.addressId, customerId: input.customerId },
  })
  if (!address) throw new ApiError('VALIDATION_ERROR', 'العنوان المحدد غير موجود')

  // ---------- التسعير من الخادم (PLAN ق1.6/ق10) ----------
  const q = await quote({
    items: input.items,
    governorate: address.governorate,
    shippingMethodCode: input.shippingMethodCode,
    couponCode: input.couponCode,
    customerId: input.customerId,
  })

  // ---------- حراسة الأعلام ----------
  const ordersEnabled = await getFlag('orders_enabled')
  const checkoutEnabled = await getFlag('checkout_enabled')
  if (!ordersEnabled || !checkoutEnabled) throw new ApiError('PERMISSION_ERROR', 'الطلبات متوقفة حاليًا من إدارة المتجر', 403)

  if (input.paymentMethodCode === 'BANK_TRANSFER') {
    const bankEnabled = await getFlag('bank_transfer_enabled')
    if (!bankEnabled) throw new ApiError('PERMISSION_ERROR', 'الدفع بالتحويل البنكي معطل حاليًا', 403)
  }
  if (input.paymentMethodCode === 'COD') {
    const codEnabled = await getFlag('cash_on_delivery_enabled')
    if (!codEnabled) throw new ApiError('PERMISSION_ERROR', 'الدفع عند الاستلام معطل حاليًا', 403)
  }

  const shippingMethod = await db.shippingMethod.findUnique({ where: { code: input.shippingMethodCode } })
  if (!shippingMethod || !shippingMethod.active) throw new ApiError('VALIDATION_ERROR', 'طريقة الشحن غير متاحة')

  const expiryHours = await getNumberSetting('payment_expiry_hours', 48)

  // ---------- المعاملة الذرية الكاملة ----------
  const order = await db.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx)
    const paymentNumber = await nextPaymentNumber(tx)
    const trackingCode = await nextTrackingCode(tx)

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: input.customerId,
        addressJson: JSON.stringify(address),
        status: 'PENDING_PAYMENT',
        paymentStatus: 'UNPAID',
        itemsTotal: q.itemsTotal,
        discountTotal: q.discountTotal,
        couponCode: q.couponCode ?? null,
        shippingFee: q.shippingFee,
        grandTotal: q.grandTotal,
        shippingMethod: shippingMethod.name,
        paymentMethod: input.paymentMethodCode,
        paymentReference: paymentNumber,
        trackingCode,
        idempotencyKey: input.idempotencyKey ?? null,
        customerNote: input.customerNote ?? null,
        placedAt: new Date(),
      },
    })

    // عناصر الطلب مع snapshots (PLAN ق72)
    for (const line of q.items) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: line.productId,
          variantId: line.variantId,
          productName: line.productName,
          skuSnapshot: null,
          attributesJson: JSON.stringify(line.attributes),
          imageUrl: line.imageUrl ?? null,
          unitPrice: line.unitPrice,
          comparePrice: line.comparePrice ?? null,
          discountPercent: line.discountPercent,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          costSnapshot: line.costPrice,
        },
      })
    }

    // سجل الدفع الأساسي مع انتهاء صلاحية (PLAN ق85)
    const defaultWarehouse = await tx.warehouse.findFirst({ where: { active: true, isDefault: true } })
      ?? await tx.warehouse.findFirst({ where: { active: true } })
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000)
    await tx.payment.create({
      data: {
        paymentNumber,
        orderId: order.id,
        methodCode: input.paymentMethodCode,
        status: 'UNPAID',
        expectedAmount: q.grandTotal,
        expiresAt: input.paymentMethodCode === 'BANK_TRANSFER' ? expiresAt : null,
      },
    })
    void defaultWarehouse

    // حجز المخزون فور إنشاء الطلب (سياسة PLAN ق15/ق11)
    if (defaultWarehouse) {
      await reserveForOrder(tx, {
        orderId: order.id,
        orderNumber,
        items: input.items,
        warehouseId: defaultWarehouse.id,
        userId: input.customerUserId,
      })
    }

    // سجل الحالة الأولي + حدث
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: null, toStatus: 'PENDING_PAYMENT' },
    })
    await tx.orderEvent.create({
      data: { orderId: order.id, type: 'ORDER_CREATED', dataJson: JSON.stringify({ orderNumber, paymentNumber, trackingCode }) },
    })

    // COD: يُؤكد مباشرة (لا تحقق مصرفي مطلوب — التحصيل عند التسليم PLAN ق20)
    if (input.paymentMethodCode === 'COD') {
      await tx.order.update({ where: { id: order.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } })
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', note: 'دفع عند الاستلام — تأكيد مباشر' },
      })
      await tx.orderEvent.create({ data: { orderId: order.id, type: 'PAYMENT_METHOD_COD' } })
    }

    // استخدام الكوبون (PLAN ق41)
    if (q.couponCode && q.couponDiscount > 0) {
      const coupon = await tx.coupon.findUnique({ where: { code: q.couponCode } })
      if (coupon) {
        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })
        await tx.couponRedemption.create({
          data: { couponId: coupon.id, customerId: input.customerId, orderId: order.id, discountAmount: q.couponDiscount },
        })
      }
    }

    return order
  })

  // ---------- ما بعد الالتزام: توثيق + إشعارات ----------
  if (input.idempotencyKey) {
    await db.idempotencyKey.upsert({
      where: { key: `order:${input.idempotencyKey}` },
      create: { key: `order:${input.idempotencyKey}`, responseJson: JSON.stringify({ orderId: order.id }) },
      update: {},
    })
  }

  await notifyUser(db, {
    userId: input.customerUserId,
    type: 'ORDER_CREATED',
    title: 'تم استلام طلبك',
    body: `طلبك ${order.orderNumber} بانتظار الدفع. كود الدفع: ${order.paymentReference}`,
    linkView: 'order-details',
    linkParam: order.id,
  })
  await notifyFinanceTeam({
    type: 'NEW_ORDER',
    title: 'طلب جديد',
    body: `طلب جديد ${order.orderNumber} بمبلغ ${order.grandTotal} — بانتظار الدفع`,
    linkView: 'admin-order-details',
    linkParam: order.id,
  })
  await writeAudit({
    action: 'order.create',
    entityType: 'order',
    entityId: order.id,
    newValues: { orderNumber: order.orderNumber, grandTotal: order.grandTotal, paymentMethod: input.paymentMethodCode },
  })

  return { order, duplicated: false }
}

// ============================================================
// انتقالات حالة الطلب (PLAN ق1.7/ق24/ق25/ق27)
// كل انتقال: تحقق من الصلاحية + آثار جانبية + سجل + إشعار
// ============================================================

async function addStatusHistory(tx: Tx, orderId: string, from: string, to: string, actorId?: string, reason?: string, note?: string) {
  await tx.orderStatusHistory.create({
    data: { orderId, fromStatus: from, toStatus: to, changedById: actorId ?? null, reason: reason ?? null, note: note ?? null },
  })
}

async function addEvent(tx: Tx, orderId: string, type: string, data?: Record<string, unknown>, customerVisible = true) {
  await tx.orderEvent.create({
    data: { orderId, type, dataJson: JSON.stringify(data ?? {}), customerVisible },
  })
}

async function notifyOrderStatus(orderId: string, status: OrderStatus, extra?: Record<string, string>) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { customer: { include: { user: true } } } })
  if (!order) return
  const label = ORDER_STATUS_LABELS[status]
  await notifyUser(db, {
    userId: order.customer.user.id,
    type: `ORDER_${status}`,
    title: `تحديث الطلب ${order.orderNumber}`,
    body: `حالة طلبك الآن: ${label}${extra?.note ? ' — ' + extra.note : ''}`,
    linkView: 'order-details',
    linkParam: order.id,
  })
}

export async function transitionOrder(
  input: { orderId: string; to: OrderStatus; actor?: SessionUser | null; reason?: string; note?: string; extra?: Record<string, unknown> }
) {
  const { orderId, to, actor, reason, note, extra } = input
  let fromStatus = ''

  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, shipments: true } })
    if (!order) throw new ApiError('VALIDATION_ERROR', 'الطلب غير موجود', 404)

    const from = order.status as OrderStatus
    fromStatus = from
    if (from === to) throw new ApiError('CONFLICT', 'الطلب في هذه الحالة بالفعل', 409)

    // التحقق من آلة الحالة (PLAN ق1.7 — لا تخطي الحالات)
    const allowed = ORDER_TRANSITIONS[from] ?? []
    if (!allowed.includes(to)) {
      throw new ApiError('CONFLICT', `لا يمكن الانتقال من "${ORDER_STATUS_LABELS[from]}" إلى "${ORDER_STATUS_LABELS[to]}"`, 409)
    }

    // تزامن تفاؤلي (PLAN ق77)
    const updated = await tx.order.update({
      where: { id: orderId, version: order.version },
      data: {
        status: to,
        version: { increment: 1 },
        ...(to === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: reason ?? note ?? 'إلغاء' } : {}),
        ...(to === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        ...(to === 'SHIPPED' ? { shippedAt: new Date() } : {}),
        ...(to === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(to === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(extra?.adminNote ? { adminNote: String(extra.adminNote) } : {}),
      },
    })
    if (!updated) throw new ApiError('CONFLICT', 'تغيرت حالة الطلب — حدّث الصفحة وأعد المحاولة', 409)

    await addStatusHistory(tx, orderId, from, to, actor?.id, reason, note)
    await addEvent(tx, orderId, `ORDER_${to}`, { reason, note, ...extra })

    // ---------- الآثار الجانبية حسب الحالة ----------

    if (to === 'CANCELLED') {
      // تحرير الحجز (PLAN ق27)
      await releaseOrderReservation(tx, orderId, reason ?? 'إلغاء الطلب', actor?.id)
      // إن كان مدفوعًا → استرداد (يُدار عبر محرك الاسترداد يدويًا من الإدارة)
      if (order.paymentStatus === 'VERIFIED' || order.paymentStatus === 'PARTIALLY_PAID') {
        const payment = await tx.payment.findFirst({ where: { orderId } })
        if (payment) {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUND_PENDING' } })
          await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'REFUND_PENDING' } })
        }
      }
    }

    if (to === 'DELIVERED') {
      // تحويل الحجز إلى بيع نهائي + COGS (سياسة worklog Task 0)
      await convertReservationToSale(tx, orderId, actor?.id)
      // تحديث مبيعات المنتجات
      for (const item of order.items) {
        await tx.product.update({ where: { id: item.productId }, data: { salesCount: { increment: item.quantity } } })
      }
      // COD: تحصيل فوري (PLAN ق20)
      if (order.paymentMethod === 'COD') {
        const payment = await tx.payment.findFirst({ where: { orderId } })
        if (payment) {
          const codBank = (await tx.appSetting.findUnique({ where: { key: 'cod_bank_account_id' } }))?.value
          const bank = codBank
            ? await tx.bankAccount.findUnique({ where: { id: codBank } })
            : await tx.bankAccount.findFirst({ where: { active: true } })
          if (bank) {
            const { postBankTransaction } = await import('@/lib/server/accounting')
            await postBankTransaction(tx, {
              bankAccountId: bank.id,
              direction: 'IN',
              amount: order.grandTotal,
              txnType: 'COD_COLLECTION',
              refType: 'order',
              refId: orderId,
              refNumber: order.orderNumber,
              description: `تحصيل دفع عند الاستلام — ${order.orderNumber}`,
            })
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'VERIFIED', paidAmount: order.grandTotal, verifiedAt: new Date() },
            })
            await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'VERIFIED' } })
          }
        }
      }
      // تحديث حالة الشحنة
      const shipment = order.shipments[0]
      if (shipment) {
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
        await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, status: 'DELIVERED', actorId: actor?.id ?? null } })
      }
    }

    if (to === 'COMPLETED') {
      // إحصاءات العميل (PLAN ق62)
      await tx.customer.update({
        where: { id: order.customerId },
        data: { totalSpent: { increment: order.grandTotal }, ordersCount: { increment: 1 } },
      })
      const customer = await tx.customer.findUnique({ where: { id: order.customerId } })
      if (customer) {
        let tier = customer.tier
        if (customer.ordersCount + 1 >= 10 || customer.totalSpent + order.grandTotal >= 500000) tier = 'VIP'
        else if (customer.ordersCount + 1 >= 2) tier = 'REGULAR'
        await tx.customer.update({ where: { id: customer.id }, data: { tier } })
      }
    }

    if (to === 'SHIPPED') {
      // إنشاء شحنة إن لم توجد (PLAN ق25)
      const existing = order.shipments[0]
      if (!existing) {
        const shipmentNumber = await nextShipmentNumber(tx)
        const trackingCode = order.trackingCode ?? (await nextTrackingCode(tx))
        await tx.shipment.create({
          data: {
            shipmentNumber,
            orderId,
            methodCode: order.paymentMethod === 'COD' ? 'HOME_DELIVERY' : 'HOME_DELIVERY',
            methodName: order.shippingMethod,
            providerName: String(extra?.provider ?? 'شركة الشحن'),
            fee: order.shippingFee,
            trackingCode,
            status: 'HANDED_OVER',
            shippedAt: new Date(),
          },
        })
        if (!order.trackingCode) {
          await tx.order.update({ where: { id: orderId }, data: { trackingCode } })
        }
      } else {
        await tx.shipment.update({ where: { id: existing.id }, data: { status: 'HANDED_OVER', shippedAt: new Date() } })
        await tx.shipmentEvent.create({ data: { shipmentId: existing.id, status: 'HANDED_OVER', actorId: actor?.id ?? null } })
      }
    }

    if (to === 'OUT_FOR_DELIVERY') {
      const shipment = order.shipments[0]
      if (shipment) {
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: 'OUT_FOR_DELIVERY' } })
        await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, status: 'OUT_FOR_DELIVERY', actorId: actor?.id ?? null } })
      }
    }

    if (to === 'FAILED_DELIVERY') {
      const shipment = order.shipments[0]
      if (shipment) {
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: 'FAILED' } })
        await tx.shipmentEvent.create({
          data: { shipmentId: shipment.id, status: 'FAILED', note: note ?? reason ?? null, actorId: actor?.id ?? null },
        })
        await tx.deliveryAttempt.create({
          data: { shipmentId: shipment.id, status: 'FAILED', reason: reason ?? note ?? 'فشل التوصيل', actorId: actor?.id ?? null },
        })
      }
    }

    return updated
  })

  // إشعار العميل + الإدارة (خارج المعاملة)
  await notifyOrderStatus(orderId, to, { note: note ?? reason ?? '' })
  await writeAudit({
    actor,
    action: `order.transition:${fromStatus}:${to}`,
    entityType: 'order',
    entityId: orderId,
    reason,
    newValues: { status: to },
  })

  return result
}

/** إلغاء بواسطة العميل — شروط أشد (PLAN ق27) */
export async function customerCancelOrder(orderId: string, customerUserId: string, reason: string) {
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) throw new ApiError('VALIDATION_ERROR', 'الطلب غير موجود', 404)
  const customer = await db.customer.findUnique({ where: { id: order.customerId }, include: { user: true } })
  if (!customer || customer.user.id !== customerUserId) {
    throw new ApiError('PERMISSION_ERROR', 'لا تملك صلاحية على هذا الطلب', 403)
  }
  const cancellable = ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'PAYMENT_ISSUE']
  if (!cancellable.includes(order.status)) {
    throw new ApiError('CONFLICT', 'لا يمكن إلغاء الطلب في هذه المرحلة — تواصل مع الدعم', 409)
  }
  return transitionOrder({ orderId, to: 'CANCELLED', reason: `إلغاء من العميل: ${reason}` })
}

// ============================================================
// انتهاء صلاحية الدفع (PLAN ق85)
// تُستدعى دوريًا من نقاط قراءة رئيسية
// ============================================================
let lastSweep = 0
export async function expireStaleOrders() {
  if (Date.now() - lastSweep < 30_000) return // مرة كل 30 ثانية كحد أقصى
  lastSweep = Date.now()

  const stalePayments = await db.payment.findMany({
    where: {
      status: { in: ['UNPAID', 'SUBMITTED', 'UNDER_REVIEW'] },
      expiresAt: { lt: new Date() },
      order: { status: { in: ['PENDING_PAYMENT', 'PAYMENT_REVIEW'] } },
    },
    include: { order: true },
    take: 20,
  })

  for (const p of stalePayments) {
    try {
      await db.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: p.id }, data: { status: 'EXPIRED' } })
        await releaseOrderReservation(tx, p.orderId, 'انتهاء صلاحية الدفع')
        await addStatusHistory(tx, p.orderId, p.order.status, 'CANCELLED', undefined, 'انتهاء صلاحية الدفع')
        await tx.order.update({
          where: { id: p.orderId },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'انتهاء صلاحية الدفع' },
        })
        await addEvent(tx, p.orderId, 'ORDER_EXPIRED', { reason: 'لم يتم الدفع خلال المدة المحددة' })
      })
      const order = await db.order.findUnique({ where: { id: p.orderId }, include: { customer: { include: { user: true } } } })
      if (order) {
        await notifyUser(db, {
          userId: order.customer.user.id,
          type: 'ORDER_EXPIRED',
          title: `انتهت صلاحية الطلب ${order.orderNumber}`,
          body: 'لم يتم تسجيل الدفع خلال المدة المحددة. يمكنك إعادة الطلب في أي وقت.',
          linkView: 'orders',
        })
      }
    } catch (e) {
      console.error('[EXPIRE SWEEP FAILED]', e)
    }
  }
}

// ---------- إنشاء الفاتورة عند الاعتماد (PLAN ق21) ----------
export async function ensureInvoice(orderId: string) {
  const existing = await db.invoice.findUnique({ where: { orderId } })
  if (existing) return existing
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: { include: { user: true } } },
  })
  if (!order) throw new ApiError('VALIDATION_ERROR', 'الطلب غير موجود', 404)

  return db.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx)
    return tx.invoice.create({
      data: {
        invoiceNumber,
        orderId,
        snapshotJson: JSON.stringify({
          storeName: 'متجر الأصيل',
          order: { orderNumber: order.orderNumber, trackingCode: order.trackingCode, paymentReference: order.paymentReference },
          customer: { name: order.customer.user.name, phone: order.customer.user.phone },
          items: order.items.map((i) => ({
            name: i.productName,
            attributes: JSON.parse(i.attributesJson ?? '{}'),
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
          totals: {
            itemsTotal: order.itemsTotal,
            shippingFee: order.shippingFee,
            couponCode: order.couponCode,
            grandTotal: order.grandTotal,
            paymentStatus: order.paymentStatus,
          },
          issuedAt: new Date().toISOString(),
        }),
        total: order.grandTotal,
      },
    })
  })
}

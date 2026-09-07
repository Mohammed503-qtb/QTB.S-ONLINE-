import { db } from '@/lib/db'
import { ApiError } from '@/lib/server/api'
import type { MovementType } from '@/lib/shared/constants'

// ============================================================
// محرك المخزون (PLAN ق22/23/63)
// قواعد صارمة:
// - لا رصيد سالب أبدًا
// - لا تعديل يدوي للرصيد دون حركة موثقة
// - كل تغيير يمر عبر recordMovement
// - Available = OnHand - Reserved
// ============================================================

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type Db = typeof db | Tx

/** تسجيل حركة مخزون + تحديث الرصيد ذريًا */
async function recordMovement(
  tx: Db,
  input: {
    variantId: string
    warehouseId: string
    quantityDelta: number // موجب = زيادة، سالب = نقص
    onHandDelta: number // تغيير on_hand (الحجز لا يغيره)
    reservedDelta: number // تغيير reserved
    movementType: MovementType
    refType?: string
    refId?: string
    refNumber?: string
    reason?: string
    userId?: string
  }
) {
  // قفل/قراءة الرصيد الحالي
  const balance = await tx.inventoryBalance.upsert({
    where: { variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId } },
    create: {
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      onHand: 0,
      reserved: 0,
    },
    update: {},
  })

  const newOnHand = balance.onHand + input.onHandDelta
  const newReserved = balance.reserved + input.reservedDelta

  // فحوصات الصلابة (PLAN ق54)
  if (newOnHand < 0) {
    throw new ApiError('OUT_OF_STOCK', 'لا يمكن تنفيذ العملية: الرصيد المتاح سيصبح سالبًا', 409)
  }
  if (newReserved < 0) {
    throw new ApiError('CONFLICT', 'لا يمكن تحرير محجوز أكثر من الموجود', 409)
  }
  if (newReserved > newOnHand) {
    throw new ApiError('OUT_OF_STOCK', 'الكمية المطلوبة غير متوفرة حاليًا', 409)
  }

  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { onHand: newOnHand, reserved: newReserved },
  })

  await tx.stockMovement.create({
    data: {
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      quantityDelta: input.quantityDelta,
      movementType: input.movementType,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      refNumber: input.refNumber ?? null,
      reason: input.reason ?? null,
      userId: input.userId ?? null,
      balanceAfter: newOnHand,
    },
  })

  return { onHand: newOnHand, reserved: newReserved, available: newOnHand - newReserved }
}

// ---------- حجز المخزون عند إنشاء الطلب (سياسة PLAN ق15) ----------
export async function reserveForOrder(
  tx: Db,
  input: { orderId: string; orderNumber: string; items: { variantId: string; quantity: number }[]; warehouseId: string; userId?: string }
) {
  // تجميع الكميات لكل variant (قد يتكرر الصنف)
  const byVariant = new Map<string, number>()
  for (const item of input.items) {
    byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.quantity)
  }

  for (const [variantId, quantity] of byVariant) {
    // فحص التوفر الكلي أولًا (رسالة أوضح)
    const balances = await tx.inventoryBalance.findMany({ where: { variantId } })
    const totalAvailable = balances.reduce((s, b) => s + (b.onHand - b.reserved), 0)
    if (totalAvailable < quantity) {
      throw new ApiError('OUT_OF_STOCK', 'عذرًا، الكمية المطلوبة نفدت أو غير متوفرة بالكمية الكافية', 409)
    }

    const result = await recordMovement(tx, {
      variantId,
      warehouseId: input.warehouseId,
      quantityDelta: 0,
      onHandDelta: 0,
      reservedDelta: quantity,
      movementType: 'ORDER_RESERVATION',
      refType: 'order',
      refId: input.orderId,
      refNumber: input.orderNumber,
      userId: input.userId,
    })

    await tx.stockReservation.create({
      data: {
        orderId: input.orderId,
        variantId,
        warehouseId: input.warehouseId,
        quantity,
        status: 'ACTIVE',
      },
    })
    void result
  }
}

// ---------- تحرير الحجز (إلغاء/انتهاء صلاحية) ----------
export async function releaseOrderReservation(tx: Db, orderId: string, reason?: string, userId?: string) {
  const reservations = await tx.stockReservation.findMany({
    where: { orderId, status: 'ACTIVE' },
  })
  const order = await tx.order.findUnique({ where: { id: orderId } })
  for (const r of reservations) {
    await recordMovement(tx, {
      variantId: r.variantId,
      warehouseId: r.warehouseId,
      quantityDelta: 0,
      onHandDelta: 0,
      reservedDelta: -r.quantity,
      movementType: 'ORDER_RELEASE',
      refType: 'order',
      refId: orderId,
      refNumber: order?.orderNumber ?? undefined,
      reason: reason ?? 'إلغاء الطلب',
      userId,
    })
    await tx.stockReservation.update({
      where: { id: r.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })
  }
}

// ---------- تحويل الحجز إلى بيع نهائي (عند التسليم/الاكتمال) ----------
export async function convertReservationToSale(tx: Db, orderId: string, userId?: string) {
  const reservations = await tx.stockReservation.findMany({
    where: { orderId, status: 'ACTIVE' },
  })
  const order = await tx.order.findUnique({ where: { id: orderId } })
  for (const r of reservations) {
    await recordMovement(tx, {
      variantId: r.variantId,
      warehouseId: r.warehouseId,
      quantityDelta: -r.quantity,
      onHandDelta: -r.quantity,
      reservedDelta: -r.quantity,
      movementType: 'SALE',
      refType: 'order',
      refId: orderId,
      refNumber: order?.orderNumber ?? undefined,
      userId,
    })
    await tx.stockReservation.update({
      where: { id: r.id },
      data: { status: 'CONVERTED', releasedAt: new Date() },
    })
  }
}

// ---------- استلام مشتريات (زيادة المخزون) ----------
export async function receiveStock(
  tx: Db,
  input: { variantId: string; warehouseId: string; quantity: number; refType: string; refId: string; refNumber?: string; unitCost?: number; userId?: string }
) {
  return recordMovement(tx, {
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    quantityDelta: input.quantity,
    onHandDelta: input.quantity,
    reservedDelta: 0,
    movementType: 'PURCHASE_RECEIPT',
    refType: input.refType,
    refId: input.refId,
    refNumber: input.refNumber,
    userId: input.userId,
    reason: input.unitCost ? `تكلفة الوحدة: ${input.unitCost}` : undefined,
  })
}

// ---------- إرجاع مخزون (مرتجع معتمد للاعادة للبيع) ----------
export async function returnStock(
  tx: Db,
  input: { variantId: string; warehouseId: string; quantity: number; refType: string; refId: string; refNumber?: string; reason?: string; userId?: string }
) {
  return recordMovement(tx, {
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    quantityDelta: input.quantity,
    onHandDelta: input.quantity,
    reservedDelta: 0,
    movementType: 'RETURN',
    refType: input.refType,
    refId: input.refId,
    refNumber: input.refNumber,
    reason: input.reason,
    userId: input.userId,
  })
}

// ---------- تالف ----------
export async function damageStock(
  tx: Db,
  input: { variantId: string; warehouseId: string; quantity: number; reason: string; userId?: string }
) {
  return recordMovement(tx, {
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    quantityDelta: -input.quantity,
    onHandDelta: -input.quantity,
    reservedDelta: 0,
    movementType: 'DAMAGE',
    refType: 'manual',
    reason: input.reason,
    userId: input.userId,
  })
}

// ---------- تسوية جرد ----------
export async function adjustStock(
  tx: Db,
  input: { variantId: string; warehouseId: string; newOnHand: number; reason: string; userId?: string }
) {
  const balance = await tx.inventoryBalance.findUnique({
    where: { variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId } },
  })
  const current = balance?.onHand ?? 0
  const delta = input.newOnHand - current
  if (delta === 0) throw new ApiError('VALIDATION_ERROR', 'لا يوجد فرق عن الرصيد الحالي')
  const newReserved = balance?.reserved ?? 0
  if (input.newOnHand < newReserved) {
    throw new ApiError('CONFLICT', 'لا يمكن أن يقل الرصيد عن الكمية المحجوزة', 409)
  }
  return recordMovement(tx, {
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    quantityDelta: delta,
    onHandDelta: delta,
    reservedDelta: 0,
    movementType: 'ADJUSTMENT',
    refType: 'manual',
    reason: input.reason,
    userId: input.userId,
  })
}

// ---------- نقل بين مخازن ----------
export async function transferStock(
  tx: Db,
  input: { variantId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; reason?: string; userId?: string }
) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new ApiError('VALIDATION_ERROR', 'لا يمكن النقل إلى نفس المخزن')
  }
  // خرج
  await recordMovement(tx, {
    variantId: input.variantId,
    warehouseId: input.fromWarehouseId,
    quantityDelta: -input.quantity,
    onHandDelta: -input.quantity,
    reservedDelta: 0,
    movementType: 'TRANSFER_OUT',
    refType: 'transfer',
    reason: input.reason,
    userId: input.userId,
  })
  // دخول
  await recordMovement(tx, {
    variantId: input.variantId,
    warehouseId: input.toWarehouseId,
    quantityDelta: input.quantity,
    onHandDelta: input.quantity,
    reservedDelta: 0,
    movementType: 'TRANSFER_IN',
    refType: 'transfer',
    reason: input.reason,
    userId: input.userId,
  })
}

// ---------- قراءة التوفر لقائمة variants ----------
export async function getAvailability(variantIds: string[], warehouseId?: string) {
  const balances = await db.inventoryBalance.findMany({
    where: { variantId: { in: variantIds }, ...(warehouseId ? { warehouseId } : {}) },
  })
  const map: Record<string, { onHand: number; reserved: number; available: number }> = {}
  for (const b of balances) {
    const cur = map[b.variantId] ?? { onHand: 0, reserved: 0, available: 0 }
    cur.onHand += b.onHand
    cur.reserved += b.reserved
    cur.available += b.onHand - b.reserved
    map[b.variantId] = cur
  }
  for (const id of variantIds) {
    if (!map[id]) map[id] = { onHand: 0, reserved: 0, available: 0 }
  }
  return map
}

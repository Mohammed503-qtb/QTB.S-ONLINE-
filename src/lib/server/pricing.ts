import { db } from '@/lib/db'
import { ApiError } from '@/lib/server/api'
import { getNumberSetting, getFlag } from '@/lib/server/flags'

// ============================================================
// محرك التسعير الموحد (PLAN ق10/59)
// الخادم هو مصدر الحقيقة: يعيد قراءة الأسعار ويحسب الخصومات
// والشحن والإجمالي — العميل لا يرسل الأسعار أبدًا (ق1.6)
// ============================================================

export type QuoteItemInput = { variantId: string; quantity: number }

export type QuoteLine = {
  productId: string
  variantId: string
  productName: string
  attributes: Record<string, string>
  imageUrl?: string | null
  unitPrice: number // السعر بعد خصم النسبة
  comparePrice?: number | null
  discountPercent: number
  quantity: number
  lineTotal: number
  costPrice: number // للـ COGS (لا يظهر للعميل)
  active: boolean
  available: number
}

export type QuoteResult = {
  items: QuoteLine[]
  itemsTotal: number
  discountTotal: number // مجموع الخصم عن الأسعار الأصلية
  couponCode?: string
  couponDiscount: number
  shippingFee: number
  grandTotal: number
  currency: string
  warnings: string[]
}

function lineDiscount(base: number, discountPercent: number) {
  if (discountPercent <= 0) return 0
  return Math.round((base * discountPercent) / 100)
}

/** حساب الشحن حسب المنطقة (PLAN ق13) */
export async function calcShipping(governorate: string, methodCode: string): Promise<number> {
  if (methodCode === 'PICKUP') return 0
  const zone = await db.shippingZone.findFirst({
    where: { governorate, active: true },
    orderBy: [{ city: 'asc' }],
  })
  if (!zone) {
    throw new ApiError('VALIDATION_ERROR', `الشحن غير متاح حاليًا إلى محافظة ${governorate}`)
  }
  let fee = zone.fee
  const method = await db.shippingMethod.findUnique({ where: { code: methodCode } })
  if (method && method.baseFee > 0) fee = Math.max(fee, method.baseFee)
  if (methodCode === 'COD') {
    const extra = await getNumberSetting('cod_fee_extra', 0)
    fee += extra
  }
  return fee
}

/** التحقق من الكوبون وحساب خصمه (الخادم فقط — PLAN ق41) */
export async function evaluateCoupon(code: string, itemsTotal: number, customerId: string, lines: QuoteLine[]) {
  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } })
  if (!coupon || !coupon.active) throw new ApiError('VALIDATION_ERROR', 'كود الخصم غير صحيح أو غير مفعل')

  const now = new Date()
  if (coupon.startsAt > now) throw new ApiError('VALIDATION_ERROR', 'هذا الكوبون لم يبدأ بعد')
  if (coupon.endsAt && coupon.endsAt < now) throw new ApiError('VALIDATION_ERROR', 'انتهت صلاحية هذا الكوبون')
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError('VALIDATION_ERROR', 'تم استهلاك هذا الكوبون بالكامل')
  }
  if (itemsTotal < coupon.minCart) {
    throw new ApiError('VALIDATION_ERROR', `الحد الأدنى للسلة لاستخدام هذا الكوبون: ${coupon.minCart}`)
  }

  // حد الاستخدام لكل عميل
  if (coupon.perCustomerLimit > 0) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, customerId } })
    if (used >= coupon.perCustomerLimit) {
      throw new ApiError('VALIDATION_ERROR', 'لقد استخدمت هذا الكوبون من قبل')
    }
  }

  // نطاق التطبيق
  let eligibleTotal = itemsTotal
  if (coupon.appliesTo === 'PRODUCTS' || coupon.appliesTo === 'CATEGORIES') {
    const targets: string[] = JSON.parse(coupon.targetsJson ?? '[]')
    if (coupon.appliesTo === 'PRODUCTS') {
      eligibleTotal = lines.filter((l) => targets.includes(l.productId)).reduce((s, l) => s + l.lineTotal, 0)
    } else {
      const prods = await db.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
        select: { id: true, categoryId: true },
      })
      const catMap = new Map(prods.map((p) => [p.id, p.categoryId]))
      eligibleTotal = lines.filter((l) => targets.includes(catMap.get(l.productId) ?? '')).reduce((s, l) => s + l.lineTotal, 0)
    }
    if (eligibleTotal === 0) throw new ApiError('VALIDATION_ERROR', 'الكوبون لا ينطبق على منتجات السلة')
  }

  let discount = coupon.type === 'PERCENT' ? Math.round((eligibleTotal * coupon.value) / 100) : Math.min(coupon.value, eligibleTotal)
  if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) discount = coupon.maxDiscount

  return { coupon, discount }
}

/** محرك التسعير: يعيد بناء السلة من الخادم ويتحقق من كل شيء */
export async function quote(input: {
  items: QuoteItemInput[]
  governorate?: string
  shippingMethodCode?: string
  couponCode?: string
  customerId?: string
}): Promise<QuoteResult> {
  const warnings: string[] = []
  if (input.items.length === 0) throw new ApiError('VALIDATION_ERROR', 'السلة فارغة')

  const variantIds = [...new Set(input.items.map((i) => i.variantId))]
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  })
  const variantMap = new Map(variants.map((v) => [v.id, v]))

  // التوفر
  const { getAvailability } = await import('@/lib/server/inventory')
  const availability = await getAvailability(variantIds)

  const lines: QuoteLine[] = []
  for (const item of input.items) {
    const v = variantMap.get(item.variantId)
    if (!v) throw new ApiError('VALIDATION_ERROR', 'منتج في السلة لم يعد موجودًا')
    if (item.quantity < 1) throw new ApiError('VALIDATION_ERROR', 'كمية غير صحيحة')
    const productActive = v.product.status === 'ACTIVE' && v.active

    const base = v.priceOverride ?? v.product.basePrice
    const compare = v.product.compareAtPrice ?? null
    const discountPercent = v.discountPercent
    const unitPrice = base - lineDiscount(base, discountPercent)
    const lineTotal = unitPrice * item.quantity

    const avail = availability[item.variantId]?.available ?? 0
    if (!productActive) {
      warnings.push(`المنتج "${v.product.name}" غير متاح حاليًا — يجب إزالته من السلة`)
    } else if (avail < item.quantity) {
      warnings.push(
        avail === 0
          ? `نفدت الكمية من "${v.product.name}"`
          : `المتاح من "${v.product.name}" حاليًا ${avail} فقط`
      )
      if (avail < item.quantity) {
        throw new ApiError('OUT_OF_STOCK', `الكمية المطلوبة من "${v.product.name}" غير متوفرة — المتاح: ${Math.max(avail, 0)}`, 409)
      }
    }

    lines.push({
      productId: v.productId,
      variantId: v.id,
      productName: v.product.name,
      attributes: JSON.parse(v.attributesJson ?? '{}'),
      imageUrl: v.imageUrl ?? null,
      unitPrice,
      comparePrice: compare && compare > base ? compare : null,
      discountPercent,
      quantity: item.quantity,
      lineTotal,
      costPrice: v.costOverride ?? v.product.costPrice ?? 0,
      active: productActive,
      available: avail,
    })
  }

  const itemsTotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const discountTotal = lines.reduce((s, l) => s + (l.comparePrice ? (l.comparePrice - l.unitPrice) * l.quantity : 0), 0)

  // الحد الأدنى للطلب
  const minOrder = await getNumberSetting('min_order_total', 0)
  if (minOrder > 0 && itemsTotal < minOrder) {
    throw new ApiError('VALIDATION_ERROR', `الحد الأدنى لإجمالي الطلب هو ${minOrder}`)
  }

  // الشحن
  let shippingFee = 0
  if (input.governorate && input.shippingMethodCode) {
    shippingFee = await calcShipping(input.governorate, input.shippingMethodCode)
  }

  // الكوبون
  let couponDiscount = 0
  let couponCode: string | undefined
  if (input.couponCode && input.customerId) {
    const flags = await getFlag('coupons_enabled')
    if (flags) {
      const { coupon, discount } = await evaluateCoupon(input.couponCode, itemsTotal, input.customerId, lines)
      couponDiscount = discount
      couponCode = coupon.code
    }
  }

  const grandTotal = Math.max(0, itemsTotal - couponDiscount + shippingFee)

  return {
    items: lines,
    itemsTotal,
    discountTotal,
    couponCode,
    couponDiscount,
    shippingFee,
    grandTotal,
    currency: 'YER',
    warnings,
  }
}

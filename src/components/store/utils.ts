// ============================================================
// أدوات مساعدة لواجهة العميل — حسابات العرض وتسميات الأحداث
// ============================================================

import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/shared/constants'

/** الخصم المطبق على سعر أساسي (عدد صحيح) */
export function applyDiscount(base: number, discountPercent: number | null | undefined): number {
  const d = discountPercent ?? 0
  if (d <= 0) return base
  return base - Math.floor((base * d) / 100)
}

type PriceSource = {
  basePrice: number
  compareAtPrice?: number | null
  variants?: { priceOverride?: number | null; discountPercent?: number | null }[]
}

/** حساب سعر البطاقة: أرخص متغير متاح + خصمه */
export function cardPrice(p: PriceSource): { price: number; compareAt?: number; discountPercent: number } {
  let price = p.basePrice
  let bestDiscount = 0
  const variants = p.variants ?? []
  if (variants.length > 0) {
    let best = Number.POSITIVE_INFINITY
    for (const v of variants) {
      const base = v.priceOverride ?? p.basePrice
      const eff = applyDiscount(base, v.discountPercent)
      if (eff < best) {
        best = eff
        price = eff
        bestDiscount = v.discountPercent ?? 0
      }
    }
  }
  const compareAt = p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : undefined
  return { price, compareAt, discountPercent: bestDiscount }
}

/** تحويل مرن لأي شكل منتج إلى شكل بطاقة موحد */
export type CardProductSource = {
  id: string
  name: string
  basePrice: number
  compareAtPrice?: number | null
  imageUrl?: string | null
  variants?: { priceOverride?: number | null; discountPercent?: number | null }[]
  available?: number
}

export function asCardProduct(p: CardProductSource): { id: string; name: string; basePrice: number; compareAtPrice: number | null; imageUrl: string | null; variants?: { priceOverride?: number | null; discountPercent?: number | null }[]; available?: number } {
  return {
    id: p.id,
    name: p.name,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice ?? null,
    imageUrl: p.imageUrl ?? null,
    variants: p.variants,
    available: p.available,
  }
}

// ---------- تسميات أحداث الخط الزمني ----------
const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'تم إنشاء الطلب',
  PAYMENT_METHOD_COD: 'طريقة الدفع: الدفع عند الاستلام',
  ORDER_EXPIRED: 'انتهت صلاحية الطلب لعدم الدفع',
  PAYMENT_SUBMITTED: 'تم تسجيل بيانات التحويل',
  PAYMENT_VERIFIED: 'تم اعتماد الدفع',
  PAYMENT_REJECTED: 'تم رفض الدفع',
  PAYMENT_CLARIFICATION: 'طلبت الإدارة إيضاحًا حول الدفع',
  RETURN_REQUESTED: 'تم طلب إرجاع',
  RETURN_REJECTED: 'تم رفض الإرجاع',
  RETURN_COMPLETED: 'اكتمل الإرجاع',
  ORDER_CANCELLED: 'تم إلغاء الطلب',
}

/** تسمية عربية لحدث في الخط الزمني (ORDER_<STATUS> تُترجم تلقائيًا) */
export function eventLabel(type: string): string {
  if (EVENT_LABELS[type]) return EVENT_LABELS[type]
  if (type.startsWith('ORDER_')) {
    const status = type.slice('ORDER_'.length)
    return ORDER_STATUS_LABELS[status as OrderStatus] ?? status
  }
  return type
}

/** تسمية فئة العميل */
export function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    NEW: 'عميل جديد',
    REGULAR: 'عميل دائم',
    VIP: 'عميل مميز VIP',
    INACTIVE: 'غير نشط',
    BLOCKED: 'محظور',
  }
  return map[tier] ?? tier
}

/** تسمية فئة تذكرة الدعم */
export function ticketCategoryLabel(c: string): string {
  const map: Record<string, string> = {
    ORDER: 'طلب',
    PAYMENT: 'دفع',
    RETURN: 'إرجاع',
    SHIPPING: 'شحن وتوصيل',
    OTHER: 'أخرى',
  }
  return map[c] ?? c
}

/** تسمية طريقة الشحن حسب الكود */
export function shippingMethodLabel(code: string): string {
  const map: Record<string, string> = {
    HOME_DELIVERY: 'توصيل للمنزل',
    PICKUP: 'استلام من الفرع',
    COURIER: 'شحن سريع',
  }
  return map[code] ?? code
}

/** تسمية طريقة الدفع */
export function paymentMethodLabel(code: string): string {
  return code === 'COD' ? 'الدفع عند الاستلام' : 'تحويل بنكي / محفظة'
}

/** بناء نص رسالة واتساب بسيط */
export function waOrderMessage(orderNumber: string, extra?: string): string {
  return `مرحبًا، بخصوص طلبي رقم ${orderNumber}${extra ? ` — ${extra}` : ''}`
}

/** تنسيق معلومات حساب الدفع لعرضها/نسخها */
export function accountSummary(acc: {
  type?: string | null
  name?: string | null
  institution?: string | null
  beneficiary?: string | null
  accountNumber?: string | null
  iban?: string | null
  walletNumber?: string | null
  phone?: string | null
  branch?: string | null
}): string {
  const parts: string[] = []
  if (acc.institution) parts.push(acc.institution)
  if (acc.branch) parts.push(`فرع ${acc.branch}`)
  if (acc.beneficiary) parts.push(`المستفيد: ${acc.beneficiary}`)
  if (acc.accountNumber) parts.push(`رقم الحساب: ${acc.accountNumber}`)
  if (acc.iban) parts.push(`IBAN: ${acc.iban}`)
  if (acc.walletNumber) parts.push(`رقم المحفظة: ${acc.walletNumber}`)
  if (acc.phone) parts.push(`رقم الهاتف: ${acc.phone}`)
  return parts.join(' · ')
}

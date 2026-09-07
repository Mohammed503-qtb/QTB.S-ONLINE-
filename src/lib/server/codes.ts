import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

// ============================================================
// مولد المعرفات المتسلسلة (PLAN ق16/ق73)
// ORD-20260906-000001 | PAY-XXXXXX | TRK-XXXXXX | INV-XXXXXX
// RET-XXXXXX | REF-XXXXXX | PUR-XXXXXX | BTX-XXXXXX | TKT-XXXXXX | EXP-XXXXXX
// كل الدوال تقبل معامل المعاملة (tx) لضمان الذرية ومنع التكرار
// ============================================================

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type Db = typeof db | Tx

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // بدون أحرف ملتبسة

function randomCode(len: number) {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

async function nextCounter(tx: Db, key: string): Promise<number> {
  const row = await tx.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  })
  return row.value
}

/** رقم الطلب: ORD-YYYYMMDD-NNNNNN (تسلسل يومي) */
export async function nextOrderNumber(tx: Db = db): Promise<string> {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const seq = await nextCounter(tx, `order:${y}${m}${d}`)
  return `ORD-${y}${m}${d}-${String(seq).padStart(6, '0')}`
}

/** كود الدفع: PAY-XXXXXX */
export async function nextPaymentNumber(tx: Db = db): Promise<string> {
  return `PAY-${randomCode(6)}`
}

/** كود التتبع: TRK-XXXXXX */
export async function nextTrackingCode(tx: Db = db): Promise<string> {
  return `TRK-${randomCode(6)}`
}

/** رقم الفاتورة: INV-XXXXXX */
export async function nextInvoiceNumber(tx: Db = db): Promise<string> {
  return `INV-${randomCode(6)}`
}

/** رقم الإرجاع: RET-XXXXXX */
export async function nextReturnNumber(tx: Db = db): Promise<string> {
  return `RET-${randomCode(6)}`
}

/** رقم الاسترداد: REF-XXXXXX */
export async function nextRefundNumber(tx: Db = db): Promise<string> {
  return `REF-${randomCode(6)}`
}

/** رقم الشراء: PUR-XXXXXX */
export async function nextPurchaseNumber(tx: Db = db): Promise<string> {
  return `PUR-${randomCode(6)}`
}

/** رقم الحركة البنكية: BTX-XXXXXX */
export async function nextBankTxnNumber(tx: Db = db): Promise<string> {
  return `BTX-${randomCode(6)}`
}

/** رقم التذكرة: TKT-XXXXXX */
export async function nextTicketNumber(tx: Db = db): Promise<string> {
  return `TKT-${randomCode(6)}`
}

/** رقم المصروف: EXP-XXXXXX */
export async function nextExpenseNumber(tx: Db = db): Promise<string> {
  return `EXP-${randomCode(6)}`
}

/** رقم الشحنة: SHP-XXXXXX */
export async function nextShipmentNumber(tx: Db = db): Promise<string> {
  return `SHP-${randomCode(6)}`
}

import { db } from '@/lib/db'
import { nextBankTxnNumber } from '@/lib/server/codes'
import { writeAudit } from '@/lib/server/audit'
import type { SessionUser } from '@/lib/server/auth'

// ============================================================
// محرك المحاسبة التشغيلية (PLAN ق32/33/55)
// سياسة معتمدة (worklog Task 0):
// - Revenue + BankTransaction(IN) عند VERIFY الدفع
// - COGS عبر حركة SALE عند تحويل الحجز إلى بيع (التسليم)
// - Refund → BankTransaction(OUT)
// كل حركة لها رقم مرجعي BTX-XXXXXX (ق1.3)
// ============================================================

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type Db = typeof db | Tx

export async function postBankTransaction(
  tx: Db,
  input: {
    bankAccountId: string
    direction: 'IN' | 'OUT'
    amount: number
    txnType: string
    refType?: string
    refId?: string
    refNumber?: string
    description?: string
    date?: Date
  }
) {
  if (input.amount <= 0) throw new Error('مبلغ الحركة البنكية يجب أن يكون موجبًا')
  const account = await tx.bankAccount.findUnique({ where: { id: input.bankAccountId } })
  if (!account) throw new Error('الحساب البنكي غير موجود')
  if (!account.active) throw new Error('الحساب البنكي معطل')

  const txnNumber = await nextBankTxnNumber(tx)
  const txn = await tx.bankTransaction.create({
    data: {
      txnNumber,
      bankAccountId: input.bankAccountId,
      direction: input.direction,
      amount: input.amount,
      txnType: input.txnType,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      refNumber: input.refNumber ?? null,
      description: input.description ?? '',
      date: input.date ?? new Date(),
    },
  })

  // الرصيد يُشتق من الحركات (PLAN ق93) لكن نحفظ snapshot للأداء
  const delta = input.direction === 'IN' ? input.amount : -input.amount
  await tx.bankAccount.update({
    where: { id: input.bankAccountId },
    data: { currentBalance: { increment: delta } },
  })

  return txn
}

/** تسجيل مصروف (يخصم من بنك أو نقدًا) */
export async function recordExpense(
  input: {
    category: string
    description: string
    amount: number
    bankAccountId?: string | null
    date?: Date
    receiptUrl?: string
  },
  actor?: SessionUser
) {
  const { nextExpenseNumber } = await import('@/lib/server/codes')
  return db.$transaction(async (tx) => {
    const expenseNumber = await nextExpenseNumber()
    const expense = await tx.expense.create({
      data: {
        expenseNumber,
        category: input.category,
        description: input.description,
        amount: input.amount,
        bankAccountId: input.bankAccountId ?? null,
        date: input.date ?? new Date(),
        receiptUrl: input.receiptUrl ?? null,
        createdById: actor?.id ?? null,
      },
    })
    if (input.bankAccountId) {
      await postBankTransaction(tx, {
        bankAccountId: input.bankAccountId,
        direction: 'OUT',
        amount: input.amount,
        txnType: 'EXPENSE',
        refType: 'expense',
        refId: expense.id,
        refNumber: expenseNumber,
        description: `مصروف: ${input.description}`,
        date: input.date,
      })
    }
    await writeAudit({
      actor,
      action: 'expense.create',
      entityType: 'expense',
      entityId: expense.id,
      newValues: { category: input.category, amount: input.amount, description: input.description },
    })
    return expense
  }, { timeout: 30_000, maxWait: 10_000 })
}

/** دفعة مورد */
export async function paySupplier(
  input: { supplierId: string; purchaseId?: string; bankAccountId?: string | null; amount: number; method: string; reference?: string; note?: string },
  actor?: SessionUser
) {
  return db.$transaction(async (tx) => {
    const payment = await tx.supplierPayment.create({
      data: {
        supplierId: input.supplierId,
        purchaseId: input.purchaseId ?? null,
        bankAccountId: input.bankAccountId ?? null,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        note: input.note ?? null,
        createdById: actor?.id ?? null,
      },
    })
    // التزام المورد ينقص
    await tx.supplier.update({
      where: { id: input.supplierId },
      data: { balance: { decrement: input.amount } },
    })
    if (input.purchaseId) {
      const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId } })
      if (purchase) {
        const newPaid = purchase.paid + input.amount
        await tx.purchase.update({
          where: { id: input.purchaseId },
          data: {
            paid: newPaid,
            status: newPaid >= purchase.total ? 'PAID' : 'PARTIALLY_PAID',
          },
        })
      }
    }
    if (input.bankAccountId) {
      await postBankTransaction(tx, {
        bankAccountId: input.bankAccountId,
        direction: 'OUT',
        amount: input.amount,
        txnType: 'SUPPLIER_PAYMENT',
        refType: 'supplier_payment',
        refId: payment.id,
        description: `دفعة مورد`,
        date: payment.date,
      })
    }
    await writeAudit({
      actor,
      action: 'supplier.payment',
      entityType: 'supplier',
      entityId: input.supplierId,
      newValues: { amount: input.amount, method: input.method, purchaseId: input.purchaseId },
    })
    return payment
  }, { timeout: 30_000, maxWait: 10_000 })
}

/** تحصيل COD عند التسليم */
export async function recordCodCollection(
  tx: Db,
  input: { orderId: string; orderNumber: string; amount: number; bankAccountId: string }
) {
  return postBankTransaction(tx, {
    bankAccountId: input.bankAccountId,
    direction: 'IN',
    amount: input.amount,
    txnType: 'COD_COLLECTION',
    refType: 'order',
    refId: input.orderId,
    refNumber: input.orderNumber,
    description: `تحصيل دفع عند الاستلام — ${input.orderNumber}`,
  })
}

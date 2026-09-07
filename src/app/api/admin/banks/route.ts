import { z } from 'zod'
import { ok, handleRouteError, parseBody, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { postBankTransaction } from '@/lib/server/accounting'
import { writeAudit } from '@/lib/server/audit'

const querySchema = z.object({
  accountId: z.string().optional(),
  txnType: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
})

// الحسابات البنكية + الحركات (PLAN ق27/32)
export async function GET(req: Request) {
  try {
    await requirePermission('accounting.view')
    const q = parseQuery(req, querySchema)

    const accounts = await db.bankAccount.findMany({
      include: { _count: { select: { transactions: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const where: Record<string, unknown> = {}
    if (q.accountId) where.bankAccountId = q.accountId
    if (q.txnType) where.txnType = q.txnType

    const [total, transactions, typeTotals] = await Promise.all([
      db.bankTransaction.count({ where }),
      db.bankTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { bankAccount: { select: { name: true, institution: true } } },
      }),
      db.bankTransaction.groupBy({
        by: ['txnType', 'direction'],
        _sum: { amount: true },
      }),
    ])

    return ok({
      accounts,
      transactions,
      total, page: q.page, pages: Math.ceil(total / q.limit),
      typeTotals: typeTotals.map((t) => ({ type: t.txnType, direction: t.direction, total: t._sum.amount ?? 0 })),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

const createAccountSchema = z.object({
  action: z.literal('create_account'),
  name: z.string().min(2, 'اسم الحساب مطلوب').max(60),
  institution: z.string().min(2, 'اسم الجهة مطلوب').max(60),
  type: z.enum(['BANK', 'WALLET', 'CASH']).default('BANK'),
  accountNumber: z.string().min(2).max(40),
  beneficiary: z.string().min(2).max(80),
  openingBalance: z.number().int().default(0),
  active: z.boolean().default(true),
})

const createTxnSchema = z.object({
  action: z.literal('create_transaction'),
  bankAccountId: z.string().min(1),
  direction: z.enum(['IN', 'OUT']),
  amount: z.number().int().min(1, 'المبلغ مطلوب'),
  txnType: z.enum(['TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'FEE', 'EXPENSE']),
  description: z.string().min(2, 'الوصف مطلوب').max(200),
  date: z.string().optional(),
})

const updateAccountSchema = z.object({
  action: z.literal('update_account'),
  id: z.string().min(1),
  name: z.string().min(2).max(60).optional(),
  accountNumber: z.string().max(40).optional(),
  active: z.boolean().optional(),
})

const schema = z.union([createAccountSchema, createTxnSchema, updateAccountSchema])

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('bank.manage')
    const body = await parseBody(req, schema)

    if (body.action === 'create_account') {
      const account = await db.bankAccount.create({
        data: {
          name: body.name, institution: body.institution, type: body.type,
          accountNumber: body.accountNumber, beneficiary: body.beneficiary,
          openingBalance: body.openingBalance, currentBalance: body.openingBalance, active: body.active,
        },
      })
      // رصيد افتتاحي كحركة موثقة (PLAN ق93 — الرصيد يُشتق من الحركات)
      if (body.openingBalance > 0) {
        await db.$transaction((tx) => postBankTransaction(tx, {
          bankAccountId: account.id, direction: 'IN', amount: body.openingBalance,
          txnType: 'OPENING', refType: 'account', refId: account.id,
          description: 'رصيد افتتاحي',
        }))
      }
      await writeAudit({ actor, action: 'bank.account.create', entityType: 'bank_account', entityId: account.id, newValues: { name: body.name, openingBalance: body.openingBalance } })
      return ok(account)
    }

    if (body.action === 'create_transaction') {
      const txn = await db.$transaction((tx) => postBankTransaction(tx, {
        bankAccountId: body.bankAccountId, direction: body.direction, amount: body.amount,
        txnType: body.txnType, refType: 'manual',
        description: body.description, date: body.date ? new Date(body.date) : undefined,
      }))
      await writeAudit({ actor, action: 'bank.transaction.create', entityType: 'bank_transaction', entityId: txn.id, newValues: { amount: body.amount, type: body.txnType, description: body.description } })
      return ok(txn)
    }

    const { id, ...data } = body
    const account = await db.bankAccount.update({ where: { id }, data })
    await writeAudit({ actor, action: 'bank.account.update', entityType: 'bank_account', entityId: id, newValues: data })
    return ok(account)
  } catch (e) {
    return handleRouteError(e)
  }
}

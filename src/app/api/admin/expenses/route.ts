import { z } from 'zod'
import { ok, handleRouteError, parseBody, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { recordExpense } from '@/lib/server/accounting'
import { EXPENSE_CATEGORIES } from '@/lib/shared/constants'

const querySchema = z.object({
  category: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// المصروفات (PLAN ق34)
export async function GET(req: Request) {
  try {
    await requirePermission('expenses.view')
    const q = parseQuery(req, querySchema)

    const where: Record<string, unknown> = {}
    if (q.category) where.category = q.category
    if (q.from || q.to) {
      where.date = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      }
    }

    const [total, expenses, sum, byCategory, accounts] = await Promise.all([
      db.expense.count({ where }),
      db.expense.findMany({
        where, orderBy: { date: 'desc' },
        skip: (q.page - 1) * q.limit, take: q.limit,
      }),
      db.expense.aggregate({ _sum: { amount: true }, where }),
      db.expense.groupBy({ by: ['category'], _sum: { amount: true }, where }),
      db.bankAccount.findMany({ where: { active: true }, select: { id: true, name: true } }),
    ])

    return ok({
      total, page: q.page, pages: Math.ceil(total / q.limit),
      expenses, totalAmount: sum._sum.amount ?? 0,
      byCategory: byCategory.map((c) => ({ category: c.category, total: c._sum.amount ?? 0 })),
      accounts, categories: EXPENSE_CATEGORIES,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

const createSchema = z.object({
  category: z.string().min(2, 'اختر التصنيف').max(40),
  description: z.string().min(3, 'الوصف مطلوب').max(200),
  amount: z.number().int().min(1, 'المبلغ مطلوب'),
  bankAccountId: z.string().optional().nullable(), // null = نقدًا
  date: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('expenses.create')
    const body = await parseBody(req, createSchema)
    const expense = await recordExpense({
      category: body.category, description: body.description, amount: body.amount,
      bankAccountId: body.bankAccountId ?? null,
      date: body.date ? new Date(body.date) : undefined,
      receiptUrl: body.receiptUrl ?? undefined,
    }, actor)
    return ok(expense)
  } catch (e) {
    return handleRouteError(e)
  }
}

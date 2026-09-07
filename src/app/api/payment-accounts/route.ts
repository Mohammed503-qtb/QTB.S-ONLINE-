import { ok, handleRouteError } from '@/lib/server/api'
import { db } from '@/lib/db'
import { getFlag } from '@/lib/server/flags'

// حسابات الدفع المتاحة للعميل في Checkout (PLAN ق10/17)
export async function GET() {
  try {
    const [bankEnabled, codEnabled] = await Promise.all([
      getFlag('bank_transfer_enabled'),
      getFlag('cash_on_delivery_enabled'),
    ])

    const accounts = bankEnabled
      ? await db.paymentAccount.findMany({
          where: { active: true, displayToCustomers: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, type: true, name: true, institution: true, beneficiary: true,
            accountNumber: true, iban: true, walletNumber: true, phone: true,
            branch: true, instructions: true,
          },
        })
      : []

    return ok({
      accounts,
      codEnabled,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

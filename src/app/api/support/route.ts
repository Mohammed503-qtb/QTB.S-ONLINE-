import { z } from 'zod'
import { ok, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { nextTicketNumber } from '@/lib/server/codes'
import { notifyRole } from '@/lib/server/notifications'

const createSchema = z.object({
  orderId: z.string().optional(),
  category: z.enum(['ORDER', 'PAYMENT', 'RETURN', 'SHIPPING', 'OTHER']).default('OTHER'),
  subject: z.string().min(3, 'الموضوع مطلوب').max(120),
  message: z.string().min(3, 'نص الرسالة مطلوب').max(2000),
})

// GET: تذاكري
export async function GET() {
  try {
    const user = await requireUser()
    const tickets = await db.supportTicket.findMany({
      where: { customerId: user.customerId ?? '' },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    return ok(tickets)
  } catch (e) {
    return handleRouteError(e)
  }
}

// POST: فتح تذكرة دعم (PLAN ق43)
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (!user.customerId) {
      const { ApiError } = await import('@/lib/server/api')
      throw new ApiError('VALIDATION_ERROR', 'ملف العميل غير موجود')
    }
    const body = await parseBody(req, createSchema)

    const ticket = await db.$transaction(async (tx) => {
      const ticketNumber = await nextTicketNumber(tx)
      const t = await tx.supportTicket.create({
        data: {
          ticketNumber, customerId: user.customerId!, orderId: body.orderId ?? null,
          category: body.category, subject: body.subject, status: 'OPEN',
        },
      })
      await tx.supportMessage.create({
        data: { ticketId: t.id, senderType: 'CUSTOMER', senderId: user.id, senderName: user.name, body: body.message },
      })
      return t
    }, { timeout: 30_000, maxWait: 10_000 })

    await notifyRole({
      role: 'MANAGER', type: 'NEW_TICKET',
      title: 'تذكرة دعم جديدة',
      body: `${ticket.ticketNumber}: ${body.subject}`,
      linkView: 'admin-tickets',
      linkParam: ticket.id,
    })

    return ok({ id: ticket.id, ticketNumber: ticket.ticketNumber })
  } catch (e) {
    return handleRouteError(e)
  }
}

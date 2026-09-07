import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { notifyUser } from '@/lib/server/notifications'
import { TICKET_STATUSES } from '@/lib/shared/constants'

// تفاصيل التذكرة + الرد (الإدارة)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('support.manage')
    const { id } = await ctx.params
    const ticket = await db.supportTicket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
      include: {
        customer: { include: { user: { select: { name: true, phone: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!ticket) return fail('VALIDATION_ERROR', 'التذكرة غير موجودة', 404)
    return ok(ticket)
  } catch (e) {
    return handleRouteError(e)
  }
}

const replySchema = z.object({
  message: z.string().min(1).max(2000).optional(),
  status: z.enum(TICKET_STATUSES as never).optional(),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('support.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, replySchema)

    const ticket = await db.supportTicket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
      include: { customer: { include: { user: true } } },
    })
    if (!ticket) return fail('VALIDATION_ERROR', 'التذكرة غير موجودة', 404)
    if (!body.message && !body.status) return fail('VALIDATION_ERROR', 'لا يوجد إجراء', 400)

    if (body.message) {
      await db.supportMessage.create({
        data: { ticketId: ticket.id, senderType: 'STAFF', senderId: actor.id, senderName: actor.name, body: body.message },
      })
      await notifyUser(db, {
        userId: ticket.customer.user.id,
        type: 'TICKET_REPLY',
        title: `رد على تذكرتك ${ticket.ticketNumber}`,
        body: body.message.slice(0, 100),
        linkView: 'support',
        linkParam: ticket.id,
      })
    }

    const updated = await db.supportTicket.update({
      where: { id: ticket.id },
      data: {
        ...(body.status ? { status: body.status } : { status: 'WAITING_CUSTOMER' }),
        updatedAt: new Date(),
      },
    })
    return ok(updated)
  } catch (e) {
    return handleRouteError(e)
  }
}

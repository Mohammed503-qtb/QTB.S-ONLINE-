import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'

const replySchema = z.object({ message: z.string().min(1).max(2000) })

// GET: محادثة التذكرة
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const ticket = await db.supportTicket.findFirst({
      where: { id, customerId: user.customerId ?? '' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!ticket) return fail('VALIDATION_ERROR', 'التذكرة غير موجودة', 404)
    return ok(ticket)
  } catch (e) {
    return handleRouteError(e)
  }
}

// POST: رد العميل على التذكرة
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const { message } = await parseBody(req, replySchema)

    const ticket = await db.supportTicket.findFirst({ where: { id, customerId: user.customerId ?? '' } })
    if (!ticket) return fail('VALIDATION_ERROR', 'التذكرة غير موجودة', 404)
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      return fail('CONFLICT', 'التذكرة مغلقة — افتح تذكرة جديدة إن لزم', 409)
    }

    await db.supportMessage.create({
      data: { ticketId: id, senderType: 'CUSTOMER', senderId: user.id, senderName: user.name, body: message },
    })
    await db.supportTicket.update({ where: { id }, data: { status: 'IN_PROGRESS', updatedAt: new Date() } })

    return ok({ replied: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

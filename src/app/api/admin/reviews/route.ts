import { z } from 'zod'
import { ok, fail, handleRouteError, parseQuery, parseBody } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'

// إدارة التقييمات: موافقة/إخفاء (PLAN ق42)
export async function GET(req: Request) {
  try {
    await requirePermission('content.manage')
    const q = parseQuery(req, z.object({ status: z.string().optional() }))

    const where: Record<string, unknown> = {}
    if (q.status) where.status = q.status

    const reviews = await db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        customer: { include: { user: { select: { name: true } } } },
      },
    })
    return ok(reviews)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(req: Request) {
  try {
    const actor = await requirePermission('content.manage')
    const { id, status } = await parseBody(req, z.object({
      id: z.string().min(1),
      status: z.enum(['PENDING', 'APPROVED', 'HIDDEN']),
    }))

    const review = await db.review.update({ where: { id }, data: { status } })
    await writeAudit({ actor, action: `review.${status.toLowerCase()}`, entityType: 'review', entityId: id })
    return ok(review)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission('content.manage')
    const { id } = parseQuery(req, z.object({ id: z.string().min(1) }))
    await db.review.delete({ where: { id } })
    await writeAudit({ actor, action: 'review.delete', entityType: 'review', entityId: id })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

void fail

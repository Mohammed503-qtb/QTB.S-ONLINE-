import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'

const updateSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  governorate: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  district: z.string().optional(),
  neighborhood: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string().optional(),
  phone: z.string().regex(/^7\d{8}$/).optional(),
  notes: z.string().max(300).optional(),
  isDefault: z.boolean().optional(),
})

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const body = await parseBody(req, updateSchema)

    const addr = await db.customerAddress.findFirst({ where: { id, customerId: user.customerId ?? '' } })
    if (!addr) return fail('VALIDATION_ERROR', 'العنوان غير موجود', 404)

    if (body.isDefault) {
      await db.customerAddress.updateMany({ where: { customerId: user.customerId ?? '' }, data: { isDefault: false } })
    }

    const updated = await db.customerAddress.update({ where: { id }, data: body })
    return ok(updated)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const addr = await db.customerAddress.findFirst({ where: { id, customerId: user.customerId ?? '' } })
    if (!addr) return fail('VALIDATION_ERROR', 'العنوان غير موجود', 404)
    if (addr.isDefault) return fail('CONFLICT', 'لا يمكن حذف العنوان الافتراضي — اجعل عنوانًا آخر افتراضيًا أولًا', 409)

    await db.customerAddress.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

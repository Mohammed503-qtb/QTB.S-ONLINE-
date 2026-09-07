import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { db } from '@/lib/db'

const createSchema = z.object({
  label: z.string().min(1).max(40).default('عنوان'),
  governorate: z.string().min(2, 'اختر المحافظة'),
  city: z.string().min(2, 'المدينة مطلوبة'),
  district: z.string().optional().default(''),
  neighborhood: z.string().optional().default(''),
  street: z.string().optional().default(''),
  landmark: z.string().optional().default(''),
  phone: z.string().regex(/^7\d{8}$/, 'رقم هاتف يمني غير صحيح'),
  notes: z.string().max(300).optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  isDefault: z.boolean().optional(),
})

// GET: عناويني
export async function GET() {
  try {
    const user = await requireUser()
    const addresses = await db.customerAddress.findMany({
      where: { customerId: user.customerId ?? '' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return ok(addresses)
  } catch (e) {
    return handleRouteError(e)
  }
}

// POST: إضافة عنوان (PLAN ق8/12)
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (!user.customerId) return fail('VALIDATION_ERROR', 'ملف العميل غير موجود', 400)
    const body = await parseBody(req, createSchema)

    // أول عنوان يصبح افتراضيًا
    const count = await db.customerAddress.count({ where: { customerId: user.customerId } })
    const isDefault = body.isDefault ?? count === 0
    if (isDefault) {
      await db.customerAddress.updateMany({ where: { customerId: user.customerId }, data: { isDefault: false } })
    }

    const address = await db.customerAddress.create({
      data: { ...body, customerId: user.customerId, isDefault, latitude: body.latitude ?? null, longitude: body.longitude ?? null },
    })
    return ok(address)
  } catch (e) {
    return handleRouteError(e)
  }
}

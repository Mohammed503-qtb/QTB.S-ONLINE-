import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { verifyOtp, createSession, getCurrentUser } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { getFlag } from '@/lib/server/flags'
import { writeAudit } from '@/lib/server/audit'

const schema = z.object({
  phone: z.string().regex(/^7\d{8}$/),
  code: z.string().length(6, 'رمز التحقق 6 أرقام'),
  name: z.string().min(2, 'الاسم مطلوب للتسجيل الجديد').optional(),
})

// التحقق من OTP → إنشاء/استعادة الحساب + جلسة
export async function POST(req: Request) {
  try {
    const { phone, code, name } = await parseBody(req, schema)
    const valid = await verifyOtp(phone, code)
    if (!valid) return fail('VALIDATION_ERROR', 'رمز التحقق غير صحيح أو منتهي الصلاحية', 400)

    let user = await db.user.findUnique({ where: { phone } })
    let isNew = false

    if (!user) {
      // تسجيل جديد
      const registrationEnabled = await getFlag('registration_enabled')
      if (!registrationEnabled) return fail('PERMISSION_ERROR', 'التسجيل متوقف حاليًا', 403)
      if (!name) return fail('VALIDATION_ERROR', 'الاسم مطلوب للتسجيل الجديد', 400)
      user = await db.user.create({ data: { phone, name, role: 'CUSTOMER' } })
      await db.customer.create({ data: { userId: user.id } })
      isNew = true
    } else {
      if (user.status !== 'ACTIVE') {
        return fail('PERMISSION_ERROR', `حسابك ${user.status === 'SUSPENDED' ? 'موقوف مؤقتًا' : 'محظور'} — تواصل مع الدعم`, 403)
      }
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    }

    const ip = req.headers.get('x-forwarded-for') ?? undefined
    const deviceInfo = req.headers.get('user-agent') ?? undefined
    await createSession(user.id, deviceInfo, ip)
    await writeAudit({
      action: isNew ? 'auth.register' : 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ip,
      newValues: { phone, role: user.role },
    })

    const me = await getCurrentUser()
    return ok({ isNew, user: me })
  } catch (e) {
    return handleRouteError(e)
  }
}

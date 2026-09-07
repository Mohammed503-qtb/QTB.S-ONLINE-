import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { issueOtp } from '@/lib/server/auth'
import { getFlag } from '@/lib/server/flags'

const schema = z.object({
  phone: z.string().regex(/^7\d{8}$/, 'رقم الهاتف يجب أن يبدأ بـ 7 ويكون 9 أرقام (شبكات اليمن)'),
})

// طلب رمز تحقق OTP
export async function POST(req: Request) {
  try {
    const { phone } = await parseBody(req, schema)
    const registrationEnabled = await getFlag('registration_enabled')
    if (!registrationEnabled) {
      return fail('PERMISSION_ERROR', 'التسجيل متوقف مؤقتًا من إدارة المتجر', 403)
    }
    const code = await issueOtp(phone)
    // وضع التطوير: نعيد الكود لعدم وجود مزود SMS في البيئة
    return ok({ sent: true, devCode: code, note: 'وضع تجريبي: الكود يظهر هنا بدل رسالة SMS' })
  } catch (e) {
    return handleRouteError(e)
  }
}

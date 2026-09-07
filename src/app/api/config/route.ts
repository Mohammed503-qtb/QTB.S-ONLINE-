import { ok, handleRouteError } from '@/lib/server/api'
import { getPublicConfig } from '@/lib/server/flags'
import { expireStaleOrders } from '@/lib/server/orders'

// التهيئة العامة للعميل: Remote Config + حالة المتجر + الإصدار (PLAN ق5/6)
export async function GET() {
  try {
    // تنظيف الطلبات المنتهية صلاحيتها (خفيف — مرة كل 30 ثانية)
    await expireStaleOrders().catch(() => {})
    const config = await getPublicConfig()
    return ok(config)
  } catch (e) {
    return handleRouteError(e)
  }
}

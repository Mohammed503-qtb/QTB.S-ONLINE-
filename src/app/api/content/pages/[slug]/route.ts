import { ok, fail, handleRouteError } from '@/lib/server/api'
import { db } from '@/lib/db'

// صفحات المحتوى الثابت (سياسات/عن/أسئلة — PLAN ق40)
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params
    const page = await db.contentPage.findFirst({ where: { slug, published: true } })
    if (!page) return fail('VALIDATION_ERROR', 'الصفحة غير موجودة', 404)
    return ok(page)
  } catch (e) {
    return handleRouteError(e)
  }
}

import { ok, handleRouteError } from '@/lib/server/api'
import { db } from '@/lib/db'

// التصنيفات + الماركات النشطة
export async function GET() {
  try {
    const [categories, brands] = await Promise.all([
      db.category.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, slug: true, imageUrl: true },
      }),
      db.brand.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
    ])
    return ok({ categories, brands })
  } catch (e) {
    return handleRouteError(e)
  }
}

import { ok, handleRouteError } from '@/lib/server/api'
import { db } from '@/lib/db'
import { getFlags } from '@/lib/server/flags'

// الصفحة الرئيسية الديناميكية (PLAN ق40/65) — أقسام + بنرات + تصنيفات
export async function GET() {
  try {
    const flags = await getFlags()
    const [banners, sections, categories, methods, zones] = await Promise.all([
      db.banner.findMany({
        where: { active: true, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        orderBy: { sortOrder: 'asc' },
      }),
      db.homeSection.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.shippingMethod.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.shippingZone.findMany({ where: { active: true } }),
    ])

    // منتجات كل قسم
    const variantSelect = {
      id: true, attributesJson: true, priceOverride: true, discountPercent: true, imageUrl: true, active: true,
    }

    const productsFor = async (where: object, order: object, limit: number) =>
      db.product.findMany({
        where: { status: 'ACTIVE', ...where },
        orderBy: order,
        take: limit,
        select: {
          id: true, name: true, slug: true, basePrice: true, compareAtPrice: true, imageUrl: true,
          isFeatured: true, salesCount: true, categoryId: true,
          variants: { where: { active: true }, select: variantSelect, orderBy: { sortOrder: 'asc' } },
        },
      })

    const [featured, offers, newArrivals, bestSellers] = await Promise.all([
      productsFor({ isFeatured: true }, { sortOrder: 'asc' }, 8),
      productsFor({ compareAtPrice: { not: null } }, { updatedAt: 'desc' }, 8),
      productsFor({}, { createdAt: 'desc' }, 8),
      productsFor({ salesCount: { gt: 0 } }, { salesCount: 'desc' }, 8),
    ])

    return ok({
      flags,
      banners: flags['store_enabled'] !== false ? banners : [],
      sections,
      categories,
      shippingMethods: methods,
      shippingZones: zones,
      products: { FEATURED: featured, OFFERS: offers, NEW_ARRIVALS: newArrivals, BEST_SELLERS: bestSellers },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

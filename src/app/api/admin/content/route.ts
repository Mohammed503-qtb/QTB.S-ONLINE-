import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody, parseQuery } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server/audit'

const querySchema = z.object({ type: z.enum(['banners', 'sections', 'pages']).optional() })

// إدارة المحتوى الديناميكي (PLAN ق40/88) — بنرات وأقسام وصفحات
export async function GET(req: Request) {
  try {
    await requirePermission('content.manage')
    const { type } = parseQuery(req, querySchema)

    if (type === 'banners') return ok(await db.banner.findMany({ orderBy: { sortOrder: 'asc' } }))
    if (type === 'sections') return ok(await db.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }))
    if (type === 'pages') return ok(await db.contentPage.findMany({ orderBy: { sortOrder: 'asc' } }))

    const [banners, sections, pages] = await Promise.all([
      db.banner.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.contentPage.findMany({ orderBy: { sortOrder: 'asc' } }),
    ])
    return ok({ banners, sections, pages })
  } catch (e) {
    return handleRouteError(e)
  }
}

const bannerSchema = z.object({
  type: z.literal('banners'),
  id: z.string().optional(),
  title: z.string().max(80).optional().nullable(),
  subtitle: z.string().max(120).optional().nullable(),
  imageUrl: z.string().min(1, 'صورة البانر مطلوبة'),
  actionType: z.enum(['NONE', 'CATEGORY', 'PRODUCT', 'PAGE']).default('NONE'),
  target: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
})

const sectionSchema = z.object({
  type: z.literal('sections'),
  id: z.string().optional(),
  sectionType: z.enum(['BANNER', 'CATEGORIES', 'FEATURED', 'BEST_SELLERS', 'NEW_ARRIVALS', 'OFFERS', 'BRANDS', 'CUSTOM']),
  title: z.string().max(60).optional().nullable(),
  configJson: z.string().default('{}'),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
})

const pageSchema = z.object({
  type: z.literal('pages'),
  id: z.string().optional(),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(2).max(80),
  content: z.string().min(2, 'المحتوى مطلوب').max(10000),
  published: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

const schema = z.union([bannerSchema, sectionSchema, pageSchema])

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('content.manage')
    const body = await parseBody(req, schema)

    if (body.type === 'banners') {
      const { type: _t, id: _id, ...data } = body
      const item = _id
        ? await db.banner.update({ where: { id: _id }, data })
        : await db.banner.create({ data })
      await writeAudit({ actor, action: `banner.${_id ? 'update' : 'create'}`, entityType: 'banner', entityId: item.id, newValues: { title: body.title } })
      return ok(item)
    }

    if (body.type === 'sections') {
      const { type: _t, id: _id, sectionType, ...data } = body
      const payload = { ...data, type: sectionType }
      const item = _id
        ? await db.homeSection.update({ where: { id: _id }, data: payload })
        : await db.homeSection.create({ data: payload })
      await writeAudit({ actor, action: `section.${_id ? 'update' : 'create'}`, entityType: 'home_section', entityId: item.id, newValues: { sectionType } })
      return ok(item)
    }

    const { type: _t, id: _id, ...data } = body
    if (!_id && !data.slug) {
      data.slug = `page-${Date.now().toString(36)}`
    }
    const item = _id
      ? await db.contentPage.update({ where: { id: _id }, data })
      : await db.contentPage.create({ data: { ...data, slug: data.slug ?? `page-${Date.now().toString(36)}` } })
    await writeAudit({ actor, action: `page.${_id ? 'update' : 'create'}`, entityType: 'content_page', entityId: item.id, newValues: { title: body.title } })
    return ok(item)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission('content.manage')
    const { type, id } = parseQuery(req, z.object({ type: z.enum(['banners', 'sections', 'pages']), id: z.string().min(1) }))

    if (type === 'banners') await db.banner.delete({ where: { id } })
    else if (type === 'sections') await db.homeSection.delete({ where: { id } })
    else await db.contentPage.delete({ where: { id } })

    await writeAudit({ actor, action: `${type}.delete`, entityType: type, entityId: id })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}

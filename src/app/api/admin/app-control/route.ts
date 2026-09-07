import { z } from 'zod'
import { ok, fail, handleRouteError, parseBody } from '@/lib/server/api'
import { requirePermission, requireAdmin } from '@/lib/server/auth'
import { db } from '@/lib/db'
import { getFlags, setFlag, getSettings, setSetting } from '@/lib/server/flags'
import { writeAudit } from '@/lib/server/audit'
import { FEATURE_FLAG_KEYS } from '@/lib/shared/constants'

// التحكم المركزي: Remote Config + Feature Flags + Settings (PLAN ق36/37/101)
export async function GET() {
  try {
    await requireAdmin()
    const [flags, settings, versions, maintenance, stats] = await Promise.all([
      db.featureFlag.findMany(),
      db.appSetting.findMany(),
      db.appVersion.findMany({ orderBy: { buildNumber: 'desc' } }),
      db.maintenanceWindow.findMany({ orderBy: { startsAt: 'desc' }, take: 10 }),
      db.$transaction(async (tx) => ({
        users: await tx.user.count(),
        orders: await tx.order.count(),
        products: await tx.product.count(),
        payments: await tx.payment.count(),
        auditLogs: await tx.auditLog.count(),
        notifications: await tx.notification.count(),
        movements: await tx.stockMovement.count(),
      })),
    ])
    return ok({ flags, settings, versions, maintenance, stats })
  } catch (e) {
    return handleRouteError(e)
  }
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_flag'),
    key: z.string().min(1),
    value: z.boolean(),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('set_setting'),
    key: z.string().min(1),
    value: z.string().max(2000),
    group: z.string().default('general'),
    label: z.string().default(''),
  }),
  z.object({
    action: z.literal('set_version'),
    versionName: z.string().min(1).max(20),
    buildNumber: z.number().int().min(1),
    minimumSupported: z.boolean().default(false),
    isLatest: z.boolean().default(false),
    releaseNotes: z.string().max(500).default(''),
    downloadUrl: z.string().optional().nullable(),
    mandatory: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('maintenance'),
    message: z.string().min(2).max(300),
    endsAt: z.string().optional().nullable(),
  }),
])

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('app_settings.manage')
    const body = await parseBody(req, schema)

    if (body.action === 'set_flag') {
      const valid = FEATURE_FLAG_KEYS.some((f) => f.key === body.key)
      if (!valid) return fail('VALIDATION_ERROR', 'مفتاح علم غير معروف', 400)
      // مستوات حساسة تحتاج SUPER_ADMIN (Kill Switch / Maintenance / Force Update)
      const sensitive = ['emergency_stop', 'maintenance_mode', 'force_update']
      if (sensitive.includes(body.key) && actor.role !== 'SUPER_ADMIN') {
        return fail('PERMISSION_ERROR', 'هذا المفتاح لمدير النظام فقط', 403)
      }
      await setFlag(body.key as never, body.value, actor.id, body.reason)
      await writeAudit({
        actor, action: `flag.${body.key}`, entityType: 'feature_flag', entityId: body.key,
        newValues: { value: body.value }, reason: body.reason,
      })
      return ok(await getFlags(true))
    }

    if (body.action === 'set_setting') {
      await setSetting(body.key, body.value, body.group, body.label, actor.id)
      await writeAudit({
        actor, action: `setting.${body.key}`, entityType: 'app_setting', entityId: body.key,
        newValues: { value: body.value },
      })
      return ok(await getSettings(true))
    }

    if (body.action === 'set_version') {
      if (body.isLatest) {
        await db.appVersion.updateMany({ where: { platform: 'WEB' }, data: { isLatest: false } })
      }
      const version = await db.appVersion.create({
        data: {
          platform: 'WEB', versionName: body.versionName, buildNumber: body.buildNumber,
          minimumSupported: body.minimumSupported, isLatest: body.isLatest,
          releaseNotes: body.releaseNotes, downloadUrl: body.downloadUrl ?? null,
          mandatory: body.mandatory,
        },
      })
      await writeAudit({
        actor, action: 'version.create', entityType: 'app_version', entityId: version.id,
        newValues: { versionName: body.versionName, buildNumber: body.buildNumber, minimum: body.minimumSupported },
      })
      return ok(version)
    }

    const maintenanceData: { message: string; createdById: string; startsAt: Date; endsAt?: Date } = {
      message: body.message,
      createdById: actor.id,
      startsAt: new Date(),
    }
    if (body.endsAt) maintenanceData.endsAt = new Date(body.endsAt)
    const window = await db.maintenanceWindow.create({ data: maintenanceData })
    await setFlag('maintenance_mode', true, actor.id, 'تشغيل وضع الصيانة')
    await writeAudit({
      actor, action: 'maintenance.enable', entityType: 'maintenance_window', entityId: window.id,
      newValues: { message: body.message }, reason: 'تشغيل الصيانة',
    })
    return ok(window)
  } catch (e) {
    return handleRouteError(e)
  }
}

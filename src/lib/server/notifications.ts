import { db } from '@/lib/db'

// ============================================================
// الإشعارات الداخلية (In-App — PLAN ق39)
// الإشعار ليس مصدر الحقيقة؛ يرتبط بالسجل عبر linkView/linkParam
// ============================================================

/** إشعار لمستخدم محدد */
export async function notifyUser(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  input: { userId: string; type: string; title: string; body: string; linkView?: string; linkParam?: string }
) {
  await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      linkView: input.linkView ?? null,
      linkParam: input.linkParam ?? null,
    },
  })
}

/** إشعار لكل مستخدمي دور معين (الإدارة) */
export async function notifyRole(
  input: { role: string; type: string; title: string; body: string; linkView?: string; linkParam?: string }
) {
  const users = await db.user.findMany({ where: { role: input.role, status: 'ACTIVE' }, select: { id: true } })
  if (users.length === 0) return
  await db.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: input.type,
      title: input.title,
      body: input.body,
      linkView: input.linkView ?? null,
      linkParam: input.linkParam ?? null,
      role: input.role,
    })),
  })
}

/** إشعارات دور الإدارة ذات الصلة بالدفع والمحاسبة */
export async function notifyFinanceTeam(input: { type: string; title: string; body: string; linkView?: string; linkParam?: string }) {
  const roles = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT']
  for (const role of roles) {
    await notifyRole({ ...input, role })
  }
}

/** إشعارات المستودع */
export async function notifyWarehouseTeam(input: { type: string; title: string; body: string; linkView?: string; linkParam?: string }) {
  const roles = ['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE']
  for (const role of roles) {
    await notifyRole({ ...input, role })
  }
}

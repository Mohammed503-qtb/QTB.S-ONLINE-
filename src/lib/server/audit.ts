import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/server/auth'

// ============================================================
// Audit Log (PLAN ق45) — كل عملية حساسة لها سجل
// ============================================================

type AuditInput = {
  actor?: SessionUser | null
  action: string
  entityType: string
  entityId: string
  oldValues?: unknown
  newValues?: unknown
  reason?: string
  ip?: string
}

export async function writeAudit(input: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValuesJson: input.oldValues !== undefined ? JSON.stringify(input.oldValues) : null,
        newValuesJson: input.newValues !== undefined ? JSON.stringify(input.newValues) : null,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
      },
    })
  } catch (e) {
    // فشل التدقيق لا يوقف العملية التجارية لكن يُسجل في اللوج
    console.error('[AUDIT WRITE FAILED]', e)
  }
}

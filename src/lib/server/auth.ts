import { cookies } from 'next/headers'
import { randomBytes, createHash } from 'crypto'
import { db } from '@/lib/db'
import { ApiError } from '@/lib/server/api'
import { ADMIN_ROLES, hasPermission, type Permission, type Role } from '@/lib/shared/constants'

// ============================================================
// نظام الجلسات — httpOnly cookie + جدول sessions
// OTP: وضع تطوير (لا يوجد مزود SMS) — الكود يُولد ويُخزن مشفرًا
// ============================================================

const COOKIE_NAME = 'ysid'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14 // أسبوعان

export type SessionUser = {
  id: string
  name: string
  phone: string
  role: Role
  status: string
  avatarUrl?: string | null
  customerId?: string | null
}

// ---------- إنشاء جلسة ----------
export async function createSession(userId: string, deviceInfo?: string, ip?: string) {
  const token = randomBytes(32).toString('hex')
  const session = await db.userSession.create({
    data: { token, userId, deviceInfo: deviceInfo ?? null, ip: ip ?? null },
  })
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  return session
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (token) {
    await db.userSession.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'logout' },
    })
  }
  store.delete(COOKIE_NAME)
}

export async function revokeSession(sessionId: string, reason: string) {
  await db.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

// ---------- المستخدم الحالي ----------
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await db.userSession.findUnique({
    where: { token },
    include: { user: { include: { customer: true } } },
  })
  if (!session) return null
  if (session.revokedAt) return null
  if (session.user.status !== 'ACTIVE') return null

  // تحديث آخر نشاط (بدون انتظار)
  db.userSession.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } }).catch(() => {})

  return {
    id: session.user.id,
    name: session.user.name,
    phone: session.user.phone,
    role: session.user.role as Role,
    status: session.user.status,
    avatarUrl: session.user.avatarUrl,
    customerId: session.user.customer?.id ?? null,
  }
}

// ---------- حماية المسارات ----------
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new ApiError('AUTH_ERROR', 'يجب تسجيل الدخول أولًا', 401)
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new ApiError('PERMISSION_ERROR', 'هذه المنطقة مخصصة للإدارة فقط', 403)
  }
  return user
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!hasPermission(user.role, permission)) {
    throw new ApiError('PERMISSION_ERROR', `لا تملك صلاحية: ${permission}`, 403)
  }
  return user
}

// ============================================================
// OTP — وضع التطوير
// التوليد + التخزين المُهشّر + التحقق
// البنية جاهزة لربط مزود SMS حقيقي لاحقًا عبر Adapter
// ============================================================

// OTP نشط مرتبط بالهاتف مع صلاحية 10 دقائق
const OTP_TTL_MS = 10 * 60 * 1000

function hashOtp(phone: string, code: string) {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex')
}

export async function issueOtp(phone: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const hash = hashOtp(phone, code)
  await db.idempotencyKey.upsert({
    where: { key: `otp:${phone}` },
    create: { key: `otp:${phone}`, responseJson: JSON.stringify({ hash, at: Date.now() }) },
    update: { responseJson: JSON.stringify({ hash, at: Date.now() }) },
  })
  // وضع التطوير: نعيد الكود ليظهر في الواجهة (لا مزود SMS في البيئة)
  // TODO-SMS: استبدال الإرجاع بإرسال عبر مزود SMS
  return code
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const rec = await db.idempotencyKey.findUnique({ where: { key: `otp:${phone}` } })
  if (!rec) return false
  try {
    const { hash, at } = JSON.parse(rec.responseJson ?? '{}')
    if (Date.now() - at > OTP_TTL_MS) return false
    if (hash !== hashOtp(phone, code)) return false
  } catch {
    return false
  }
  // استهلاك الكود
  await db.idempotencyKey.delete({ where: { key: `otp:${phone}` } }).catch(() => {})
  return true
}

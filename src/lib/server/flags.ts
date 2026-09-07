import { db } from '@/lib/db'
import { PUBLIC_FLAGS, SETTING_KEYS, type FeatureFlagKey } from '@/lib/shared/constants'

// ============================================================
// Remote Config + Feature Flags + App Settings (PLAN ق6/ق87)
// مع كاش في الذاكرة (TTL قصير) لتخفيف ضغط قاعدة البيانات
// ============================================================

type FlagsCache = { values: Record<string, boolean>; at: number }
type SettingsCache = { values: Record<string, string>; at: number }

const g = globalThis as unknown as {
  __ys_flags?: FlagsCache
  __ys_settings?: SettingsCache
}

const FLAGS_TTL = 5000 // 5 ثوانٍ
const SETTINGS_TTL = 5000

// ---------- Feature Flags ----------
export async function getFlags(force = false): Promise<Record<string, boolean>> {
  const cache = g.__ys_flags
  if (!force && cache && Date.now() - cache.at < FLAGS_TTL) return cache.values
  const rows = await db.featureFlag.findMany()
  const values: Record<string, boolean> = {}
  for (const row of rows) values[row.key] = row.value
  g.__ys_flags = { values, at: Date.now() }
  return values
}

export async function getFlag(key: FeatureFlagKey): Promise<boolean> {
  const flags = await getFlags()
  return flags[key] ?? true // fallback آمن: غير معرّف = مفعّل (PLAN ق6: fallback)
}

export async function setFlag(key: FeatureFlagKey, value: boolean, actorId?: string, reason?: string) {
  await db.featureFlag.upsert({
    where: { key },
    create: { key, value, updatedById: actorId ?? null, reason: reason ?? null },
    update: { value, updatedById: actorId ?? null, reason: reason ?? null },
  })
  g.__ys_flags = undefined // إبطال الكاش
}

// ---------- App Settings ----------
export async function getSettings(force = false): Promise<Record<string, string>> {
  const cache = g.__ys_settings
  if (!force && cache && Date.now() - cache.at < SETTINGS_TTL) return cache.values
  const rows = await db.appSetting.findMany()
  const values: Record<string, string> = {}
  for (const row of rows) values[row.key] = row.value
  g.__ys_settings = { values, at: Date.now() }
  return values
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const settings = await getSettings()
  return settings[key] ?? fallback
}

export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const raw = await getSetting(key, String(fallback))
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export async function setSetting(key: string, value: string, group: string, label: string, actorId?: string) {
  await db.appSetting.upsert({
    where: { key },
    create: { key, value, group, label, updatedById: actorId ?? null },
    update: { value, updatedById: actorId ?? null },
  })
  g.__ys_settings = undefined
}

// ---------- الحالة العامة للتطبيق ----------
export type PublicConfig = {
  flags: Record<string, boolean>
  settings: {
    storeName: string
    storeTagline: string
    storeLogoUrl: string
    whatsappNumber: string
    supportPhone: string
    currency: string
    currencySymbol: string
    storeHours: string
    address: string
    maintenanceMessage: string
    returnWindowDays: number
    paymentExpiryHours: number
    minOrderTotal: number
  }
  appStatus: string // ONLINE | PARTIAL_PAUSED | MAINTENANCE | EMERGENCY_STOP
  version: { minimum: string; latest: string; forceUpdate: boolean; releaseNotes: string }
}

export async function getPublicConfig(force = false): Promise<PublicConfig> {
  const [flags, settings] = await Promise.all([getFlags(force), getSettings(force)])
  const version = await db.appVersion.findFirst({
    where: { platform: 'WEB', active: true },
    orderBy: { buildNumber: 'desc' },
  })

  const maintenance = flags['maintenance_mode'] === true
  const emergency = flags['emergency_stop'] === true
  const storeEnabled = flags['store_enabled'] !== false
  const ordersEnabled = flags['orders_enabled'] !== false && flags['checkout_enabled'] !== false

  let appStatus = 'ONLINE'
  if (emergency) appStatus = 'EMERGENCY_STOP'
  else if (maintenance) appStatus = 'MAINTENANCE'
  else if (!storeEnabled || !ordersEnabled) appStatus = 'PARTIAL_PAUSED'

  return {
    flags: Object.fromEntries(PUBLIC_FLAGS.map((k) => [k, flags[k] ?? true])),
    settings: {
      storeName: settings[SETTING_KEYS.storeName] ?? 'متجر الأصيل',
      storeTagline: settings[SETTING_KEYS.storeTagline] ?? 'تسوق بثقة — يصلك أينما كنت',
      storeLogoUrl: settings[SETTING_KEYS.storeLogoUrl] ?? '/uploads/logo.svg',
      whatsappNumber: settings[SETTING_KEYS.whatsappNumber] ?? '967771234567',
      supportPhone: settings[SETTING_KEYS.supportPhone] ?? '771234567',
      currency: settings[SETTING_KEYS.currency] ?? 'YER',
      currencySymbol: settings[SETTING_KEYS.currencySymbol] ?? 'ريال',
      storeHours: settings[SETTING_KEYS.storeHours] ?? 'السبت - الخميس: 8 ص - 10 م',
      address: settings[SETTING_KEYS.address] ?? 'عدن - المنصورة',
      maintenanceMessage: settings[SETTING_KEYS.maintenanceMessage] ?? 'المتجر متوقف مؤقتًا للصيانة، سنعود قريبًا',
      returnWindowDays: Number(settings[SETTING_KEYS.returnWindowDays] ?? '7'),
      paymentExpiryHours: Number(settings[SETTING_KEYS.paymentExpiryHours] ?? '48'),
      minOrderTotal: Number(settings[SETTING_KEYS.minOrderTotal] ?? '0'),
    },
    appStatus,
    version: {
      minimum: version?.minimumSupported ? version.versionName : '1.0.0',
      latest: version?.versionName ?? '1.0.0',
      forceUpdate: flags['force_update'] === true,
      releaseNotes: version?.releaseNotes ?? '',
    },
  }
}

// ---------- حراسة الميزات في المسارات الحساسة ----------
export async function assertFlagEnabled(key: FeatureFlagKey, message?: string) {
  const enabled = await getFlag(key)
  if (!enabled) {
    const { ApiError } = await import('@/lib/server/api')
    throw new ApiError('PERMISSION_ERROR', message ?? 'هذه الميزة معطلة حاليًا من الإدارة', 403)
  }
}

'use client'

// ============================================================
// الجذر — مسار واحد / (قيد البيئة)
// يحدد القشرة المناسبة حسب الدور (PLAN ق41/107):
// - زائر/عميل → Store Shell
// - دور إداري → Admin Shell (مع إمكانية معاينة المتجر)
// - صيانة/إيقاف → شاشة الحالة المناسبة مع بقاء دخول الإدارة
// ============================================================

import { useSession, useConfig } from '@/lib/client/session'
import { useNav } from '@/lib/client/stores'
import { StoreShell } from '@/components/store/store-shell'
import { AdminShell } from '@/components/admin/admin-shell'
import { AppGate } from '@/components/app/app-gate'
import { Spinner } from '@/components/app/spinner'

export function RootApp() {
  const { user, isAdmin, isLoading: sessionLoading } = useSession()
  const { data: config, isLoading: configLoading, error: configError } = useConfig()
  const view = useNav((s) => s.view)
  const reset = useNav((s) => s.reset)

  const loading = sessionLoading || configLoading

  // قشرة الإدارة لأي مسار admin-*
  const isAdminView = view.startsWith('admin')

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">🛍️</div>
        <Spinner />
        <p className="text-sm text-muted-foreground">جارِ تحميل المتجر...</p>
      </div>
    )
  }

  // فشل تحميل الإعدادات: fallback آمن (PLAN ق6)
  if (configError || !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
        <div className="text-5xl">📡</div>
        <h1 className="text-xl font-bold">تعذر الاتصال بالمتجر</h1>
        <p className="text-muted-foreground max-w-sm">تحقق من اتصالك بالإنترنت ثم أعد المحاولة</p>
        <button onClick={() => location.reload()} className="rounded-lg bg-primary text-primary-foreground px-6 py-2 font-medium">
          إعادة المحاولة
        </button>
      </div>
    )
  }

  // الإدارة تعمل دائمًا حتى في الصيانة (PLAN ق37: يمكن السماح للمدير بالدخول)
  if (isAdmin && (isAdminView || config.appStatus === 'MAINTENANCE' || config.appStatus === 'EMERGENCY_STOP') && view !== 'store-preview') {
    return <AdminShell />
  }

  // عميل/زائر → بوابات الحالة ثم المتجر
  return (
    <AppGate config={config} isAdmin={isAdmin}>
      {isAdmin && view === 'store-preview' ? (
        <StoreShell preview />
      ) : (
        <StoreShell />
      )}
    </AppGate>
  )
}

export function goStore() {
  useNav.getState().reset('home')
}

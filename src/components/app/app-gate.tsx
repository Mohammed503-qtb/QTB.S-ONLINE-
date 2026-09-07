'use client'

import type { PublicConfig } from '@/lib/client/session'

// بوابات الحالة العامة (PLAN ق5/6/37/40):
// صيانة / إيقاف طارئ / إغلاق المتجر — مع بقاء دخول الإدارة ممكنًا
export function AppGate({ config, isAdmin, children }: { config: PublicConfig; isAdmin: boolean; children: React.ReactNode }) {
  const flags = config.flags

  // إيقاف طارئ: كل شيء مغلق (الإدارة تصل عبر لوحتها)
  if (flags.emergency_stop) {
    return (
      <StatusScreen
        icon="🛑"
        title="التطبيق موقوف مؤقتًا"
        subtitle="تم إيقاف النظام مؤقتًا لأسباب تشغيلية. نعتذر عن الإزعاج ونعود قريبًا."
        adminHint={isAdmin}
      />
    )
  }

  // صيانة
  if (flags.maintenance_mode) {
    return (
      <StatusScreen
        icon="🛠️"
        title="المتجر تحت الصيانة"
        subtitle={config.settings.maintenanceMessage}
        adminHint={isAdmin}
      />
    )
  }

  // المتجر مغلق لكن الكتالوج يعمل (PARTIAL)
  if (flags.store_enabled === false && !isAdmin) {
    return (
      <StatusScreen
        icon="🌙"
        title="المتجر مغلق حاليًا"
        subtitle="نستقبل الطلبات قريبًا — تابعنا لاحقًا"
        adminHint={isAdmin}
      />
    )
  }

  return <>{children}</>
}

function StatusScreen({ icon, title, subtitle, adminHint }: { icon: string; title: string; subtitle: string; adminHint: boolean }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="text-6xl" aria-hidden>{icon}</div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="text-muted-foreground max-w-md leading-relaxed">{subtitle}</p>
        {adminHint && (
          <a href="#" onClick={() => location.reload()} className="mt-2 rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-accent">
            الدخول إلى لوحة الإدارة
          </a>
        )}
      </main>
      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground">
        متجر الأصيل — اليمن
      </footer>
    </div>
  )
}

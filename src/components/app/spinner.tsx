'use client'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary ${className}`} role="status" aria-label="جارِ التحميل">
      <span className="sr-only">جارِ التحميل</span>
    </div>
  )
}

export function FullSpinner({ label = 'جارِ التحميل...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function EmptyState({ icon = '📭', title, subtitle, action }: { icon?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="text-5xl opacity-80">{icon}</div>
      <h3 className="font-bold text-lg">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground max-w-sm">{subtitle}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      <div className="text-5xl opacity-80">⚠️</div>
      <h3 className="font-bold text-lg">حدث خطأ</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message ?? 'تعذر تحميل البيانات'}</p>
      {retry && (
        <button onClick={retry} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}

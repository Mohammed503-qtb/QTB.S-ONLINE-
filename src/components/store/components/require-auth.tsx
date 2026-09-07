'use client'

import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/lib/client/session'
import { useUi } from '@/lib/client/stores'
import { EmptyState } from '@/components/app/spinner'

// ============================================================
// حارس الجلسة — يعرض حالة دخول بدل المحتوى الخاص بالعضو
// ============================================================

export function RequireAuth({ children, title = 'هذه الصفحة تحتاج تسجيل الدخول' }: { children: React.ReactNode; title?: string }) {
  const { isAuthenticated, isLoading } = useSession()
  const openLogin = useUi((s) => s.openLogin)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon="🔐"
        title={title}
        subtitle="سجّل الدخول برقم هاتفك اليمني (7xxxxxxxx) — رمز تحقق واحد ويكون حسابك جاهزًا"
        action={
          <Button onClick={() => openLogin(title)} className="min-h-11 bg-emerald-700 px-6 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
            <LogIn className="size-4" aria-hidden />
            تسجيل الدخول
          </Button>
        }
      />
    )
  }

  return <>{children}</>
}

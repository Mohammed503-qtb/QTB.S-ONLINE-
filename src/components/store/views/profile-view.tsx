'use client'

import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Bell,
  Headphones,
  Heart,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Package,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sun,
  User,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/app/spinner'
import { useLogin, useSession } from '@/lib/client/session'
import { useNav } from '@/lib/client/stores'
import { money, roleLabel } from '@/lib/client/format'
import { tierLabel } from '../utils'

// ============================================================
// حسابي — بياناتي + إحصاءات + روابط سريعة + وضع داكن + خروج
// ============================================================

const QUICK_LINKS = [
  { view: 'orders', label: 'طلباتي', icon: Package },
  { view: 'addresses', label: 'عناويني', icon: MapPin },
  { view: 'returns', label: 'طلبات الإرجاع', icon: RotateCcw },
  { view: 'favorites', label: 'المفضلة', icon: Heart },
  { view: 'notifications', label: 'الإشعارات', icon: Bell },
  { view: 'support', label: 'الدعم الفني', icon: Headphones },
  { view: 'track', label: 'تتبع طلب', icon: Shield },
] as const

const POLICY_LINKS = [
  { slug: 'about', label: 'من نحن' },
  { slug: 'return-policy', label: 'سياسة الإرجاع' },
  { slug: 'shipping-policy', label: 'سياسة الشحن' },
  { slug: 'payment-policy', label: 'سياسة الدفع' },
  { slug: 'terms', label: 'الشروط والأحكام' },
  { slug: 'privacy', label: 'الخصوصية' },
  { slug: 'faq', label: 'الأسئلة الشائعة' },
] as const

export function ProfileView() {
  const { user, customer, isAuthenticated, isLoading } = useSession()
  const go = useNav((s) => s.go)
  const { logout } = useLogin()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <EmptyState
        icon="👤"
        title="مرحبًا بك في حسابك"
        subtitle="سجّل الدخول برقم هاتفك لعرض طلباتك وعناوينك ومفضلتك"
        action={
          <Button onClick={() => go('home')} className="min-h-11 bg-emerald-700 px-6 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
            <LogIn className="size-4" aria-hidden />
            تسجيل الدخول من الرئيسية
          </Button>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      {/* البطاقة الشخصية */}
      <section className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6" aria-label="بياناتي">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          {user.name.trim().charAt(0) || '؟'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{user.name}</h1>
          <p dir="ltr" className="font-mono text-sm text-muted-foreground">{user.phone}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">
            <User className="size-3" aria-hidden />
            {roleLabel(user.role)}
          </span>
        </div>
      </section>

      {/* الإحصاءات */}
      {customer && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="إحصاءات حسابي">
          <StatCard icon={<ShoppingBag className="size-5" aria-hidden />} label="الطلبات" value={String(customer.ordersCount)} />
          <StatCard icon={<Wallet className="size-5" aria-hidden />} label="إجمالي المشتريات" value={money(customer.totalSpent)} />
          <StatCard icon={<Shield className="size-5" aria-hidden />} label="التصنيف" value={tierLabel(customer.tier)} />
          <StatCard icon={<Wallet className="size-5" aria-hidden />} label="رصيد دائن" value={money(customer.creditBalance)} />
        </section>
      )}

      {/* الروابط السريعة */}
      <section className="rounded-2xl border bg-card p-2 shadow-sm" aria-label="روابط سريعة">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.view}
            type="button"
            onClick={() => go(link.view)}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold transition-colors hover:bg-accent"
          >
            <link.icon className="size-5 text-emerald-600" aria-hidden />
            {link.label}
          </button>
        ))}
      </section>

      {/* السياسات */}
      <section className="rounded-2xl border bg-card p-2 shadow-sm" aria-label="السياسات">
        {POLICY_LINKS.map((link) => (
          <button
            key={link.slug}
            type="button"
            onClick={() => go('page', { slug: link.slug })}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            {link.label}
          </button>
        ))}
      </section>

      {/* الوضع الداكن */}
      <section className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm" aria-label="المظهر">
        <div className="flex items-center gap-3">
          <Sun className="size-5 text-amber-500 dark:hidden" aria-hidden />
          <Moon className="hidden size-5 text-emerald-400 dark:block" aria-hidden />
          <div>
            <p className="text-sm font-bold">الوضع الداكن</p>
            <p className="text-xs text-muted-foreground">تبديل مظهر المتجر</p>
          </div>
        </div>
        <ThemeToggle />
      </section>

      {/* الخروج */}
      <div className="pb-24 lg:pb-0">
        <Button
          variant="outline"
          className="min-h-12 w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
          onClick={async () => {
            try {
              await logout()
              toast.success('تم تسجيل الخروج — إلى اللقاء 👋')
              window.setTimeout(() => window.location.reload(), 500)
            } catch {
              toast.error('تعذر تسجيل الخروج — حاول مجددًا')
            }
          }}
        >
          <LogOut className="size-5" aria-hidden />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        {icon}
      </span>
      <p className="mt-2 truncate text-sm font-extrabold sm:text-base">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Switch
      checked={resolvedTheme === 'dark'}
      onCheckedChange={(checked) => {
        setTheme(checked ? 'dark' : 'light')
        toast.success(checked ? 'تم تشغيل الوضع الداكن' : 'تم تشغيل الوضع الفاتح')
      }}
      aria-label="تبديل الوضع الداكن"
      className="data-[state=checked]:bg-emerald-600"
    />
  )
}

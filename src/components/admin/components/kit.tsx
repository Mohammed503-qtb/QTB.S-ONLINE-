'use client'

// ============================================================
// عدة مشتركة لواجهة الإدارة: شارات، بطاقات، ترقيم صفحات،
// مساعد استعلام/تعديل موحد مع toast + invalidateQueries
// ============================================================

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ChevronLeft, ChevronRight, ImageOff, Search } from 'lucide-react'
import { api, ApiClientError } from '@/lib/client/api'
import { statusColor } from '@/lib/client/format'
import { hasPermission, type Permission, type Role } from '@/lib/shared/constants'
import { useSession } from '@/lib/client/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, Spinner } from '@/components/app/spinner'
import { cn } from '@/lib/utils'

// ---------- شارة حالة ملونة ----------
export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', statusColor(status), className)}>
      {label}
    </span>
  )
}

// ---------- ترويسة صفحة ----------
export function PageHeader({ title, description, actions, onBack }: { title: string; description?: string; actions?: ReactNode; onBack?: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <Button variant="outline" size="icon" onClick={onBack} aria-label="رجوع" className="shrink-0">
            <ChevronRight className="size-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground truncate">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------- صورة ذكية مع بديل عند الخطأ ----------
export function SmartImage({ src, alt, className, fallbackIcon = true }: { src?: string | null; alt: string; className?: string; fallbackIcon?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-muted rounded-md', className)} aria-label={alt} role="img">
        {fallbackIcon ? <ImageOff className="size-4 text-muted-foreground" /> : <span className="text-xs text-muted-foreground">لا صورة</span>}
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn('object-cover rounded-md', className)} />
}

// ---------- بطاقة إحصائية ----------
export function StatCard({ title, value, icon, tone = 'default', hint, onClick }: { title: string; value: ReactNode; icon?: ReactNode; tone?: 'default' | 'primary' | 'warning' | 'danger' | 'info'; hint?: string; onClick?: () => void }) {
  const tones: Record<string, string> = {
    default: 'bg-card text-card-foreground',
    primary: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200',
    warning: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200',
    danger: 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200',
    info: 'bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100',
  }
  return (
    <div
      className={cn('rounded-xl border p-4 flex items-center gap-3', tones[tone], onClick && 'cursor-pointer hover:shadow-md transition-shadow', onClick && 'hover:border-primary/40')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {icon && <div className="shrink-0 rounded-lg bg-background/70 dark:bg-black/20 p-2 text-primary">{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{title}</p>
        <p className="text-lg font-bold tabular-nums truncate">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </div>
    </div>
  )
}

// ---------- ترويسة قسم داخل بطاقة ----------
export function SectionHeader({ title, icon, badge, action }: { title: string; icon?: ReactNode; badge?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b pb-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <h2 className="font-bold text-sm md:text-base truncate">{title}</h2>
        {badge}
      </div>
      {action}
    </div>
  )
}

// ---------- تبويبات الحالة بعدادات (أزرار قابلة للتمرير) ----------
export type TabOption = { value: string; label: string; count?: number }

export function StatusTabs({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: TabOption[] }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors min-h-[36px]',
              active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-border'
            )}
          >
            <span>{o.label}</span>
            {o.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[10px] tabular-nums', active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------- ترقيم الصفحات ----------
export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  const items: number[] = []
  const from = Math.max(1, Math.min(page - 2, pages - 4))
  const to = Math.min(pages, from + 4)
  for (let i = from; i <= to; i++) items.push(i)
  return (
    <nav className="flex items-center justify-center gap-1 pt-4" aria-label="ترقيم الصفحات">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="الصفحة السابقة">
        <ChevronRight className="size-4" />
      </Button>
      {from > 1 && <span className="px-1 text-muted-foreground">…</span>}
      {items.map((p) => (
        <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined} className="min-w-9">
          {p}
        </Button>
      ))}
      {to < pages && <span className="px-1 text-muted-foreground">…</span>}
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="الصفحة التالية">
        <ChevronLeft className="size-4" />
      </Button>
    </nav>
  )
}

// ---------- حقل بحث (مُرحّل debounce) ----------
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function SearchInput({ value, onChange, placeholder = 'بحث...', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="ps-3 pe-9" aria-label={placeholder} />
    </div>
  )
}

// ---------- صلاحيات ----------
export function usePerm(): { role: Role | null; can: (p: Permission) => boolean } {
  const { user } = useSession()
  const role = (user?.role as Role | undefined) ?? null
  return { role, can: (p: Permission) => (role ? hasPermission(role, p) : false) }
}

// ---------- تعديل موحد (toast + invalidate) ----------
export function useApiMutation<TVars, TRes>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { success?: string | ((res: TRes, vars: TVars) => string); invalidate?: unknown[][]; onDone?: (res: TRes, vars: TVars) => void } = {}
) {
  const qc = useQueryClient()
  return useMutation<TRes, Error, TVars>({
    mutationFn: fn,
    onSuccess: (res, vars) => {
      if (opts.success !== undefined) {
        const msg = typeof opts.success === 'string' ? opts.success : opts.success(res, vars)
        toast.success(msg)
      }
      for (const key of opts.invalidate ?? []) {
        void qc.invalidateQueries({ queryKey: key })
      }
      opts.onDone?.(res, vars)
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === 'PERMISSION_ERROR') {
        toast.error(`صلاحية غير كافية: ${err.message}`)
      } else {
        toast.error(err instanceof ApiClientError ? err.message : 'حدث خطأ غير متوقع — حاول مرة أخرى')
      }
    },
  })
}

// ---------- JSON منسق ----------
export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  let text: string
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }
  return (
    <pre dir="ltr" className={cn('text-[11px] leading-5 text-muted-foreground bg-muted rounded-md p-2 overflow-x-auto max-w-md', className)}>
      {text}
    </pre>
  )
}

// ---------- تحذير مدمج ----------
export function InlineWarning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

// ---------- قيم فارغة/تحميل/خطأ لقسم صغير ----------
export function MiniLoader() {
  return (
    <div className="flex items-center justify-center py-8">
      <Spinner />
    </div>
  )
}

export function MiniEmpty({ title = 'لا توجد بيانات', icon = '📭', subtitle }: { title?: string; icon?: string; subtitle?: string }) {
  return <EmptyState icon={icon} title={title} subtitle={subtitle} />
}

export function MiniError({ message, retry }: { message?: string; retry?: () => void }) {
  return <ErrorState message={message} retry={retry} />
}

// ---------- حقل رفع صورة ----------
export function UploadField({ label, value, onChange, folder, pending }: { label: string; value: string; onChange: (url: string) => void; folder: string; pending?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const disabled = busy || pending
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        {value ? <SmartImage src={value} alt={label} className="size-16 border" /> : null}
        <div className="flex flex-col gap-1.5">
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setBusy(true)
              setErr('')
              try {
                const res = await api.upload(file, folder)
                onChange(res.url)
                toast.success('تم رفع الصورة')
              } catch (error) {
                setErr(error instanceof ApiClientError ? error.message : 'فشل رفع الصورة')
              } finally {
                setBusy(false)
              }
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => ref.current?.click()}>
              {busy ? <Spinner className="size-3.5" /> : null}
              {busy ? 'جارِ الرفع...' : 'اختيار صورة'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} disabled={disabled}>
                إزالة
              </Button>
            )}
          </div>
          {err && <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>}
        </div>
      </div>
    </div>
  )
}

// ---------- تسميات عربية موحدة لأنواع داخلية ----------
export const TXN_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_PAYMENT: 'تحصيل دفعة عميل',
  REFUND: 'استرداد',
  EXPENSE: 'مصروف',
  SUPPLIER_PAYMENT: 'دفعة مورد',
  TRANSFER_IN: 'إيداع / تحويل داخل',
  TRANSFER_OUT: 'سحب / تحويل خارج',
  ADJUSTMENT: 'تسوية',
  FEE: 'رسوم',
  COD_COLLECTION: 'تحصيل عند التسليم',
  OPENING: 'رصيد افتتاحي',
}

export const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: 'استلام شراء',
  ORDER_RESERVATION: 'حجز لطلب',
  ORDER_RELEASE: 'تحرير حجز',
  SALE: 'بيع',
  RETURN: 'مرتجع',
  DAMAGE: 'تالف',
  ADJUSTMENT: 'تسوية جرد',
  TRANSFER_OUT: 'نقل خارج',
  TRANSFER_IN: 'نقل داخل',
  STOCK_ISSUE: 'فرق جرد',
}

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  RECEIVED: 'مستلم',
  PARTIALLY_PAID: 'مدفوع جزئيًا',
  PAID: 'مدفوع',
  CANCELLED: 'ملغي',
}

export const TIER_LABELS: Record<string, string> = {
  NEW: 'جديد',
  REGULAR: 'عادي',
  VIP: 'VIP',
  INACTIVE: 'غير نشط',
  BLOCKED: 'محجوب',
}

export const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  BLOCKED: 'محظور',
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: 'بانتظار المراجعة',
  APPROVED: 'معتمد',
  HIDDEN: 'مخفي',
}

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  ORDER: 'طلب',
  PAYMENT: 'دفع',
  RETURN: 'إرجاع',
  SHIPPING: 'شحن',
  OTHER: 'أخرى',
}

export const REFUND_METHOD_LABELS: Record<string, string> = {
  BANK: 'تحويل بنكي',
  CASH: 'نقدًا',
  CREDIT: 'رصيد دائن',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  COD: 'دفع عند الاستلام',
}

export const BANK_TYPE_LABELS: Record<string, string> = {
  BANK: 'بنك',
  WALLET: 'محفظة',
  CASH: 'صندوق نقدي',
}

export const BANNER_ACTION_LABELS: Record<string, string> = {
  NONE: 'بدون إجراء',
  CATEGORY: 'تصنيف',
  PRODUCT: 'منتج',
  PAGE: 'صفحة',
}

export const SECTION_TYPE_LABELS: Record<string, string> = {
  BANNER: 'بانر رئيسي',
  CATEGORIES: 'شبكة الأقسام',
  FEATURED: 'منتجات مميزة',
  BEST_SELLERS: 'الأكثر بيعًا',
  NEW_ARRIVALS: 'وصل حديثًا',
  OFFERS: 'عروض وخصومات',
  BRANDS: 'الماركات',
  CUSTOM: 'مخصص',
}

export const COUPON_SCOPE_LABELS: Record<string, string> = {
  ALL: 'كل المنتجات',
  PRODUCTS: 'منتجات محددة',
  CATEGORIES: 'تصنيفات محددة',
}

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'نشط',
  ARCHIVED: 'مؤرشف',
}

export const BROADCAST_TARGET_LABELS: Record<string, string> = {
  CUSTOMERS: 'كل العملاء',
  ALL_ADMINS: 'كل المستخدمين الإداريين',
  MANAGERS: 'المديرون',
  ACCOUNTANTS: 'المحاسبون',
  WAREHOUSE: 'موظفو المستودع',
}

export const RISK_FLAG_LABELS: Record<string, string> = {
  DUPLICATE: 'تحويل مكرر',
  AMOUNT_MISMATCH: 'مبلغ غير مطابق',
}

export function attrText(attributes: Record<string, string> | null | undefined): string {
  if (!attributes) return ''
  const entries = Object.entries(attributes)
  if (!entries.length) return ''
  return entries.map(([k, v]) => `${k}: ${v}`).join(' · ')
}

export function parseAttrs(json?: string | null): Record<string, string> {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function riskFlagList(riskFlags?: string | null): string[] {
  return (riskFlags ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// نجوم التقييم
export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-amber-500' : 'text-muted-foreground/30'}>
          ★
        </span>
      ))}
    </span>
  )
}

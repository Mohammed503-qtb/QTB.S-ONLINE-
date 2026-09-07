'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PackageSearch, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { dateFmt, money, orderStatusLabel, paymentStatusLabel, statusColor, timeAgo } from '@/lib/client/format'
import { cn } from '@/lib/utils'
import { CodeBox } from '../components/code-box'
import { eventLabel } from '../utils'
import type { TrackResult } from '../types'

// ============================================================
// تتبع عام بكود (ORD-/PAY-/TRK-) — يعمل بدون تسجيل دخول
// ============================================================

export function TrackView({ initialCode }: { initialCode?: string }) {
  const go = useNav((s) => s.go)
  const [code, setCode] = useState(initialCode ?? '')
  const [submittedCode, setSubmittedCode] = useState<string | null>(initialCode ?? null)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['track', submittedCode],
    queryFn: () => api.get<TrackResult>(`/api/track/${encodeURIComponent(submittedCode ?? '')}`),
    enabled: !!submittedCode && submittedCode.trim().length > 3,
    retry: 0,
    refetchOnWindowFocus: false,
  })

  const submit = () => {
    const c = code.trim().toUpperCase()
    if (!c) return
    setSubmittedCode(c)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-extrabold">تتبع طلبك</h1>
        <p className="text-sm text-muted-foreground">أدخل رقم الطلب (ORD-) أو مرجع الدفع (PAY-) أو كود التتبع (TRK-)</p>
      </div>

      {/* نموذج البحث */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="relative flex-1">
          <PackageSearch className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="كود التتبع"
            dir="ltr"
            className="min-h-12 ps-9 font-mono"
            placeholder="ORD-XXXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
        <Button type="submit" className="h-12 min-w-24 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
          <Search className="size-5" aria-hidden />
          تتبع
        </Button>
      </form>

      {/* النتيجة */}
      {submittedCode && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}

      {submittedCode && !isLoading && error && (
        <ErrorState message={error instanceof ApiClientError ? error.message : 'لم نجد طلبًا بهذا الكود'} retry={() => refetch()} />
      )}

      {submittedCode && !isLoading && !error && data && (
        <div className={cn('space-y-4 transition-opacity', isFetching && 'opacity-60')}>
          {/* بطاقة الحالة */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">حالة الطلب</p>
                <p className="text-xl font-extrabold">{data.statusLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.itemsCount} منتج · {money(data.grandTotal)} · {dateFmt(data.placedAt)}
                </p>
              </div>
              <span className={cn('rounded-full px-4 py-1.5 text-sm font-bold', statusColor(data.status))}>{orderStatusLabel(data.status)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusColor(data.paymentStatus))}>
                الدفع: {paymentStatusLabel(data.paymentStatus)}
              </span>
              {data.customerName && <span className="text-xs text-muted-foreground">عميل: {data.customerName}</span>}
              {timeAgo(data.placedAt) !== '—' && <span className="text-xs text-muted-foreground">{timeAgo(data.placedAt)}</span>}
            </div>
          </div>

          {/* الأكواد */}
          <div className="grid gap-3 sm:grid-cols-3">
            <CodeBox code={data.orderNumber} label="رقم الطلب" />
            <CodeBox code={data.paymentReference} label="مرجع الدفع" />
            <CodeBox code={data.trackingCode} label="كود التتبع" />
          </div>

          {/* الخط الزمني */}
          <div className="space-y-3 rounded-2xl border bg-card p-4" aria-label="سجل الطلب">
            <h2 className="font-extrabold">سجل الطلب</h2>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا أحداث بعد</p>
            ) : (
              <ol className="relative space-y-4 border-s-2 ps-4">
                {data.timeline.map((event, i) => {
                  const isLatest = i === data.timeline.length - 1
                  return (
                    <li key={`${event.type}-${event.at}`} className="relative">
                      <span className={cn('absolute -start-[22px] top-0.5 size-4 rounded-full', isLatest ? 'bg-emerald-600' : 'bg-muted')} aria-hidden />
                      <p className="text-sm font-semibold">{eventLabel(event.type)}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(event.at)}</p>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <Alert>
            <AlertDescription className="flex flex-col gap-2 text-sm">
              <span>هل هذا طلبك؟ سجّل الدخول لعرض التفاصيل الكاملة والإجراءات (الدفع، الإلغاء، الإرجاع...)</span>
              <Button size="sm" variant="outline" className="min-h-10 w-fit" onClick={() => go('orders')}>
                طلباتي
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {!submittedCode && (
        <EmptyState
          icon="🔎"
          title="ابدأ بتتبع طلبك"
          subtitle="ستجد الكود في رسالة تأكيد الطلب أو من صفحة طلباتي"
        />
      )}
    </div>
  )
}

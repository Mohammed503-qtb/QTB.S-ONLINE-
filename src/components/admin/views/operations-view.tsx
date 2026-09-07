'use client'

// ============================================================
// مركز العمليات — كل ما يحتاج تدخلًا إداريًا في مكان واحد:
// طابور الدفعات (اعتماد/رفض سريع)، مشاكل الطلبات، مخزون منخفض،
// مرتجعات، توصيل فاشل، تذاكر
// ============================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { keepPreviousData } from '@tanstack/react-query'
import { AlertTriangle, BadgeCheck, Boxes, CreditCard, LifeBuoy, PackageX, Truck, Undo2, XCircle } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, orderStatusLabel, paymentStatusLabel, returnStatusLabel, ticketStatusLabel, timeAgo } from '@/lib/client/format'
import { REJECT_REASONS } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/app/spinner'
import { PageHeader, SectionHeader, StatusBadge, attrText, useApiMutation, usePerm, RISK_FLAG_LABELS, riskFlagList } from '@/components/admin/components/kit'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { OperationsResponse } from '@/components/admin/types'

export function OperationsView() {
  const go = useNav((s) => s.go)
  const { can } = usePerm()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectingNumber, setRejectingNumber] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-operations'],
    queryFn: () => api.get<OperationsResponse>('/api/admin/operations'),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })

  const rejectMutation = useApiMutation<{ id: string; reason: string }, { rejected: boolean }>(
    (vars) => api.post(`/api/admin/payments/${vars.id}/action`, { action: 'reject', reason: vars.reason }),
    {
      success: 'تم رفض الدفعة وإشعار العميل',
      invalidate: [['admin-operations'], ['admin-payments']],
    }
  )

  const approveMutation = useApiMutation<{ id: string }, unknown>(
    (vars) => api.post(`/api/admin/payments/${vars.id}/action`, { action: 'verify' }),
    {
      success: 'تم اعتماد الدفعة وتأكيد الطلب',
      invalidate: [['admin-operations'], ['admin-payments'], ['admin-dashboard']],
    }
  )

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    )
  }
  if (error || !data) return <ErrorState message={error?.message} retry={refetch} />

  const { payments, orderIssues, lowStock, returns, failedDeliveries, tickets } = data
  const canReview = can('payments.review')

  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز العمليات"
        description="كل ما يحتاج تدخلك الآن — مرتب حسب الأولوية"
        actions={<Button variant="outline" size="sm" onClick={() => refetch()}>تحديث</Button>}
      />

      {/* طابور الدفعات */}
      <Card>
        <CardContent className="space-y-3">
          <SectionHeader
            title="دفعات بانتظار المراجعة"
            icon={<CreditCard className="size-4" />}
            action={payments.length > 3 ? <button onClick={() => go('admin-payments', { status: 'SUBMITTED' })} className="text-xs text-primary hover:underline">عرض الكل</button> : undefined}
          />
          {payments.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">لا توجد دفعات بانتظار المراجعة ✅</p>}
          {payments.length > 0 && (
            <div className="space-y-2">
              {payments.slice(0, 8).map((p) => {
                const flags = riskFlagList(p.riskFlags)
                return (
                  <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-2 rounded-lg border p-3">
                    <button className="flex-1 text-start min-w-0" onClick={() => go('admin-payment-details', { id: p.id })}>
                      <p className="text-sm font-semibold">
                        {p.paymentNumber}
                        <span className="text-muted-foreground font-normal"> — {p.order.orderNumber}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.customer.name} · {p.customer.phone} · {p.submittedAt ? timeAgo(p.submittedAt) : 'لم يُسجل'}
                      </p>
                      {flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {flags.map((f) => (
                            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                              <AlertTriangle className="size-3" />
                              {RISK_FLAG_LABELS[f] ?? f}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-end">
                        <p className="text-sm font-bold tabular-nums">{money(p.submittedAmount ?? p.expectedAmount)}</p>
                        <p className="text-[10px] text-muted-foreground">المطلوب: {money(p.expectedAmount)}</p>
                      </div>
                      {canReview && (
                        <>
                          <Button size="sm" className="gap-1" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate({ id: p.id })}>
                            <BadgeCheck className="size-4" /> اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            onClick={() => { setRejectingId(p.id); setRejectingNumber(p.paymentNumber) }}
                          >
                            <XCircle className="size-4" /> رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* مشاكل الطلبات */}
      <Card>
        <CardContent className="space-y-3">
          <SectionHeader
            title="طلبات بها مشاكل"
            icon={<AlertTriangle className="size-4" />}
            action={orderIssues.length > 0 ? <button onClick={() => go('admin-orders')} className="text-xs text-primary hover:underline">كل الطلبات</button> : undefined}
          />
          {orderIssues.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">لا توجد طلبات بها مشاكل ✅</p>}
          <div className="grid gap-2 md:grid-cols-2">
            {orderIssues.map((o) => (
              <button
                key={o.id}
                onClick={() => go('admin-order-details', { id: o.id })}
                className="flex items-center justify-between gap-2 rounded-lg border p-3 text-start hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{o.orderNumber}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <StatusBadge status={o.status} label={orderStatusLabel(o.status)} />
                    <StatusBadge status={o.paymentStatus} label={paymentStatusLabel(o.paymentStatus)} />
                  </div>
                </div>
                <p className="text-sm font-bold tabular-nums shrink-0">{money(o.grandTotal)}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* مخزون منخفض */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="مخزون منخفض"
              icon={<Boxes className="size-4" />}
              action={lowStock.length > 0 && can('inventory.view') ? <button onClick={() => go('admin-inventory', { lowOnly: '1' })} className="text-xs text-primary hover:underline">إدارة المخزون</button> : undefined}
            />
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">لا توجد أصناف منخفضة ✅</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lowStock.map((l, i) => (
                <div key={l.variantId + i} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{l.product}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {attrText(l.attributes) || '—'} · {l.warehouse}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {l.onHand === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-[11px] font-bold">
                        <PackageX className="size-3" /> نفد
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                        {l.onHand} متبقي
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* المرتجعات */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="مرتجعات قيد المعالجة"
              icon={<Undo2 className="size-4" />}
              action={returns.length > 0 && can('returns.view') ? <button onClick={() => go('admin-returns')} className="text-xs text-primary hover:underline">كل المرتجعات</button> : undefined}
            />
            {returns.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">لا توجد مرتجعات معلقة ✅</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {returns.map((r) => (
                <button key={r.id} onClick={() => go('admin-returns', { status: r.status })} className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-start hover:border-primary/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.returnNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.reason} · طلب {r.orderNumber}</p>
                  </div>
                  <StatusBadge status={r.status} label={returnStatusLabel(r.status)} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* توصيل فاشل */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="توصيل فاشل / قيد الإرجاع" icon={<Truck className="size-4" />} />
            {failedDeliveries.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">لا توجد شحنات فاشلة ✅</p>}
            <div className="space-y-2">
              {failedDeliveries.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{s.trackingCode}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      طلب {s.orderNumber} · {s.customer.name} · {s.customer.phone}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-[11px] font-bold shrink-0">
                    {s.status === 'FAILED' ? 'فشل التوصيل' : 'قيد الإرجاع'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* التذاكر */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="تذاكر مفتوحة"
              icon={<LifeBuoy className="size-4" />}
              action={tickets.length > 0 && can('support.manage') ? <button onClick={() => go('admin-tickets')} className="text-xs text-primary hover:underline">كل التذاكر</button> : undefined}
            />
            {tickets.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">لا توجد تذاكر مفتوحة ✅</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => go('admin-ticket-details', { id: t.id })} className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-start hover:border-primary/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.ticketNumber} · {timeAgo(t.createdAt)}</p>
                  </div>
                  <StatusBadge status={t.status} label={ticketStatusLabel(t.status)} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* رفض دفعة (سبب إلزامي من REJECT_REASONS) */}
      <ConfirmDialog
        open={rejectingId !== null}
        onOpenChange={(v) => { if (!v) { setRejectingId(null) } }}
        title={`رفض الدفعة ${rejectingNumber}`}
        description="سيتم إشعار العميل بالسبب وإعادة الطلب لمرحلة معالجة المشكلة."
        confirmLabel="رفض الدفعة"
        danger
        requireReason
        reasonLabel="سبب الرفض"
        reasonOptions={REJECT_REASONS}
        onConfirm={async ({ reason }) => {
          if (!rejectingId) return
          await rejectMutation.mutateAsync({ id: rejectingId, reason })
          setRejectingId(null)
        }}
      />
    </div>
  )
}

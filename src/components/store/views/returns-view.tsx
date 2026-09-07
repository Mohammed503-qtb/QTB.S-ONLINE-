'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { dateFmt, money, statusColor, timeAgo } from '@/lib/client/format'
import { RETURN_STATUS_LABELS, RETURNABLE_STATUSES, type ReturnStatus, type OrderStatus } from '@/lib/shared/constants'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { SafeImg } from '../components/safe-img'
import type { ReturnRequest } from '../types'

// ============================================================
// طلبات الإرجاع — قائمة + اختيار طلب مؤهل لطلب جديد
// ============================================================

export function ReturnsView() {
  return (
    <RequireAuth title="سجّل الدخول لعرض طلبات الإرجاع">
      <ReturnsInner />
    </RequireAuth>
  )
}

function ReturnsInner() {
  const go = useNav((s) => s.go)
  const [pickOpen, setPickOpen] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['returns'],
    queryFn: () => api.get<ReturnRequest[]>('/api/returns'),
  })

  // طلبات مؤهلة للإرجاع (DELIVERED/COMPLETED) — لل اختيار عند طلب جديد
  const { data: ordersData } = useQuery({
    queryKey: ['orders', 1],
    queryFn: () => api.get<{ total: number; orders: { id: string; orderNumber: string; status: string; grandTotal: number; placedAt: string | null }[] }>('/api/orders?page=1&limit=24'),
    enabled: pickOpen,
  })
  const eligibleOrders = (ordersData?.orders ?? []).filter((o) => RETURNABLE_STATUSES.includes(o.status as OrderStatus))

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">طلبات الإرجاع</h1>
        <Button className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={() => setPickOpen(true)}>
          <Plus className="size-4" aria-hidden />
          طلب إرجاع جديد
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error || !data ? (
        <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل طلبات الإرجاع'} retry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="↩️"
          title="لا توجد طلبات إرجاع"
          subtitle="يمكنك طلب الإرجاع خلال نافذة الإرجاع بعد استلام طلبك"
          action={
            <Button variant="outline" className="min-h-11" onClick={() => go('orders')}>
              طلباتي
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <ReturnCard key={r.id} request={r} />
          ))}
        </div>
      )}

      {/* حوار اختيار طلب مؤهل */}
      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>اختر طلبًا لإرجاع أصنافه</DialogTitle>
            <DialogDescription>متاح للطلبات المسلّمة أو المكتملة فقط</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto pe-1">
            {!ordersData && <Skeleton className="h-16 w-full rounded-xl" />}
            {ordersData && eligibleOrders.length === 0 && (
              <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">لا توجد طلبات مؤهلة للإرجاع حاليًا</p>
            )}
            {eligibleOrders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setPickOpen(false)
                  go('return-new', { orderId: o.id })
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card p-3 text-start transition-colors hover:border-emerald-400"
              >
                <span>
                  <span className="font-mono font-bold" dir="ltr">{o.orderNumber}</span>
                  <span className="block text-xs text-muted-foreground">
                    {money(o.grandTotal)} · {dateFmt(o.placedAt)}
                  </span>
                </span>
                <ChevronLeft className="size-5 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReturnCard({ request }: { request: ReturnRequest }) {
  return (
    <article className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono font-bold" dir="ltr">
          <RotateCcw className="size-4 text-emerald-600" aria-hidden />
          {request.returnNumber}
        </span>
        <span className={cn('rounded-full px-3 py-0.5 text-xs font-bold', statusColor(request.status))}>
          {RETURN_STATUS_LABELS[request.status as ReturnStatus] ?? request.status}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        بخصوص الطلب <span className="font-mono" dir="ltr">{request.order.orderNumber}</span> · {money(request.order.grandTotal)} · {timeAgo(request.createdAt)}
      </p>
      <div className="space-y-1 rounded-xl bg-muted/50 p-2.5 text-sm">
        <p><b>السبب:</b> {request.reason}</p>
        {request.customerNote && <p className="text-muted-foreground">{request.customerNote}</p>}
      </div>
      <ul className="space-y-1">
        {request.items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-muted/40">
              <SafeImg src={item.imageUrl} alt={item.productName} className="size-full" />
            </span>
            <span className="flex-1 truncate">{item.productName}</span>
            <span className="text-muted-foreground">×{item.quantity}</span>
          </li>
        ))}
      </ul>
      {request.refunds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          الاسترداد: {request.refunds.map((ref) => `${money(ref.amount)} (${RETURN_STATUS_LABELS[ref.status as ReturnStatus] ?? ref.status})`).join('، ')}
        </p>
      )}
    </article>
  )
}

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Package, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { dateFmt, money, orderStatusLabel, paymentStatusLabel, statusColor } from '@/lib/client/format'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { SafeImg } from '../components/safe-img'
import type { OrderListItem, OrdersListResult } from '../types'

// ============================================================
// طلباتي — بطاقات + فلاتر حالة + ترقيم صفحات
// ============================================================

const STATUS_FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'PENDING_PAYMENT', label: 'بانتظار الدفع' },
  { value: 'PAYMENT_REVIEW', label: 'قيد المراجعة' },
  { value: 'PROCESSING', label: 'قيد التجهيز' },
  { value: 'SHIPPED', label: 'تم الشحن' },
  { value: 'DELIVERED', label: 'تم التسليم' },
  { value: 'COMPLETED', label: 'مكتمل' },
  { value: 'CANCELLED', label: 'ملغي' },
] as const

const PAGE_LIMIT = 10

export function OrdersView() {
  return (
    <RequireAuth title="سجّل الدخول لعرض طلباتك">
      <OrdersInner />
    </RequireAuth>
  )
}

function OrdersInner() {
  const go = useNav((s) => s.go)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['orders', page],
    queryFn: () => api.get<OrdersListResult>(`/api/orders?page=${page}&limit=${PAGE_LIMIT}`),
  })

  const orders = (data?.orders ?? []).filter((o) => !statusFilter || o.status === statusFilter)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_LIMIT)) : 1

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <h1 className="text-2xl font-extrabold">طلباتي</h1>

      {/* فلاتر الحالة */}
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="فلترة حسب الحالة">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'min-h-9 shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              statusFilter === f.value
                ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-600'
                : 'bg-card hover:bg-accent'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل الطلبات'} retry={() => refetch()} />
      ) : data.orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="لا توجد طلبات بعد"
          subtitle="ابدأ أول عملية شراء واستمتع بتجربة سهلة"
          action={
            <Button onClick={() => go('catalog')} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
              تسوق الآن
            </Button>
          }
        />
      ) : orders.length === 0 ? (
        <EmptyState icon="🔍" title="لا توجد طلبات بهذه الحالة" subtitle="جرّب فلترًا آخر" />
      ) : (
        <div className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onOpen={() => go('order-details', { id: order.id })} />
          ))}
        </div>
      )}

      {/* ترقيم الصفحات */}
      {data && data.orders.length > 0 && totalPages > 1 && (
        <nav aria-label="ترقيم الصفحات" className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" className="size-11" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="الصفحة السابقة">
            <ChevronRight className="size-5" aria-hidden />
          </Button>
          <span className="text-sm font-medium">صفحة {page} من {totalPages} ({data.total} طلب)</span>
          <Button variant="outline" size="icon" className="size-11" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="الصفحة التالية">
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  )
}

function OrderCard({ order, onOpen }: { order: OrderListItem; onOpen: () => void }) {
  const previewImages = order.items.slice(0, 3).map((i) => i.imageUrl).filter(Boolean)
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-2xl border bg-card p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600"
      aria-label={`تفاصيل الطلب ${order.orderNumber}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono font-bold" dir="ltr">
          <Receipt className="size-4 text-emerald-600" aria-hidden />
          {order.orderNumber}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', statusColor(order.status))}>{orderStatusLabel(order.status)}</span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', statusColor(order.paymentStatus))}>{paymentStatusLabel(order.paymentStatus)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {previewImages.length > 0 ? (
            <div className="flex -space-x-2 space-x-reverse" dir="rtl">
              {previewImages.map((img, i) => (
                <span key={i} className="size-11 overflow-hidden rounded-xl border-2 border-card bg-muted/40">
                  <SafeImg src={img} alt="" className="size-full" />
                </span>
              ))}
            </div>
          ) : (
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
              <Package className="size-5 text-muted-foreground" aria-hidden />
            </span>
          )}
          <div className="text-xs text-muted-foreground">
            <p>{totalQty} منتج · {dateFmt(order.placedAt ?? order.createdAt)}</p>
            <p className="font-bold text-foreground">{money(order.grandTotal)}</p>
          </div>
        </div>
        <ChevronLeft className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </button>
  )
}

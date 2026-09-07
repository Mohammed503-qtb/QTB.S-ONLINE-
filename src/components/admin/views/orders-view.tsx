'use client'

// ============================================================
// قائمة الطلبات — فلاتر الحالة بعدادات + بحث + ترقيم
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/client/api'
import { money, orderStatusLabel, paymentStatusLabel, timeAgo } from '@/lib/client/format'
import { ORDER_STATUSES } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, Pager, SearchInput, StatusBadge, StatusTabs, useDebounced, PAYMENT_METHOD_LABELS, SmartImage } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { OrderRow, StatusCounts } from '@/components/admin/types'

type OrdersResponse = { total: number; page: number; pages: number; orders: OrderRow[]; statusCounts: StatusCounts }

export function OrdersView() {
  const go = useNav((s) => s.go)
  const params = useNav((s) => s.params)

  const [status, setStatus] = useState<string>(params.status ?? '')
  const [search, setSearch] = useState(params.search ?? '')
  const debouncedSearch = useDebounced(search)
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin-orders', { status, search: debouncedSearch, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15' })
      if (status) sp.set('status', status)
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      return api.get<OrdersResponse>(`/api/admin/orders?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const statusCounts = query.data?.statusCounts ?? {}
  const tabs = [
    { value: '', label: 'الكل', count: Object.values(statusCounts).reduce((s, v) => s + v, 0) },
    ...ORDER_STATUSES
      .filter((s) => (statusCounts[s] ?? 0) > 0 || s === status)
      .map((s) => ({ value: s, label: orderStatusLabel(s), count: statusCounts[s] ?? 0 })),
  ]

  const columns: Column<OrderRow>[] = [
    {
      key: 'order',
      header: 'الطلب',
      cell: (o) => (
        <div className="min-w-0">
          <p className="font-semibold text-sm" dir="ltr">{o.orderNumber}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(o.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'العميل',
      cell: (o) => (
        <div className="min-w-0">
          <p className="text-sm truncate max-w-36">{o.customer?.user.name ?? '—'}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{o.customer?.user.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'الأصناف',
      cell: (o) => (
        <div className="flex items-center gap-1.5">
          {o.items?.[0]?.imageUrl ? <SmartImage src={o.items[0].imageUrl} alt="صورة المنتج" className="size-9" /> : null}
          <span className="text-xs text-muted-foreground">
            {o.items?.length ?? 0} صنف
            {o.items?.[0] ? ` · ${o.items[0].productName}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (o) => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={o.status} label={orderStatusLabel(o.status)} />
          <StatusBadge status={o.paymentStatus} label={paymentStatusLabel(o.paymentStatus)} />
        </div>
      ),
    },
    {
      key: 'method',
      header: 'الدفع',
      cell: (o) => <span className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}</span>,
    },
    {
      key: 'total',
      header: 'الإجمالي',
      cell: (o) => <span className="font-bold tabular-nums text-sm">{money(o.grandTotal)}</span>,
      thClassName: 'text-end',
      className: 'text-end',
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="الطلبات"
        description={query.data ? `${query.data.total} طلب إجمالًا` : 'إدارة ومتابعة الطلبات'}
        onBack={page === 1 && !status && !search ? undefined : () => { setPage(1); setStatus(''); setSearch('') }}
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="بحث برقم الطلب / كود الدفع / التتبع / هاتف أو اسم العميل..."
              className="flex-1"
            />
          </div>
          <StatusTabs
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={tabs}
          />
          <DataTable
            columns={columns}
            rows={query.data?.orders}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="🛍️"
            emptyTitle="لا توجد طلبات مطابقة"
            emptySubtitle={status || search ? 'جرّب تغيير الفلاتر أو البحث' : 'لم يُسجل أي طلب بعد'}
            onRowClick={(o) => go('admin-order-details', { id: o.id })}
            footer={
              <Pager
                page={query.data?.page ?? 1}
                pages={query.data?.pages ?? 1}
                onChange={setPage}
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

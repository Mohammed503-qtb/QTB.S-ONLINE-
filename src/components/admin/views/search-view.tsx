'use client'

// ============================================================
// البحث الشامل — نتائج بأقسام: طلبات/دفعات/عملاء/منتجات/
// مرتجعات/شحنات، كل نتيجة تنقل لصفحة تفاصيلها
// ============================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, orderStatusLabel, paymentStatusLabel, returnStatusLabel, shipmentStatusLabel } from '@/lib/client/format'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, SearchInput, SmartImage, StatusBadge, useDebounced, usePerm } from '@/components/admin/components/kit'
import { MiniEmpty } from '@/components/admin/components/kit'
import type { SearchResponse } from '@/components/admin/types'

export function SearchView({ q }: { q: string }) {
  const go = useNav((s) => s.go)
  const { can } = usePerm()
  const [search, setSearch] = useState(q)
  const debouncedSearch = useDebounced(search, 300)

  const query = useQuery({
    queryKey: ['admin-search', { q: debouncedSearch }],
    queryFn: () => api.get<SearchResponse>(`/api/admin/search?q=${encodeURIComponent(debouncedSearch.trim())}`),
    enabled: debouncedSearch.trim().length > 0,
  })

  const data = query.data
  const hasResults =
    data &&
    (data.orders.length > 0 || data.payments.length > 0 || data.customers.length > 0 || data.products.length > 0 || data.returns.length > 0 || data.shipments.length > 0)

  const section = (title: string, icon: string, count: number, children: React.ReactNode) => (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <span className="text-lg">{icon}</span> {title}
            <span className="rounded-full bg-muted text-muted-foreground px-2 py-px text-[11px] tabular-nums">{count}</span>
          </h2>
        </div>
        {count === 0 ? <p className="text-sm text-muted-foreground py-2">لا نتائج في هذا القسم</p> : children}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      <PageHeader title="البحث الشامل" description={q ? `نتائج البحث عن: ${q}` : 'ابحث في كل أقسام المتجر'} onBack={q ? () => go('admin-dashboard') : undefined} />

      <Card>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); if (search.trim()) go('admin-search', { q: search.trim() }) }}
            className="flex gap-2"
            role="search"
          >
            <div className="relative flex-1">
              <SearchIcon className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="رقم طلب / دفعة / مرتجع / كود تتبع / هاتف / اسم..."
                className="ps-3 pe-9 h-10"
                aria-label="بحث شامل"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!search.trim()}>بحث</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            يدعم: ORD / PAY / RET / TRK / أرقام الهواتف وأسماء العملاء وأسماء المنتجات
          </p>
        </CardContent>
      </Card>

      {query.isLoading && <p className="text-sm text-muted-foreground text-center py-8">جارِ البحث...</p>}
      {query.error && <p className="text-sm text-rose-600 text-center py-8">تعذر البحث: {query.error.message}</p>}

      {!query.isLoading && debouncedSearch.trim() && data && !hasResults && (
        <MiniEmpty icon="🔍" title="لا نتائج" subtitle={`لم نجد شيئًا يطابق «${debouncedSearch}»`} />
      )}

      {data && hasResults && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* الطلبات */}
          {can('orders.view') &&
            section('الطلبات', '🛍️', data.orders.length, (
              <div className="space-y-2">
                {data.orders.map((o) => (
                  <button key={o.id} onClick={() => go('admin-order-details', { id: o.id })} className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-start hover:border-primary/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" dir="ltr">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.customer?.user.name ?? '—'}
                        {o.paymentReference ? ` · دفع: ${o.paymentReference}` : ''}
                        {o.trackingCode ? ` · تتبع: ${o.trackingCode}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={o.status} label={orderStatusLabel(o.status)} />
                      <span className="text-xs font-bold tabular-nums">{money(o.grandTotal)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}

          {/* الدفعات */}
          {can('payments.view') &&
            section('المدفوعات', '💳', data.payments.length, (
              <div className="space-y-2">
                {data.payments.map((p) => (
                  <button key={p.id} onClick={() => go('admin-payment-details', { id: p.id })} className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-start hover:border-primary/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" dir="ltr">{p.paymentNumber}</p>
                      <p className="text-xs text-muted-foreground">طلب {p.order.orderNumber}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={p.status} label={paymentStatusLabel(p.status)} />
                      <span className="text-xs tabular-nums">{money(p.submittedAmount ?? p.expectedAmount)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}

          {/* العملاء */}
          {can('customers.view') &&
            section('العملاء', '👥', data.customers.length, (
              <div className="space-y-2">
                {data.customers.map((c) => (
                  <button key={c.id} onClick={() => go('admin-customer-details', { id: c.id })} className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-start hover:border-primary/40 transition-colors">
                    <p className="text-sm font-semibold truncate">{c.user.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{c.user.phone}</p>
                  </button>
                ))}
              </div>
            ))}

          {/* المنتجات */}
          {can('products.update') &&
            section('المنتجات', '📦', data.products.length, (
              <div className="space-y-2">
                {data.products.map((p) => (
                  <button key={p.id} onClick={() => go('admin-products')} className="w-full flex items-center gap-2.5 rounded-lg border p-2.5 text-start hover:border-primary/40 transition-colors">
                    <SmartImage src={p.imageUrl} alt={p.name} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.status === 'ACTIVE' ? 'نشط' : p.status === 'ARCHIVED' ? 'مؤرشف' : 'مسودة'}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0">{money(p.basePrice)}</span>
                  </button>
                ))}
              </div>
            ))}

          {/* المرتجعات */}
          {can('returns.view') &&
            section('المرتجعات', '↩️', data.returns.length, (
              <div className="space-y-2">
                {data.returns.map((r) => (
                  <button key={r.id} onClick={() => go('admin-returns', { status: r.status })} className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-start hover:border-primary/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" dir="ltr">{r.returnNumber}</p>
                      <p className="text-xs text-muted-foreground">طلب {r.order.orderNumber}</p>
                    </div>
                    <StatusBadge status={r.status} label={returnStatusLabel(r.status)} />
                  </button>
                ))}
              </div>
            ))}

          {/* الشحنات */}
          {can('orders.view') &&
            section('الشحنات', '🚚', data.shipments.length, (
              <div className="space-y-2">
                {data.shipments.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" dir="ltr">{s.trackingCode}</p>
                      <p className="text-xs text-muted-foreground">طلب {s.order.orderNumber}</p>
                    </div>
                    <StatusBadge status={s.status} label={shipmentStatusLabel(s.status)} />
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

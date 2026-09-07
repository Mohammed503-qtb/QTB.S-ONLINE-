'use client'

// ============================================================
// العملاء — جدول (بحث/تصنيف VIP) ينقل للملف الكامل
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/client/api'
import { money, timeAgo } from '@/lib/client/format'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Pager, SearchInput, StatusBadge, TIER_LABELS, useDebounced } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { CustomerRow } from '@/components/admin/types'

type CustomersResponse = { total: number; page: number; pages: number; customers: CustomerRow[] }

export function CustomersView() {
  const go = useNav((s) => s.go)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [tier, setTier] = useState('')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin-customers', { search: debouncedSearch, tier, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15' })
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      if (tier) sp.set('tier', tier)
      return api.get<CustomersResponse>(`/api/admin/customers?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const columns: Column<CustomerRow>[] = [
    {
      key: 'customer',
      header: 'العميل',
      cell: (c) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-40">{c.user.name}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{c.user.phone}</p>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'التصنيف',
      cell: (c) => <StatusBadge status={c.tier === 'VIP' ? 'APPROVED' : c.tier === 'BLOCKED' ? 'BLOCKED' : 'UNPAID'} label={TIER_LABELS[c.tier] ?? c.tier} />,
    },
    {
      key: 'orders',
      header: 'الطلبات',
      cell: (c) => (
        <div className="text-xs">
          <p className="tabular-nums font-semibold">{c._count?.orders ?? c.ordersCount ?? 0} طلب</p>
          <p className="text-muted-foreground">{c._count?.returnRequests ?? 0} مرتجع · {c._count?.tickets ?? 0} تذكرة</p>
        </div>
      ),
    },
    {
      key: 'spent',
      header: 'إجمالي الشراء',
      cell: (c) => <span className="text-sm font-bold tabular-nums">{money(c.totalSpent)}</span>,
    },
    {
      key: 'credit',
      header: 'رصيد دائن',
      cell: (c) => (
        <span className={`text-sm tabular-nums ${c.creditBalance > 0 ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
          {c.creditBalance > 0 ? money(c.creditBalance) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (c) => (
        <span className={`text-xs font-semibold ${c.user.status === 'ACTIVE' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {c.user.status === 'ACTIVE' ? 'نشط' : c.user.status === 'SUSPENDED' ? 'موقوف' : 'محظور'}
        </span>
      ),
    },
    {
      key: 'since',
      header: 'عميل منذ',
      cell: (c) => <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="العملاء" description={query.data ? `${query.data.total} عميل` : 'قاعدة عملاء المتجر'} />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="بحث بالاسم / الهاتف / البريد..." className="flex-1" />
            <Select value={tier || '__all__'} onValueChange={(v) => { setTier(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-40 w-full"><SelectValue placeholder="كل التصنيفات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل التصنيفات</SelectItem>
                {Object.entries(TIER_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            rows={query.data?.customers}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="👥"
            emptyTitle="لا يوجد عملاء مطابقون"
            onRowClick={(c) => go('admin-customer-details', { id: c.id })}
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>
    </div>
  )
}

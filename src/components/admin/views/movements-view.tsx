'use client'

// ============================================================
// سجل حركات المخزون — فلاتر (نوع/مخزن/بحث) + الكمية +أخضر/-أحمر
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ArrowLeftRight } from 'lucide-react'
import { api } from '@/lib/client/api'
import { dateTimeFmt } from '@/lib/client/format'
import { MOVEMENT_TYPES } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MOVEMENT_LABELS, PageHeader, Pager, SearchInput, attrText, useDebounced } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { MovementRow, WarehouseRow } from '@/components/admin/types'

type MovementsResponse = { total: number; page: number; pages: number; movements: MovementRow[] }
type WarehousesResponse = WarehouseRow[]

export function MovementsView() {
  const params = useNav((s) => s.params)
  const [type, setType] = useState(params.type ?? '')
  const [warehouseId, setWarehouseId] = useState(params.warehouseId ?? '')
  const [variantId] = useState(params.variantId ?? '')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 200)
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin-movements', { type, warehouseId, variantId, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '30' })
      if (type) sp.set('type', type)
      if (warehouseId) sp.set('warehouseId', warehouseId)
      if (variantId) sp.set('variantId', variantId)
      return api.get<MovementsResponse>(`/api/admin/inventory/movements?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const warehousesQuery = useQuery({
    queryKey: ['admin-warehouses-lite'],
    queryFn: () => api.get<WarehousesResponse>('/api/admin/warehouses'),
    staleTime: 60_000,
  })

  // بحث على صفحة الحالية (بحث نصي محلي)
  const rows = (query.data?.movements ?? []).filter(
    (m) => !debouncedSearch.trim() || m.productName.includes(debouncedSearch.trim()) || (m.refNumber ?? '').includes(debouncedSearch.trim().toUpperCase())
  )

  const columns: Column<MovementRow>[] = [
    {
      key: 'product',
      header: 'المنتج',
      cell: (m) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-52">{m.productName}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-52">{attrText(m.attributes) || '—'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'نوع الحركة',
      cell: (m) => <span className="text-sm">{MOVEMENT_LABELS[m.movementType] ?? m.movementType}</span>,
    },
    {
      key: 'warehouse',
      header: 'المخزن',
      cell: (m) => <span className="text-sm">{m.warehouse.name}</span>,
    },
    {
      key: 'delta',
      header: 'الكمية',
      cell: (m) => (
        <span className={`text-sm font-bold tabular-nums ${m.quantityDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {m.quantityDelta >= 0 ? '+' : ''}{m.quantityDelta}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'الرصيد بعدها',
      cell: (m) => <span className="text-sm tabular-nums text-muted-foreground">{m.balanceAfter ?? '—'}</span>,
    },
    {
      key: 'ref',
      header: 'مرجع العملية',
      cell: (m) => (
        <div className="min-w-0">
          {m.refNumber ? (
            <p className="text-xs font-medium" dir="ltr">{m.refNumber}</p>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {m.reason && <p className="text-[11px] text-muted-foreground truncate max-w-40">{m.reason}</p>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      cell: (m) => <span className="text-xs text-muted-foreground whitespace-nowrap">{dateTimeFmt(m.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="سجل حركات المخزون" description={query.data ? `${query.data.total} حركة مسجلة` : 'كل تغيير في الأرصدة له حركة موثقة'} />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث في الصفحة الحالية (منتج/مرجع)..." className="flex-1" />
            <Select value={type || '__all__'} onValueChange={(v) => { setType(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-44 w-full">
                <SelectValue placeholder="كل الأنواع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل الأنواع</SelectItem>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{MOVEMENT_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warehouseId || '__all__'} onValueChange={(v) => { setWarehouseId(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-44 w-full">
                <SelectValue placeholder="كل المخازن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل المخازن</SelectItem>
                {(warehousesQuery.data ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {variantId && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ArrowLeftRight className="size-3.5" />
              مفلترة على متغير محدد — امسح الفلتر من صفحة المخزون
            </p>
          )}

          <DataTable
            columns={columns}
            rows={rows}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="🧾"
            emptyTitle="لا توجد حركات مطابقة"
            compact
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>
    </div>
  )
}

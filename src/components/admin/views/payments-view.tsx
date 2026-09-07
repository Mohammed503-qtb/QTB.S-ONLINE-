'use client'

// ============================================================
// طابور المدفوعات — tabs بالحالات + شارات المخاطر + بحث + فرز
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { AlertTriangle, Flag } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, paymentStatusLabel, timeAgo } from '@/lib/client/format'
import { PAYMENT_STATUSES } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { PageHeader, Pager, RISK_FLAG_LABELS, SearchInput, StatusBadge, StatusTabs, riskFlagList, useDebounced } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { PaymentRow, StatusCounts } from '@/components/admin/types'

type PaymentsResponse = { total: number; page: number; pages: number; payments: PaymentRow[]; statusCounts: StatusCounts }

export function PaymentsView() {
  const go = useNav((s) => s.go)
  const params = useNav((s) => s.params)

  const [status, setStatus] = useState<string>(params.status ?? '')
  const [search, setSearch] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const debouncedSearch = useDebounced(search)
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin-payments', { status, search: debouncedSearch, flaggedOnly, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15', risk: flaggedOnly ? 'flagged' : 'all' })
      if (status) sp.set('status', status)
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      return api.get<PaymentsResponse>(`/api/admin/payments?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const statusCounts = query.data?.statusCounts ?? {}
  const tabs = [
    { value: '', label: 'الكل', count: Object.values(statusCounts).reduce((s, v) => s + v, 0) },
    ...PAYMENT_STATUSES
      .filter((s) => (statusCounts[s] ?? 0) > 0 || s === status)
      .map((s) => ({ value: s, label: paymentStatusLabel(s), count: statusCounts[s] ?? 0 })),
  ]

  const columns: Column<PaymentRow>[] = [
    {
      key: 'payment',
      header: 'الدفعة',
      cell: (p) => (
        <div className="min-w-0">
          <p className="font-semibold text-sm" dir="ltr">{p.paymentNumber}</p>
          <p className="text-[11px] text-muted-foreground">{p.submittedAt ? timeAgo(p.submittedAt) : p.verifiedAt ? `اعتمدت ${timeAgo(p.verifiedAt)}` : 'بانتظار التحويل'}</p>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'الطلب / العميل',
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-sm font-medium" dir="ltr">{p.order?.orderNumber ?? '—'}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-36">{p.order?.customer?.user.name ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'amounts',
      header: 'المبالغ',
      cell: (p) => (
        <div className="text-xs">
          <p>المطلوب: <span className="tabular-nums font-medium">{money(p.expectedAmount)}</span></p>
          <p>المحوّل: <span className="tabular-nums font-medium">{p.submittedAmount != null ? money(p.submittedAmount) : '—'}</span></p>
          {p.paidAmount > 0 && <p className="text-emerald-700 dark:text-emerald-400">المعتمد: <span className="tabular-nums">{money(p.paidAmount)}</span></p>}
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'المخاطر',
      cell: (p) => {
        const flags = riskFlagList(p.riskFlags)
        if (!flags.length) return <span className="text-muted-foreground text-xs">—</span>
        return (
          <div className="flex flex-col gap-1 items-start">
            {flags.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                <AlertTriangle className="size-3" />
                {RISK_FLAG_LABELS[f] ?? f}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (p) => <StatusBadge status={p.status} label={paymentStatusLabel(p.status)} />,
    },
    {
      key: 'proof',
      header: 'الإيصال',
      cell: (p) =>
        p.proofUrl ? (
          <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            عرض
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="طابور المدفوعات"
        description={query.data ? `${query.data.total} سجل دفع` : 'مراجعة تحويلات العملاء واعتمادها'}
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="بحث برقم الدفعة / مرجع التحويل / الطلب / العميل..."
              className="flex-1"
            />
            <div className="flex items-center gap-2 border rounded-md px-3 h-10 shrink-0">
              <Switch id="flagged-only" checked={flaggedOnly} onCheckedChange={(v) => { setFlaggedOnly(v); setPage(1) }} />
              <Label htmlFor="flagged-only" className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Flag className="size-3.5 text-amber-600" /> المخاطر فقط
              </Label>
            </div>
          </div>

          <StatusTabs
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={tabs}
          />

          <DataTable
            columns={columns}
            rows={query.data?.payments}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="💳"
            emptyTitle="لا توجد دفعات مطابقة"
            emptySubtitle={status || search || flaggedOnly ? 'جرّب تغيير الفلاتر' : 'لم يُسجل أي دفع بعد'}
            onRowClick={(p) => go('admin-payment-details', { id: p.id })}
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>
    </div>
  )
}

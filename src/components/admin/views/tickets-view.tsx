'use client'

// ============================================================
// تذاكر الدعم — جدول + tabs بالحالات + آخر رسالة
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { LifeBuoy } from 'lucide-react'
import { api } from '@/lib/client/api'
import { ticketStatusLabel, timeAgo } from '@/lib/client/format'
import { TICKET_STATUSES } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, Pager, StatusBadge, StatusTabs, TICKET_CATEGORY_LABELS } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { StatusCounts, TicketRow } from '@/components/admin/types'

type TicketsResponse = { total: number; page: number; pages: number; tickets: TicketRow[]; statusCounts?: StatusCounts }

export function TicketsView() {
  const go = useNav((s) => s.go)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin-tickets', { status, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15' })
      if (status) sp.set('status', status)
      return api.get<TicketsResponse>(`/api/admin/tickets?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
    refetchInterval: 90_000,
  })

  const tabs = [
    { value: '', label: 'الكل', count: query.data?.total },
    ...TICKET_STATUSES.map((s) => ({ value: s, label: ticketStatusLabel(s) })),
  ]

  const columns: Column<TicketRow>[] = [
    {
      key: 'ticket',
      header: 'التذكرة',
      cell: (t) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{t.ticketNumber}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(t.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'الموضوع',
      cell: (t) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate max-w-52">{t.subject}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] rounded-full bg-muted px-1.5 py-px text-muted-foreground">
              {TICKET_CATEGORY_LABELS[t.category] ?? t.category}
            </span>
            {t.messages?.[0] && <span className="text-[11px] text-muted-foreground truncate max-w-36">{t.messages[0].body}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'العميل',
      cell: (t) => (
        <div className="min-w-0">
          <p className="text-sm truncate max-w-32">{t.customer?.user.name ?? '—'}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{t.customer?.user.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (t) => <StatusBadge status={t.status} label={ticketStatusLabel(t.status)} />,
    },
    {
      key: 'updated',
      header: 'آخر تحديث',
      cell: (t) => <span className="text-xs text-muted-foreground">{timeAgo(t.updatedAt)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="تذاكر الدعم"
        description={query.data ? `${query.data.total} تذكرة` : 'طلبات دعم العملاء'}
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LifeBuoy className="size-4 text-primary" /> ترتيب: الأقدم أولًا داخل كل حالة
          </span>
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <StatusTabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={tabs} />
          <DataTable
            columns={columns}
            rows={query.data?.tickets}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="🎧"
            emptyTitle="لا توجد تذاكر"
            onRowClick={(t) => go('admin-ticket-details', { id: t.id })}
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>
    </div>
  )
}

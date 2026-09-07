'use client'

// ============================================================
// سجل التدقيق — من فعل ماذا ومتى ولماذا (قيم قبل/بعد JSON)
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { api } from '@/lib/client/api'
import { dateTimeFmt, roleLabel } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Pager, SearchInput, JsonBlock, useDebounced } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { AuditRow } from '@/components/admin/types'

type AuditResponse = {
  total: number; page: number; pages: number
  logs: AuditRow[]
  actionTypes: { action: string; count: number }[]
}

export function AuditView() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin-audit', { search: debouncedSearch, action, entityType, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '30' })
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      if (action) sp.set('action', action)
      if (entityType.trim()) sp.set('entityType', entityType.trim())
      return api.get<AuditResponse>(`/api/admin/audit?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const columns: Column<AuditRow>[] = [
    {
      key: 'actor',
      header: 'من',
      cell: (l) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-32">{l.actor?.name ?? 'النظام'}</p>
          <p className="text-[11px] text-muted-foreground">{l.actorRole ? roleLabel(l.actorRole) : ''}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'الإجراء',
      cell: (l) => <span className="text-xs font-mono" dir="ltr">{l.action}</span>,
    },
    {
      key: 'entity',
      header: 'الكيان',
      cell: (l) => (
        <div className="min-w-0">
          <p className="text-xs" dir="ltr">{l.entityType}</p>
          <p className="text-[10px] text-muted-foreground truncate max-w-28" dir="ltr">{l.entityId.slice(0, 14)}…</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'السبب',
      cell: (l) => <span className="text-xs text-muted-foreground truncate block max-w-40">{l.reason ?? '—'}</span>,
    },
    {
      key: 'values',
      header: 'القيم (قبل/بعد)',
      cell: (l) => {
        const hasOld = l.oldValues !== null && l.oldValues !== undefined
        const hasNew = l.newValues !== null && l.newValues !== undefined
        if (!hasOld && !hasNew) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <details className="text-xs" data-no-row-click>
            <summary className="cursor-pointer text-primary select-none">عرض JSON</summary>
            <div className="space-y-1.5 pt-1.5">
              {hasOld && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">قبل:</p>
                  <JsonBlock value={l.oldValues} className="max-w-56" />
                </div>
              )}
              {hasNew && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">بعد:</p>
                  <JsonBlock value={l.newValues} className="max-w-56" />
                </div>
              )}
            </div>
          </details>
        )
      },
    },
    {
      key: 'time',
      header: 'الوقت',
      cell: (l) => <span className="text-xs text-muted-foreground whitespace-nowrap">{dateTimeFmt(l.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="سجل التدقيق"
        description={query.data ? `${query.data.total} عملية موثقة` : 'كل إجراء حساس له سجل'}
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="بحث في الإجراء/الكيان/السبب..." className="flex-1" />
            <Select value={action || '__all__'} onValueChange={(v) => { setAction(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-52 w-full"><SelectValue placeholder="كل الإجراءات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل الإجراءات ({query.data?.actionTypes.length ?? 0})</SelectItem>
                {(query.data?.actionTypes ?? []).map((a) => (
                  <SelectItem key={a.action} value={a.action}>
                    <span dir="ltr" className="font-mono text-xs">{a.action}</span> ({a.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(1) }}
              placeholder="نوع الكيان (product, order...)"
              dir="ltr"
              className="sm:w-52"
              aria-label="فلتر نوع الكيان"
            />
          </div>

          <DataTable
            columns={columns}
            rows={query.data?.logs}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="📜"
            emptyTitle="لا توجد سجلات مطابقة"
            compact
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ScrollText className="size-3.5" />
            لا حذف مالي ولا تعديل بلا أثر — كل عملية حساسة تسجل هنا (من الخادم)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

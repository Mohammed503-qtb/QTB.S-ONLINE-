'use client'

// ============================================================
// التقييمات — موافقة / إخفاء / حذف
// ============================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, EyeOff, Trash2 } from 'lucide-react'
import { api } from '@/lib/client/api'
import { timeAgo } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader, REVIEW_STATUS_LABELS, SearchInput, SmartImage, StatusBadge, StatusTabs, Stars, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { ReviewRow } from '@/components/admin/types'

export function ReviewsView() {
  const qc = useQueryClient()
  const { can } = usePerm()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 200)
  const [deleteTarget, setDeleteTarget] = useState<ReviewRow | null>(null)

  const query = useQuery({
    queryKey: ['admin-reviews', { status }],
    queryFn: () => {
      const sp = new URLSearchParams()
      if (status) sp.set('status', status)
      return api.get<ReviewRow[]>(`/api/admin/reviews?${sp.toString()}`)
    },
  })

  const updateMutation = useApiMutation<{ id: string; status: string }, unknown>(
    (vars) => api.put('/api/admin/reviews', vars),
    {
      success: (res, vars) => (vars.status === 'APPROVED' ? 'تم اعتماد التقييم ونشره' : vars.status === 'HIDDEN' ? 'تم إخفاء التقييم' : 'تم التحديث'),
      invalidate: [['admin-reviews'], ['admin-products']],
    }
  )

  const deleteMutation = useApiMutation<string, unknown>(
    (id) => api.del(`/api/admin/reviews?id=${id}`),
    {
      success: 'تم حذف التقييم نهائيًا',
      invalidate: [['admin-reviews']],
      onDone: () => setDeleteTarget(null),
    }
  )

  const rows = (query.data ?? []).filter(
    (r) => !debouncedSearch.trim() || (r.comment ?? '').includes(debouncedSearch.trim()) || r.product.name.includes(debouncedSearch.trim()) || (r.customer?.user.name ?? '').includes(debouncedSearch.trim())
  )

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-reviews'] })

  const tabs = [
    { value: '', label: 'الكل', count: query.data?.length },
    ...Object.entries(REVIEW_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="التقييمات" description={query.data ? `${query.data.length} تقييم` : 'مراجعة تقييمات المنتجات قبل النشر'} />

      <Card>
        <CardContent className="space-y-3">
          <SearchInput value={search} onChange={setSearch} placeholder="بحث في التعليقات / المنتج / العميل (في الصفحة الحالية)..." className="sm:max-w-md" />
          <StatusTabs value={status} onChange={setStatus} options={tabs} />

          {query.isLoading && <p className="text-sm text-muted-foreground py-6 text-center">جارِ التحميل...</p>}
          {query.error && <p className="text-sm text-rose-600 py-6 text-center">تعذر التحميل: {query.error.message}</p>}
          {rows.length === 0 && !query.isLoading && <p className="text-sm text-muted-foreground py-6 text-center">لا توجد تقييمات مطابقة</p>}

          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
                <SmartImage src={r.product.imageUrl} alt={r.product.name} className="size-12 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold truncate">{r.product.name}</p>
                    <Stars rating={r.rating} />
                    <StatusBadge status={r.status} label={REVIEW_STATUS_LABELS[r.status] ?? r.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.customer?.user.name ?? 'عميل'} · {timeAgo(r.createdAt)}
                  </p>
                  {r.comment && <p className="text-sm leading-6 line-clamp-3">{r.comment}</p>}
                </div>
                {can('content.manage') && (
                  <div className="flex flex-col gap-1 shrink-0" data-no-row-click>
                    {r.status !== 'APPROVED' && (
                      <Button variant="ghost" size="icon" aria-label="اعتماد" title="اعتماد ونشر" onClick={() => updateMutation.mutate({ id: r.id, status: 'APPROVED' })}>
                        <Check className="size-4 text-emerald-600" />
                      </Button>
                    )}
                    {r.status !== 'HIDDEN' && (
                      <Button variant="ghost" size="icon" aria-label="إخفاء" title="إخفاء من المتجر" onClick={() => updateMutation.mutate({ id: r.id, status: 'HIDDEN' })}>
                        <EyeOff className="size-4 text-amber-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" aria-label="حذف" title="حذف نهائي" onClick={() => setDeleteTarget(r)}>
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title="حذف التقييم نهائيًا"
        description={`${deleteTarget ? `«${deleteTarget.product.name}»` : ''} — الحذف لا يمكن التراجع عنه.`}
        confirmLabel="حذف"
        danger
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteMutation.mutateAsync(deleteTarget.id)
        }}
      />
    </div>
  )
}

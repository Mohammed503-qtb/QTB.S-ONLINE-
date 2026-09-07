'use client'

// ============================================================
// المرتجعات — جدول بفلاتر + انتقالات من الحالات المسموحة فقط
// (approve/reject/receive/inspect → refund_pending مع اختيار
// طريقة الاسترداد والحساب البنكي)
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ChevronDown, Undo2 } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, returnStatusLabel, timeAgo } from '@/lib/client/format'
import { RETURN_STATUSES, RETURN_TRANSITIONS } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, Pager, SearchInput, StatusBadge, StatusTabs, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { BankAccountRow, ReturnRow, StatusCounts } from '@/components/admin/types'

type ReturnsResponse = { total: number; page: number; pages: number; returns: ReturnRow[]; statusCounts: StatusCounts }

export function ReturnsView() {
  const go = useNav((s) => s.go)
  const params = useNav((s) => s.params)
  const { can } = usePerm()

  const [status, setStatus] = useState<string>(params.status ?? '')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [page, setPage] = useState(1)

  const [rejectTarget, setRejectTarget] = useState<ReturnRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [refundTarget, setRefundTarget] = useState<ReturnRow | null>(null)
  const [refundMethod, setRefundMethod] = useState<string>('BANK')
  const [refundBank, setRefundBank] = useState('')
  const [formError, setFormError] = useState('')

  const query = useQuery({
    queryKey: ['admin-returns', { status, search: debouncedSearch, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15' })
      if (status) sp.set('status', status)
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      return api.get<ReturnsResponse>(`/api/admin/returns?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const banksQuery = useQuery({
    queryKey: ['admin-banks-lite'],
    queryFn: () => api.get<{ accounts: BankAccountRow[] }>('/api/admin/banks'),
    enabled: can('accounting.view') && refundTarget !== null,
  })

  const transition = useApiMutation<{ id: string; to: string; reason?: string; note?: string; refundMethod?: string; bankAccountId?: string }, { status: string }>(
    (vars) => api.post(`/api/admin/returns/${vars.id}/action`, { to: vars.to, reason: vars.reason, note: vars.note, refundMethod: vars.refundMethod, bankAccountId: vars.bankAccountId }),
    {
      success: (res) => `تم الانتقال إلى: ${returnStatusLabel(res.status)}`,
      invalidate: [['admin-returns'], ['admin-orders'], ['admin-refunds'], ['admin-operations'], ['admin-inventory'], ['admin-movements']],
    }
  )

  const statusCounts = query.data?.statusCounts ?? {}
  const tabs = [
    { value: '', label: 'الكل', count: Object.values(statusCounts).reduce((s, v) => s + v, 0) },
    ...RETURN_STATUSES
      .filter((s) => (statusCounts[s] ?? 0) > 0 || s === status)
      .map((s) => ({ value: s, label: returnStatusLabel(s), count: statusCounts[s] ?? 0 })),
  ]

  const runTransition = (row: ReturnRow, to: string) => {
    if (to === 'REJECTED') {
      setRejectReason('')
      setRejectTarget(row)
      return
    }
    if (to === 'REFUND_PENDING') {
      setRefundMethod('BANK')
      setRefundBank('')
      setRefundTarget(row)
      return
    }
    transition.mutate({ id: row.id, to })
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    setFormError('')
    if (rejectReason.trim().length < 3) return setFormError('سبب الرفض إلزامي (3 أحرف على الأقل)')
    await transition.mutateAsync({ id: rejectTarget.id, to: 'REJECTED', reason: rejectReason.trim() })
    setRejectTarget(null)
  }

  const submitRefund = async () => {
    if (!refundTarget) return
    setFormError('')
    if (refundMethod === 'BANK' && !refundBank) return setFormError('اختر الحساب البنكي للاسترداد')
    await transition.mutateAsync({ id: refundTarget.id, to: 'REFUND_PENDING', refundMethod, bankAccountId: refundMethod === 'BANK' ? refundBank : undefined })
    setRefundTarget(null)
  }

  const columns: Column<ReturnRow>[] = [
    {
      key: 'return',
      header: 'المرتجع',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{r.returnNumber}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'الطلب / العميل',
      cell: (r) => (
        <div className="min-w-0">
          <button onClick={() => go('admin-order-details', { id: r.order.id })} className="text-sm font-medium text-primary hover:underline" dir="ltr">
            {r.order.orderNumber}
          </button>
          <p className="text-xs text-muted-foreground truncate max-w-36">{r.customer.user.name} · {r.customer.user.phone}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'السبب / الأصناف',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm truncate max-w-40">{r.reason}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-40">
            {r.items.length} صنف: {r.items.map((i) => `${i.orderItem.productName}×${i.quantity}`).join('، ')}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'قيمة الاسترداد',
      cell: (r) => {
        const total = r.items.reduce((s, i) => s + i.orderItem.unitPrice * i.quantity, 0)
        return <span className="text-sm font-bold tabular-nums">{money(total)}</span>
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (r) => <StatusBadge status={r.status} label={returnStatusLabel(r.status)} />,
    },
    {
      key: 'refunds',
      header: 'استردادات',
      cell: (r) => (
        r.refunds.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {r.refunds.map((f) => (
              <span key={f.id} className="text-[11px] text-muted-foreground" dir="ltr">{f.refundNumber} · {money(f.amount)}</span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'الانتقالات',
      cell: (r) => {
        const next = RETURN_TRANSITIONS[r.status as keyof typeof RETURN_TRANSITIONS] ?? []
        const canManage = can('returns.manage')
        if (next.length === 0) return <span className="text-xs text-muted-foreground">نهائية</span>
        if (!canManage) return <span className="text-xs text-muted-foreground">—</span>
        const primary = next[0]
        return (
          <div className="flex items-center gap-1" data-no-row-click>
            <Button
              size="sm"
              variant={primary === 'REJECTED' ? 'destructive' : primary === 'REFUND_PENDING' ? 'default' : 'outline'}
              className="h-8 text-xs"
              disabled={transition.isPending}
              onClick={() => runTransition(r, primary)}
            >
              {returnStatusLabel(primary)}
            </Button>
            {next.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="المزيد" disabled={transition.isPending}>
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {next.slice(1).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => runTransition(r, s)} className={s === 'REJECTED' ? 'text-rose-600 focus:text-rose-600' : ''}>
                      {returnStatusLabel(s)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="المرتجعات" description={query.data ? `${query.data.total} طلب إرجاع` : 'إدارة مرتجعات العملاء'} />

      <Card>
        <CardContent className="space-y-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="بحث برقم المرتجع / الطلب / العميل..." className="sm:max-w-sm" />
          <StatusTabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={tabs} />
          <DataTable
            columns={columns}
            rows={query.data?.returns}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="↩️"
            emptyTitle="لا توجد مرتجعات مطابقة"
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>

      {/* رفض المرتجع — سبب إلزامي */}
      <Dialog open={rejectTarget !== null} onOpenChange={(v) => { if (!v) setRejectTarget(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="size-5 text-rose-600" />
              رفض المرتجع {rejectTarget?.returnNumber ?? ''}
            </DialogTitle>
            <DialogDescription>سيُشعَر العميل بالسبب ويُغلق ملف الإرجاع.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="rej-reason">سبب الرفض * <span className="text-rose-600">(إلزامي)</span></Label>
            <Textarea id="rej-reason" value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setFormError('') }} rows={3} placeholder="مثال: المنتج استُخدم وفقًا لسياسة الإرجاع..." />
            {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={transition.isPending}>إلغاء</Button>
            <Button variant="destructive" onClick={submitReject} disabled={transition.isPending}>رفض نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* بدء الاسترداد */}
      <Dialog open={refundTarget !== null} onOpenChange={(v) => { if (!v) setRefundTarget(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>بدء الاسترداد — {refundTarget?.returnNumber ?? ''}</DialogTitle>
            <DialogDescription>
              سيُنشأ سجل استرداد قابل للتنفيذ من صحة المبالغ:{' '}
              {refundTarget ? money(refundTarget.items.reduce((s, i) => s + i.orderItem.unitPrice * i.quantity, 0)) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>طريقة الاسترداد *</Label>
              <RadioGroup value={refundMethod} onValueChange={setRefundMethod} className="flex flex-col gap-2">
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer has-[button[data-state=checked]]:border-primary">
                  <RadioGroupItem value="BANK" id="rf-bank" />
                  <div>
                    <p className="text-sm font-semibold">تحويل بنكي</p>
                    <p className="text-xs text-muted-foreground">يخصم من الحساب البنكي عند التنفيذ</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer has-[button[data-state=checked]]:border-primary">
                  <RadioGroupItem value="CASH" id="rf-cash" />
                  <div>
                    <p className="text-sm font-semibold">نقدًا</p>
                    <p className="text-xs text-muted-foreground">تسليم نقدي موثق</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer has-[button[data-state=checked]]:border-primary">
                  <RadioGroupItem value="CREDIT" id="rf-credit" />
                  <div>
                    <p className="text-sm font-semibold">رصيد دائن</p>
                    <p className="text-xs text-muted-foreground">يُضاف لرصيد العميل</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
            {refundMethod === 'BANK' && (
              <div className="space-y-2">
                <Label>الحساب البنكي *</Label>
                <Select value={refundBank || undefined} onValueChange={(v) => { setRefundBank(v); setFormError('') }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                  <SelectContent>
                    {(banksQuery.data?.accounts ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} — {b.institution}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={transition.isPending}>إلغاء</Button>
            <Button onClick={submitRefund} disabled={transition.isPending}>إنشاء الاسترداد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

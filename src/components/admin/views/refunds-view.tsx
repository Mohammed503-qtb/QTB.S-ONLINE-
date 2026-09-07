'use client'

// ============================================================
// الاستردادات — جدول + إنشاء يدوي (بحث طلب) + أزرار
// approve / complete / cancel وفق الحالة المسموحة
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { BanknoteIcon, CheckCircle2, Plus, XCircle } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, refundStatusLabel, timeAgo } from '@/lib/client/format'
import { REFUND_STATUSES, REFUND_TRANSITIONS } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Pager, REFUND_METHOD_LABELS, SearchInput, StatusBadge, StatusTabs, useApiMutation, useDebounced, usePerm, MiniLoader } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { OrderRow, RefundRow, StatusCounts } from '@/components/admin/types'

type RefundsResponse = { total: number; page: number; pages: number; refunds: RefundRow[]; banks: { id: string; name: string }[]; statusCounts?: StatusCounts }

export function RefundsView() {
  const go = useNav((s) => s.go)
  const { can } = usePerm()

  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const debouncedOrderSearch = useDebounced(orderSearch, 300)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'BANK' | 'CASH' | 'CREDIT'>('BANK')
  const [bankAccountId, setBankAccountId] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')

  const [cancelTarget, setCancelTarget] = useState<RefundRow | null>(null)

  const query = useQuery({
    queryKey: ['admin-refunds', { status, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15' })
      if (status) sp.set('status', status)
      return api.get<RefundsResponse>(`/api/admin/refunds?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const ordersQuery = useQuery({
    queryKey: ['admin-orders-pick', { search: debouncedOrderSearch }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: '1', limit: '10' })
      if (debouncedOrderSearch.trim()) sp.set('search', debouncedOrderSearch.trim())
      return api.get<{ orders: OrderRow[] }>(`/api/admin/orders?${sp.toString()}`)
    },
    enabled: createOpen,
    placeholderData: keepPreviousData,
  })

  const createMutation = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/refunds', body),
    {
      success: 'أُنشئ سجل الاسترداد بحالة مطلوب',
      invalidate: [['admin-refunds'], ['admin-orders'], ['admin-dashboard']],
      onDone: () => setCreateOpen(false),
    }
  )

  const actionMutation = useApiMutation<{ id: string; action: string; note?: string }, { status: string }>(
    (vars) => api.post(`/api/admin/refunds/${vars.id}/action`, { action: vars.action, note: vars.note }),
    {
      success: (res) => `تم التحديث إلى: ${refundStatusLabel(res.status)}`,
      invalidate: [['admin-refunds'], ['admin-orders'], ['admin-banks'], ['admin-dashboard'], ['admin-operations']],
    }
  )

  const tabs = [
    { value: '', label: 'الكل', count: query.data?.total },
    ...REFUND_STATUSES.map((s) => ({ value: s, label: refundStatusLabel(s) })),
  ]

  const submitCreate = async () => {
    setFormError('')
    if (!selectedOrder) return setFormError('ابحث واختر الطلب المرتبط بالاسترداد')
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt < 1) return setFormError('أدخل مبلغًا صحيحًا (1 على الأقل)')
    if (amt > selectedOrder.grandTotal) return setFormError(`المبلغ يتجاوز إجمالي الطلب (${money(selectedOrder.grandTotal)})`)
    if (reason.trim().length < 3) return setFormError('السبب إلزامي (3 أحرف على الأقل)')
    if (method === 'BANK' && !bankAccountId) return setFormError('اختر الحساب البنكي')
    await createMutation.mutateAsync({
      orderId: selectedOrder.id,
      amount: amt,
      method,
      bankAccountId: method === 'BANK' ? bankAccountId : undefined,
      reason: reason.trim(),
    })
    setSelectedOrder(null)
    setOrderSearch('')
    setAmount('')
    setReason('')
    setMethod('BANK')
    setBankAccountId('')
  }

  const columns: Column<RefundRow>[] = [
    {
      key: 'refund',
      header: 'الاسترداد',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{r.refundNumber}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'الطلب / المرتجع',
      cell: (r) => (
        <div className="min-w-0">
          {r.order ? (
            <button onClick={() => go('admin-orders')} className="text-sm font-medium text-primary hover:underline" dir="ltr">
              {r.order.orderNumber}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">طلب محذوف</span>
          )}
          {r.returnRequest && <p className="text-[11px] text-muted-foreground" dir="ltr">مرتجع: {r.returnRequest.returnNumber}</p>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      cell: (r) => <span className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-400">{money(r.amount)}</span>,
    },
    {
      key: 'method',
      header: 'الطريقة',
      cell: (r) => <span className="text-sm">{REFUND_METHOD_LABELS[r.method] ?? r.method}</span>,
    },
    {
      key: 'reason',
      header: 'السبب',
      cell: (r) => <span className="text-xs text-muted-foreground truncate max-w-48 block">{r.reason ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (r) => <StatusBadge status={r.status} label={refundStatusLabel(r.status)} />,
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      cell: (r) => {
        const next = REFUND_TRANSITIONS[r.status as keyof typeof REFUND_TRANSITIONS] ?? []
        const canApprove = can('refunds.approve') && (r.status === 'REQUESTED' || r.status === 'APPROVED')
        const canProcess = can('refunds.process') && (r.status === 'REQUESTED' || r.status === 'APPROVED' || r.status === 'PROCESSING')
        const canCancel = can('refunds.approve') && next.includes('CANCELLED')
        return (
          <div className="flex items-center gap-1" data-no-row-click>
            {canApprove && r.status === 'REQUESTED' && (
              <Button size="sm" className="h-8 text-xs" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ id: r.id, action: 'approve' })}>
                اعتماد
              </Button>
            )}
            {canProcess && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ id: r.id, action: 'complete' })}>
                <BanknoteIcon className="size-3.5" /> {r.status === 'REQUESTED' ? 'اعتماد وتنفيذ' : 'تنفيذ'}
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-rose-600" disabled={actionMutation.isPending} onClick={() => setCancelTarget(r)}>
                <XCircle className="size-3.5" /> إلغاء
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const banks = query.data?.banks ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="الاستردادات"
        description={query.data ? `${query.data.total} سجل استرداد` : 'أموال عائدة للعملاء — بأثر مالي حقيقي'}
        actions={
          can('refunds.approve') ? (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setCreateOpen(true) }}>
              <Plus className="size-4" /> استرداد يدوي
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <StatusTabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={tabs} />
          <DataTable
            columns={columns}
            rows={query.data?.refunds}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="💸"
            emptyTitle="لا توجد استردادات"
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>

      {/* إنشاء استرداد يدوي */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!createMutation.isPending) setCreateOpen(v) }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BanknoteIcon className="size-5 text-primary" />
              استرداد يدوي
            </DialogTitle>
            <DialogDescription>لإلغاء بعد الدفع أو تسوية خاصة — يمر بمراحل الاعتماد والتنفيذ.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* بحث الطلب */}
            <div className="space-y-2">
              <Label htmlFor="rf-order-search">ابحث عن الطلب *</Label>
              <SearchInput value={orderSearch} onChange={setOrderSearch} placeholder="رقم الطلب / هاتف العميل..." />
              {debouncedOrderSearch.trim() && !selectedOrder && (
                <div className="max-h-44 overflow-y-auto rounded-lg border divide-y">
                  {ordersQuery.isLoading && <MiniLoader />}
                  {ordersQuery.data?.orders.length === 0 && <p className="p-3 text-sm text-muted-foreground">لا نتائج</p>}
                  {ordersQuery.data?.orders.map((o) => (
                    <button
                      key={o.id}
                      className="w-full flex items-center justify-between gap-2 p-2.5 text-start hover:bg-accent"
                      onClick={() => { setSelectedOrder(o); setAmount(String(o.grandTotal)) }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" dir="ltr">{o.orderNumber}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{o.customer?.user.name ?? ''} · {timeAgo(o.createdAt)}</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums shrink-0">{money(o.grandTotal)}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedOrder && (
                <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 p-2.5">
                  <div>
                    <p className="text-sm font-semibold" dir="ltr">{selectedOrder.orderNumber}</p>
                    <p className="text-[11px] text-muted-foreground">إجمالي الطلب: {money(selectedOrder.grandTotal)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedOrder(null); setAmount('') }}>
                    <XCircle className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rf-amount">المبلغ (ريال) *</Label>
                <Input id="rf-amount" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>الطريقة *</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as 'BANK' | 'CASH' | 'CREDIT')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REFUND_METHOD_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {method === 'BANK' && (
              <div className="space-y-2">
                <Label>الحساب البنكي *</Label>
                <Select value={bankAccountId || undefined} onValueChange={setBankAccountId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rf-reason">السبب * <span className="text-rose-600">(إلزامي)</span></Label>
              <Input id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تعويض عن تأخير الشحن..." />
            </div>

            {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>إلغاء</Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending}>
              <CheckCircle2 className="size-4" /> إنشاء الاسترداد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إلغاء استرداد */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(v) => { if (!v) setCancelTarget(null) }}
        title={`إلغاء الاسترداد ${cancelTarget?.refundNumber ?? ''}`}
        description="إلغاء سجل الاسترداد دون تنفيذ — للأخطاء في الإنشاء."
        confirmLabel="إلغاء الاسترداد"
        danger
        onConfirm={async () => {
          if (!cancelTarget) return
          await actionMutation.mutateAsync({ id: cancelTarget.id, action: 'cancel' })
          setCancelTarget(null)
        }}
      />
    </div>
  )
}

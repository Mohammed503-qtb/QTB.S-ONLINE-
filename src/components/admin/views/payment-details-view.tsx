'use client'

// ============================================================
// تفاصيل الدفعة — الإيصال + بيانات التحويل + الأحداث + الأثر البنكي
// + إجراءات: اعتماد (حساب بنكي) / رفض (سبب) / توضيح / تسوية الزائد
// ============================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BanknoteIcon, BadgeCheck, Building2, Eye, History, Landmark, MessageSquareText, Receipt, Scale, XCircle } from 'lucide-react'
import { api } from '@/lib/client/api'
import { dateTimeFmt, money, orderStatusLabel, paymentStatusLabel, timeAgo } from '@/lib/client/format'
import { REJECT_REASONS } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ErrorState, FullSpinner } from '@/components/app/spinner'
import {
  InlineWarning, PageHeader, RISK_FLAG_LABELS, SectionHeader, SmartImage, StatusBadge, TXN_TYPE_LABELS,
  riskFlagList, useApiMutation, usePerm,
} from '@/components/admin/components/kit'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { PaymentDetailResponse } from '@/components/admin/types'

export function PaymentDetailsView({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const { can } = usePerm()

  const [verifyOpen, setVerifyOpen] = useState(false)
  const [bankId, setBankId] = useState('')
  const [confirmAmount, setConfirmAmount] = useState('')
  const [verifyNote, setVerifyNote] = useState('')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [clarifyOpen, setClarifyOpen] = useState(false)
  const [clarifyMsg, setClarifyMsg] = useState('')
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleMethod, setSettleMethod] = useState<'CREDIT' | 'REFUND'>('CREDIT')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-payment', id],
    queryFn: () => api.get<PaymentDetailResponse>(`/api/admin/payments/${encodeURIComponent(id)}`),
    enabled: !!id,
  })

  const action = useApiMutation<Record<string, unknown>, unknown>(
    (vars) => api.post(`/api/admin/payments/${encodeURIComponent(id)}/action`, vars),
    {
      success: (res, vars) => {
        const a = vars.action as string
        if (a === 'verify') return 'تم اعتماد الدفعة وتأكيد الطلب وإصدار الفاتورة'
        if (a === 'reject') return 'تم رفض الدفعة'
        if (a === 'clarify') return 'أُرسل طلب التوضيح للعميل'
        if (a === 'review') return 'نُقلت الدفعة قيد المراجعة'
        return 'تمت التسوية'
      },
      invalidate: [['admin-payment', id], ['admin-payments'], ['admin-orders'], ['admin-dashboard'], ['admin-operations']],
    }
  )

  if (!id) return <ErrorState message="معرّف الدفعة غير صالح" retry={() => go('admin-payments')} />
  if (isLoading) return <FullSpinner label="جارِ تحميل تفاصيل الدفعة..." />
  if (error || !data) return <ErrorState message={error?.message} retry={refetch} />

  const { payment, order, customer, account, events, actorNames, bankTxns, duplicateOf, banks } = data
  const flags = riskFlagList(payment.riskFlags)
  const canReview = can('payments.review')
  const actionable = ['SUBMITTED', 'UNDER_REVIEW'].includes(payment.status)
  const snapshot = account

  const verifySubmit = async () => {
    await action.mutateAsync({
      action: 'verify',
      bankAccountId: bankId || undefined,
      confirmAmount: confirmAmount.trim() ? Number(confirmAmount.trim()) : undefined,
      note: verifyNote.trim() || undefined,
    })
    setVerifyOpen(false)
    setBankId('')
    setConfirmAmount('')
    setVerifyNote('')
  }

  const settleSubmit = async () => {
    await action.mutateAsync({ action: 'settle_overpayment', method: settleMethod })
    setSettleOpen(false)
  }

  const clarifySubmit = async () => {
    if (clarifyMsg.trim().length < 3) return
    await action.mutateAsync({ action: 'clarify', message: clarifyMsg.trim() })
    setClarifyOpen(false)
    setClarifyMsg('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`الدفعة ${payment.paymentNumber}`}
        description={`الطلب ${order.orderNumber} · ${orderStatusLabel(order.status)}`}
        onBack={() => (back ? back() : go('admin-payments'))}
        actions={<StatusBadge status={payment.status} label={paymentStatusLabel(payment.status)} />}
      />

      {flags.length > 0 && (
        <InlineWarning>
          <p className="font-semibold mb-1">مؤشرات مخاطر:</p>
          <ul className="list-disc ps-5 space-y-0.5">
            {flags.map((f) => (
              <li key={f}>{RISK_FLAG_LABELS[f] ?? f}{duplicateOf ? ` — مرتبطة بالدفعة ${duplicateOf.paymentNumber}` : ''}</li>
            ))}
          </ul>
        </InlineWarning>
      )}

      {/* الإجراءات */}
      {canReview && (
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="إجراءات المراجعة" icon={<BadgeCheck className="size-4" />} />
            <div className="flex flex-wrap gap-2">
              {payment.status === 'SUBMITTED' && (
                <Button variant="outline" className="gap-1.5" disabled={action.isPending} onClick={() => action.mutate({ action: 'review' })}>
                  <History className="size-4" /> وضع قيد المراجعة
                </Button>
              )}
              {actionable && (
                <Button className="gap-1.5" disabled={action.isPending} onClick={() => setVerifyOpen(true)}>
                  <BadgeCheck className="size-4" /> اعتماد الدفعة
                </Button>
              )}
              {actionable && (
                <Button variant="destructive" className="gap-1.5" disabled={action.isPending} onClick={() => setRejectOpen(true)}>
                  <XCircle className="size-4" /> رفض الدفعة
                </Button>
              )}
              {actionable && (
                <Button variant="outline" className="gap-1.5" disabled={action.isPending} onClick={() => setClarifyOpen(true)}>
                  <MessageSquareText className="size-4" /> طلب توضيح من العميل
                </Button>
              )}
              {(payment.overpayment ?? 0) > 0 && (
                <Button variant="outline" className="gap-1.5 border-amber-400 text-amber-700 dark:text-amber-300" disabled={action.isPending} onClick={() => setSettleOpen(true)}>
                  <Scale className="size-4" /> تسوية المبلغ الزائد ({money(payment.overpayment ?? 0)})
                </Button>
              )}
            </div>
            {!actionable && <p className="text-sm text-muted-foreground">الدفع في حالته الحالية لا يقبل إجراءات مراجعة.</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* الإيصال */}
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3">
            <SectionHeader title="إيصال التحويل" icon={<Receipt className="size-4" />} />
            {payment.proofUrl ? (
              <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="block rounded-lg border overflow-hidden group relative">
                <SmartImage src={payment.proofUrl} alt={`إيصال ${payment.paymentNumber}`} className="w-full h-64 object-contain bg-muted" />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs py-1.5 text-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Eye className="size-3.5" /> عرض بالحجم الكامل
                </span>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">لم يرفع العميل إيصالًا</p>
            )}
          </CardContent>
        </Card>

        {/* بيانات التحويل */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3">
            <SectionHeader title="بيانات التحويل" icon={<BanknoteIcon className="size-4" />} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <InfoRow label="المبلغ المطلوب" value={money(payment.expectedAmount)} strong />
              <InfoRow label="المبلغ المحوّل" value={payment.submittedAmount != null ? money(payment.submittedAmount) : '—'} strong />
              <InfoRow label="المبلغ المعتمد" value={payment.paidAmount > 0 ? money(payment.paidAmount) : '—'} />
              <InfoRow label="المبلغ الزائد" value={(payment.overpayment ?? 0) > 0 ? money(payment.overpayment ?? 0) : '—'} />
              <InfoRow label="مرجع التحويل" value={payment.customerTransferRef ?? '—'} ltr />
              <InfoRow label="تاريخ التحويل" value={payment.transferDate ? dateTimeFmt(payment.transferDate) : '—'} />
              <InfoRow label="اسم المُحوِّل" value={payment.senderName ?? '—'} />
              <InfoRow label="تاريخ التسجيل" value={payment.submittedAt ? dateTimeFmt(payment.submittedAt) : '—'} />
              {payment.rejectReason && <InfoRow label="سبب الرفض السابق" value={payment.rejectReason} danger />}
              {payment.notes && <InfoRow label="ملاحظات العميل" value={payment.notes} span />}
            </div>

            {snapshot && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="size-3.5" /> حساب الدفع المُحوَّل إليه (لقطة وقت الطلب)
                </p>
                <p className="text-sm font-medium">{snapshot.name ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{snapshot.institution ?? '—'}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{snapshot.accountNumber ?? '—'}</p>
                <p className="text-xs text-muted-foreground">المستفيد: {snapshot.beneficiary ?? '—'}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => go('admin-order-details', { id: order.id })}>
                فتح الطلب {order.orderNumber}
              </Button>
              <Button variant="outline" size="sm" onClick={() => go('admin-customer-details', { id: customer.phone })}>
                ملف العميل: {customer.name}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* الأحداث */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title={`أحداث الدفعة (${events.length})`} icon={<History className="size-4" />} />
            {events.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أحداث مسجلة.</p>}
            <div className="space-y-0 max-h-96 overflow-y-auto">
              {events.map((e, i) => {
                const evData = parseEvent(e.dataJson)
                return (
                  <div key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1.5 size-2.5 rounded-full shrink-0 ${i === events.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                      {i < events.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-4 min-w-0 flex-1">
                      <p className="text-sm font-medium">{eventLabel(e.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.actorId ? actorNames[e.actorId] ?? 'مستخدم' : 'النظام'} · {timeAgo(e.createdAt)}
                      </p>
                      {typeof evData === 'object' && evData !== null && 'amount' in (evData as Record<string, unknown>) && (
                        <p className="text-xs text-muted-foreground">المبلغ: {money(Number((evData as Record<string, unknown>).amount) || 0)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* الأثر البنكي */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title={`الأثر البنكي (${bankTxns.length})`} icon={<Landmark className="size-4" />} />
            {bankTxns.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حركات بنكية مرتبطة بعد — تُنشأ عند الاعتماد.</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {bankTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" dir="ltr">{t.txnNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {TXN_TYPE_LABELS[t.txnType] ?? t.txnType} · {t.description}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${t.direction === 'IN' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {t.direction === 'IN' ? '+' : '-'}{money(t.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{dateTimeFmt(t.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* حوار الاعتماد */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="size-5 text-primary" />
              اعتماد الدفعة {payment.paymentNumber}
            </DialogTitle>
            <DialogDescription>
              سيُقيد المبلغ في الحساب البنكي، ويُؤكد الطلب، وتُصدر الفاتورة تلقائيًا.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>الحساب البنكي المستلِم</Label>
              <Select value={bankId || undefined} onValueChange={setBankId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الحساب (اختياري)" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} — {b.institution}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {payment.expectedAmount !== payment.submittedAmount && (
              <div className="space-y-2">
                <Label htmlFor="confirm-amount">
                  المبلغ المؤكد <span className="text-amber-600">(المحوّل {payment.submittedAmount != null ? money(payment.submittedAmount) : '—'} / المطلوب {money(payment.expectedAmount)})</span>
                </Label>
                <Input
                  id="confirm-amount"
                  type="number"
                  inputMode="numeric"
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(e.target.value)}
                  placeholder={`افتراضي: ${payment.submittedAmount ?? payment.expectedAmount}`}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="verify-note">ملاحظة (اختياري)</Label>
              <Input id="verify-note" value={verifyNote} onChange={(e) => setVerifyNote(e.target.value)} placeholder="تُسجل مع الاعتماد" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>إلغاء</Button>
            <Button onClick={verifySubmit} disabled={action.isPending}>اعتماد نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار الرفض — سبب إلزامي */}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`رفض الدفعة ${payment.paymentNumber}`}
        description="سيُعاد الطلب إلى حالة معالجة مشكلة الدفع ويُشعَر العميل بالسبب."
        confirmLabel="رفض الدفعة"
        danger
        requireReason
        reasonLabel="سبب الرفض"
        reasonOptions={REJECT_REASONS}
        noteField
        noteLabel="ملاحظة إضافية (اختياري)"
        onConfirm={async ({ reason, note }) => {
          await action.mutateAsync({ action: 'reject', reason, note: note || undefined })
        }}
      />

      {/* حوار التوضيح */}
      <Dialog open={clarifyOpen} onOpenChange={setClarifyOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareText className="size-5 text-primary" />
              طلب توضيح من العميل
            </DialogTitle>
            <DialogDescription>ستُرسل رسالة للعميل عبر الإشعارات مع بيانات الدفعة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="clarify-msg">نص الرسالة</Label>
            <Textarea
              id="clarify-msg"
              value={clarifyMsg}
              onChange={(e) => setClarifyMsg(e.target.value)}
              rows={3}
              placeholder="مثال: صورة الإيصال غير واضحة، الرجاء إعادة رفعها..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClarifyOpen(false)}>إلغاء</Button>
            <Button onClick={clarifySubmit} disabled={action.isPending || clarifyMsg.trim().length < 3}>إرسال الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تسوية الزائد */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="size-5 text-amber-600" />
              تسوية المبلغ الزائد
            </DialogTitle>
            <DialogDescription>
              المبلغ الزائد: {money(payment.overpayment ?? 0)} — اختر طريقة التسوية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <RadioGroup value={settleMethod} onValueChange={(v) => setSettleMethod(v as 'CREDIT' | 'REFUND')} className="gap-2">
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[button[data-state=checked]]:border-primary">
                <RadioGroupItem value="CREDIT" id="settle-credit" className="mt-1" />
                <div>
                  <p className="text-sm font-semibold">رصيد دائن للعميل</p>
                  <p className="text-xs text-muted-foreground">يُضاف لرصيد العميل ويُخصم من طلباته القادمة.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[button[data-state=checked]]:border-primary">
                <RadioGroupItem value="REFUND" id="settle-refund" className="mt-1" />
                <div>
                  <p className="text-sm font-semibold">استرداد نقدي</p>
                  <p className="text-xs text-muted-foreground">يُنشأ سجل استرداد يُنفَّذ من الحساب البنكي.</p>
                </div>
              </label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)}>إلغاء</Button>
            <Button onClick={settleSubmit} disabled={action.isPending}>تنفيذ التسوية</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ label, value, strong, ltr, span, danger }: { label: string; value: string; strong?: boolean; ltr?: boolean; span?: boolean; danger?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={[
          'text-sm',
          strong ? 'font-bold tabular-nums' : 'font-medium',
          danger ? 'text-rose-600 dark:text-rose-400' : '',
          ltr ? 'text-end' : '',
        ].join(' ')}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function parseEvent(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    CREATED: 'أُنشئ سجل الدفع',
    SUBMITTED: 'سجّل العميل تحويلًا',
    SUBMIT_UPDATED: 'حدّث العميل بيانات التحويل',
    UNDER_REVIEW: 'نُقل قيد المراجعة',
    CLARIFY_REQUESTED: 'طُلب توضيح من العميل',
    CLARIFY_RESPONDED: 'ردّ العميل بالتوضيح',
    VERIFIED: 'اعتُمدت الدفعة',
    REJECTED: 'رُفضت الدفعة',
    OVERPAYMENT_SETTLED: 'سُوّي المبلغ الزائد',
    REFUND_INITIATED: 'بدأ الاسترداد',
    EXPIRED: 'انتهت صلاحية الدفع',
  }
  return labels[type] ?? type
}

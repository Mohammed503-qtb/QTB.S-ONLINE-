'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Ban,
  CheckCircle2,
  Circle,
  FileText,
  MessageCircle,
  Package,
  Receipt,
  RotateCcw,
  Star,
  Truck,
  Upload,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useConfig } from '@/lib/client/session'
import { useNav, whatsappLink } from '@/lib/client/stores'
import { dateFmt, dateTimeFmt, money, orderStatusLabel, paymentStatusLabel, shipmentStatusLabel, statusColor } from '@/lib/client/format'
import { CUSTOMER_CANCELLABLE, RETURNABLE_STATUSES, RETURN_STATUS_LABELS, type OrderStatus, type ReturnStatus } from '@/lib/shared/constants'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { CodeBox } from '../components/code-box'
import { SafeImg } from '../components/safe-img'
import { eventLabel, paymentMethodLabel, shippingMethodLabel, waOrderMessage } from '../utils'
import { Stars } from './product-view'
import type { OrderDetailsResult, PaymentAccount } from '../types'

// ============================================================
// تفاصيل الطلب — عناصر + ملخص + دفع + خط زمني صادق + إجراءات
// قاعدة: لا يظهر "تم الدفع" في الخط الزمني إلا إذا payment.status = VERIFIED
// ============================================================

export function OrderDetailsView({ id }: { id: string }) {
  return (
    <RequireAuth title="سجّل الدخول لعرض تفاصيل طلبك">
      <OrderDetailsInner id={id} />
    </RequireAuth>
  )
}

function OrderDetailsInner({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const qc = useQueryClient()
  const { data: config } = useConfig()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<OrderDetailsResult>(`/api/orders/${encodeURIComponent(id)}`),
    enabled: id.length > 0,
  })

  const [cancelOpen, setCancelOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [reviewItem, setReviewItem] = useState<{ productId: string; productName: string } | null>(null)

  if (!id) return <ErrorState message="لم يتم تحديد طلب" />
  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }
  if (error || !data) return <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل الطلب'} retry={() => refetch()} />

  const { order, items, timeline, payment, shipment, returns, invoice, address } = data

  const canCancel = CUSTOMER_CANCELLABLE.includes(order.status as OrderStatus)
  const canReturn = RETURNABLE_STATUSES.includes(order.status as OrderStatus)
  const canReview = RETURNABLE_STATUSES.includes(order.status as OrderStatus) && config?.flags.reviews_enabled !== false
  const canSubmitPayment =
    payment !== null &&
    order.paymentMethod === 'BANK_TRANSFER' &&
    ['UNPAID', 'REJECTED', 'PARTIALLY_PAID'].includes(payment.status)

  // الخط الزمني الصادق: إخفاء "تم الدفع" إن لم يكن الدفع معتمدًا
  const honestTimeline = timeline.filter((e) => {
    if (e.type === 'PAYMENT_VERIFIED' && payment?.status !== 'VERIFIED') return false
    if (e.type === 'PAYMENT_SUBMITTED' && payment && payment.status === 'UNPAID') return false
    return true
  })

  const whatsappEnabled = config?.flags.whatsapp_enabled !== false

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      {/* الرأس */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => back()} className="min-h-9 font-bold text-emerald-700 hover:underline dark:text-emerald-400">
          ← رجوع
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusColor(order.status))}>{orderStatusLabel(order.status)}</span>
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusColor(order.paymentStatus))}>{paymentStatusLabel(order.paymentStatus)}</span>
        </div>
      </div>

      {/* الأرقام */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="أرقام الطلب">
        <CodeBox code={order.orderNumber} label="رقم الطلب" />
        {order.paymentReference && <CodeBox code={order.paymentReference} label="مرجع الدفع" />}
        {order.trackingCode && <CodeBox code={order.trackingCode} label="كود التتبع" />}
      </section>

      {/* تنبيه الدفع */}
      {canSubmitPayment && payment && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Receipt className="size-4" aria-hidden />
          <AlertTitle>بانتظار التحويل — {money(payment.expectedAmount)}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2 text-sm">
            <span>
              حوّل المبلغ إلى حسابات المتجر وسجّل بيانات التحويل ليعتمد الدفع ويُجهّز طلبك.
              {payment.expiresAt && <> آخر موعد: <b>{dateTimeFmt(payment.expiresAt)}</b></>}
            </span>
            <Button size="sm" className="min-h-10 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={() => setPaymentOpen(true)}>
              تسجيل التحويل
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {payment?.status === 'REJECTED' && payment.rejectReason && (
        <Alert variant="destructive">
          <Ban className="size-4" aria-hidden />
          <AlertTitle>رُفض الدفع</AlertTitle>
          <AlertDescription className="text-sm">السبب: {payment.rejectReason} — يمكنك تسجيل تحويل جديد صحيح.</AlertDescription>
        </Alert>
      )}
      {payment && ['SUBMITTED', 'UNDER_REVIEW'].includes(payment.status) && (
        <Alert>
          <CheckCircle2 className="size-4" aria-hidden />
          <AlertDescription className="text-sm">
            تم استلام بيانات تحويلك ({money(payment.submittedAmount ?? 0)}) وهي قيد مراجعة المحاسبة — سيتم إشعارك عند الاعتماد.
          </AlertDescription>
        </Alert>
      )}

      {/* العناصر */}
      <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="عناصر الطلب">
        <h2 className="font-extrabold">العناصر ({items.length})</h2>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <button
                type="button"
                className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted/40"
                onClick={() => item.productId && go('product', { id: item.productId })}
                aria-label={item.productName}
              >
                <SafeImg src={item.imageUrl} alt={item.productName} className="size-full" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ')} × {item.quantity}
                </p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{money(item.lineTotal)}</p>
              </div>
              {canReview && item.productId && (
                <Button variant="outline" size="sm" className="min-h-9" onClick={() => setReviewItem({ productId: item.productId, productName: item.productName })}>
                  <Star className="size-4" aria-hidden />
                  تقييم
                </Button>
              )}
            </li>
          ))}
        </ul>

        <Separator />

        {/* الملخص */}
        <div className="space-y-1.5 text-sm">
          <Row label="إجمالي المنتجات" value={money(order.itemsTotal)} />
          {order.discountTotal > 0 && <Row label="خصم المنتجات" value={`- ${money(order.discountTotal)}`} className="text-amber-700 dark:text-amber-400" />}
          {order.couponCode && <Row label={`كوبون ${order.couponCode}`} value="مُطبق على الطلب" className="text-emerald-700 dark:text-emerald-400" />}
          <Row label={`الشحن (${shippingMethodLabel(order.shippingMethod)})`} value={money(order.shippingFee)} />
          <div className="flex justify-between border-t pt-2 text-base font-extrabold">
            <span>الإجمالي</span>
            <span className="text-emerald-700 dark:text-emerald-400">{money(order.grandTotal)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          طريقة الدفع: {paymentMethodLabel(order.paymentMethod)} · {dateFmt(order.placedAt)}
        </p>
      </section>

      {/* الدفع */}
      {payment && (
        <section className="space-y-2 rounded-2xl border bg-card p-4" aria-label="بيانات الدفع">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-extrabold">
              <Receipt className="size-5 text-emerald-600" aria-hidden />
              الدفع {payment.paymentNumber}
            </h2>
            <Badge className={statusColor(payment.status)}>{paymentStatusLabel(payment.status)}</Badge>
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label="المبلغ المطلوب" value={money(payment.expectedAmount)} />
            {payment.submittedAmount !== null && payment.submittedAmount > 0 && (
              <Row label="المبلغ المسجل" value={money(payment.submittedAmount)} />
            )}
            {payment.paidAmount > 0 && <Row label="المبلغ المعتمد" value={money(payment.paidAmount)} />}
          </div>
          {canSubmitPayment && (
            <Button className="min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={() => setPaymentOpen(true)}>
              تسجيل بيانات التحويل
            </Button>
          )}
        </section>
      )}

      {/* الشحنة */}
      {shipment && (
        <section className="space-y-2 rounded-2xl border bg-card p-4" aria-label="الشحنة">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-extrabold">
              <Truck className="size-5 text-emerald-600" aria-hidden />
              الشحنة {shipment.shipmentNumber}
            </h2>
            <Badge className={statusColor(shipment.status)}>{shipmentStatusLabel(shipment.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            الناقل: {shipment.provider || '—'} · كود التتبع <span dir="ltr" className="font-mono font-bold">{shipment.trackingCode}</span>
            {shipment.deliveredAt && ` · سُلّمت ${dateFmt(shipment.deliveredAt)}`}
          </p>
        </section>
      )}

      {/* الإرجاعات */}
      {returns.length > 0 && (
        <section className="space-y-2 rounded-2xl border bg-card p-4" aria-label="طلبات الإرجاع">
          <h2 className="font-extrabold">طلبات الإرجاع</h2>
          {returns.map((r) => (
            <div key={r.id} className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold" dir="ltr">{r.returnNumber}</span>
                <Badge className={statusColor(r.status)}>{RETURN_STATUS_LABELS[r.status as ReturnStatus] ?? r.status}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">
                السبب: {r.reason} · الأصناف: {r.items.map((i) => `${i.productName} ×${i.quantity}`).join('، ')}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* الفاتورة */}
      {invoice && (
        <section className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-4" aria-label="الفاتورة">
          <h2 className="flex items-center gap-2 font-bold">
            <FileText className="size-5 text-emerald-600" aria-hidden />
            الفاتورة {invoice.invoiceNumber}
          </h2>
          <div className="text-sm">
            <span className="font-bold">{money(invoice.total)}</span>
            <span className="ms-2 text-xs text-muted-foreground">{dateFmt(invoice.issuedAt)}</span>
          </div>
        </section>
      )}

      {/* الخط الزمني */}
      <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="سجل الطلب">
        <h2 className="font-extrabold">سجل الطلب</h2>
        {honestTimeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا أحداث بعد</p>
        ) : (
          <ol className="relative space-y-4 border-s-2 ps-4">
            {honestTimeline.map((event, i) => {
              const isLatest = i === honestTimeline.length - 1
              return (
                <li key={`${event.type}-${event.at}`} className="relative">
                  <span className={cn('absolute -start-[22px] top-0.5 flex size-4 items-center justify-center rounded-full', isLatest ? 'bg-emerald-600' : 'bg-muted')}>
                    {isLatest ? <CheckCircle2 className="size-3.5 text-white" aria-hidden /> : <Circle className="size-2 fill-muted-foreground text-muted-foreground" aria-hidden />}
                  </span>
                  <p className="text-sm font-semibold">{eventLabel(event.type)}</p>
                  <p className="text-xs text-muted-foreground">{dateTimeFmt(event.at)}</p>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* العنوان */}
      {address.city && (
        <section className="space-y-1 rounded-2xl border bg-card p-4 text-sm" aria-label="عنوان التوصيل">
          <h2 className="font-extrabold">عنوان التوصيل</h2>
          <p className="text-muted-foreground">
            {address.governorate ?? ''}، {address.city}
            {address.district ? `، ${address.district}` : ''}
            {address.neighborhood ? `، حي ${address.neighborhood}` : ''}
            {address.street ? `، ${address.street}` : ''}
            {address.landmark ? ` (${address.landmark})` : ''}
          </p>
          {address.phone && <p dir="ltr" className="text-muted-foreground">{address.phone}</p>}
          {order.customerNote && (
            <p className="rounded-xl bg-muted/50 p-2 text-xs">ملاحظتك: {order.customerNote}</p>
          )}
        </section>
      )}

      {/* الإجراءات */}
      <div className="grid gap-2 pb-24 sm:grid-cols-2 lg:pb-0">
        {canCancel && (
          <Button variant="outline" className="min-h-11 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950" onClick={() => setCancelOpen(true)}>
            <Ban className="size-4" aria-hidden />
            إلغاء الطلب
          </Button>
        )}
        {canReturn && config?.flags.returns_enabled !== false && (
          <Button variant="outline" className="min-h-11" onClick={() => go('return-new', { orderId: order.id })}>
            <RotateCcw className="size-4" aria-hidden />
            طلب إرجاع
          </Button>
        )}
        {whatsappEnabled && (
          <Button
            variant="outline"
            className="min-h-11 sm:col-span-2"
            onClick={() =>
              window.open(
                whatsappLink(
                  config?.settings.whatsappNumber ?? '',
                  waOrderMessage(order.orderNumber, `الحالة: ${orderStatusLabel(order.status)} · مرجع الدفع: ${order.paymentReference}`)
                ),
                '_blank',
                'noopener'
              )
            }
          >
            <MessageCircle className="size-4" aria-hidden />
            تواصل معنا بخصوص الطلب
          </Button>
        )}
      </div>

      {/* حوار الإلغاء */}
      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} orderId={order.id} />

      {/* حوار تسجيل التحويل */}
      {payment && (
        <SubmitPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          paymentId={payment.id}
          expectedAmount={payment.expectedAmount}
          orderNumber={order.orderNumber}
          onSubmitted={() => {
            qc.invalidateQueries({ queryKey: ['order', id] })
            qc.invalidateQueries({ queryKey: ['orders'] })
          }}
        />
      )}

      {/* حوار التقييم */}
      {reviewItem && (
        <ReviewDialog
          orderId={order.id}
          productId={reviewItem.productId}
          productName={reviewItem.productName}
          onClose={() => setReviewItem(null)}
        />
      )}
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex justify-between', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

// ---------- حوار الإلغاء ----------
function CancelDialog({ open, onOpenChange, orderId }: { open: boolean; onOpenChange: (o: boolean) => void; orderId: string }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cancel = useMutation({
    mutationFn: () => api.post('/api/orders/' + encodeURIComponent(orderId) + '/cancel', { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('تم إلغاء الطلب')
      onOpenChange(false)
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر إلغاء الطلب'
      setError(msg)
      toast.error(msg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setReason(''); setError(null) } }}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>إلغاء الطلب</DialogTitle>
          <DialogDescription>الإلغاء متاح قبل اعتماد الدفع فقط</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">سبب الإلغاء *</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(null) }}
            placeholder="اذكر سبب الإلغاء..."
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>تراجع</Button>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={reason.trim().length < 3 || cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? 'جارِ الإلغاء...' : 'تأكيد الإلغاء'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- حوار تسجيل التحويل ----------
function SubmitPaymentDialog({
  open,
  onOpenChange,
  paymentId,
  expectedAmount,
  orderNumber,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  paymentId: string
  expectedAmount: number
  orderNumber: string
  onSubmitted: () => void
}) {
  const [amount, setAmount] = useState(String(expectedAmount))
  const [accountId, setAccountId] = useState<string | undefined>(undefined)
  const [transferRef, setTransferRef] = useState('')
  const [transferDate, setTransferDate] = useState('')
  const [senderName, setSenderName] = useState('')
  const [notes, setNotes] = useState('')
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: accountsData } = useQuery({
    queryKey: ['payment-accounts'],
    queryFn: () => api.get<{ accounts: PaymentAccount[]; codEnabled: boolean }>('/api/payment-accounts'),
    enabled: open,
  })

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const res = await api.upload(file, 'proofs')
      setProofUrl(res.url)
      toast.success('تم رفع الإيصال')
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'تعذر رفع الصورة')
    } finally {
      setUploading(false)
    }
  }

  const submit = useMutation({
    mutationFn: () =>
      api.post(`/api/payments/${encodeURIComponent(paymentId)}/submit`, {
        amount: Number(amount) || 0,
        ...(accountId ? { paymentAccountId: accountId } : {}),
        ...(transferRef.trim() ? { customerTransferRef: transferRef.trim() } : {}),
        ...(transferDate ? { transferDate } : {}),
        ...(senderName.trim() ? { senderName: senderName.trim() } : {}),
        ...(proofUrl ? { proofUrl } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success('تم تسجيل التحويل — سيُراجعه المحاسب قريبًا')
      onSubmitted()
      onOpenChange(false)
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر تسجيل التحويل'
      setError(msg)
      toast.error(msg)
    },
  })

  const onSubmitClick = () => {
    setError(null)
    const n = Number(amount)
    if (!n || n < 1) return setError('أدخل المبلغ المحوّل')
    submit.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تسجيل بيانات التحويل</DialogTitle>
          <DialogDescription>
            الطلب <span dir="ltr" className="font-mono font-bold">{orderNumber}</span> · المطلوب {money(expectedAmount)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pe-1 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">المبلغ المحوّل *</Label>
            <Input id="pay-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label>الحساب المحوّل إليه</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="اختر الحساب" />
              </SelectTrigger>
              <SelectContent>
                {accountsData?.accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.institution} — {accountLast4(acc.accountNumber || acc.walletNumber || '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">مرجع التحويل / رقم العملية</Label>
            <Input id="pay-ref" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} maxLength={60} placeholder="من إشعار التحويل" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">تاريخ التحويل</Label>
            <Input id="pay-date" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-sender">اسم المُحوِّل</Label>
            <Input id="pay-sender" value={senderName} onChange={(e) => setSenderName(e.target.value)} maxLength={80} placeholder="اسم صاحب الحساب الذي حوّل" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-proof">صورة الإيصال (اختياري)</Label>
            {proofUrl ? (
              <div className="flex items-center gap-3 rounded-xl border p-2">
                <img src={proofUrl} alt="إيصال التحويل" className="size-14 rounded-lg object-cover" />
                <Button variant="ghost" size="sm" className="min-h-9 text-rose-600" onClick={() => setProofUrl(null)}>
                  إزالة
                </Button>
              </div>
            ) : (
              <label
                htmlFor="pay-proof"
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-accent"
              >
                <Upload className="size-4" aria-hidden />
                {uploading ? 'جارِ الرفع...' : 'ارفع صورة الإيصال'}
                <input
                  id="pay-proof"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) upload(file)
                  }}
                />
              </label>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-notes">ملاحظات</Label>
            <Textarea id="pay-notes" rows={2} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" disabled={submit.isPending} onClick={onSubmitClick}>
            {submit.isPending ? 'جارِ الإرسال...' : 'إرسال بيانات التحويل'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function accountLast4(num: string): string {
  return num.length > 4 ? `****${num.slice(-4)}` : num
}

// ---------- حوار التقييم ----------
function ReviewDialog({ orderId, productId, productName, onClose }: { orderId: string; productId: string; productName: string; onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = useMutation({
    mutationFn: () => api.post('/api/reviews', { productId, orderId, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
    onSuccess: () => {
      toast.success('شكرًا لك! سيظهر تقييمك بعد مراجعة الإدارة')
      onClose()
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر إرسال التقييم'
      setError(msg)
      toast.error(msg)
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>تقييم المنتج</DialogTitle>
          <DialogDescription className="truncate">{productName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-center gap-1" role="radiogroup" aria-label="التقييم من 5">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={rating === i + 1}
                aria-label={`${i + 1} نجوم`}
                onClick={() => setRating(i + 1)}
                className="min-h-11 min-w-11 rounded-lg p-1 transition-transform hover:scale-110"
              >
                <Star className={cn('size-8', i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} aria-hidden />
              </button>
            ))}
          </div>
          <Textarea rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="شاركنا رأيك في المنتج (اختياري)..." aria-label="تعليقك" />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11" onClick={onClose}>لاحقًا</Button>
            <Button className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" disabled={rating === 0 || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? 'جارِ الإرسال...' : 'إرسال التقييم'}
            </Button>
          </div>
          <div className="text-center">
            <Stars rating={rating} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

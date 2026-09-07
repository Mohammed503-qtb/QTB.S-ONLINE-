'use client'

// ============================================================
// تفاصيل الطلب (الإدارة) — كل السلاسل: العميل/العنوان/الأصناف/
// الماليات/الدفع/الشحن/سجل الحالات/حركات المخزون + أزرار
// الانتقال من nextStatuses فقط (CANCELLED يتطلب سببًا)
// ============================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BadgeCheck, Ban, CreditCard, FileText, History, MapPin, MessageCircle, Package,
  Receipt, Truck, User, Warehouse, ChevronDown, ArrowLeftRight,
} from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, dateTimeFmt, orderStatusLabel, paymentStatusLabel, returnStatusLabel, shipmentStatusLabel, timeAgo } from '@/lib/client/format'
import { useNav, whatsappLink } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState, FullSpinner } from '@/components/app/spinner'
import {
  MOVEMENT_LABELS, PAYMENT_METHOD_LABELS, PageHeader, SectionHeader, SmartImage, StatusBadge,
  attrText, parseAttrs, useApiMutation, usePerm,
} from '@/components/admin/components/kit'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { OrderDetailResponse } from '@/components/admin/types'

export function OrderDetailsView({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const { can } = usePerm()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [shipOpen, setShipOpen] = useState(false)
  const [shipProvider, setShipProvider] = useState('')
  const [shipNote, setShipNote] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => api.get<OrderDetailResponse>(`/api/admin/orders/${encodeURIComponent(id)}`),
    enabled: !!id,
  })

  const transition = useApiMutation<{ to: string; reason?: string; note?: string; provider?: string }, { status: string }>(
    (vars) => api.post(`/api/admin/orders/${encodeURIComponent(id)}/status`, vars),
    {
      success: (res) => `تم تحديث الحالة إلى: ${orderStatusLabel(res.status)}`,
      invalidate: [['admin-order', id], ['admin-orders'], ['admin-dashboard'], ['admin-operations']],
    }
  )

  if (!id) return <ErrorState message="معرّف الطلب غير صالح" retry={() => go('admin-orders')} />
  if (isLoading) return <FullSpinner label="جارِ تحميل تفاصيل الطلب..." />
  if (error || !data) return <ErrorState message={error?.message} retry={refetch} />

  const { order, address, nextStatuses, movements, changedByNames } = data
  const next = nextStatuses ?? []
  const canUpdate = can('orders.update')
  const canCancel = can('orders.cancel')
  const attrs = (json: string) => parseAttrs(json)

  const runTransition = (to: string) => {
    if (to === 'CANCELLED') {
      setCancelOpen(true)
      return
    }
    if (to === 'SHIPPED') {
      setShipOpen(true)
      return
    }
    transition.mutate({ to })
  }

  const shipSubmit = async () => {
    await transition.mutateAsync({ to: 'SHIPPED', provider: shipProvider.trim() || undefined, note: shipNote.trim() || undefined })
    setShipOpen(false)
    setShipProvider('')
    setShipNote('')
  }

  const whatsappMsg = `مرحبًا ${order.customer?.user.name ?? ''}، بخصوص طلبكم ${order.orderNumber} من متجر الأصيل.`

  return (
    <div className="space-y-6">
      <PageHeader
        title={`الطلب ${order.orderNumber}`}
        description={`أُنشئ ${dateTimeFmt(order.createdAt)} · نسخة التحديث ${order.version ?? 1}`}
        onBack={() => (back ? back() : go('admin-orders'))}
        actions={
          <>
            <StatusBadge status={order.status} label={orderStatusLabel(order.status)} />
            <StatusBadge status={order.paymentStatus} label={paymentStatusLabel(order.paymentStatus)} />
          </>
        }
      />

      {/* أزرار الانتقال — من nextStatuses فقط */}
      {canUpdate && (
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="إجراءات الحالة" icon={<History className="size-4" />} />
            {next.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">الطلب في حالة نهائية — لا انتقالات متاحة.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="lg"
                  className="gap-2"
                  disabled={transition.isPending}
                  onClick={() => runTransition(next[0])}
                >
                  <BadgeCheck className="size-4" />
                  الخطوة التالية: {orderStatusLabel(next[0])}
                </Button>
                {next.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="lg" className="gap-1.5" disabled={transition.isPending}>
                        انتقالات أخرى
                        <ChevronDown className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {next.slice(1).map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => runTransition(s)}
                          className={s === 'CANCELLED' ? 'text-rose-600 focus:text-rose-600' : ''}
                          disabled={s === 'CANCELLED' && !canCancel}
                        >
                          {s === 'CANCELLED' ? <Ban className="size-4" /> : <ArrowLeftRight className="size-4" />}
                          {orderStatusLabel(s)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {order.status === 'CANCELLED' && order.cancelReason && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 w-full">سبب الإلغاء: {order.cancelReason}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* العميل */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="العميل" icon={<User className="size-4" />} />
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold">{order.customer?.user.name ?? '—'}</p>
              <p className="text-muted-foreground" dir="ltr">{order.customer?.user.phone ?? '—'}</p>
              {order.customer?.user.email && <p className="text-muted-foreground" dir="ltr">{order.customer.user.email}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              onClick={() => go('admin-customer-details', { id: order.customer?.user.phone ?? order.id })}
            >
              <User className="size-4" /> ملف العميل
            </Button>
            <a
              href={whatsappLink(`967${order.customer?.user.phone ?? ''}`, whatsappMsg)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-md border px-3 h-9 text-sm hover:bg-accent transition-colors"
            >
              <MessageCircle className="size-4 text-emerald-600" /> واتساب العميل
            </a>
          </CardContent>
        </Card>

        {/* عنوان التسليم */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="عنوان التسليم" icon={<MapPin className="size-4" />} />
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>
                {address.governorate ?? '—'} — {address.city ?? '—'}
                {address.district ? ` / ${address.district}` : ''}
              </p>
              {address.neighborhood && <p>الحي: {address.neighborhood}</p>}
              {address.street && <p>الشارع: {address.street}</p>}
              {address.landmark && <p>علامة مميزة: {address.landmark}</p>}
              {address.phone && <p dir="ltr">هاتف الاستلام: {address.phone}</p>}
              {address.notes && <p>ملاحظات: {address.notes}</p>}
            </div>
          </CardContent>
        </Card>

        {/* ملخص مالي */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="الملخص المالي" icon={<Receipt className="size-4" />} />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي الأصناف</span><span className="tabular-nums">{money(order.itemsTotal)}</span></div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>الخصم {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span className="tabular-nums">- {money(order.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">الشحن</span><span className="tabular-nums">{money(order.shippingFee)}</span></div>
              <div className="flex justify-between border-t pt-1.5 font-bold text-base">
                <span>الإجمالي</span>
                <span className="tabular-nums text-primary">{money(order.grandTotal)}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>طريقة الدفع: {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              {order.paymentReference && <p dir="ltr">كود الدفع: {order.paymentReference}</p>}
              {order.trackingCode && <p dir="ltr">كود التتبع: {order.trackingCode}</p>}
            </div>
            {order.customerNote && (
              <div className="rounded-lg bg-muted p-2.5 text-xs">
                <span className="font-semibold">ملاحظة العميل: </span>
                {order.customerNote}
              </div>
            )}
            {order.adminNote && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-xs">
                <span className="font-semibold">ملاحظة إدارية: </span>
                {order.adminNote}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* الفاتورة */}
      <Card>
        <CardContent className="space-y-3">
          <SectionHeader title="الفاتورة" icon={<FileText className="size-4" />} />
          {order.invoice ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-3 py-1 text-sm font-bold" dir="ltr">
                <FileText className="size-4" /> {order.invoice.invoiceNumber}
              </span>
              <span className="text-sm text-muted-foreground">صدرت {dateTimeFmt(order.invoice.issuedAt)} · بقيمة {money(order.invoice.total)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا توجد فاتورة بعد — تُصدر تلقائيًا عند اعتماد الدفع من طابور المدفوعات.
            </p>
          )}
        </CardContent>
      </Card>

      {/* الأصناف */}
      <Card>
        <CardContent className="space-y-3">
          <SectionHeader title={`الأصناف (${order.items.length})`} icon={<Package className="size-4" />} />
          <div className="space-y-2">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <SmartImage src={it.imageUrl} alt={it.productName} className="size-14" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{it.productName}</p>
                  <p className="text-xs text-muted-foreground truncate">{attrText(attrs(it.attributesJson)) || '—'}</p>
                  {it.skuSnapshot && <p className="text-[10px] text-muted-foreground" dir="ltr">{it.skuSnapshot}</p>}
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-medium tabular-nums">{money(it.unitPrice)}</p>
                  <p className="text-xs text-muted-foreground">× {it.quantity}</p>
                </div>
                <p className="text-sm font-bold tabular-nums shrink-0 w-24 text-end">{money(it.lineTotal)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* الدفع */}
      <Card>
        <CardContent className="space-y-3">
          <SectionHeader title={`سجلات الدفع (${order.payments.length})`} icon={<CreditCard className="size-4" />} />
          {order.payments.length === 0 && <p className="text-sm text-muted-foreground">لا توجد سجلات دفع لهذا الطلب.</p>}
          <div className="space-y-2">
            {order.payments.map((p) => (
              <button
                key={p.id}
                onClick={() => go('admin-payment-details', { id: p.id })}
                className="w-full flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-start hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold" dir="ltr">{p.paymentNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    المطلوب {money(p.expectedAmount)}
                    {p.submittedAmount != null ? ` · المُحوَّل ${money(p.submittedAmount)}` : ''}
                    {p.paidAmount > 0 ? ` · المعتمد ${money(p.paidAmount)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.proofUrl && <SmartImage src={p.proofUrl} alt="إيصال الدفع" className="size-10" />}
                  <StatusBadge status={p.status} label={paymentStatusLabel(p.status)} />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* الشحن */}
      <Card>
        <CardContent className="space-y-3">
          <SectionHeader title={`الشحنات (${order.shipments.length})`} icon={<Truck className="size-4" />} />
          {order.shipments.length === 0 && <p className="text-sm text-muted-foreground">لم تُنشأ شحنة لهذا الطلب بعد.</p>}
          {order.shipments.map((s) => (
            <div key={s.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" dir="ltr">{s.trackingCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.methodName} {s.providerName ? `· ${s.providerName}` : ''} · أجرة {money(s.fee)}
                    {s.codCollected > 0 ? ` · محصل COD ${money(s.codCollected)}` : ''}
                  </p>
                </div>
                <StatusBadge status={s.status} label={shipmentStatusLabel(s.status)} />
              </div>
              {(s.events.length > 0 || s.attempts.length > 0) && (
                <div className="max-h-56 overflow-y-auto space-y-1.5 border-t pt-2">
                  {s.events.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{shipmentStatusLabel(e.status)}</span>
                      <span className="text-muted-foreground shrink-0">{timeAgo(e.createdAt)}</span>
                      {e.note && <span className="text-muted-foreground truncate">{e.note}</span>}
                    </div>
                  ))}
                  {s.attempts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
                      <span>{a.status === 'FAILED' ? 'محاولة توصيل فاشلة' : 'محاولة توصيل ناجحة'}</span>
                      <span className="text-muted-foreground shrink-0">{timeAgo(a.createdAt)}</span>
                      {a.reason && <span className="truncate">{a.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* سجل الحالات */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title={`سجل الحالات (${order.statusHistory.length})`} icon={<History className="size-4" />} />
            <div className="space-y-0 max-h-96 overflow-y-auto">
              {order.statusHistory.map((h, i) => (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 size-2.5 rounded-full shrink-0 ${i === order.statusHistory.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    {i < order.statusHistory.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-4 min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {h.fromStatus ? `${orderStatusLabel(h.fromStatus)} → ` : ''}
                      <span className="font-bold">{orderStatusLabel(h.toStatus)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {h.changedById ? changedByNames[h.changedById] ?? 'مستخدم' : 'النظام'} · {dateTimeFmt(h.createdAt)}
                    </p>
                    {h.reason && <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">السبب: {h.reason}</p>}
                    {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* حركات المخزون */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title={`حركات المخزون (${movements.length})`} icon={<Warehouse className="size-4" />} />
            {movements.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حركات مخزون مرتبطة.</p>}
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.variant.product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {MOVEMENT_LABELS[m.movementType] ?? m.movementType} · {m.warehouse.name}
                      {m.refNumber ? ` · ${m.refNumber}` : ''}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className={`font-bold tabular-nums ${m.quantityDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {m.quantityDelta >= 0 ? '+' : ''}{m.quantityDelta}
                    </p>
                    {m.reason && <p className="text-[10px] text-muted-foreground max-w-36 truncate">{m.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* المرتجعات */}
      {order.returnRequests.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title={`المرتجعات (${order.returnRequests.length})`} icon={<Package className="size-4" />} />
            <div className="space-y-2">
              {order.returnRequests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => go('admin-returns', { status: r.status })}
                  className="w-full flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-start hover:border-primary/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" dir="ltr">{r.returnNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.reason} · {r.items.length} صنف · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} label={returnStatusLabel(r.status)} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* حوار الإلغاء — سبب إلزامي */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`إلغاء الطلب ${order.orderNumber}`}
        description="سيتم تحرير المخزون المحجوز وإشعار العميل. لا يمكن التراجع."
        confirmLabel="إلغاء الطلب"
        danger
        requireReason
        reasonLabel="سبب الإلغاء"
        reasonPlaceholder="مثال: نفد المخزون، طلب العميل..."
        noteField
        noteLabel="ملاحظة داخلية (اختياري)"
        onConfirm={async ({ reason, note }) => {
          await transition.mutateAsync({ to: 'CANCELLED', reason, note: note || undefined })
        }}
      />

      {/* حوار الشحن — شركة الشحن اختيارية */}
      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              شحن الطلب {order.orderNumber}
            </DialogTitle>
            <DialogDescription>سيتم توليد كود تتبع وإشعار العميل بالشحنة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="ship-provider">شركة / جهة الشحن (اختياري)</Label>
              <Input id="ship-provider" value={shipProvider} onChange={(e) => setShipProvider(e.target.value)} placeholder="مثال: أمانة التوصيل" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ship-note">ملاحظة (اختياري)</Label>
              <Input id="ship-note" value={shipNote} onChange={(e) => setShipNote(e.target.value)} placeholder="ملاحظة تظهر في السجل" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipOpen(false)}>إلغاء</Button>
            <Button onClick={shipSubmit} disabled={transition.isPending}>تأكيد الشحن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

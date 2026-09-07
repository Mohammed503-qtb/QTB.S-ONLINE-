'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Banknote, Check, CreditCard, MapPin, PackageCheck, Plus, Truck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useConfig } from '@/lib/client/session'
import { useCart, useNav } from '@/lib/client/stores'
import { money } from '@/lib/client/format'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { AddressForm } from '../components/address-form'
import { PaymentAccountCard } from '../components/payment-account-card'
import { SafeImg } from '../components/safe-img'
import { shippingMethodLabel } from '../utils'
import type { Address, HomeData, PaymentAccount, QuoteResult } from '../types'

// ============================================================
// إتمام الشراء — 4 خطوات (عنوان → شحن → دفع → مراجعة)
// الأسعار دائمًا من الخادم: نرسل variantId + quantity فقط
// Idempotency: مفتاح واحد لكل جلسة شراء
// ============================================================

const STEPS = [
  { label: 'العنوان', icon: MapPin },
  { label: 'الشحن', icon: Truck },
  { label: 'الدفع', icon: CreditCard },
  { label: 'المراجعة', icon: PackageCheck },
] as const

type CreateOrderResult = {
  duplicated: boolean
  orderId: string
  orderNumber: string
  paymentReference: string
  trackingCode: string
  grandTotal: number
}

export function CheckoutView({ couponCode }: { couponCode?: string }) {
  return (
    <RequireAuth title="سجّل الدخول لإتمام الشراء">
      <CheckoutInner couponCode={couponCode} />
    </RequireAuth>
  )
}

function CheckoutInner({ couponCode }: { couponCode?: string }) {
  const items = useCart((s) => s.items)
  const clear = useCart((s) => s.clear)
  const go = useNav((s) => s.go)
  const replace = useNav((s) => s.replace)
  const { data: config } = useConfig()

  const [step, setStep] = useState(1)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [shippingMethodCode, setShippingMethodCode] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'COD' | null>(null)
  const [customerNote, setCustomerNote] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // مفتاح Idempotency — يولد مرة واحدة عند فتح الشراء
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  // العناوين
  const { data: addresses, isLoading: addressesLoading, error: addressesError, refetch: refetchAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<Address[]>('/api/addresses'),
  })

  // طرق الشحن (من بيانات الرئيسية)
  const { data: home } = useQuery({
    queryKey: ['home'],
    queryFn: () => api.get<HomeData>('/api/catalog/home'),
    staleTime: 60_000,
  })

  // حسابات الدفع
  const { data: accountsData } = useQuery({
    queryKey: ['payment-accounts'],
    queryFn: () => api.get<{ accounts: PaymentAccount[]; codEnabled: boolean }>('/api/payment-accounts'),
  })

  // العنوان الفعّال: اختيار المستخدم أو الافتراضي (اشتقاق بدون تأثيرات)
  const fallbackAddress = addresses?.find((a) => a.isDefault) ?? addresses?.[0] ?? null
  const addressId = selectedAddressId ?? fallbackAddress?.id ?? null

  // عرض السعر الحي مع العنوان وطريقة الشحن
  const cartKey = items.map((i) => `${i.variantId}:${i.quantity}`).join('|')
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['checkout-quote', cartKey, addressId, shippingMethodCode, couponCode],
    queryFn: () =>
      api.post<QuoteResult>('/api/checkout/quote', {
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        ...(addressId ? { addressId } : {}),
        ...(shippingMethodCode ? { shippingMethodCode } : {}),
        ...(couponCode ? { couponCode } : {}),
      }),
    enabled: items.length > 0,
    retry: 0,
  })

  const selectedAddress = addresses?.find((a) => a.id === addressId) ?? null
  const shippingMethod = home?.shippingMethods.find((m) => m.code === shippingMethodCode) ?? null
  const bankEnabled = config?.flags.bank_transfer_enabled !== false
  const codEnabled = accountsData?.codEnabled === true

  // إنشاء الطلب — الأسعار من الخادم فقط
  const createOrder = useMutation({
    mutationFn: () =>
      api.post<CreateOrderResult>('/api/orders', {
        addressId,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        shippingMethodCode,
        paymentMethodCode: paymentMethod,
        ...(couponCode ? { couponCode } : {}),
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
        idempotencyKey,
      }),
    onSuccess: (res) => {
      clear()
      toast.success(res.duplicated ? 'تم استرجاع طلبك السابق' : `تم إنشاء الطلب ${res.orderNumber} بنجاح`)
      replace('order-success', { id: res.orderId })
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر إنشاء الطلب — حاول مجددًا'
      setSubmitError(msg)
      toast.error(msg)
    },
  })

  const itemsPayload = useMemo(() => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), [items])

  if (items.length === 0 && !createOrder.isSuccess) {
    return (
      <EmptyState
        icon="🛒"
        title="السلة فارغة"
        subtitle="لا يمكن إتمام الشراء بدون منتجات في السلة"
        action={
          <Button onClick={() => go('catalog')} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
            تسوق الآن
          </Button>
        }
      />
    )
  }

  const canNext =
    step === 1 ? !!addressId : step === 2 ? !!shippingMethodCode : step === 3 ? !!paymentMethod : false

  const confirmDisabled =
    createOrder.isPending || !addressId || !shippingMethodCode || !paymentMethod || !itemsPayload.length || !quote

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-4">
      <h1 className="text-2xl font-extrabold">إتمام الشراء</h1>

      {/* شريط الخطوات */}
      <ol className="flex items-center" aria-label="خطوات الشراء">
        {STEPS.map((s, i) => {
          const num = i + 1
          const done = step > num
          const active = step === num
          return (
            <li key={s.label} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => num < step && setStep(num)}
                className={cn('flex min-h-11 flex-col items-center gap-1 sm:flex-row sm:gap-2', num < step && 'cursor-pointer')}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                    done ? 'border-emerald-600 bg-emerald-600 text-white' : active ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-muted text-muted-foreground'
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : num}
                </span>
                <span className={cn('text-xs font-semibold sm:text-sm', active ? 'text-emerald-700 dark:text-emerald-400' : done ? '' : 'text-muted-foreground')}>
                  {s.label}
                </span>
              </button>
              {num < STEPS.length && <span className={cn('mx-1 h-0.5 flex-1 rounded', done ? 'bg-emerald-600' : 'bg-muted')} aria-hidden />}
            </li>
          )
        })}
      </ol>

      {/* الخطوة 1: العنوان */}
      {step === 1 && (
        <section className="space-y-4" aria-label="اختيار العنوان">
          {addressesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : addressesError ? (
            <ErrorState message="تعذر تحميل عناوينك" retry={() => refetchAddresses()} />
          ) : !addresses || addresses.length === 0 ? (
            <EmptyState
              icon="📍"
              title="لا توجد عناوين محفوظة"
              subtitle="أضف عنوان التوصيل لإكمال الطلب"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((addr) => (
                <AddressOption key={addr.id} address={addr} selected={addressId === addr.id} onSelect={() => setSelectedAddressId(addr.id)} />
              ))}
            </div>
          )}
          <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            إضافة عنوان جديد
          </Button>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="max-w-2xl" dir="rtl">
              <DialogHeader>
                <DialogTitle>عنوان جديد</DialogTitle>
                <DialogDescription>سيصل طلبك إلى هذا العنوان</DialogDescription>
              </DialogHeader>
              <AddressForm
                onDone={(saved) => {
                  setAddOpen(false)
                  setSelectedAddressId(saved.id)
                  refetchAddresses()
                }}
                onCancel={() => setAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </section>
      )}

      {/* الخطوة 2: الشحن */}
      {step === 2 && (
        <section className="space-y-4" aria-label="اختيار طريقة الشحن">
          {home?.shippingMethods.length ? (
            <>
              {home.shippingMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setShippingMethodCode(m.code)}
                  aria-pressed={shippingMethodCode === m.code}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border p-4 text-start shadow-sm transition-colors',
                    shippingMethodCode === m.code ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40' : 'bg-card hover:border-emerald-300'
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <Truck className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-bold">
                      {m.name}
                      {m.etaNote && <span className="text-xs font-normal text-muted-foreground">{m.etaNote}</span>}
                    </span>
                    {m.description && <span className="mt-0.5 block text-sm text-muted-foreground">{m.description}</span>}
                  </span>
                  <span className={cn('mt-1 size-5 shrink-0 rounded-full border-2', shippingMethodCode === m.code ? 'border-emerald-600 bg-emerald-600' : 'border-muted')} aria-hidden />
                </button>
              ))}
              {selectedAddress && (
                <Alert>
                  <MapPin className="size-4" aria-hidden />
                  <AlertDescription className="text-sm">
                    أجرة الشحن تُحسب حسب <b>{selectedAddress.governorate}</b> — سترى السعر بعد التحديد
                  </AlertDescription>
                </Alert>
              )}
              {shippingMethodCode && quote && (
                <div className="rounded-2xl border bg-card p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">أجرة الشحن إلى {selectedAddress?.governorate}</span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{money(quote.shippingFee)}</span>
                  </div>
                </div>
              )}
              {shippingMethodCode && quoteError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    {quoteError instanceof ApiClientError ? quoteError.message : 'تعذر حساب الشحن — أعد المحاولة'}
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <Skeleton className="h-24 w-full rounded-2xl" />
          )}
        </section>
      )}

      {/* الخطوة 3: الدفع */}
      {step === 3 && (
        <section className="space-y-4" aria-label="اختيار طريقة الدفع">
          {bankEnabled && (
            <button
              type="button"
              onClick={() => setPaymentMethod('BANK_TRANSFER')}
              aria-pressed={paymentMethod === 'BANK_TRANSFER'}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border p-4 text-start shadow-sm transition-colors',
                paymentMethod === 'BANK_TRANSFER' ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40' : 'bg-card hover:border-emerald-300'
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <CreditCard className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="font-bold">تحويل بنكي / محفظة</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">حوّل المبلغ إلى أحد الحسابات ثم سجّل بيانات التحويل من صفحة الطلب</span>
              </span>
              <span className={cn('mt-1 size-5 shrink-0 rounded-full border-2', paymentMethod === 'BANK_TRANSFER' ? 'border-emerald-600 bg-emerald-600' : 'border-muted')} aria-hidden />
            </button>
          )}

          {codEnabled && (
            <button
              type="button"
              onClick={() => setPaymentMethod('COD')}
              aria-pressed={paymentMethod === 'COD'}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border p-4 text-start shadow-sm transition-colors',
                paymentMethod === 'COD' ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40' : 'bg-card hover:border-emerald-300'
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <Banknote className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="font-bold">الدفع عند الاستلام</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">ادفع نقدًا لمندوب التوصيل عند وصول طلبك</span>
              </span>
              <span className={cn('mt-1 size-5 shrink-0 rounded-full border-2', paymentMethod === 'COD' ? 'border-emerald-600 bg-emerald-600' : 'border-muted')} aria-hidden />
            </button>
          )}

          {paymentMethod === 'BANK_TRANSFER' && (
            <div className="space-y-3">
              <h2 className="font-bold">حوّل المبلغ إلى أحد هذه الحسابات:</h2>
              {accountsData?.accounts.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {accountsData.accounts.map((acc) => (
                    <PaymentAccountCard key={acc.id} account={acc} />
                  ))}
                </div>
              ) : (
                <Skeleton className="h-32 w-full rounded-2xl" />
              )}
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertDescription className="text-sm">
                  بعد إنشاء الطلب ستحصل على رقم مرجعي للدفع (PAY-) — سجّل بيانات تحويلك من صفحة الطلب ليصلك الطلب أسرع.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </section>
      )}

      {/* الخطوة 4: المراجعة */}
      {step === 4 && (
        <section className="space-y-4" aria-label="مراجعة الطلب">
          {/* العناصر */}
          <div className="space-y-2 rounded-2xl border bg-card p-4">
            <h2 className="font-bold">المنتجات ({items.length})</h2>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted/40">
                    <SafeImg src={item.image} alt={item.name} className="size-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ')} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* الملخصات */}
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard title="التوصيل إلى">
              {selectedAddress ? (
                <p className="text-sm leading-relaxed">
                  <b>{selectedAddress.label}</b> — {selectedAddress.governorate}، {selectedAddress.city}
                  {selectedAddress.district ? `، ${selectedAddress.district}` : ''}
                  {selectedAddress.neighborhood ? `، ${selectedAddress.neighborhood}` : ''}
                  <span dir="ltr" className="block text-xs text-muted-foreground">{selectedAddress.phone}</span>
                </p>
              ) : (
                <p className="text-sm text-rose-600">لم يتم اختيار عنوان</p>
              )}
            </SummaryCard>
            <SummaryCard title="الشحن والدفع">
              <p className="text-sm">
                {shippingMethod ? shippingMethodLabel(shippingMethodCode ?? shippingMethod.code) : '—'}
                {shippingMethod?.etaNote ? ` (${shippingMethod.etaNote})` : ''}
                <br />
                {paymentMethod === 'COD' ? 'الدفع عند الاستلام' : paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي / محفظة' : '—'}
              </p>
            </SummaryCard>
          </div>

          {/* ملاحظة */}
          <div className="space-y-1.5">
            <label htmlFor="checkout-note" className="text-sm font-bold">ملاحظة للطلب (اختياري)</label>
            <Textarea
              id="checkout-note"
              rows={2}
              maxLength={500}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="أي تفاصيل إضافية تساعدنا في تجهيز طلبك..."
            />
          </div>

          {/* الإجماليات من الخادم */}
          {quoteError && !quote ? (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">
                {quoteError instanceof ApiClientError ? quoteError.message : 'تعذر حساب الإجمالي من الخادم — لا يمكن تأكيد الطلب'}
              </AlertDescription>
            </Alert>
          ) : quoteLoading || !quote ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <div className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
              <Row label="إجمالي المنتجات" value={money(quote.itemsTotal)} />
              {quote.discountTotal > 0 && <Row label="خصم المنتجات" value={`- ${money(quote.discountTotal)}`} className="text-amber-700 dark:text-amber-400" />}
              {quote.couponDiscount > 0 && <Row label={`خصم الكوبون ${quote.couponCode ?? ''}`} value={`- ${money(quote.couponDiscount)}`} className="text-emerald-700 dark:text-emerald-400" />}
              <Row label="الشحن" value={money(quote.shippingFee)} />
              <div className="flex justify-between border-t pt-2 text-base font-extrabold">
                <span>الإجمالي المطلوب</span>
                <span className="text-emerald-700 dark:text-emerald-400">{money(quote.grandTotal)}</span>
              </div>
              {quote.warnings.length > 0 && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <AlertDescription>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {quote.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{submitError}</AlertDescription>
            </Alert>
          )}
        </section>
      )}

      {/* أزرار التنقل بين الخطوات */}
      <div className="flex items-center justify-between gap-3 pb-24 lg:pb-0">
        {step > 1 ? (
          <Button variant="outline" className="min-h-11" onClick={() => setStep((s) => s - 1)} disabled={createOrder.isPending}>
            <ArrowRight className="size-4" aria-hidden />
            السابق
          </Button>
        ) : (
          <Button variant="outline" className="min-h-11" onClick={() => go('cart')}>
            <ArrowRight className="size-4" aria-hidden />
            السلة
          </Button>
        )}

        {step < 4 ? (
          <Button
            className="min-h-11 bg-emerald-700 px-8 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
          >
            التالي
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12 bg-emerald-700 px-8 text-base text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            disabled={confirmDisabled}
            onClick={() => createOrder.mutate()}
          >
            {createOrder.isPending ? 'جارِ إنشاء الطلب...' : 'تأكيد الطلب'}
            <Check className="size-5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------- مكونات مساعدة ----------
function AddressOption({ address, selected, onSelect }: { address: Address; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-2xl border p-4 text-start shadow-sm transition-colors',
        selected ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40' : 'bg-card hover:border-emerald-300'
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-bold">
          <MapPin className="size-4 text-emerald-600" aria-hidden />
          {address.label}
        </span>
        {address.isDefault && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">افتراضي</span>}
      </span>
      <span className="text-sm text-muted-foreground">
        {address.governorate}، {address.city}
        {address.district ? `، ${address.district}` : ''}
        {address.neighborhood ? `، حي ${address.neighborhood}` : ''}
        {address.street ? `، ${address.street}` : ''}
      </span>
      <span dir="ltr" className="text-xs text-muted-foreground">{address.phone}</span>
      <span className={cn('mt-1 size-5 self-end rounded-full border-2', selected ? 'border-emerald-600 bg-emerald-600' : 'border-muted')} aria-hidden />
    </button>
  )
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h3 className="mb-1.5 text-sm font-bold text-muted-foreground">{title}</h3>
      {children}
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

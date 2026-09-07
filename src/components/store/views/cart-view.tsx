'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Minus, Plus, ShoppingCart, Tag, Trash2, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useSession } from '@/lib/client/session'
import { useCart, useNav, useUi } from '@/lib/client/stores'
import { money } from '@/lib/client/format'
import { SafeImg } from '../components/safe-img'
import type { CouponValidateResult, QuoteResult } from '../types'

// ============================================================
// السلة — تعديل الكميات + ملخص حي من الخادم (/api/checkout/quote)
// + كوبون (validate) + زر إتمام الشراء (يتطلب جلسة)
// ============================================================

export function CartView() {
  const items = useCart((s) => s.items)
  const updateQty = useCart((s) => s.updateQty)
  const remove = useCart((s) => s.remove)
  const clear = useCart((s) => s.clear)
  const go = useNav((s) => s.go)
  const { isAuthenticated } = useSession()
  const openLogin = useUi((s) => s.openLogin)

  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<string | null>(null)
  const [couponLabel, setCouponLabel] = useState<string | null>(null)

  // عرض السعر الحي من الخادم (الأسعار دائمًا من الخادم)
  const cartKey = items.map((i) => `${i.variantId}:${i.quantity}`).join('|')
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['quote', cartKey, coupon],
    queryFn: () =>
      api.post<QuoteResult>('/api/checkout/quote', {
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        ...(coupon ? { couponCode: coupon } : {}),
      }),
    enabled: items.length > 0,
    retry: 0,
  })

  // التحقق من الكوبون
  const validateCoupon = useMutation({
    mutationFn: () =>
      api.post<CouponValidateResult>('/api/coupons/validate', {
        code: couponInput.trim(),
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      }),
    onSuccess: (res) => {
      setCoupon(res.code)
      setCouponLabel(res.label)
      setCouponInput('')
      toast.success(`تم تطبيق الكوبون: ${res.label}`)
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'كوبون غير صالح'),
  })

  if (items.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="سلتك فارغة"
        subtitle="اكتشف تشكيلتنا وأضف ما يعجبك إلى السلة"
        action={
          <Button onClick={() => go('catalog')} className="min-h-11 bg-emerald-700 px-6 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
            <ShoppingCart className="size-4" aria-hidden />
            تسوق الآن
          </Button>
        }
      />
    )
  }

  const warnings = quote?.warnings ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">سلة المشتريات</h1>
        <Button variant="ghost" size="sm" className="min-h-9 text-rose-600 hover:text-rose-700" onClick={() => { clear(); toast.success('تم تفريغ السلة') }}>
          <Trash2 className="size-4" aria-hidden />
          تفريغ السلة
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* العناصر */}
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => (
            <article key={item.variantId} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-sm">
              <button
                type="button"
                className="size-20 shrink-0 overflow-hidden rounded-xl bg-muted/40 sm:size-24"
                onClick={() => go('product', { id: item.productId })}
                aria-label={`عرض ${item.name}`}
              >
                <SafeImg src={item.image} alt={item.name} className="size-full" />
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <button type="button" onClick={() => go('product', { id: item.productId })} className="text-start font-bold leading-snug hover:underline">
                  {item.name}
                </button>
                {Object.keys(item.attributes).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center rounded-xl border" role="group" aria-label={`كمية ${item.name}`}>
                    <Button variant="ghost" size="icon" className="size-10" onClick={() => updateQty(item.variantId, item.quantity - 1)} aria-label="إنقاص الكمية">
                      <Minus className="size-4" aria-hidden />
                    </Button>
                    <span className="w-8 text-center font-bold" aria-live="polite">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="size-10" onClick={() => updateQty(item.variantId, item.quantity + 1)} aria-label="زيادة الكمية" disabled={item.quantity >= 99}>
                      <Plus className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{money(item.price * item.quantity)}</span>
                    <span className="text-xs text-muted-foreground">({money(item.price)} للوحدة)</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 self-start text-muted-foreground hover:text-rose-600"
                onClick={() => { remove(item.variantId); toast.success('تم حذف المنتج من السلة') }}
                aria-label={`حذف ${item.name}`}
              >
                <X className="size-5" aria-hidden />
              </Button>
            </article>
          ))}
        </div>

        {/* الملخص */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="ملخص السلة">
          <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="font-extrabold">ملخص الطلب</h2>

            {/* الكوبون */}
            {coupon ? (
              <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-400 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  <Tag className="size-4" aria-hidden />
                  {coupon} — {couponLabel}
                </div>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => { setCoupon(null); setCouponLabel(null) }} aria-label="إزالة الكوبون">
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  aria-label="كود الخصم"
                  className="min-h-11"
                  placeholder="كود الخصم (إن وجد)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && couponInput.trim()) validateCoupon.mutate()
                  }}
                />
                <Button
                  variant="outline"
                  className="min-h-11 px-4"
                  disabled={!couponInput.trim() || validateCoupon.isPending}
                  onClick={() => validateCoupon.mutate()}
                >
                  {validateCoupon.isPending ? '...' : 'تطبيق'}
                </Button>
              </div>
            )}

            {/* تحذيرات */}
            {warnings.length > 0 && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {quoteError && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  {quoteError instanceof ApiClientError ? quoteError.message : 'تعذر حساب الإجمالي من الخادم'}
                </AlertDescription>
              </Alert>
            )}

            {/* الأرقام */}
            {quoteLoading || !quote ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">إجمالي المنتجات</span>
                  <span className="font-bold">{money(quote.itemsTotal)}</span>
                </div>
                {quote.discountTotal > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400">
                    <span>خصم المنتجات</span>
                    <span className="font-bold">- {money(quote.discountTotal)}</span>
                  </div>
                )}
                {quote.couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>خصم الكوبون</span>
                    <span className="font-bold">- {money(quote.couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الشحن</span>
                  <span className="font-medium">{quote.shippingFee > 0 ? money(quote.shippingFee) : 'يُحدد بعد اختيار العنوان'}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base">
                  <span className="font-extrabold">الإجمالي</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{money(quote.grandTotal)}</span>
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="h-12 w-full bg-emerald-700 text-base text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              onClick={() => {
                if (!isAuthenticated) {
                  openLogin('سجّل الدخول لإتمام الشراء')
                  return
                }
                go('checkout', coupon ? { coupon } : undefined)
              }}
            >
              إتمام الشراء
              <ArrowLeft className="size-5" aria-hidden />
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

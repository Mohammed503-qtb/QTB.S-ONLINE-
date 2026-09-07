'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RotateCcw, Send } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState, EmptyState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { money, orderStatusLabel } from '@/lib/client/format'
import { RETURNABLE_STATUSES, RETURN_REASONS, type OrderStatus } from '@/lib/shared/constants'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { SafeImg } from '../components/safe-img'
import type { OrderDetailsResult } from '../types'

// ============================================================
// طلب إرجاع جديد — اختيار أصناف وكميات + سبب + ملاحظة
// ============================================================

export function ReturnNewView({ orderId }: { orderId: string }) {
  return (
    <RequireAuth title="سجّل الدخول لطلب الإرجاع">
      <ReturnNewInner orderId={orderId} />
    </RequireAuth>
  )
}

function ReturnNewInner({ orderId }: { orderId: string }) {
  const go = useNav((s) => s.go)
  const [selected, setSelected] = useState<Record<string, number>>({}) // orderItemId → qty
  const [reason, setReason] = useState<string | undefined>(undefined)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.get<OrderDetailsResult>(`/api/orders/${encodeURIComponent(orderId)}`),
    enabled: orderId.length > 0,
  })

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ id: string; returnNumber: string }>('/api/returns', {
        orderId,
        items: Object.entries(selected).map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (res) => {
      toast.success(`تم إرسال طلب الإرجاع ${res.returnNumber}`)
      go('returns')
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر إرسال الطلب'
      setError(msg)
      toast.error(msg)
    },
  })

  if (!orderId) return <EmptyState icon="❓" title="لم يتم تحديد طلب" subtitle="اختر طلبًا من طلباتي أولًا" />

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }
  if (loadError || !data) return <ErrorState message={loadError instanceof Error ? loadError.message : 'تعذر تحميل الطلب'} retry={() => refetch()} />

  const returnable = RETURNABLE_STATUSES.includes(data.order.status as OrderStatus)

  if (!returnable) {
    return (
      <EmptyState
        icon="⛔"
        title="هذا الطلب غير مؤهل للإرجاع"
        subtitle={`حالة الطلب الحالية: ${orderStatusLabel(data.order.status)} — الإرجاع متاح بعد التسليم فقط`}
        action={
          <Button variant="outline" className="min-h-11" onClick={() => go('orders')}>
            طلباتي
          </Button>
        }
      />
    )
  }

  const toggleItem = (itemId: string, qty: number, maxQty: number) => {
    setSelected((s) => {
      const next = { ...s }
      if (qty <= 0) delete next[itemId]
      else next[itemId] = Math.min(qty, maxQty)
      return next
    })
    setError(null)
  }

  const onSubmitClick = () => {
    setError(null)
    if (Object.keys(selected).length === 0) return setError('اختر صنفًا واحدًا على الأقل')
    if (!reason) return setError('اختر سبب الإرجاع')
    submit.mutate()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <RotateCcw className="size-6 text-emerald-600" aria-hidden />
          طلب إرجاع
        </h1>
        <span className="font-mono text-sm text-muted-foreground" dir="ltr">{data.order.orderNumber}</span>
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          اختر الأصناف التي تريد إرجاعها مع الكميات، وسيتم مراجعة الطلب من فريقنا. الاسترداد يتم بعد فحص المنتجات.
        </AlertDescription>
      </Alert>

      {/* الأصناف */}
      <section className="space-y-2" aria-label="أصناف الطلب">
        <h2 className="font-bold">أصناف الطلب</h2>
        {data.items.map((item) => {
          const qty = selected[item.id] ?? 0
          return (
            <div
              key={item.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 transition-colors',
                qty > 0 && 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30'
              )}
            >
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                <Checkbox checked={qty > 0} onCheckedChange={(c) => toggleItem(item.id, c ? 1 : 0, item.quantity)} aria-label={`اختيار ${item.productName}`} />
                <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted/40">
                  <SafeImg src={item.imageUrl} alt={item.productName} className="size-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.productName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ')} · {money(item.unitPrice)}
                  </span>
                  <span className="block text-xs text-muted-foreground">الكمية المشتراة: {item.quantity}</span>
                </span>
              </label>
              {qty > 0 && (
                <div className="flex items-center rounded-xl border" role="group" aria-label={`كمية إرجاع ${item.productName}`}>
                  <Button variant="ghost" size="icon" className="size-10" onClick={() => toggleItem(item.id, qty - 1, item.quantity)} aria-label="إنقاص">
                    −
                  </Button>
                  <span className="w-8 text-center font-bold" aria-live="polite">{qty}</span>
                  <Button variant="ghost" size="icon" className="size-10" onClick={() => toggleItem(item.id, qty + 1, item.quantity)} aria-label="زيادة" disabled={qty >= item.quantity}>
                    +
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* السبب */}
      <div className="space-y-1.5">
        <Label>سبب الإرجاع *</Label>
        <Select value={reason} onValueChange={(v) => { setReason(v); setError(null) }}>
          <SelectTrigger className="min-h-11 w-full">
            <SelectValue placeholder="اختر السبب" />
          </SelectTrigger>
          <SelectContent>
            {RETURN_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* الملاحظة */}
      <div className="space-y-1.5">
        <Label htmlFor="return-note">ملاحظات إضافية</Label>
        <Textarea id="return-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="أي تفاصيل تساعد فريق المراجعة..." />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 pb-24 sm:flex-row sm:justify-end lg:pb-0">
        <Button variant="outline" className="min-h-11" onClick={() => go('orders')}>إلغاء</Button>
        <Button
          className="min-h-11 bg-emerald-700 px-8 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          disabled={submit.isPending}
          onClick={onSubmitClick}
        >
          <Send className="size-4" aria-hidden />
          {submit.isPending ? 'جارِ الإرسال...' : 'إرسال طلب الإرجاع'}
        </Button>
      </div>
    </div>
  )
}

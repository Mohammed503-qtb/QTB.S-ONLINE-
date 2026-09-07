'use client'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Eye, Info, MessageCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FullSpinner, ErrorState } from '@/components/app/spinner'
import { api } from '@/lib/client/api'
import { useConfig } from '@/lib/client/session'
import { useNav, whatsappLink } from '@/lib/client/stores'
import { money, dateTimeFmt } from '@/lib/client/format'
import { RequireAuth } from '../components/require-auth'
import { CodeBox } from '../components/code-box'
import { PaymentAccountCard } from '../components/payment-account-card'
import { waOrderMessage } from '../utils'
import type { OrderDetailsResult, PaymentAccount } from '../types'

// ============================================================
// نجاح الطلب — أرقام كبيرة قابلة للنسخ + تعليمات الدفع + واتساب
// ============================================================

export function OrderSuccessView({ id }: { id: string }) {
  return (
    <RequireAuth title="سجّل الدخول لعرض تفاصيل طلبك">
      <OrderSuccessInner id={id} />
    </RequireAuth>
  )
}

function OrderSuccessInner({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const { data: config } = useConfig()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<OrderDetailsResult>(`/api/orders/${encodeURIComponent(id)}`),
    enabled: id.length > 0,
  })

  if (isLoading) return <FullSpinner label="جارِ تحميل بيانات الطلب..." />

  if (error || !data) {
    return <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل الطلب'} retry={() => refetch()} />
  }

  const { order, payment } = data
  const isBank = order.paymentMethod === 'BANK_TRANSFER'
  const accountSnapshot = payment?.account
  const whatsappEnabled = config?.flags.whatsapp_enabled !== false

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* رأس النجاح */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-center text-white shadow-lg dark:from-emerald-700 dark:to-emerald-800">
        <CheckCircle2 className="mx-auto size-16" aria-hidden />
        <h1 className="mt-2 text-2xl font-extrabold">تم استلام طلبك بنجاح!</h1>
        <p className="mt-1 text-sm text-emerald-50/90">
          {isBank ? 'أكمل التحويل وسجّل بياناته من صفحة الطلب ليُعتمد الدفع' : 'سيصلك طلبك قريبًا — الدفع عند الاستلام'}
        </p>
        <p className="mt-3 inline-flex items-baseline gap-2 rounded-2xl bg-white/15 px-4 py-2 backdrop-blur">
          <span className="text-sm">الإجمالي المطلوب</span>
          <span className="text-2xl font-extrabold">{money(order.grandTotal)}</span>
        </p>
      </div>

      {/* الأرقام الكبيرة */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="أرقام الطلب">
        <CodeBox code={order.orderNumber} label="رقم الطلب" />
        {order.paymentReference && <CodeBox code={order.paymentReference} label="مرجع الدفع" />}
        {order.trackingCode && <CodeBox code={order.trackingCode} label="كود التتبع" />}
      </section>

      {/* تعليمات الدفع البنكي */}
      {isBank && payment && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Info className="size-4" aria-hidden />
          <AlertTitle>مهم — خطوات الدفع</AlertTitle>
          <AlertDescription>
            <ol className="list-inside list-decimal space-y-1 text-sm">
              <li>حوّل مبلغ <b>{money(payment.expectedAmount)}</b> إلى أحد حسابات المتجر بالأسفل</li>
              <li>ضع <b dir="ltr">{order.paymentReference}</b> في خانة ملاحظة التحويل أو مرجع العملية</li>
              <li>سجّل بيانات التحويل من صفحة الطلب (زر «تسجيل التحويل») مع صورة الإيصال إن أمكن</li>
              {payment.expiresAt && <li>يرجى إتمام الدفع قبل <b>{dateTimeFmt(payment.expiresAt)}</b> وإلا يُلغى الطلب تلقائيًا</li>}
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* حسابات الدفع */}
      {isBank && accountSnapshot && accountSnapshot.accountNumber && (
        <section className="space-y-3" aria-label="حسابات الدفع">
          <h2 className="font-bold">الحساب المسجل لهذا الطلب</h2>
          <PaymentAccountCard account={{ ...accountSnapshot, id: accountSnapshot.id ?? '', name: accountSnapshot.name ?? 'حساب المتجر', institution: accountSnapshot.institution ?? 'المؤسسة', beneficiary: accountSnapshot.beneficiary ?? '', accountNumber: accountSnapshot.accountNumber ?? '', type: accountSnapshot.type ?? 'BANK', instructions: accountSnapshot.instructions ?? '' } as PaymentAccount} />
        </section>
      )}

      {/* الأزرار */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" className="h-12 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={() => go('order-details', { id: order.id })}>
          <Eye className="size-5" aria-hidden />
          عرض الطلب وتسجيل التحويل
        </Button>
        {whatsappEnabled && (
          <Button
            size="lg"
            variant="outline"
            className="h-12"
            onClick={() => {
              window.open(whatsappLink(config?.settings.whatsappNumber ?? '', waOrderMessage(order.orderNumber, `مرجع الدفع ${order.paymentReference}`)), '_blank', 'noopener')
              toast.info('فتح واتساب — أرسل رسالتك')
            }}
          >
            <MessageCircle className="size-5" aria-hidden />
            تواصل بخصوص الطلب
          </Button>
        )}
      </div>

      <div className="text-center">
        <Button variant="link" className="min-h-11" onClick={() => go('home')}>
          متابعة التسوق
        </Button>
      </div>
    </div>
  )
}

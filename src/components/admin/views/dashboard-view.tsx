'use client'

// ============================================================
// لوحة معلومات الإدارة — مؤشرات اليوم + الطوابير + أرصدة بنكية
// + رسم مبيعات آخر 7 أيام (recharts AreaChart)
// ============================================================

import { useQuery } from '@tanstack/react-query'
import { keepPreviousData } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  BanknoteIcon, CreditCard, Package, ReceiptText, ShoppingBag, ShoppingCart, Truck, Undo2, Warehouse, TrendingUp,
} from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, dateFmt, shortMoney } from '@/lib/client/format'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/app/spinner'
import { PageHeader, SectionHeader, StatCard, usePerm, BANK_TYPE_LABELS } from '@/components/admin/components/kit'
import type { DashboardResponse } from '@/components/admin/types'

export function DashboardView() {
  const go = useNav((s) => s.go)
  const { can } = usePerm()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get<DashboardResponse>('/api/admin/dashboard'),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }
  if (error || !data) return <ErrorState message={error?.message} retry={refetch} />

  const { today, queues, totals, banks, salesByDay } = data
  const maxChart = Math.max(...salesByDay.map((d) => d.total), 1)

  return (
    <div className="space-y-6">
      <PageHeader title="لوحة المعلومات" description={`نظرة اليوم — ${dateFmt(new Date())}`} />

      {/* مؤشرات اليوم */}
      <section aria-label="مؤشرات اليوم">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard title="طلبات اليوم" value={today.orders} icon={<ShoppingBag className="size-5" />} onClick={() => go('admin-orders')} hint={`آخر 7 أيام: ${totals.orders7d} طلب`} />
          <StatCard title="مبيعات اليوم" value={money(today.sales)} icon={<TrendingUp className="size-5" />} tone="primary" onClick={() => go('admin-orders')} />
          <StatCard title="محصل اليوم (بنكيًا)" value={money(today.collected)} icon={<BanknoteIcon className="size-5" />} tone="primary" onClick={() => can('accounting.view') ? go('admin-banks') : undefined} />
          <StatCard title="مصروفات اليوم" value={money(today.expenses)} icon={<ReceiptText className="size-5" />} tone="warning" onClick={() => can('expenses.view') ? go('admin-expenses') : undefined} />
          <StatCard title="صافي اليوم" value={money(today.net)} icon={<BanknoteIcon className="size-5" />} tone={today.net >= 0 ? 'primary' : 'danger'} />
        </div>
      </section>

      {/* طوابير العمل — كل بطاقة تنقل للقائمة المفلترة */}
      <section aria-label="طوابير العمل">
        <SectionHeader title="طوابير العمل" icon={<Truck className="size-4" />} />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-3">
          {can('payments.view') && (
            <StatCard title="دفعات بانتظار المراجعة" value={queues.reviewPayments} icon={<CreditCard className="size-5" />} tone={queues.reviewPayments > 0 ? 'warning' : 'default'} onClick={() => go('admin-payments', { status: 'SUBMITTED' })} />
          )}
          <StatCard title="طلبات قيد التجهيز" value={queues.processingOrders} icon={<Package className="size-5" />} tone="info" onClick={() => go('admin-orders', { status: 'PROCESSING' })} />
          <StatCard title="طلبات مع الشحن" value={queues.shippingOrders} icon={<Truck className="size-5" />} tone="info" onClick={() => go('admin-orders', { status: 'SHIPPED' })} />
          {can('returns.view') && (
            <StatCard title="مرتجعات معلقة" value={queues.pendingReturns} icon={<Undo2 className="size-5" />} tone={queues.pendingReturns > 0 ? 'warning' : 'default'} onClick={() => go('admin-returns', { status: 'REQUESTED' })} />
          )}
          {can('inventory.view') && (
            <StatCard title="أصناف مخزون منخفض" value={queues.lowStock} icon={<Warehouse className="size-5" />} tone={queues.lowStock > 0 ? 'danger' : 'default'} onClick={() => go('admin-inventory', { lowOnly: '1' })} />
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* رسم المبيعات */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">مبيعات آخر 7 أيام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} tickFormatter={(v: number) => shortMoney(v)} width={44} />
                  <Tooltip
                    formatter={(value: number | string, name: string) => [name === 'total' ? money(Number(value)) : value, name === 'total' ? 'المبيعات' : 'الطلبات']}
                    contentStyle={{ direction: 'rtl', borderRadius: 10, fontSize: 12, border: '1px solid #e5e7eb' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} fill="url(#salesFill)" name="total" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              أعلى يوم: {money(Math.max(...salesByDay.map((d) => d.total), 0))} — الطلبات غير الملغاة فقط
            </p>
            <p className="sr-only">أقصى قيمة بالمخطط {money(maxChart)}</p>
          </CardContent>
        </Card>

        {/* الأرصدة البنكية */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>الأرصدة البنكية</span>
              {can('accounting.view') && (
                <button onClick={() => go('admin-banks')} className="text-xs text-primary hover:underline">
                  إدارة الحسابات
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {banks.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حسابات بنكية</p>}
            {banks.map((b) => (
              <div key={b.name + b.institution} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{b.institution} · {BANK_TYPE_LABELS[b.type] ?? b.type}</p>
                </div>
                <p className="text-sm font-bold tabular-nums shrink-0">{money(b.currentBalance)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* إحصاءات عامة */}
      <section aria-label="إحصاءات عامة">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="إجمالي العملاء" value={totals.customers} icon={<ShoppingCart className="size-5" />} onClick={() => can('customers.view') ? go('admin-customers') : undefined} />
          <StatCard title="منتجات نشطة" value={totals.activeProducts} icon={<Package className="size-5" />} onClick={() => can('products.update') ? go('admin-products') : undefined} />
          <StatCard title="طلبات 7 أيام" value={totals.orders7d} icon={<ShoppingBag className="size-5" />} onClick={() => go('admin-orders')} />
          <StatCard title="دفعات غير مدفوعة" value={queues.pendingPayments} icon={<CreditCard className="size-5" />} tone="info" onClick={() => can('payments.view') ? go('admin-payments') : undefined} />
        </div>
      </section>
    </div>
  )
}

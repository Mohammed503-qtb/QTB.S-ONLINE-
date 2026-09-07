'use client'

// ============================================================
// ملف العميل الكامل — بيانات + إحصاء + عناوين + طلباته +
// مدفوعاته + مرتجعاته + استرداداته + تقييماته
// ============================================================

import { useQuery } from '@tanstack/react-query'
import { CreditCard, MapPin, Package, Undo2, User, Wallet } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, orderStatusLabel, paymentStatusLabel, refundStatusLabel, returnStatusLabel, timeAgo } from '@/lib/client/format'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, FullSpinner } from '@/components/app/spinner'
import { PageHeader, REFUND_METHOD_LABELS, SectionHeader, StatCard, StatusBadge, TIER_LABELS, usePerm, Stars } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { CustomerDetailResponse, CustomerOrderMini, CustomerRefundMini } from '@/components/admin/types'

type PaymentMini = { paymentNumber: string; status: string; expectedAmount: number; paidAmount: number; createdAt: string }
type ReturnMini = { returnNumber: string; status: string; reason: string; createdAt: string }
type ReviewMini = { id: string; rating: number; comment?: string | null; createdAt: string; product: { name: string } }

export function CustomerDetailsView({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const { can } = usePerm()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-customer', id],
    queryFn: () => api.get<CustomerDetailResponse>(`/api/admin/customers/${encodeURIComponent(id)}`),
    enabled: !!id,
  })

  if (!id) return <ErrorState message="معرّف العميل غير صالح" retry={() => go('admin-customers')} />
  if (isLoading) return <FullSpinner label="جارِ تحميل ملف العميل..." />
  if (error || !data) return <ErrorState message={error?.message} retry={refetch} />

  const { customer, orders, payments, returns, refunds, reviews } = data

  const orderColumns: Column<CustomerOrderMini>[] = [
    {
      key: 'order',
      header: 'الطلب',
      cell: (o) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{o.orderNumber}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(o.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (o) => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={o.status} label={orderStatusLabel(o.status)} />
          <StatusBadge status={o.paymentStatus} label={paymentStatusLabel(o.paymentStatus)} />
        </div>
      ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      cell: (o) => <span className="text-sm font-bold tabular-nums">{money(o.grandTotal)}</span>,
    },
    {
      key: 'tracking',
      header: 'التتبع',
      cell: (o) => (o.trackingCode ? <span className="text-xs" dir="ltr">{o.trackingCode}</span> : <span className="text-xs text-muted-foreground">—</span>),
    },
  ]

  const paymentColumns: Column<PaymentMini>[] = [
    {
      key: 'payment',
      header: 'الدفعة',
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{p.paymentNumber}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(p.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (p) => <StatusBadge status={p.status} label={paymentStatusLabel(p.status)} />,
    },
    {
      key: 'amounts',
      header: 'المبالغ',
      cell: (p) => (
        <div className="text-xs">
          <p>المطلوب: <span className="tabular-nums">{money(p.expectedAmount)}</span></p>
          <p>المعتمد: <span className="tabular-nums">{money(p.paidAmount)}</span></p>
        </div>
      ),
    },
  ]

  const returnColumns: Column<ReturnMini>[] = [
    {
      key: 'return',
      header: 'المرتجع',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{r.returnNumber}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-40">{r.reason}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (r) => <StatusBadge status={r.status} label={returnStatusLabel(r.status)} />,
    },
    {
      key: 'date',
      header: 'التاريخ',
      cell: (r) => <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>,
    },
  ]

  const refundColumns: Column<CustomerRefundMini>[] = [
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
      key: 'status',
      header: 'الحالة',
      cell: (r) => <StatusBadge status={r.status} label={refundStatusLabel(r.status)} />,
    },
    {
      key: 'amount',
      header: 'المبلغ',
      cell: (r) => <span className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-400">{money(r.amount)}</span>,
    },
    {
      key: 'method',
      header: 'الطريقة',
      cell: (r) => <span className="text-xs">{REFUND_METHOD_LABELS[r.method] ?? r.method}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.user.name}
        description={`${customer.user.phone} · ${TIER_LABELS[customer.tier] ?? customer.tier} · عميل منذ ${timeAgo(customer.createdAt)}`}
        onBack={() => (back ? back() : go('admin-customers'))}
        actions={<StatusBadge status={customer.user.status === 'ACTIVE' ? 'ACTIVE' : 'BLOCKED'} label={customer.user.status === 'ACTIVE' ? 'نشط' : customer.user.status === 'SUSPENDED' ? 'موقوف' : 'محظور'} />}
      />

      {/* إحصاءات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard title="عدد الطلبات" value={customer.ordersCount} icon={<Package className="size-5" />} />
        <StatCard title="إجمالي الشراء" value={money(customer.ordersTotal)} tone="primary" icon={<Wallet className="size-5" />} />
        <StatCard title="المرتجعات" value={returns.length} tone="info" icon={<Undo2 className="size-5" />} />
        <StatCard title="عمليات الإلغاء" value={customer.cancellations} tone="warning" />
        <StatCard title="رصيد دائن" value={money(customer.creditBalance)} tone={customer.creditBalance > 0 ? 'primary' : 'default'} icon={<CreditCard className="size-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* بيانات العميل */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="بيانات العميل" icon={<User className="size-4" />} />
            <div className="space-y-1.5 text-sm">
              <p><span className="text-muted-foreground">الاسم: </span>{customer.user.name}</p>
              <p dir="ltr" className="text-end"><span className="text-muted-foreground">الهاتف: </span>{customer.user.phone}</p>
              {customer.user.email && <p dir="ltr" className="text-end"><span className="text-muted-foreground">البريد: </span>{customer.user.email}</p>}
              <p><span className="text-muted-foreground">آخر دخول: </span>{customer.user.lastLoginAt ? timeAgo(customer.user.lastLoginAt) : 'لم يسجل'}</p>
              <p><span className="text-muted-foreground">المفضلة: </span>{customer.favorites.length} منتج</p>
            </div>
          </CardContent>
        </Card>

        {/* العناوين */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3">
            <SectionHeader title={`عناوين التسليم (${customer.addresses.length})`} icon={<MapPin className="size-4" />} />
            {customer.addresses.length === 0 && <p className="text-sm text-muted-foreground">لا توجد عناوين محفوظة.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {customer.addresses.map((a) => (
                <div key={a.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    {a.label}
                    {a.isDefault && <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-px text-[10px] font-bold">افتراضي</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.governorate} — {a.city}{a.district ? ` / ${a.district}` : ''}{a.neighborhood ? ` / ${a.neighborhood}` : ''}
                  </p>
                  {a.street && <p className="text-xs text-muted-foreground">{a.street}</p>}
                  <p className="text-xs text-muted-foreground" dir="ltr">{a.phone}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* سجلات العميل */}
      <Tabs defaultValue="orders" dir="rtl">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="orders" className="gap-1.5 flex-1">الطلبات ({orders.length})</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 flex-1">المدفوعات ({payments.length})</TabsTrigger>
          <TabsTrigger value="returns" className="gap-1.5 flex-1">المرتجعات ({returns.length})</TabsTrigger>
          <TabsTrigger value="refunds" className="gap-1.5 flex-1">الاستردادات ({refunds.length})</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5 flex-1">التقييمات ({reviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-3">
          <Card>
            <CardContent>
              <DataTable
                columns={orderColumns}
                rows={orders}
                emptyIcon="🛍️"
                emptyTitle="لا توجد طلبات"
                compact
                onRowClick={(o) => go('admin-order-details', { id: o.id })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-3">
          <Card>
            <CardContent>
              <DataTable columns={paymentColumns} rows={payments} emptyIcon="💳" emptyTitle="لا توجد مدفوعات" compact />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="mt-3">
          <Card>
            <CardContent>
              <DataTable columns={returnColumns} rows={returns} emptyIcon="↩️" emptyTitle="لا توجد مرتجعات" compact />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refunds" className="mt-3">
          <Card>
            <CardContent>
              <DataTable columns={refundColumns} rows={refunds} emptyIcon="💸" emptyTitle="لا توجد استردادات" compact />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-3">
          <Card>
            <CardContent className="space-y-2">
              {reviews.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">لا توجد تقييمات</p>}
              {reviews.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.product.name}</p>
                    <Stars rating={r.rating} />
                    {r.comment && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.comment}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(r.createdAt)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {can('orders.view') && orders.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => go('admin-orders')}>إدارة كل الطلبات</Button>
        </div>
      )}
    </div>
  )
}

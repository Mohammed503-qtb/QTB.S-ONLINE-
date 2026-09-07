'use client'

// ============================================================
// التقارير — tabs (sales/inventory/payments/financial/products)
// كل تقرير ملخصه وجداوله + فترة from/to + تصدير CSV
// ============================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart3 } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, orderStatusLabel, paymentStatusLabel } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/app/spinner'
import { PageHeader, StatCard, StatusBadge, usePerm } from '@/components/admin/components/kit'

type ReportType = 'sales' | 'inventory' | 'payments' | 'financial' | 'products'

type ReportData = Record<string, unknown>

const EXPORT_BY_TYPE: Record<ReportType, string> = {
  sales: 'orders',
  inventory: 'inventory',
  payments: 'payments',
  financial: 'expenses',
  products: 'products',
}

export function ReportsView() {
  const { can } = usePerm()
  const [type, setType] = useState<ReportType>('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const query = useQuery({
    queryKey: ['admin-report', { type, from, to }],
    queryFn: () => {
      const sp = new URLSearchParams({ type })
      if (from) sp.set('from', from)
      if (to) sp.set('to', to)
      return api.get<ReportData>(`/api/admin/reports?${sp.toString()}`)
    },
    placeholderData: (prev) => prev,
  })

  const data = query.data
  const summary = (data?.summary ?? {}) as Record<string, number>
  const exportHref = `/api/admin/export?type=${EXPORT_BY_TYPE[type]}`

  const summaryLabels: Record<ReportType, [string, string][]> = {
    sales: [
      ['ordersCount', 'عدد الطلبات'], ['grossSales', 'قيمة الأصناف'], ['shippingCollected', 'الشحن المحصل'],
      ['grandTotal', 'الإجمالي'], ['discountGiven', 'الخصومات الممنوحة'], ['avgOrder', 'متوسط الطلب'],
    ],
    inventory: [
      ['skus', 'عدد الأرصدة'], ['totalOnHand', 'إجمالي الكميات'], ['totalReserved', 'المحجوز'],
      ['lowStock', 'أصناف منخفضة'], ['outOfStock', 'نفدت'], ['totalCostValue', 'قيمة المخزون (تكلفة)'], ['totalRetailValue', 'قيمة المخزون (بيع)'],
    ],
    payments: [
      ['verifiedCount', 'دفعات معتمدة'], ['verifiedAmount', 'مبالغ معتمدة'], ['overpayments', 'مبالغ زائدة معلقة'],
    ],
    financial: [
      ['totalIn', 'إجمالي الداخل'], ['totalOut', 'إجمالي الخارج'], ['customerPayments', 'تحصيلات العملاء'],
      ['expenses', 'المصروفات'], ['refunds', 'الاستردادات'], ['purchases', 'المشتريات'],
    ],
    products: [],
  }

  const loading = query.isLoading
  const retry = () => query.refetch()

  return (
    <div className="space-y-4">
      <PageHeader
        title="التقارير"
        description={data?.note ? String(data.note) : 'تقارير تشغيلية ومالية'}
        actions={
          can('backup.export') ? (
            <Button variant="outline" className="gap-1.5" asChild>
              <a href={exportHref} download>
                <Download className="size-4" /> تصدير CSV
              </a>
            </Button>
          ) : undefined
        }
      />

      {/* الفترة */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rep-from">من تاريخ</Label>
            <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-to">إلى تاريخ</Label>
            <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <p className="text-xs text-muted-foreground">الافتراضي: آخر 30 يومًا</p>
        </CardContent>
      </Card>

      <Tabs value={type} onValueChange={(v) => setType(v as ReportType)}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="sales" className="gap-1 flex-1">المبيعات</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1 flex-1">المخزون</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1 flex-1">المدفوعات</TabsTrigger>
          <TabsTrigger value="financial" className="gap-1 flex-1">المالية</TabsTrigger>
          <TabsTrigger value="products" className="gap-1 flex-1">المنتجات</TabsTrigger>
        </TabsList>

        {loading && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-48 rounded-xl" />
          </div>
        )}

        {query.error && !loading && <ErrorState message={query.error.message} retry={retry} />}

        {/* المبيعات */}
        {type === 'sales' && data && !loading && (
          <TabsContent value="sales" className="mt-3 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {summaryLabels.sales.map(([k, label]) => (
                <StatCard key={k} title={label} value={k.includes('Count') || k === 'ordersCount' ? summary[k] : money(summary[k])} tone={k === 'discountGiven' ? 'warning' : k === 'grandTotal' ? 'primary' : 'default'} />
              ))}
            </div>
            <Card>
              <CardContent className="space-y-4">
                <ReportTable title="حسب الحالة" rows={(data.byStatus ?? []) as Record<string, unknown>[]} cols={['status', 'عدد', 'الإجمالي']} render={(row, col) => {
                  const r = row as { status: string; _count: { _all: number }; _sum: { grandTotal: number } }
                  if (col === 'status') return <StatusBadge status={r.status} label={orderStatusLabel(r.status)} />
                  if (col === 'عدد') return r._count?._all ?? 0
                  return money(r._sum?.grandTotal ?? 0)
                }} />
                <ReportTable title="حسب طريقة الدفع" rows={(data.byMethod ?? []) as Record<string, unknown>[]} cols={['paymentMethod', 'عدد', 'الإجمالي']} render={(row, col) => {
                  const r = row as { paymentMethod: string; _count: { _all: number }; _sum: { grandTotal: number } }
                  if (col === 'paymentMethod') return r.paymentMethod === 'COD' ? 'دفع عند الاستلام' : 'تحويل بنكي'
                  if (col === 'عدد') return r._count?._all ?? 0
                  return money(r._sum?.grandTotal ?? 0)
                }} />
                <ReportTable title="الأكثر بيعًا" rows={(data.topProducts ?? []) as Record<string, unknown>[]} cols={['name', 'الكمية', 'الإيراد']} render={(row, col) => {
                  const r = row as { name: string; qty: number; total: number }
                  if (col === 'name') return r.name
                  if (col === 'الكمية') return r.qty
                  return money(r.total)
                }} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* المخزون */}
        {type === 'inventory' && data && !loading && (
          <TabsContent value="inventory" className="mt-3 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              {summaryLabels.inventory.map(([k, label]) => (
                <StatCard key={k} title={label} value={k === 'skus' || k === 'lowStock' || k === 'outOfStock' || k === 'totalOnHand' || k === 'totalReserved' ? summary[k] : money(summary[k])} tone={k === 'lowStock' || k === 'outOfStock' ? 'warning' : 'default'} />
              ))}
            </div>
            <Card>
              <CardContent>
                <ReportTable title="أصناف تحت حد الطلب" rows={(data.lowStockItems ?? []) as Record<string, unknown>[]} cols={['product', 'warehouse', 'onHand', 'reorderLevel']} render={(row, col) => {
                  const r = row as { product: string; warehouse: string; onHand: number; reorderLevel: number }
                  if (col === 'product') return r.product
                  if (col === 'warehouse') return r.warehouse
                  if (col === 'onHand') return r.onHand
                  return r.reorderLevel
                }} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* المدفوعات */}
        {type === 'payments' && data && !loading && (
          <TabsContent value="payments" className="mt-3 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {summaryLabels.payments.map(([k, label]) => (
                <StatCard key={k} title={label} value={k === 'verifiedCount' ? summary[k] : money(summary[k])} tone="primary" />
              ))}
            </div>
            <Card>
              <CardContent className="space-y-4">
                <ReportTable title="حسب الحالة" rows={(data.byStatus ?? []) as Record<string, unknown>[]} cols={['status', 'عدد', 'المبالغ']} render={(row, col) => {
                  const r = row as { status: string; _count: { _all: number }; _sum: { paidAmount: number } }
                  if (col === 'status') return <StatusBadge status={r.status} label={paymentStatusLabel(r.status)} />
                  if (col === 'عدد') return r._count?._all ?? 0
                  return money(r._sum?.paidAmount ?? 0)
                }} />
                <ReportTable title="دفعات عليها مؤشرات مخاطر" rows={(data.flagged ?? []) as Record<string, unknown>[]} cols={['paymentNumber', 'status', 'riskFlags', 'expectedAmount']} render={(row, col) => {
                  const r = row as { paymentNumber: string; status: string; riskFlags: string; expectedAmount: number }
                  if (col === 'paymentNumber') return r.paymentNumber
                  if (col === 'status') return <StatusBadge status={r.status} label={paymentStatusLabel(r.status)} />
                  if (col === 'riskFlags') return r.riskFlags || '—'
                  return money(r.expectedAmount)
                }} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* المالية */}
        {type === 'financial' && data && !loading && (
          <TabsContent value="financial" className="mt-3 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {summaryLabels.financial.map(([k, label]) => (
                <StatCard key={k} title={label} value={money(summary[k])} tone={k === 'totalIn' || k === 'customerPayments' ? 'primary' : k === 'totalOut' || k === 'expenses' ? 'warning' : 'default'} />
              ))}
            </div>
            <Card>
              <CardContent className="space-y-4">
                <ReportTable title="أرصدة الحسابات" rows={(data.banks ?? []) as Record<string, unknown>[]} cols={['name', 'institution', 'currentBalance']} render={(row, col) => {
                  const r = row as { name: string; institution: string; currentBalance: number }
                  if (col === 'name') return r.name
                  if (col === 'institution') return r.institution
                  return money(r.currentBalance)
                }} />
                <ReportTable title="المصروفات حسب التصنيف" rows={(data.expensesByCategory ?? []) as Record<string, unknown>[]} cols={['category', 'الإجمالي']} render={(row, col) => {
                  const r = row as { category: string; _sum: { amount: number } }
                  if (col === 'category') return r.category
                  return money(r._sum?.amount ?? 0)
                }} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* المنتجات */}
        {type === 'products' && data && !loading && (
          <TabsContent value="products" className="mt-3">
            <Card>
              <CardContent>
                <ReportTable
                  title="ربحية المنتجات (تقديرية)"
                  rows={(data.products ?? []) as Record<string, unknown>[]}
                  cols={['name', 'category', 'salesCount', 'onHand', 'basePrice', 'costPrice', 'marginPercent', 'estimatedProfit']}
                  render={(row, col) => {
                    const r = row as { name: string; category: string; salesCount: number; onHand: number; basePrice: number; costPrice: number | null; marginPercent: number | null; estimatedProfit: number }
                    switch (col) {
                      case 'name': return r.name
                      case 'category': return r.category
                      case 'salesCount': return r.salesCount
                      case 'onHand': return r.onHand
                      case 'basePrice': return money(r.basePrice)
                      case 'costPrice': return r.costPrice != null ? money(r.costPrice) : '—'
                      case 'marginPercent': return r.marginPercent != null ? `${r.marginPercent}%` : '—'
                      default:
                        return <span className={r.estimatedProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>{money(r.estimatedProfit)}</span>
                    }
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// جدول تقرير عام مبسط
function ReportTable({ title, rows, cols, render }: { title: string; rows: Record<string, unknown>[]; cols: string[]; render: (row: Record<string, unknown>, col: string) => React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 border-b pb-2">
        <BarChart3 className="size-4 text-primary" />
        <h3 className="font-bold text-sm">{title} ({rows.length})</h3>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground py-2">لا توجد بيانات في هذه الفترة</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                {cols.map((c) => (
                  <th key={c} className="text-start text-xs font-medium p-2 whitespace-nowrap">{c === 'name' || c === 'product' || c === 'paymentNumber' || c === 'status' || c === 'category' || c === 'warehouse' || c === 'riskFlags' || c === 'expectedAmount' || c === 'institution' ? columnLabel(c, title) : c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                  {cols.map((c) => (
                    <td key={c} className="p-2 align-middle whitespace-nowrap">{render(row, c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function columnLabel(col: string, title: string): string {
  if (col === 'name') return 'الاسم'
  if (col === 'product') return 'المنتج'
  if (col === 'paymentNumber') return 'الدفعة'
  if (col === 'status') return 'الحالة'
  if (col === 'category') return 'التصنيف'
  if (col === 'warehouse') return 'المخزن'
  if (col === 'riskFlags') return 'المخاطر'
  if (col === 'expectedAmount') return 'المطلوب'
  if (col === 'institution') return 'الجهة'
  if (col === 'onHand') return 'المتوفر'
  if (col === 'reorderLevel') return 'حد الطلب'
  if (col === 'currentBalance') return 'الرصيد'
  return title
}

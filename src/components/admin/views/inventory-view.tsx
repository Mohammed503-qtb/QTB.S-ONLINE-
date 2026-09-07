'use client'

// ============================================================
// أرصدة المخزون — جدول + فلاتر (مخزن / منخفض فقط) + إجراءات:
// تسوية جرد / تالف / نقل بين المخازن / ضبط حد إعادة الطلب
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ArrowLeftRight, ClipboardCheck, PackageMinus, PackageSearch, SlidersHorizontal, Warehouse } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money } from '@/lib/client/format'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { PageHeader, Pager, SearchInput, StatCard, attrText, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { InventoryRow, WarehouseRow } from '@/components/admin/types'

type InventoryResponse = {
  total: number; page: number; pages: number
  balances: InventoryRow[]
  warehouses: WarehouseRow[]
  summary: { totalVariants: number; totalOnHand: number; totalReserved: number; lowCount: number }
}

type ActionKind = 'adjust' | 'damage' | 'transfer' | 'reorder'

export function InventoryView() {
  const go = useNav((s) => s.go)
  const params = useNav((s) => s.params)
  const { can } = usePerm()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [warehouseId, setWarehouseId] = useState('')
  const [lowOnly, setLowOnly] = useState(params.lowOnly === '1')
  const [page, setPage] = useState(1)

  const [action, setAction] = useState<{ kind: ActionKind; row: InventoryRow } | null>(null)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [targetWarehouse, setTargetWarehouse] = useState('')
  const [formError, setFormError] = useState('')

  const query = useQuery({
    queryKey: ['admin-inventory', { search: debouncedSearch, warehouseId, lowOnly, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '30' })
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      if (warehouseId) sp.set('warehouseId', warehouseId)
      if (lowOnly) sp.set('lowOnly', '1')
      return api.get<InventoryResponse>(`/api/admin/inventory?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const mutation = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/inventory', body),
    {
      success: (_res, vars) => {
        const k = vars.action as string
        if (k === 'adjust') return 'تمت تسوية الجرد وتسجيل الحركة'
        if (k === 'damage') return 'سُجل التالف وأُخفض المخزون'
        if (k === 'transfer') return 'تم النقل بين المخازن'
        return 'حُدّث حد إعادة الطلب'
      },
      invalidate: [['admin-inventory'], ['admin-movements'], ['admin-dashboard'], ['admin-operations'], ['admin-products']],
    }
  )

  const openAction = (kind: ActionKind, row: InventoryRow) => {
    setFormError('')
    setValue('')
    setReason('')
    setTargetWarehouse('')
    setAction({ kind, row })
  }

  const submitAction = async () => {
    if (!action) return
    setFormError('')
    const { kind, row } = action
    const num = Number(value)
    if (['adjust', 'damage', 'transfer', 'reorder'].includes(kind) && (!Number.isFinite(num) || num < 0)) {
      return setFormError('أدخل رقمًا صحيحًا')
    }
    if ((kind === 'damage' || kind === 'adjust') && reason.trim().length < 3) {
      return setFormError('السبب إلزامي (3 أحرف على الأقل)')
    }
    if (kind === 'damage' && num < 1) return setFormError('الكمية يجب أن تكون 1 على الأقل')
    if (kind === 'transfer' && num < 1) return setFormError('كمية النقل يجب أن تكون 1 على الأقل')
    if (kind === 'transfer' && !targetWarehouse) return setFormError('اختر المخزن الهدف')
    if (kind === 'transfer' && targetWarehouse === row.warehouseId) return setFormError('اختر مخزنًا مختلفًا عن المصدر')

    if (kind === 'adjust') {
      await mutation.mutateAsync({ action: 'adjust', variantId: row.variantId, warehouseId: row.warehouseId, newOnHand: num, reason: reason.trim() })
    } else if (kind === 'damage') {
      await mutation.mutateAsync({ action: 'damage', variantId: row.variantId, warehouseId: row.warehouseId, quantity: num, reason: reason.trim() })
    } else if (kind === 'transfer') {
      await mutation.mutateAsync({ action: 'transfer', variantId: row.variantId, fromWarehouseId: row.warehouseId, toWarehouseId: targetWarehouse, quantity: num, reason: reason.trim() || undefined })
    } else {
      await mutation.mutateAsync({ action: 'reorder_level', variantId: row.variantId, warehouseId: row.warehouseId, reorderLevel: num })
    }
    setAction(null)
  }

  const actionLabels: Record<ActionKind, string> = {
    adjust: 'تسوية جرد',
    damage: 'تسجيل تالف',
    transfer: 'نقل بين المخازن',
    reorder: 'ضبط حد إعادة الطلب',
  }

  const columns: Column<InventoryRow>[] = [
    {
      key: 'product',
      header: 'المنتج',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-52">{r.variant.product.name}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-52">{attrText(r.attributes) || '—'}</p>
          {r.variant.sku && <p className="text-[10px] text-muted-foreground" dir="ltr">{r.variant.sku}</p>}
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'المخزن',
      cell: (r) => <span className="text-sm">{r.warehouse.name}</span>,
    },
    {
      key: 'onHand',
      header: 'الكمية الفعلية',
      cell: (r) => <span className={`text-sm font-bold tabular-nums ${r.onHand <= r.reorderLevel ? 'text-amber-600 dark:text-amber-400' : ''}`}>{r.onHand}</span>,
    },
    {
      key: 'reserved',
      header: 'محجوز',
      cell: (r) => <span className="text-sm tabular-nums text-muted-foreground">{r.reserved}</span>,
    },
    {
      key: 'available',
      header: 'المتاح',
      cell: (r) => {
        const avail = r.available ?? r.onHand - r.reserved
        return <span className={`text-sm font-bold tabular-nums ${avail <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{avail}</span>
      },
    },
    {
      key: 'reorder',
      header: 'حد الطلب',
      cell: (r) => <span className="text-sm tabular-nums">{r.reorderLevel}</span>,
    },
    {
      key: 'price',
      header: 'القيمة (تكلفة)',
      cell: (r) => {
        const product = r.variant.product as InventoryRow['variant']['product'] & { costPrice?: number | null }
        return <span className="text-xs text-muted-foreground tabular-nums">{product.costPrice != null ? money(product.costPrice * r.onHand) : '—'}</span>
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="إجراءات المخزون" data-no-row-click>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {can('inventory.adjust') && (
              <>
                <DropdownMenuItem onClick={() => openAction('adjust', r)}>
                  <ClipboardCheck className="size-4" /> تسوية جرد
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAction('damage', r)} className="text-rose-600 focus:text-rose-600">
                  <PackageMinus className="size-4" /> تسجيل تالف
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAction('reorder', r)}>
                  <SlidersHorizontal className="size-4" /> ضبط حد الطلب
                </DropdownMenuItem>
              </>
            )}
            {can('inventory.transfer') && (
              <DropdownMenuItem onClick={() => openAction('transfer', r)}>
                <ArrowLeftRight className="size-4" /> نقل لمخزن آخر
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => go('admin-movements', { variantId: r.variantId })}>
              <PackageSearch className="size-4" /> عرض حركاته
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const s = query.data?.summary

  return (
    <div className="space-y-4">
      <PageHeader title="أرصدة المخزون" description={s ? `${s.totalVariants} متغير · ${s.lowCount} منخفض` : 'مراقبة الأرصدة والتسويات'} />

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="إجمالي الكميات" value={s.totalOnHand} icon={<Warehouse className="size-5" />} />
          <StatCard title="المحجوز لطلبات" value={s.totalReserved} tone="info" />
          <StatCard title="المتاح للبيع" value={s.totalOnHand - s.totalReserved} tone="primary" />
          <StatCard title="أصناف تحت حد الطلب" value={s.lowCount} tone={s.lowCount > 0 ? 'warning' : 'default'} />
        </div>
      )}

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="بحث باسم المنتج أو SKU..." className="flex-1" />
            <Select value={warehouseId || '__all__'} onValueChange={(v) => { setWarehouseId(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-52 w-full">
                <SelectValue placeholder="كل المخازن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل المخازن</SelectItem>
                {query.data?.warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 border rounded-md px-3 h-10 shrink-0">
              <Switch id="low-only" checked={lowOnly} onCheckedChange={(v) => { setLowOnly(v); setPage(1) }} />
              <label htmlFor="low-only" className="text-xs cursor-pointer font-medium">المنخفض فقط</label>
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={query.data?.balances}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="📦"
            emptyTitle="لا توجد أرصدة مطابقة"
            compact
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>

      {/* حوار الإجراءات */}
      <Dialog open={action !== null} onOpenChange={(v) => { if (!mutation.isPending && !v) setAction(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{action ? actionLabels[action.kind] : ''}</DialogTitle>
            <DialogDescription>
              {action && (
                <span className="line-clamp-1">
                  {action.row.variant.product.name} — {attrText(action.row.attributes) || 'بدون خصائص'} · {action.row.warehouse.name} (الحالي: {action.row.onHand})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {action && (
            <div className="space-y-4 py-1">
              {action.kind === 'transfer' ? (
                <>
                  <div className="space-y-2">
                    <Label>المخزن الهدف *</Label>
                    <Select value={targetWarehouse || undefined} onValueChange={setTargetWarehouse}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                      <SelectContent>
                        {query.data?.warehouses.filter((w) => w.id !== action.row.warehouseId).map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-value">الكمية المنقولة *</Label>
                    <Input id="inv-value" type="number" inputMode="numeric" min={1} value={value} onChange={(e) => setValue(e.target.value)} placeholder="مثال: 10" />
                    <p className="text-[11px] text-muted-foreground">المتاح للنقل: {action.row.available ?? action.row.onHand - action.row.reserved}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-reason">سبب النقل (اختياري)</Label>
                    <Input id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: إعادة توزيع للمخزن الرئيسي" />
                  </div>
                </>
              ) : action.kind === 'reorder' ? (
                <div className="space-y-2">
                  <Label htmlFor="inv-value">حد إعادة الطلب الجديد *</Label>
                  <Input id="inv-value" type="number" inputMode="numeric" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder={`الحالي: ${action.row.reorderLevel}`} />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="inv-value">
                      {action.kind === 'adjust' ? 'الكمية الفعلية الجديدة (جرد فعلي) *' : 'الكمية التالفة *'}
                    </Label>
                    <Input
                      id="inv-value"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={action.kind === 'adjust' ? `الحالي: ${action.row.onHand}` : 'مثال: 2'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-reason">السبب * <span className="text-rose-600">(إلزامي — يُسجل في التدقيق)</span></Label>
                    <Textarea id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={action.kind === 'adjust' ? 'مثال: جرد دوري، تصحيح فرق...' : 'مثال: تلف أثناء التغليف...'} />
                  </div>
                </>
              )}
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={mutation.isPending}>إلغاء</Button>
            <Button variant={action?.kind === 'damage' ? 'destructive' : 'default'} onClick={submitAction} disabled={mutation.isPending}>
              تنفيذ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

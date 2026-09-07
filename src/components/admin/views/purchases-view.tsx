'use client'

// ============================================================
// المشتريات — جدول + إنشاء شراء (استلام مباشر للمخزون) + دفعات
// إضافية على الفواتير القائمة
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { BanknoteIcon, ClipboardList, Plus, Trash2, Truck } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, dateTimeFmt } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PageHeader, Pager, PURCHASE_STATUS_LABELS, SearchInput, StatusBadge, attrText, parseAttrs, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { BankAccountRow, ProductRow, PurchaseRow, SupplierRow, WarehouseRow } from '@/components/admin/types'

type PurchasesResponse = { total: number; page: number; pages: number; purchases: PurchaseRow[] }

type PurchaseItemForm = { productId: string; variantId: string; quantity: string; unitCost: string }

export function PurchasesView() {
  const { can } = usePerm()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [notes, setNotes] = useState('')
  const [paidNow, setPaidNow] = useState('')
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK'>('CASH')
  const [bankAccountId, setBankAccountId] = useState('')
  const [items, setItems] = useState<PurchaseItemForm[]>([{ productId: '', variantId: '', quantity: '1', unitCost: '' }])
  const [productSearch, setProductSearch] = useState('')
  const debouncedProductSearch = useDebounced(productSearch, 300)
  const [formError, setFormError] = useState('')

  const [payTarget, setPayTarget] = useState<PurchaseRow | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [pay2Method, setPay2Method] = useState<'CASH' | 'BANK'>('CASH')
  const [pay2Bank, setPay2Bank] = useState('')
  const [payError, setPayError] = useState('')

  const query = useQuery({
    queryKey: ['admin-purchases', { search: debouncedSearch, status, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15' })
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      if (status) sp.set('status', status)
      return api.get<PurchasesResponse>(`/api/admin/purchases?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  // بيانات إنشاء الشراء
  const suppliersQuery = useQuery({
    queryKey: ['admin-suppliers-lite'],
    queryFn: () => api.get<SupplierRow[]>('/api/admin/suppliers'),
    enabled: createOpen,
  })
  const warehousesQuery = useQuery({
    queryKey: ['admin-warehouses-lite'],
    queryFn: () => api.get<WarehouseRow[]>('/api/admin/warehouses'),
    enabled: createOpen,
  })
  const productsQuery = useQuery({
    queryKey: ['admin-products-pick', { search: debouncedProductSearch }],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: '20' })
      if (debouncedProductSearch.trim()) sp.set('search', debouncedProductSearch.trim())
      return api.get<{ products: ProductRow[] }>(`/api/admin/products?${sp.toString()}`)
    },
    enabled: createOpen,
    placeholderData: keepPreviousData,
  })
  const banksQuery = useQuery({
    queryKey: ['admin-banks-lite'],
    queryFn: () => api.get<{ accounts: BankAccountRow[] }>('/api/admin/banks'),
    enabled: can('accounting.view') && (createOpen || payTarget !== null),
  })

  const createMutation = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/purchases', body),
    {
      success: 'تم إنشاء فاتورة الشراء واستلام المخزون',
      invalidate: [['admin-purchases'], ['admin-inventory'], ['admin-movements'], ['admin-suppliers'], ['admin-dashboard']],
      onDone: () => setCreateOpen(false),
    }
  )

  const payMutation = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.put('/api/admin/purchases', body),
    {
      success: 'تم تسجيل الدفعة للمورد',
      invalidate: [['admin-purchases'], ['admin-suppliers'], ['admin-banks'], ['admin-dashboard']],
      onDone: () => setPayTarget(null),
    }
  )

  const resetCreateForm = () => {
    setSupplierId('')
    setWarehouseId('')
    setInvoiceRef('')
    setNotes('')
    setPaidNow('')
    setPayMethod('CASH')
    setBankAccountId('')
    setItems([{ productId: '', variantId: '', quantity: '1', unitCost: '' }])
    setProductSearch('')
    setFormError('')
  }

  const products = productsQuery.data?.products ?? []
  const productById = new Map(products.map((p) => [p.id, p]))
  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0)

  const submitCreate = async () => {
    setFormError('')
    if (!supplierId) return setFormError('اختر المورد')
    if (!warehouseId) return setFormError('اختر المخزن')
    const cleanItems = items
      .filter((i) => i.variantId)
      .map((i) => ({ variantId: i.variantId, quantity: Number(i.quantity) || 0, unitCost: Number(i.unitCost) || 0 }))
    if (cleanItems.length === 0) return setFormError('أضف صنفًا واحدًا على الأقل مع اختيار المتغير')
    if (cleanItems.some((i) => i.quantity < 1 || i.unitCost < 1)) return setFormError('كل صنف يحتاج كمية وتكلفة (1 على الأقل)')
    const paid = Number(paidNow) || 0
    if (paid > total) return setFormError('المدفوع الآن لا يمكن أن يتجاوز إجمالي الفاتورة')
    await createMutation.mutateAsync({
      supplierId,
      warehouseId,
      invoiceRef: invoiceRef.trim() || undefined,
      notes: notes.trim() || undefined,
      paidNow: paid,
      paymentMethod: payMethod,
      bankAccountId: payMethod === 'BANK' ? bankAccountId || undefined : undefined,
      items: cleanItems,
    })
    resetCreateForm()
  }

  const submitPay = async () => {
    if (!payTarget) return
    setPayError('')
    const amount = Number(payAmount) || 0
    if (amount < 1) return setPayError('أدخل مبلغًا صحيحًا')
    if (pay2Method === 'BANK' && !pay2Bank) return setPayError('اختر الحساب البنكي')
    await payMutation.mutateAsync({
      action: 'pay',
      purchaseId: payTarget.id,
      amount,
      method: pay2Method,
      bankAccountId: pay2Method === 'BANK' ? pay2Bank : undefined,
    })
    setPayAmount('')
  }

  const columns: Column<PurchaseRow>[] = [
    {
      key: 'purchase',
      header: 'الفاتورة',
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{p.purchaseNumber}</p>
          <p className="text-[11px] text-muted-foreground">{dateTimeFmt(p.date)}{p.invoiceRef ? ` · مرجع: ${p.invoiceRef}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'المورد / المخزن',
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-sm truncate max-w-36">{p.supplier.name}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-36">{p.warehouse.name}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'الأصناف',
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-xs">{p.items.length} صنف</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-40">{p.items[0]?.productName ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'totals',
      header: 'الإجمالي / المدفوع',
      cell: (p) => (
        <div className="text-xs">
          <p className="font-bold tabular-nums">{money(p.total)}</p>
          <p className="text-muted-foreground tabular-nums">مدفوع: {money(p.paid)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (p) => <StatusBadge status={p.status} label={PURCHASE_STATUS_LABELS[p.status] ?? p.status} />,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (p) => {
        const remaining = p.total - p.paid
        const canPay = can('purchases.view') && remaining > 0 && p.status !== 'CANCELLED'
        return (
          <div className="flex items-center gap-1" data-no-row-click>
            {canPay && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => { setPayError(''); setPayTarget(p); setPayAmount(String(remaining)); setPay2Method('CASH'); setPay2Bank('') }}
              >
                <BanknoteIcon className="size-3.5" /> دفع {money(remaining)}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="المشتريات"
        description={query.data ? `${query.data.total} فاتورة شراء` : 'فواتير الموردين واستلام المخزون'}
        actions={
          can('purchases.create') ? (
            <Button className="gap-1.5" onClick={() => { resetCreateForm(); setCreateOpen(true) }}>
              <Plus className="size-4" /> فاتورة شراء
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="بحث برقم الفاتورة / المرجع / المورد..." className="flex-1" />
            <Select value={status || '__all__'} onValueChange={(v) => { setStatus(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-40 w-full"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل الحالات</SelectItem>
                {Object.entries(PURCHASE_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            rows={query.data?.purchases}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="🧾"
            emptyTitle="لا توجد فواتير شراء"
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>

      {/* حوار إنشاء شراء */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!createMutation.isPending) setCreateOpen(v) }}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              فاتورة شراء جديدة
            </DialogTitle>
            <DialogDescription>
              عند الحفظ تُستلم الأصناف فورًا في المخزن المحدد، ويُسجَّل التزام المورد بالمتبقي إن لم يُدفع كامل المبلغ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>المورد *</Label>
                <Select value={supplierId || undefined} onValueChange={setSupplierId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {(suppliersQuery.data ?? []).filter((s) => s.active).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المخزن *</Label>
                <Select value={warehouseId || undefined} onValueChange={setWarehouseId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                  <SelectContent>
                    {(warehousesQuery.data ?? []).filter((w) => w.active).map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pur-ref">مرجع فاتورة المورد</Label>
                <Input id="pur-ref" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="اختياري" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pur-notes">ملاحظات</Label>
                <Input id="pur-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
              </div>
            </div>

            {/* أصناف الشراء */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-bold">الأصناف</Label>
                <div className="flex items-center gap-2">
                  <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="بحث المنتجات..." className="w-40 sm:w-56" />
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setItems([...items, { productId: '', variantId: '', quantity: '1', unitCost: '' }])}>
                    <Plus className="size-4" /> صنف
                  </Button>
                </div>
              </div>

              {items.map((it, idx) => {
                const product = it.productId ? productById.get(it.productId) : undefined
                return (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">المنتج *</Label>
                        <Select
                          value={it.productId || undefined}
                          onValueChange={(v) => setItems(items.map((x, i) => (i === idx ? { ...x, productId: v, variantId: '' } : x)))}
                        >
                          <SelectTrigger className="w-full"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">المتغير *</Label>
                        <Select
                          value={it.variantId || undefined}
                          onValueChange={(v) => setItems(items.map((x, i) => (i === idx ? { ...x, variantId: v } : x)))}
                          disabled={!product}
                        >
                          <SelectTrigger className="w-full"><SelectValue placeholder={product ? 'اختر المتغير' : 'اختر المنتج أولًا'} /></SelectTrigger>
                          <SelectContent>
                            {(product?.variants ?? []).map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {attrText(v.attributes ?? parseAttrs(v.attributesJson)) || `متغير ${v.sku ?? ''}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs" htmlFor={`pq-${idx}`}>الكمية *</Label>
                        <Input
                          id={`pq-${idx}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs" htmlFor={`pc-${idx}`}>تكلفة الوحدة (ريال) *</Label>
                        <Input
                          id={`pc-${idx}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={it.unitCost}
                          onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, unitCost: e.target.value } : x)))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        إجمالي السطر: <span className="font-bold tabular-nums">{money((Number(it.quantity) || 0) * (Number(it.unitCost) || 0))}</span>
                      </p>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label="حذف الصنف">
                          <Trash2 className="size-4 text-rose-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}

              <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 p-3">
                <span className="text-sm font-semibold">إجمالي الفاتورة</span>
                <span className="text-base font-bold tabular-nums text-primary">{money(total)}</span>
              </div>
            </div>

            {/* الدفع الآن */}
            <div className="space-y-3">
              <Label className="text-base font-bold">الدفعة الآن (اختياري)</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pur-paid">المدفوع الآن</Label>
                  <Input id="pur-paid" type="number" inputMode="numeric" min={0} value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="0" />
                  <p className="text-[11px] text-muted-foreground">المتبقي يسجَّل التزامًا على المورد</p>
                </div>
                <div className="space-y-2">
                  <Label>طريقة الدفع</Label>
                  <RadioGroup value={payMethod} onValueChange={(v) => setPayMethod(v as 'CASH' | 'BANK')} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="CASH" id="pm-cash" />
                      <Label htmlFor="pm-cash" className="cursor-pointer text-sm">نقدًا</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="BANK" id="pm-bank" disabled={!can('accounting.view')} />
                      <Label htmlFor="pm-bank" className="cursor-pointer text-sm">تحويل بنكي</Label>
                    </div>
                  </RadioGroup>
                  {payMethod === 'BANK' && (
                    <Select value={bankAccountId || undefined} onValueChange={setBankAccountId}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="اختر الحساب البنكي" /></SelectTrigger>
                      <SelectContent>
                        {(banksQuery.data?.accounts ?? []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name} — {b.institution}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>إلغاء</Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending}>
              <Truck className="size-4" /> إنشاء واستلام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار دفعة مورد */}
      <Dialog open={payTarget !== null} onOpenChange={(v) => { if (!payMutation.isPending && !v) setPayTarget(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BanknoteIcon className="size-5 text-primary" />
              دفعة على فاتورة {payTarget?.purchaseNumber}
            </DialogTitle>
            <DialogDescription>
              {payTarget && (
                <>
                  المورد: {payTarget.supplier.name} · الإجمالي {money(payTarget.total)} · المتبقي {money(payTarget.total - payTarget.paid)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">المبلغ *</Label>
              <Input id="pay-amount" type="number" inputMode="numeric" min={1} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الطريقة</Label>
              <RadioGroup value={pay2Method} onValueChange={(v) => setPay2Method(v as 'CASH' | 'BANK')} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CASH" id="p2-cash" />
                  <Label htmlFor="p2-cash" className="cursor-pointer text-sm">نقدًا</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="BANK" id="p2-bank" disabled={!can('accounting.view')} />
                  <Label htmlFor="p2-bank" className="cursor-pointer text-sm">تحويل بنكي</Label>
                </div>
              </RadioGroup>
              {pay2Method === 'BANK' && (
                <Select value={pay2Bank || undefined} onValueChange={setPay2Bank}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر الحساب البنكي" /></SelectTrigger>
                  <SelectContent>
                    {(banksQuery.data?.accounts ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} — {b.institution}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظة (اختياري)" rows={2} aria-label="ملاحظة الدفعة" />
            {payError && <p className="text-sm text-rose-600 dark:text-rose-400">{payError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)} disabled={payMutation.isPending}>إلغاء</Button>
            <Button onClick={submitPay} disabled={payMutation.isPending}>تسجيل الدفعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

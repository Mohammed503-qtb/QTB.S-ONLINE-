'use client'

// ============================================================
// الموردون — جدول (رصيد مستحق) + إنشاء/تعديل + كشف حساب
// ============================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Pencil, Plus, Truck } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, dateFmt } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PURCHASE_STATUS_LABELS, SearchInput, StatusBadge, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { MiniEmpty, MiniLoader } from '@/components/admin/components/kit'
import type { SupplierDetail, SupplierRow } from '@/components/admin/types'

type SupplierForm = { id?: string; name: string; phone: string; email: string; address: string; notes: string; active: boolean }

const emptyForm: SupplierForm = { name: '', phone: '', email: '', address: '', notes: '', active: true }

export function SuppliersView() {
  const { can } = usePerm()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)
  const [form, setForm] = useState<SupplierForm | null>(null)
  const [formError, setFormError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: () => api.get<SupplierRow[]>('/api/admin/suppliers'),
  })

  const detailQuery = useQuery({
    queryKey: ['admin-supplier-detail', detailId],
    queryFn: () => api.get<SupplierDetail>(`/api/admin/suppliers?detail=${encodeURIComponent(detailId ?? '')}`),
    enabled: !!detailId,
  })

  const saveMutation = useApiMutation<SupplierForm, unknown>(
    (f) =>
      f.id
        ? api.put('/api/admin/suppliers', { id: f.id, name: f.name, phone: f.phone.trim() || undefined, email: f.email.trim() || undefined, address: f.address.trim() || undefined, notes: f.notes.trim() || undefined, active: f.active })
        : api.post('/api/admin/suppliers', { name: f.name, phone: f.phone.trim() || undefined, email: f.email.trim() || undefined, address: f.address.trim() || undefined, notes: f.notes.trim() || undefined, active: f.active }),
    {
      success: (res, f) => (f.id ? 'تم تحديث المورد' : 'تمت إضافة المورد'),
      invalidate: [['admin-suppliers'], ['admin-suppliers-lite']],
      onDone: () => setForm(null),
    }
  )

  const rows = (query.data ?? []).filter((s) => !debouncedSearch.trim() || s.name.includes(debouncedSearch.trim()) || (s.phone ?? '').includes(debouncedSearch.trim()))

  const columns: Column<SupplierRow>[] = [
    {
      key: 'name',
      header: 'المورد',
      cell: (s) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-44">{s.name}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{s.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'purchases',
      header: 'الفواتير',
      cell: (s) => <span className="text-sm tabular-nums">{s._count?.purchases ?? 0}</span>,
    },
    {
      key: 'totalPurchases',
      header: 'إجمالي المشتريات',
      cell: (s) => <span className="text-sm tabular-nums font-medium">{money(s.totalPurchases ?? 0)}</span>,
    },
    {
      key: 'balance',
      header: 'الرصيد المستحق',
      cell: (s) => (
        <span className={`text-sm font-bold tabular-nums ${s.balance > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {money(s.balance)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'نشط',
      cell: (s) => (
        <span className={`text-xs font-semibold ${s.active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
          {s.active ? 'نشط' : 'معطّل'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (s) => (
        <div className="flex items-center gap-1" data-no-row-click>
          <Button variant="ghost" size="icon" onClick={() => setDetailId(s.id)} aria-label={`كشف حساب ${s.name}`}>
            <Eye className="size-4" />
          </Button>
          {can('suppliers.manage') && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`تحرير ${s.name}`}
              onClick={() => {
                setFormError('')
                setForm({ id: s.id, name: s.name, phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '', active: s.active })
              }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const submit = async () => {
    if (!form) return
    setFormError('')
    if (form.name.trim().length < 2) return setFormError('اسم المورد مطلوب')
    if (form.phone.trim() && !/^7\d{8}$/.test(form.phone.trim())) return setFormError('رقم الهاتف يجب أن يكون 9 خانات تبدأ بـ 7')
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setFormError('البريد الإلكتروني غير صحيح')
    await saveMutation.mutateAsync(form)
  }

  const detail = detailQuery.data

  return (
    <div className="space-y-4">
      <PageHeader
        title="الموردون"
        description={query.data ? `${query.data.length} مورد` : 'إدارة الموردين والتزاماتهم'}
        actions={
          can('suppliers.manage') ? (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setForm({ ...emptyForm }) }}>
              <Plus className="size-4" /> مورد جديد
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم المورد أو هاتفه..." className="sm:max-w-sm" />
          <DataTable
            columns={columns}
            rows={rows}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="🚚"
            emptyTitle="لا يوجد موردون"
            compact
          />
        </CardContent>
      </Card>

      {/* كشف الحساب */}
      <Dialog open={detailId !== null} onOpenChange={(v) => { if (!v) setDetailId(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              كشف حساب: {detail?.name ?? ''}
            </DialogTitle>
            <DialogDescription>
              {detail ? `الرصيد المستحق: ${money(detail.balance)} · إجمالي التعاملات: ${money(detail.totalPurchases ?? 0)}` : 'جارِ التحميل...'}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading && <MiniLoader />}
          {detail && (
            <Tabs defaultValue="purchases" dir="rtl">
              <TabsList className="w-full">
                <TabsTrigger value="purchases" className="flex-1">الفواتير ({detail.purchases.length})</TabsTrigger>
                <TabsTrigger value="payments" className="flex-1">المدفوعات ({detail.payments.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="purchases" className="space-y-2 mt-3 max-h-80 overflow-y-auto">
                {detail.purchases.length === 0 && <MiniEmpty title="لا توجد فواتير" icon="🧾" />}
                {detail.purchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" dir="ltr">{p.purchaseNumber}</p>
                      <p className="text-xs text-muted-foreground">{dateFmt(p.date)}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-bold tabular-nums">{money(p.total)}</p>
                      <p className="text-[11px] text-muted-foreground">مدفوع: {money(p.paid)}</p>
                    </div>
                    <StatusBadge status={p.status} label={PURCHASE_STATUS_LABELS[p.status] ?? p.status} />
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="payments" className="space-y-2 mt-3 max-h-80 overflow-y-auto">
                {detail.payments.length === 0 && <MiniEmpty title="لا توجد مدفوعات" icon="💵" />}
                {detail.payments.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm">{pm.method === 'BANK' ? 'تحويل بنكي' : 'نقدًا'}{pm.reference ? ` · ${pm.reference}` : ''}</p>
                      {pm.note && <p className="text-xs text-muted-foreground truncate max-w-56">{pm.note}</p>}
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{money(pm.amount)}</p>
                      <p className="text-[11px] text-muted-foreground">{dateFmt(pm.date)}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* إنشاء/تحرير مورد */}
      <Dialog open={form !== null} onOpenChange={(v) => { if (!saveMutation.isPending && !v) setForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'تحرير المورد' : 'مورد جديد'}</DialogTitle>
            <DialogDescription>بيانات جهة التوريد للتواصل وكشف الحساب.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="s-name">الاسم *</Label>
                <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: مؤسسة النور للتجارة" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="s-phone">الهاتف</Label>
                  <Input id="s-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="7xxxxxxxx" dir="ltr" inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-email">البريد</Label>
                  <Input id="s-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="اختياري" dir="ltr" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-address">العنوان</Label>
                <Input id="s-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="اختياري" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-notes">ملاحظات</Label>
                <Textarea id="s-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="شروط التوريد مثلًا..." />
              </div>
              <div className="flex items-center gap-3 border rounded-lg px-3 h-12">
                <Switch id="s-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label htmlFor="s-active" className="cursor-pointer text-sm">نشط</Label>
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saveMutation.isPending}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

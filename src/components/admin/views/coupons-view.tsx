'use client'

// ============================================================
// الكوبونات — جدول + إنشاء/تعديل (PERCENT/FIXED، حدود، نطاق،
// تواريخ) + تفاصيل الاستخدام (redemptions)
// ============================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { api } from '@/lib/client/api'
import { dateFmt, money, timeAgo } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, COUPON_SCOPE_LABELS, StatusBadge, useApiMutation, usePerm, MiniEmpty, MiniLoader } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { CouponRow } from '@/components/admin/types'

type CouponForm = {
  id?: string
  code: string
  type: string
  value: string
  minCart: string
  maxDiscount: string
  usageLimit: string
  perCustomerLimit: string
  appliesTo: string
  targets: string
  startsAt: string
  endsAt: string
  active: boolean
}

const emptyForm: CouponForm = {
  code: '', type: 'PERCENT', value: '', minCart: '0', maxDiscount: '', usageLimit: '', perCustomerLimit: '1',
  appliesTo: 'ALL', targets: '', startsAt: '', endsAt: '', active: true,
}

export function CouponsView() {
  const qc = useQueryClient()
  const { can } = usePerm()
  const [form, setForm] = useState<CouponForm | null>(null)
  const [formError, setFormError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CouponRow | null>(null)

  const query = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => api.get<CouponRow[]>('/api/admin/coupons'),
  })

  const detailQuery = useQuery({
    queryKey: ['admin-coupon-detail', detailId],
    queryFn: () => api.get<CouponRow & { redemptions: { id: string; discountAmount: number; createdAt: string; customer: { user: { name: string } } }[] }>(`/api/admin/coupons?id=${detailId}`),
    enabled: !!detailId,
  })

  const saveMutation = useApiMutation<CouponForm, unknown>(
    (f) => {
      const body = {
        code: f.code.trim().toUpperCase(),
        type: f.type,
        value: Number(f.value) || 0,
        minCart: Number(f.minCart) || 0,
        maxDiscount: f.maxDiscount.trim() ? Number(f.maxDiscount.trim()) : null,
        usageLimit: f.usageLimit.trim() ? Number(f.usageLimit.trim()) : null,
        perCustomerLimit: Number(f.perCustomerLimit) || 0,
        appliesTo: f.appliesTo,
        targets: f.targets.trim() ? f.targets.split(',').map((s) => s.trim()).filter(Boolean) : [],
        startsAt: f.startsAt || undefined,
        endsAt: f.endsAt || null,
        active: f.active,
      }
      if (f.id) return api.put(`/api/admin/coupons?id=${f.id}`, body)
      return api.post('/api/admin/coupons', body)
    },
    {
      success: (res, f) => (f.id ? 'تم تحديث الكوبون' : 'تم إنشاء الكوبون'),
      invalidate: [['admin-coupons'], ['config']],
      onDone: () => setForm(null),
    }
  )

  const deleteMutation = useApiMutation<string, unknown>(
    (id) => api.del(`/api/admin/coupons?id=${id}`),
    {
      success: 'تم التنفيذ (تعطيل إذا استُخدم)',
      invalidate: [['admin-coupons'], ['config']],
      onDone: () => setDeleteTarget(null),
    }
  )

  const openEdit = (c: CouponRow) => {
    setFormError('')
    const targets = (() => {
      try {
        const t = JSON.parse(c.targetsJson ?? '[]')
        return Array.isArray(t) ? t.join(', ') : ''
      } catch {
        return ''
      }
    })()
    setForm({
      id: c.id,
      code: c.code,
      type: c.type,
      value: String(c.value),
      minCart: String(c.minCart),
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
      perCustomerLimit: String(c.perCustomerLimit),
      appliesTo: c.appliesTo,
      targets,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 10) : '',
      endsAt: c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 10) : '',
      active: c.active,
    })
  }

  const submit = async () => {
    if (!form) return
    setFormError('')
    if (!/^[A-Za-z0-9]+$/.test(form.code.trim())) return setFormError('الكود بحروف إنجليزية وأرقام فقط (بدون مسافات)')
    const value = Number(form.value)
    if (!Number.isFinite(value) || value < 1) return setFormError('القيمة مطلوبة')
    if (form.type === 'PERCENT' && value > 90) return setFormError('نسبة الخصم لا تتجاوز 90%')
    await saveMutation.mutateAsync(form)
  }

  const columns: Column<CouponRow>[] = [
    {
      key: 'code',
      header: 'الكود',
      cell: (c) => (
        <div className="min-w-0">
          <p className="text-sm font-bold" dir="ltr">{c.code}</p>
          <p className="text-[11px] text-muted-foreground">
            {c.type === 'PERCENT' ? `خصم ${c.value}%` : `خصم ${money(c.value)}`}
            {c.minCart > 0 ? ` · حد أدنى ${money(c.minCart)}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'limits',
      header: 'الاستخدام',
      cell: (c) => (
        <div className="text-xs">
          <p className="tabular-nums">
            استُخدم {c.usedCount}{c.usageLimit != null ? ` / ${c.usageLimit}` : ''}
          </p>
          <p className="text-muted-foreground">لكل عميل: {c.perCustomerLimit}</p>
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'النطاق',
      cell: (c) => <span className="text-xs">{COUPON_SCOPE_LABELS[c.appliesTo] ?? c.appliesTo}</span>,
    },
    {
      key: 'dates',
      header: 'الفترة',
      cell: (c) => (
        <div className="text-xs text-muted-foreground">
          <p>من {dateFmt(c.startsAt)}</p>
          <p>{c.endsAt ? `إلى ${dateFmt(c.endsAt)}` : 'بلا نهاية'}</p>
        </div>
      ),
    },
    {
      key: 'active',
      header: 'نشط',
      cell: (c) => (
        <StatusBadge status={c.active ? 'ACTIVE' : 'CLOSED'} label={c.active ? 'نشط' : 'معطّل'} />
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (c) => (
        <div className="flex items-center gap-1" data-no-row-click>
          <Button variant="ghost" size="icon" onClick={() => setDetailId(c.id)} aria-label={`استخدام ${c.code}`}>
            <Eye className="size-4" />
          </Button>
          {can('coupons.manage') && (
            <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={`تحرير ${c.code}`}>
              <Pencil className="size-4" />
            </Button>
          )}
          {can('coupons.manage') && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} aria-label={`حذف ${c.code}`}>
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const detail = detailQuery.data

  return (
    <div className="space-y-4">
      <PageHeader
        title="الكوبونات"
        description={query.data ? `${query.data.length} كوبون` : 'عروض الخصم'}
        actions={
          can('coupons.manage') ? (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setForm({ ...emptyForm }) }}>
              <Plus className="size-4" /> كوبون جديد
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            rows={query.data}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => void qc.invalidateQueries({ queryKey: ['admin-coupons'] })}
            emptyIcon="🎟️"
            emptyTitle="لا توجد كوبونات"
            compact
          />
        </CardContent>
      </Card>

      {/* تفاصيل الاستخدام */}
      <Dialog open={detailId !== null} onOpenChange={(v) => { if (!v) setDetailId(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TicketPercent className="size-5 text-primary" />
              استخدام الكوبون {detail?.code ?? ''}
            </DialogTitle>
            <DialogDescription>
              {detail ? `استُخدم ${detail.usedCount} مرة · إجمالي الخصم الممنوح يظهر بالتفاصيل` : 'جارِ التحميل...'}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && <MiniLoader />}
          {detail && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {detail.redemptions?.length === 0 && <MiniEmpty title="لم يُستخدم بعد" icon="🛒" />}
              {detail.redemptions?.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.customer.user.name}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400 shrink-0">
                    - {money(r.discountAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* إنشاء/تحرير */}
      <Dialog open={form !== null} onOpenChange={(v) => { if (!saveMutation.isPending && !v) setForm(null) }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? `تحرير ${form.code}` : 'كوبون جديد'}</DialogTitle>
            <DialogDescription>الكوبون يُطبق على الأصناف فقط (الشحن لا يخضع للخصم).</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cp-code">الكود *</Label>
                  <Input id="cp-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAVE10" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>النوع *</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">نسبة مئوية %</SelectItem>
                      <SelectItem value="FIXED">مبلغ ثابت</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-value">القيمة *</Label>
                  <Input id="cp-value" type="number" inputMode="numeric" min={1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'PERCENT' ? 'مثال: 10' : 'مثال: 2000'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-min">الحد الأدنى للسلة</Label>
                  <Input id="cp-min" type="number" inputMode="numeric" min={0} value={form.minCart} onChange={(e) => setForm({ ...form, minCart: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-max">أقصى خصم (ريال)</Label>
                  <Input id="cp-max" type="number" inputMode="numeric" min={0} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} placeholder="للنسب فقط" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-limit">حد الاستخدام الكلي</Label>
                  <Input id="cp-limit" type="number" inputMode="numeric" min={1} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="بلا حد" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-per">لكل عميل</Label>
                  <Input id="cp-per" type="number" inputMode="numeric" min={0} value={form.perCustomerLimit} onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>النطاق</Label>
                  <Select value={form.appliesTo} onValueChange={(v) => setForm({ ...form, appliesTo: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(COUPON_SCOPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-start">يبدأ في</Label>
                  <Input id="cp-start" type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cp-end">ينتهي في</Label>
                  <Input id="cp-end" type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                </div>
              </div>
              {form.appliesTo !== 'ALL' && (
                <div className="space-y-2">
                  <Label htmlFor="cp-targets">
                    الأهداف (معرفات {form.appliesTo === 'PRODUCTS' ? 'المنتجات/المتغيرات' : 'التصنيفات'}) — مفصولة بفواصل
                  </Label>
                  <Input id="cp-targets" value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} placeholder="slug1, slug2" dir="ltr" />
                </div>
              )}
              <div className="flex items-center gap-3 border rounded-lg px-3 h-12">
                <Switch id="cp-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label htmlFor="cp-active" className="cursor-pointer text-sm">نشط</Label>
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saveMutation.isPending}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>حفظ الكوبون</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حذف */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title={`حذف الكوبون ${deleteTarget?.code ?? ''}`}
        description="إن استُخدم من قبل سيُعطّل فقط (عدم حذف مدمر للبيانات المالية)."
        confirmLabel="تنفيذ"
        danger
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteMutation.mutateAsync(deleteTarget.id)
        }}
      />
    </div>
  )
}

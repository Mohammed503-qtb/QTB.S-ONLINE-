'use client'

// ============================================================
// المخازن — CRUD (اسم/كود/مدينة/افتراضي/نشط)
// ============================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building, Pencil, Plus, Star, Trash2, Warehouse } from 'lucide-react'
import { api } from '@/lib/client/api'
import { GOVERNORATES } from '@/lib/shared/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, useApiMutation, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { WarehouseRow } from '@/components/admin/types'

type WarehouseForm = { id?: string; name: string; code: string; city: string; isDefault: boolean; active: boolean }

const emptyForm: WarehouseForm = { name: '', code: '', city: '', isDefault: false, active: true }

export function WarehousesView() {
  const qc = useQueryClient()
  const { can } = usePerm()
  const [form, setForm] = useState<WarehouseForm | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WarehouseRow | null>(null)

  const query = useQuery({
    queryKey: ['admin-warehouses'],
    queryFn: () => api.get<WarehouseRow[]>('/api/admin/warehouses'),
  })

  const saveMutation = useApiMutation<WarehouseForm, unknown>(
    (f) =>
      f.id
        ? api.put('/api/admin/warehouses', { id: f.id, name: f.name, code: f.code || undefined, city: f.city, isDefault: f.isDefault, active: f.active })
        : api.post('/api/admin/warehouses', { name: f.name, code: f.code || undefined, city: f.city, isDefault: f.isDefault }),
    {
      success: (res, f) => (f.id ? 'تم تحديث المخزن' : 'تم إنشاء المخزن'),
      invalidate: [['admin-warehouses'], ['admin-warehouses-lite'], ['admin-inventory']],
      onDone: () => setForm(null),
    }
  )

  const deleteMutation = useApiMutation<string, unknown>(
    (id) => api.del(`/api/admin/warehouses?id=${id}`),
    {
      success: 'تم التنفيذ (تعطيل إذا كانت له حركات)',
      invalidate: [['admin-warehouses'], ['admin-warehouses-lite']],
      onDone: () => setDeleteTarget(null),
    }
  )

  const submit = async () => {
    if (!form) return
    setFormError('')
    if (form.name.trim().length < 2) return setFormError('اسم المخزن مطلوب')
    await saveMutation.mutateAsync(form)
  }

  const columns: Column<WarehouseRow>[] = [
    {
      key: 'name',
      header: 'المخزن',
      cell: (w) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Warehouse className="size-4 text-primary shrink-0" />
            {w.name}
            {w.isDefault && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-px text-[10px] font-bold"><Star className="size-2.5 fill-current" /> افتراضي</span>}
          </p>
          {w.code && <p className="text-[11px] text-muted-foreground" dir="ltr">{w.code}</p>}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'المدينة',
      cell: (w) => (
        <span className="text-sm flex items-center gap-1">
          <Building className="size-3.5 text-muted-foreground" />
          {w.city || '—'}
        </span>
      ),
    },
    {
      key: 'counts',
      header: 'الأرصدة / الحركات',
      cell: (w) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {w._count?.balances ?? 0} رصيد · {w._count?.movements ?? 0} حركة
        </span>
      ),
    },
    {
      key: 'active',
      header: 'نشط',
      cell: (w) => (
        <span className={`text-xs font-semibold ${w.active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
          {w.active ? 'نشط' : 'معطّل'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (w) => (
        <div className="flex items-center gap-1" data-no-row-click>
          {can('warehouses.manage') && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`تحرير ${w.name}`}
              onClick={() => { setFormError(''); setForm({ id: w.id, name: w.name, code: w.code ?? '', city: w.city, isDefault: w.isDefault, active: w.active }) }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {can('warehouses.manage') && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(w)} aria-label={`حذف ${w.name}`}>
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="المخازن"
        description="مواقع التخزين والنقل بينها"
        actions={
          can('warehouses.manage') ? (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setForm({ ...emptyForm }) }}>
              <Plus className="size-4" /> مخزن جديد
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
            onRetry={() => void qc.invalidateQueries({ queryKey: ['admin-warehouses'] })}
            emptyIcon="🏭"
            emptyTitle="لا توجد مخازن"
            compact
          />
        </CardContent>
      </Card>

      {/* حوار الإنشاء/التحرير */}
      <Dialog open={form !== null} onOpenChange={(v) => { if (!saveMutation.isPending && !v) setForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'تحرير المخزن' : 'مخزن جديد'}</DialogTitle>
            <DialogDescription>تحديد مخزن افتراضي يلغي الافتراضية عن غيره.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="w-name">الاسم *</Label>
                <Input id="w-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: المخزن الرئيسي — صنعاء" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-code">الكود (اختياري)</Label>
                <Input id="w-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WH-01" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Select value={form.city || '__none__'} onValueChange={(v) => setForm({ ...form, city: v === '__none__' ? '' : v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون مدينة</SelectItem>
                    {GOVERNORATES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 border rounded-lg px-3">
                  <Switch id="w-default" checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
                  <Label htmlFor="w-default" className="cursor-pointer text-sm">افتراضي</Label>
                </div>
                {form.id && (
                  <div className="flex items-center gap-3 border rounded-lg px-3">
                    <Switch id="w-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                    <Label htmlFor="w-active" className="cursor-pointer text-sm">نشط</Label>
                  </div>
                )}
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

      {/* حوار الحذف */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title={`حذف ${deleteTarget?.name ?? ''}`}
        description="إن كانت له حركات مخزون سيُعطّل فقط بدل الحذف."
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

'use client'

// ============================================================
// التصنيفات والماركات — tabs + CRUD بسيط (اسم + صورة + ترتيب + نشط)
// ============================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { api } from '@/lib/client/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PageHeader, SmartImage, UploadField, useApiMutation, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { BrandRow, CategoryRow } from '@/components/admin/types'

type ItemType = 'category' | 'brand'
type ItemForm = { id?: string; name: string; slug: string; imageUrl: string; sortOrder: string; active: boolean }

const emptyForm: ItemForm = { name: '', slug: '', imageUrl: '', sortOrder: '0', active: true }

export function CategoriesView() {
  const qc = useQueryClient()
  const { can } = usePerm()
  const [tab, setTab] = useState<ItemType>('category')
  const [form, setForm] = useState<ItemForm | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ type: ItemType; id: string; name: string } | null>(null)

  const query = useQuery({
    queryKey: ['admin-catalog', tab],
    queryFn: () => api.get<(CategoryRow | BrandRow)[]>(`/api/admin/catalog?type=${tab}`),
  })

  const saveMutation = useApiMutation<{ form: ItemForm; type: ItemType }, unknown>(
    ({ form: f, type }) => {
      const body = {
        type,
        ...(f.id ? { id: undefined } : {}),
        name: f.name,
        slug: f.slug.trim() || undefined,
        imageUrl: f.imageUrl || undefined,
        sortOrder: Number(f.sortOrder) || 0,
        active: f.active,
      }
      if (f.id) {
        const sp = new URLSearchParams({ type })
        return api.put(`/api/admin/catalog?${sp.toString()}&id=${f.id}`, body)
      }
      return api.post('/api/admin/catalog', body)
    },
    {
      success: (res, vars) => (vars.form.id ? 'تم تحديث التعديلات' : 'تمت الإضافة'),
      invalidate: [['admin-catalog'], ['admin-products'], ['config']],
      onDone: () => { setForm(null) },
    }
  )

  const deleteMutation = useApiMutation<{ type: ItemType; id: string }, unknown>(
    (t) => api.del(`/api/admin/catalog?type=${t.type}&id=${t.id}`),
    {
      success: 'تم الحذف',
      invalidate: [['admin-catalog'], ['admin-products'], ['config']],
      onDone: () => setDeleteTarget(null),
    }
  )

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-catalog'] })

  const columns: Column<CategoryRow | BrandRow>[] = [
    {
      key: 'item',
      header: tab === 'category' ? 'التصنيف' : 'الماركة',
      cell: (c) => {
        const img = tab === 'category' ? (c as CategoryRow).imageUrl : (c as BrandRow).logoUrl
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <SmartImage src={img} alt={c.name} className="size-10 rounded-full" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{c.name}</p>
              <p className="text-[11px] text-muted-foreground" dir="ltr">{c.slug}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'count',
      header: 'المنتجات',
      cell: (c) => <Badge variant="secondary" className="tabular-nums">{c._count?.products ?? 0}</Badge>,
    },
    {
      key: 'sort',
      header: 'الترتيب',
      cell: (c) => <span className="text-sm tabular-nums">{c.sortOrder}</span>,
    },
    {
      key: 'active',
      header: 'نشط',
      cell: (c) => (
        <span className={`text-xs font-semibold ${c.active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
          {c.active ? 'نشط' : 'معطّل'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (c) => (
        <div className="flex items-center gap-1" data-no-row-click>
          {can('categories.manage') && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`تحرير ${c.name}`}
              onClick={() => {
                setFormError('')
                setForm({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  imageUrl: (tab === 'category' ? (c as CategoryRow).imageUrl : (c as BrandRow).logoUrl) ?? '',
                  sortOrder: String(c.sortOrder),
                  active: c.active,
                })
              }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {can('categories.manage') && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: tab, id: c.id, name: c.name })} aria-label={`حذف ${c.name}`}>
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const submit = async () => {
    if (!form) return
    setFormError('')
    if (form.name.trim().length < 2) return setFormError('الاسم مطلوب (حرفان على الأقل)')
    if (form.slug.trim() && !/^[a-z0-9-]+$/.test(form.slug.trim())) return setFormError('المعرف بحروف إنجليزية صغيرة وأرقام وشرطات فقط')
    await saveMutation.mutateAsync({ form, type: tab })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="التصنيفات والماركات"
        description="تنظيم الكتالوج وتسلسل ظهوره في المتجر"
        actions={
          can('categories.manage') ? (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setForm({ ...emptyForm }) }}>
              <Plus className="size-4" /> {tab === 'category' ? 'تصنيف جديد' : 'ماركة جديدة'}
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as ItemType)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="category" className="gap-1.5 flex-1 sm:flex-none"><Tags className="size-4" /> التصنيفات</TabsTrigger>
          <TabsTrigger value="brand" className="gap-1.5 flex-1 sm:flex-none">الماركات</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3">
          <Card>
            <CardContent>
              <DataTable
                columns={columns}
                rows={query.data}
                loading={query.isLoading}
                error={query.error}
                onRetry={invalidate}
                emptyIcon="🏷️"
                emptyTitle={tab === 'category' ? 'لا توجد تصنيفات' : 'لا توجد ماركات'}
                compact
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* حوار الإنشاء/التحرير */}
      <Dialog open={form !== null} onOpenChange={(v) => { if (!saveMutation.isPending) { if (!v) setForm(null) } }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'تحرير' : 'إضافة'} {tab === 'category' ? 'تصنيف' : 'ماركة'}</DialogTitle>
            <DialogDescription>لا يمكن حذف العناصر المرتبطة بمنتجات — عطّلها بدلًا من ذلك.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="c-name">الاسم *</Label>
                <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: عطور رجالية" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-slug">المعرف (اختياري)</Label>
                <Input id="c-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="perfumes-men" dir="ltr" />
              </div>
              <UploadField label={tab === 'category' ? 'صورة التصنيف' : 'شعار الماركة'} value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} folder={tab === 'category' ? 'categories' : 'brands'} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="c-sort">الترتيب</Label>
                  <Input id="c-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                </div>
                <div className="flex items-center gap-3 border rounded-lg px-3">
                  <Switch id="c-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label htmlFor="c-active" className="cursor-pointer text-sm">نشط</Label>
                </div>
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
        description="إن كان مرتبطًا بمنتجات سيرفض الخادم الحذف."
        confirmLabel="حذف"
        danger
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteMutation.mutateAsync({ type: deleteTarget.type, id: deleteTarget.id })
        }}
      />
    </div>
  )
}

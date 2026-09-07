'use client'

// ============================================================
// إدارة المنتجات — جدول + إنشاء/تحرير في Dialog كبير مع محرر
// متغيرات (attributes مفتاح/قيمة) + رفع صورة + أرشفة
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Archive, Package, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
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
import { PageHeader, Pager, PRODUCT_STATUS_LABELS, SearchInput, SmartImage, StatusBadge, UploadField, attrText, parseAttrs, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { BrandRow, CategoryRow, ProductRow } from '@/components/admin/types'

type ProductsResponse = { total: number; page: number; pages: number; products: ProductRow[]; categories: CategoryRow[]; brands: BrandRow[] }

// ---------- نموذج متغير ----------
type AttrKV = { k: string; v: string }
type VariantForm = {
  id?: string
  attrs: AttrKV[]
  price: string
  cost: string
  discount: string
  active: boolean
}

function emptyVariant(): VariantForm {
  return { attrs: [{ k: '', v: '' }], price: '', cost: '', discount: '0', active: true }
}

function toVariantForm(v: { id: string; attributesJson?: string; attributes?: Record<string, string>; priceOverride?: number | null; costOverride?: number | null; discountPercent: number; active: boolean }): VariantForm {
  const attrs = parseAttrs(v.attributesJson) ?? v.attributes ?? {}
  const entries = Object.entries(attrs)
  return {
    id: v.id,
    attrs: entries.length > 0 ? entries.map(([k, val]) => ({ k, v: val })) : [{ k: '', v: '' }],
    price: v.priceOverride != null ? String(v.priceOverride) : '',
    cost: v.costOverride != null ? String(v.costOverride) : '',
    discount: String(v.discountPercent ?? 0),
    active: v.active,
  }
}

function variantPayload(vf: VariantForm): Record<string, unknown> {
  const attributes: Record<string, string> = {}
  for (const a of vf.attrs) {
    if (a.k.trim() && a.v.trim()) attributes[a.k.trim()] = a.v.trim()
  }
  return {
    ...(vf.id ? { id: vf.id } : {}),
    attributes,
    priceOverride: vf.price.trim() ? Number(vf.price.trim()) : null,
    costOverride: vf.cost.trim() ? Number(vf.cost.trim()) : null,
    discountPercent: Number(vf.discount || '0') || 0,
    active: vf.active,
  }
}

// ---------- النموذج الرئيسي ----------
type ProductForm = {
  id?: string
  name: string
  description: string
  categoryId: string
  brandId: string
  basePrice: string
  compareAtPrice: string
  costPrice: string
  status: string
  isFeatured: boolean
  imageUrl: string
  variants: VariantForm[]
}

export function ProductsView() {
  const go = useNav((s) => s.go)
  const { can } = usePerm()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ProductForm | null>(null)
  const [formError, setFormError] = useState('')
  const [archiveProduct, setArchiveProduct] = useState<ProductRow | null>(null)

  const query = useQuery({
    queryKey: ['admin-products', { search: debouncedSearch, category, status, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '15' })
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      if (category) sp.set('category', category)
      if (status) sp.set('status', status)
      return api.get<ProductsResponse>(`/api/admin/products?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const saveMutation = useApiMutation<ProductForm, unknown>(
    (f) =>
      f.id
        ? api.put(`/api/admin/products/${f.id}`, {
            name: f.name,
            description: f.description,
            categoryId: f.categoryId,
            brandId: f.brandId || null,
            basePrice: Number(f.basePrice) || 0,
            compareAtPrice: f.compareAtPrice.trim() ? Number(f.compareAtPrice.trim()) : null,
            costPrice: f.costPrice.trim() ? Number(f.costPrice.trim()) : null,
            status: f.status,
            isFeatured: f.isFeatured,
            imageUrl: f.imageUrl || undefined,
            variants: f.variants.map(variantPayload),
          })
        : api.post('/api/admin/products', {
            name: f.name,
            description: f.description,
            categoryId: f.categoryId,
            brandId: f.brandId || null,
            basePrice: Number(f.basePrice) || 0,
            compareAtPrice: f.compareAtPrice.trim() ? Number(f.compareAtPrice.trim()) : null,
            costPrice: f.costPrice.trim() ? Number(f.costPrice.trim()) : null,
            status: f.status,
            isFeatured: f.isFeatured,
            imageUrl: f.imageUrl || undefined,
            variants: f.variants.map(variantPayload),
          }),
    {
      success: (res, f) => (f.id ? 'تم تحديث المنتج' : 'تم إنشاء المنتج'),
      invalidate: [['admin-products'], ['admin-dashboard']],
      onDone: () => { setFormOpen(false); setForm(null) },
    }
  )

  const archiveMutation = useApiMutation<string, unknown>(
    (id) => api.del(`/api/admin/products/${id}`),
    {
      success: 'تمت الأرشفة',
      invalidate: [['admin-products'], ['admin-dashboard']],
    }
  )

  const openCreate = () => {
    setFormError('')
    setForm({
      name: '',
      description: '',
      categoryId: query.data?.categories[0]?.id ?? '',
      brandId: '',
      basePrice: '',
      compareAtPrice: '',
      costPrice: '',
      status: 'ACTIVE',
      isFeatured: false,
      imageUrl: '',
      variants: [emptyVariant()],
    })
    setFormOpen(true)
  }

  const openEdit = (p: ProductRow) => {
    setFormError('')
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      categoryId: p.categoryId,
      brandId: p.brandId ?? '',
      basePrice: String(p.basePrice),
      compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : '',
      costPrice: p.costPrice != null ? String(p.costPrice) : '',
      status: p.status,
      isFeatured: p.isFeatured,
      imageUrl: p.imageUrl ?? '',
      variants: (p.variants ?? []).map(toVariantForm),
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form) return
    setFormError('')
    if (form.name.trim().length < 2) return setFormError('اسم المنتج مطلوب (حرفان على الأقل)')
    if (!form.categoryId) return setFormError('اختر التصنيف')
    const price = Number(form.basePrice)
    if (!Number.isFinite(price) || price < 1) return setFormError('أدخل سعرًا صحيحًا (1 على الأقل)')
    const hasAttrs = form.variants.some((v) => v.attrs.some((a) => a.k.trim() && a.v.trim()))
    if (!hasAttrs) return setFormError('أضف خصائصًا لمتغير واحد على الأقل (مثل اللون أو المقاس)')
    await saveMutation.mutateAsync(form)
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'product',
      header: 'المنتج',
      cell: (p) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <SmartImage src={p.imageUrl} alt={p.name} className="size-11" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate max-w-44 flex items-center gap-1">
              {p.name}
              {p.isFeatured && <Star className="size-3.5 text-amber-500 fill-amber-500 shrink-0" />}
            </p>
            <p className="text-[11px] text-muted-foreground truncate max-w-44">{p.category?.name ?? '—'}{p.brand?.name ? ` · ${p.brand.name}` : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'السعر',
      cell: (p) => (
        <div className="text-sm">
          <p className="font-bold tabular-nums">{money(p.basePrice)}</p>
          {p.compareAtPrice != null && <p className="text-[11px] text-muted-foreground line-through tabular-nums">{money(p.compareAtPrice)}</p>}
        </div>
      ),
    },
    {
      key: 'variants',
      header: 'المتغيرات',
      cell: (p) => (
        <div className="text-xs">
          <p>{p.variants?.length ?? 0} متغير</p>
          <p className="text-muted-foreground truncate max-w-32">{p.variants?.[0] ? attrText(p.variants[0].attributes ?? parseAttrs(p.variants[0].attributesJson)) : '—'}</p>
        </div>
      ),
    },
    {
      key: 'available',
      header: 'المتوفر',
      cell: (p) => {
        const avail = p.totalAvailable ?? 0
        return (
          <span className={`text-sm font-bold tabular-nums ${avail <= 0 ? 'text-rose-600 dark:text-rose-400' : avail <= 5 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            {avail}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (p) => <StatusBadge status={p.status} label={PRODUCT_STATUS_LABELS[p.status] ?? p.status} />,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (p) => (
        <div className="flex items-center gap-1" data-no-row-click>
          {can('products.update') && (
            <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label={`تحرير ${p.name}`}>
              <Pencil className="size-4" />
            </Button>
          )}
          {can('products.archive') && p.status !== 'ARCHIVED' && (
            <Button variant="ghost" size="icon" onClick={() => setArchiveProduct(p)} aria-label={`أرشفة ${p.name}`}>
              <Archive className="size-4 text-amber-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="المنتجات"
        description={query.data ? `${query.data.total} منتج` : 'إدارة الكتالوج'}
        actions={
          can('products.update') ? (
            <Button className="gap-1.5" onClick={openCreate}>
              <Plus className="size-4" /> منتج جديد
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="بحث بالاسم / SKU / الباركود..." className="flex-1" />
            <Select value={category || '__all__'} onValueChange={(v) => { setCategory(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-44 w-full">
                <SelectValue placeholder="كل التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل التصنيفات</SelectItem>
                {query.data?.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || '__all__'} onValueChange={(v) => { setStatus(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-36 w-full">
                <SelectValue placeholder="كل الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل الحالات</SelectItem>
                {Object.entries(PRODUCT_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            rows={query.data?.products}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="📦"
            emptyTitle="لا توجد منتجات مطابقة"
            onRowClick={(p) => openEdit(p)}
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>

      {/* حوار الإنشاء/التحرير */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!saveMutation.isPending) { setFormOpen(v); if (!v) setForm(null) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              {form?.id ? 'تحرير المنتج' : 'منتج جديد'}
            </DialogTitle>
            <DialogDescription>السعر يأتي من الخادم عند الطلبات — تعديل الأسعار لا يمس الطلبات القديمة.</DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-5 py-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-name">اسم المنتج *</Label>
                  <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: عطر العود الملكي" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-desc">الوصف</Label>
                  <Textarea id="p-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="وصف المنتج..." />
                </div>
                <div className="space-y-2">
                  <Label>التصنيف *</Label>
                  <Select value={form.categoryId || undefined} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                    <SelectContent>
                      {query.data?.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الماركة</Label>
                  <Select value={form.brandId || '__none__'} onValueChange={(v) => setForm({ ...form, brandId: v === '__none__' ? '' : v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="بدون ماركة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">بدون ماركة</SelectItem>
                      {query.data?.brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-price">السعر (ريال) *</Label>
                  <Input id="p-price" type="number" inputMode="numeric" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} placeholder="مثال: 15000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-compare">السعر قبل الخصم</Label>
                  <Input id="p-compare" type="number" inputMode="numeric" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} placeholder="اختياري" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-cost">سعر التكلفة</Label>
                  <Input id="p-cost" type="number" inputMode="numeric" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="لحساب الربحية" />
                </div>
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRODUCT_STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <UploadField label="صورة المنتج الرئيسية" value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} folder="products" />
                </div>
                <div className="flex items-center gap-3 sm:col-span-2 border rounded-lg p-3">
                  <Switch id="p-featured" checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
                  <Label htmlFor="p-featured" className="cursor-pointer">
                    <span className="flex items-center gap-1 font-semibold">منتج مميز <Star className="size-3.5 text-amber-500 fill-amber-500" /></span>
                    <span className="text-xs text-muted-foreground font-normal">يظهر في قسم المنتجات المميزة بالصفحة الرئيسية</span>
                  </Label>
                </div>
              </div>

              {/* محرر المتغيرات */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">المتغيرات ({form.variants.length})</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setForm({ ...form, variants: [...form.variants, emptyVariant()] })}>
                    <Plus className="size-4" /> إضافة متغير
                  </Button>
                </div>
                {form.variants.map((vf, vi) => (
                  <div key={vi} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">متغير #{vi + 1}{vf.id ? ' (موجود)' : ''}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Switch id={`v-active-${vi}`} checked={vf.active} onCheckedChange={(v) => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, active: v } : x)) })} />
                          <Label htmlFor={`v-active-${vi}`} className="text-xs cursor-pointer">{vf.active ? 'مفعّل' : 'معطّل'}</Label>
                        </div>
                        {form.variants.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, variants: form.variants.filter((_, i) => i !== vi) })} aria-label="حذف المتغير">
                            <Trash2 className="size-4 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* الخصائص key-value */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">الخصائص (مثل اللون / المقاس)</p>
                      {vf.attrs.map((a, ai) => (
                        <div key={ai} className="flex items-center gap-2">
                          <Input
                            value={a.k}
                            onChange={(e) => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, attrs: x.attrs.map((y, j) => (j === ai ? { ...y, k: e.target.value } : y)) } : x)) })}
                            placeholder="الخصية (مثل: اللون)"
                            className="w-36"
                            aria-label="اسم الخاصية"
                          />
                          <Input
                            value={a.v}
                            onChange={(e) => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, attrs: x.attrs.map((y, j) => (j === ai ? { ...y, v: e.target.value } : y)) } : x)) })}
                            placeholder="القيمة (مثل: أسود)"
                            className="flex-1"
                            aria-label="قيمة الخاصية"
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, attrs: x.attrs.filter((_, j) => j !== ai) } : x)) })} aria-label="حذف الخاصية">
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, attrs: [...x.attrs, { k: '', v: '' }] } : x)) })}>
                          <Plus className="size-3.5" /> خاصية
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, attrs: [...x.attrs, { k: 'اللون', v: '' }] } : x)) })}>
                          + اللون
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, attrs: [...x.attrs, { k: 'المقاس', v: '' }] } : x)) })}>
                          + المقاس
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor={`vp-${vi}`}>سعر خاص</Label>
                        <Input id={`vp-${vi}`} type="number" inputMode="numeric" value={vf.price} onChange={(e) => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, price: e.target.value } : x)) })} placeholder="افتراضي" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor={`vc-${vi}`}>تكلفة خاصة</Label>
                        <Input id={`vc-${vi}`} type="number" inputMode="numeric" value={vf.cost} onChange={(e) => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, cost: e.target.value } : x)) })} placeholder="افتراضي" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor={`vd-${vi}`}>خصم %</Label>
                        <Input id={`vd-${vi}`} type="number" inputMode="numeric" min={0} max={90} value={vf.discount} onChange={(e) => setForm({ ...form, variants: form.variants.map((x, i) => (i === vi ? { ...x, discount: e.target.value } : x)) })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setFormOpen(false); setForm(null) }} disabled={saveMutation.isPending}>
              إلغاء
            </Button>
            <Button onClick={submitForm} disabled={saveMutation.isPending}>
              {form?.id ? 'حفظ التعديلات' : 'إنشاء المنتج'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* أرشفة */}
      <ConfirmDialog
        open={archiveProduct !== null}
        onOpenChange={(v) => { if (!v) setArchiveProduct(null) }}
        title={`أرشفة ${archiveProduct?.name ?? ''}`}
        description="المنتجات المرتبطة بطلبات تُؤرشف فقط؛ غيرها قد يُحذف نهائيًا."
        confirmLabel="تنفيذ"
        danger
        onConfirm={async () => {
          if (!archiveProduct) return
          await archiveMutation.mutateAsync(archiveProduct.id)
          setArchiveProduct(null)
        }}
      />
    </div>
  )
}

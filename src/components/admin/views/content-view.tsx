'use client'

// ============================================================
// المحتوى — 3 tabs: البانرات / أقسام الرئيسية / الصفحات
// ============================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Image as ImageIcon, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/client/api'
import { timeAgo } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BANNER_ACTION_LABELS, PageHeader, SECTION_TYPE_LABELS, SmartImage, StatusBadge, UploadField, useApiMutation, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { BannerRow, ContentPageRow, HomeSectionRow } from '@/components/admin/types'

type BannerForm = { id?: string; title: string; subtitle: string; imageUrl: string; actionType: string; target: string; sortOrder: string; active: boolean }
type SectionForm = { id?: string; sectionType: string; title: string; configJson: string; sortOrder: string; active: boolean }
type PageForm = { id?: string; slug: string; title: string; content: string; published: boolean; sortOrder: string }

export function ContentView() {
  const qc = useQueryClient()
  const { can } = usePerm()
  const [bannerForm, setBannerForm] = useState<BannerForm | null>(null)
  const [sectionForm, setSectionForm] = useState<SectionForm | null>(null)
  const [pageForm, setPageForm] = useState<PageForm | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'banners' | 'sections' | 'pages'; id: string; label: string } | null>(null)

  const query = useQuery({
    queryKey: ['admin-content'],
    queryFn: () => api.get<{ banners: BannerRow[]; sections: HomeSectionRow[]; pages: ContentPageRow[] }>('/api/admin/content'),
  })

  const saveBanner = useApiMutation<BannerForm, unknown>(
    (f) => api.post('/api/admin/content', { type: 'banners', ...(f.id ? { id: f.id } : {}), title: f.title || null, subtitle: f.subtitle || null, imageUrl: f.imageUrl, actionType: f.actionType, target: f.target || null, sortOrder: Number(f.sortOrder) || 0, active: f.active }),
    {
      success: (res, f) => (f.id ? 'تم تحديث البانر' : 'تمت إضافة البانر'),
      invalidate: [['admin-content'], ['config'], ['catalog-home']],
      onDone: () => setBannerForm(null),
    }
  )

  const saveSection = useApiMutation<SectionForm, unknown>(
    (f) => api.post('/api/admin/content', { type: 'sections', ...(f.id ? { id: f.id } : {}), sectionType: f.sectionType, title: f.title || null, configJson: f.configJson || '{}', sortOrder: Number(f.sortOrder) || 0, active: f.active }),
    {
      success: (res, f) => (f.id ? 'تم تحديث القسم' : 'تمت إضافة القسم'),
      invalidate: [['admin-content'], ['config'], ['catalog-home']],
      onDone: () => setSectionForm(null),
    }
  )

  const savePage = useApiMutation<PageForm, unknown>(
    (f) => api.post('/api/admin/content', { type: 'pages', ...(f.id ? { id: f.id } : {}), slug: f.slug.trim(), title: f.title, content: f.content, published: f.published, sortOrder: Number(f.sortOrder) || 0 }),
    {
      success: (res, f) => (f.id ? 'تم تحديث الصفحة' : 'تمت إضافة الصفحة'),
      invalidate: [['admin-content'], ['config']],
      onDone: () => setPageForm(null),
    }
  )

  const deleteMutation = useApiMutation<{ type: string; id: string }, unknown>(
    (t) => api.del(`/api/admin/content?type=${t.type}&id=${t.id}`),
    {
      success: 'تم الحذف',
      invalidate: [['admin-content'], ['config'], ['catalog-home']],
      onDone: () => setDeleteTarget(null),
    }
  )

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-content'] })

  // ---------- banners ----------
  const bannerColumns: Column<BannerRow>[] = [
    {
      key: 'banner',
      header: 'البانر',
      cell: (b) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <SmartImage src={b.imageUrl} alt={b.title ?? 'بانر'} className="size-11 w-16" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate max-w-40">{b.title ?? 'بدون عنوان'}</p>
            <p className="text-[11px] text-muted-foreground truncate max-w-40">{b.subtitle ?? ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'الإجراء',
      cell: (b) => (
        <div className="text-xs">
          <p>{BANNER_ACTION_LABELS[b.actionType] ?? b.actionType}</p>
          {b.target && <p className="text-muted-foreground" dir="ltr">{b.target}</p>}
        </div>
      ),
    },
    {
      key: 'sort',
      header: 'الترتيب',
      cell: (b) => <span className="text-sm tabular-nums">{b.sortOrder}</span>,
    },
    {
      key: 'active',
      header: 'نشط',
      cell: (b) => <StatusBadge status={b.active ? 'ACTIVE' : 'CLOSED'} label={b.active ? 'نشط' : 'معطّل'} />,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (b) => (
        <div className="flex items-center gap-1" data-no-row-click>
          {can('content.manage') && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="تحرير البانر"
              onClick={() => {
                setFormError('')
                setBannerForm({ id: b.id, title: b.title ?? '', subtitle: b.subtitle ?? '', imageUrl: b.imageUrl, actionType: b.actionType, target: b.target ?? '', sortOrder: String(b.sortOrder), active: b.active })
              }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {can('content.manage') && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'banners', id: b.id, label: b.title ?? 'بانر' })} aria-label="حذف البانر">
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // ---------- sections ----------
  const sectionColumns: Column<HomeSectionRow>[] = [
    {
      key: 'type',
      header: 'القسم',
      cell: (s) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold">{SECTION_TYPE_LABELS[s.type] ?? s.type}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-44">{s.title ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'sort',
      header: 'الترتيب',
      cell: (s) => <span className="text-sm tabular-nums">{s.sortOrder}</span>,
    },
    {
      key: 'active',
      header: 'نشط',
      cell: (s) => <StatusBadge status={s.active ? 'ACTIVE' : 'CLOSED'} label={s.active ? 'ظاهر' : 'مخفي'} />,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (s) => (
        <div className="flex items-center gap-1" data-no-row-click>
          {can('content.manage') && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="تحرير القسم"
              onClick={() => { setFormError(''); setSectionForm({ id: s.id, sectionType: s.type, title: s.title ?? '', configJson: s.configJson ?? '{}', sortOrder: String(s.sortOrder), active: s.active }) }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {can('content.manage') && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'sections', id: s.id, label: SECTION_TYPE_LABELS[s.type] ?? s.type })} aria-label="حذف القسم">
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // ---------- pages ----------
  const pageColumns: Column<ContentPageRow>[] = [
    {
      key: 'page',
      header: 'الصفحة',
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-44">{p.title}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">/{p.slug}</p>
        </div>
      ),
    },
    {
      key: 'updated',
      header: 'آخر تحديث',
      cell: (p) => <span className="text-xs text-muted-foreground">{timeAgo(p.updatedAt)}</span>,
    },
    {
      key: 'published',
      header: 'النشر',
      cell: (p) => <StatusBadge status={p.published ? 'ACTIVE' : 'DRAFT'} label={p.published ? 'منشورة' : 'مسودة'} />,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (p) => (
        <div className="flex items-center gap-1" data-no-row-click>
          {can('content.manage') && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="تحرير الصفحة"
              onClick={() => { setFormError(''); setPageForm({ id: p.id, slug: p.slug, title: p.title, content: p.content, published: p.published, sortOrder: String(p.sortOrder) }) }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {can('content.manage') && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'pages', id: p.id, label: p.title })} aria-label="حذف الصفحة">
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const submitBanner = async () => {
    if (!bannerForm) return
    setFormError('')
    if (!bannerForm.imageUrl) return setFormError('صورة البانر مطلوبة')
    await saveBanner.mutateAsync(bannerForm)
  }

  const submitSection = async () => {
    if (!sectionForm) return
    setFormError('')
    if (sectionForm.configJson.trim() && sectionForm.configJson.trim() !== '{}') {
      try {
        JSON.parse(sectionForm.configJson)
      } catch {
        return setFormError('JSON الإعدادات غير صحيح')
      }
    }
    await saveSection.mutateAsync(sectionForm)
  }

  const submitPage = async () => {
    if (!pageForm) return
    setFormError('')
    if (!/^[a-z0-9-]+$/.test(pageForm.slug.trim())) return setFormError('المعرف بحروف إنجليزية صغيرة وشرطات فقط')
    if (pageForm.title.trim().length < 2) return setFormError('العنوان مطلوب')
    if (pageForm.content.trim().length < 2) return setFormError('المحتوى مطلوب')
    await savePage.mutateAsync(pageForm)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="المحتوى"
        description="البانرات وأقسام الرئيسية والصفحات الثابتة"
      />

      <Tabs defaultValue="banners" dir="rtl">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="banners" className="gap-1.5 flex-1 sm:flex-none">
            <ImageIcon className="size-4" /> البانرات ({query.data?.banners.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="sections" className="gap-1.5 flex-1 sm:flex-none">
            <LayoutGrid className="size-4" /> أقسام الرئيسية ({query.data?.sections.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5 flex-1 sm:flex-none">
            <FileText className="size-4" /> الصفحات ({query.data?.pages.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* البانرات */}
        <TabsContent value="banners" className="mt-3 space-y-3">
          {can('content.manage') && (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setBannerForm({ title: '', subtitle: '', imageUrl: '', actionType: 'NONE', target: '', sortOrder: '0', active: true }) }}>
              <Plus className="size-4" /> بانر جديد
            </Button>
          )}
          <Card>
            <CardContent>
              <DataTable columns={bannerColumns} rows={query.data?.banners} loading={query.isLoading} error={query.error} onRetry={invalidate} emptyIcon="🖼️" emptyTitle="لا توجد بانرات" compact />
            </CardContent>
          </Card>
        </TabsContent>

        {/* الأقسام */}
        <TabsContent value="sections" className="mt-3 space-y-3">
          {can('content.manage') && (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setSectionForm({ sectionType: 'FEATURED', title: '', configJson: '{}', sortOrder: '0', active: true }) }}>
              <Plus className="size-4" /> قسم جديد
            </Button>
          )}
          <Card>
            <CardContent>
              <DataTable columns={sectionColumns} rows={query.data?.sections} loading={query.isLoading} error={query.error} onRetry={invalidate} emptyIcon="🧩" emptyTitle="لا توجد أقسام" compact />
            </CardContent>
          </Card>
        </TabsContent>

        {/* الصفحات */}
        <TabsContent value="pages" className="mt-3 space-y-3">
          {can('content.manage') && (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setPageForm({ slug: '', title: '', content: '', published: true, sortOrder: '0' }) }}>
              <Plus className="size-4" /> صفحة جديدة
            </Button>
          )}
          <Card>
            <CardContent>
              <DataTable columns={pageColumns} rows={query.data?.pages} loading={query.isLoading} error={query.error} onRetry={invalidate} emptyIcon="📄" emptyTitle="لا توجد صفحات" compact />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* حوار البانر */}
      <Dialog open={bannerForm !== null} onOpenChange={(v) => { if (!saveBanner.isPending && !v) setBannerForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{bannerForm?.id ? 'تحرير البانر' : 'بانر جديد'}</DialogTitle>
            <DialogDescription>يظهر أعلى الصفحة الرئيسية وفق الترتيب.</DialogDescription>
          </DialogHeader>
          {bannerForm && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="bn-title">العنوان</Label>
                <Input id="bn-title" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} placeholder="مثال: عروض رمضان" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bn-sub">العنوان الفرعي</Label>
                <Input id="bn-sub" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} placeholder="اختياري" />
              </div>
              <UploadField label="صورة البانر *" value={bannerForm.imageUrl} onChange={(url) => setBannerForm({ ...bannerForm, imageUrl: url })} folder="banners" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الإجراء عند الضغط</Label>
                  <Select value={bannerForm.actionType} onValueChange={(v) => setBannerForm({ ...bannerForm, actionType: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BANNER_ACTION_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bn-target">الهدف (slug)</Label>
                  <Input id="bn-target" value={bannerForm.target} onChange={(e) => setBannerForm({ ...bannerForm, target: e.target.value })} placeholder="مثال: perfumes" dir="ltr" disabled={bannerForm.actionType === 'NONE'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bn-sort">الترتيب</Label>
                  <Input id="bn-sort" type="number" value={bannerForm.sortOrder} onChange={(e) => setBannerForm({ ...bannerForm, sortOrder: e.target.value })} />
                </div>
                <div className="flex items-center gap-3 border rounded-lg px-3 h-10">
                  <Switch id="bn-active" checked={bannerForm.active} onCheckedChange={(v) => setBannerForm({ ...bannerForm, active: v })} />
                  <Label htmlFor="bn-active" className="cursor-pointer text-sm">نشط</Label>
                </div>
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBannerForm(null)} disabled={saveBanner.isPending}>إلغاء</Button>
            <Button onClick={submitBanner} disabled={saveBanner.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار القسم */}
      <Dialog open={sectionForm !== null} onOpenChange={(v) => { if (!saveSection.isPending && !v) setSectionForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{sectionForm?.id ? 'تحرير القسم' : 'قسم جديد'}</DialogTitle>
            <DialogDescription>ترتيب ظهور أقسام الصفحة الرئيسية.</DialogDescription>
          </DialogHeader>
          {sectionForm && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>نوع القسم *</Label>
                <Select value={sectionForm.sectionType} onValueChange={(v) => setSectionForm({ ...sectionForm, sectionType: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SECTION_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-title">العنوان الظاهر</Label>
                <Input id="sc-title" value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="مثال: الأكثر مبيعًا هذا الشهر" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-config">إعدادات JSON (للمخصص فقط)</Label>
                <Textarea id="sc-config" value={sectionForm.configJson} onChange={(e) => setSectionForm({ ...sectionForm, configJson: e.target.value })} rows={3} dir="ltr" placeholder="{}" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sc-sort">الترتيب</Label>
                  <Input id="sc-sort" type="number" value={sectionForm.sortOrder} onChange={(e) => setSectionForm({ ...sectionForm, sortOrder: e.target.value })} />
                </div>
                <div className="flex items-center gap-3 border rounded-lg px-3 h-10">
                  <Switch id="sc-active" checked={sectionForm.active} onCheckedChange={(v) => setSectionForm({ ...sectionForm, active: v })} />
                  <Label htmlFor="sc-active" className="cursor-pointer text-sm">ظاهر</Label>
                </div>
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionForm(null)} disabled={saveSection.isPending}>إلغاء</Button>
            <Button onClick={submitSection} disabled={saveSection.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار الصفحة */}
      <Dialog open={pageForm !== null} onOpenChange={(v) => { if (!savePage.isPending && !v) setPageForm(null) }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{pageForm?.id ? `تحرير: ${pageForm.title}` : 'صفحة جديدة'}</DialogTitle>
            <DialogDescription>الصفحات الثابتة مثل «من نحن» و«الشروط والأحكام».</DialogDescription>
          </DialogHeader>
          {pageForm && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pg-title">العنوان *</Label>
                  <Input id="pg-title" value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} placeholder="من نحن" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pg-slug">المعرف (slug) *</Label>
                  <Input id="pg-slug" value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} placeholder="about-us" dir="ltr" disabled={!!pageForm.id} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pg-content">المحتوى *</Label>
                <Textarea id="pg-content" value={pageForm.content} onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })} rows={8} placeholder="نص الصفحة..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pg-sort">الترتيب</Label>
                  <Input id="pg-sort" type="number" value={pageForm.sortOrder} onChange={(e) => setPageForm({ ...pageForm, sortOrder: e.target.value })} />
                </div>
                <div className="flex items-center gap-3 border rounded-lg px-3 h-10">
                  <Switch id="pg-pub" checked={pageForm.published} onCheckedChange={(v) => setPageForm({ ...pageForm, published: v })} />
                  <Label htmlFor="pg-pub" className="cursor-pointer text-sm">منشورة</Label>
                </div>
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageForm(null)} disabled={savePage.isPending}>إلغاء</Button>
            <Button onClick={submitPage} disabled={savePage.isPending}>حفظ الصفحة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حذف */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title={`حذف: ${deleteTarget?.label ?? ''}`}
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

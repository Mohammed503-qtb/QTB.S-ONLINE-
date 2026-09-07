'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { cn } from '@/lib/utils'
import { ProductCard } from '../components/product-card'
import type { Brand, Category, CatalogListResult } from '../types'

// ============================================================
// الكتالوج — فلاتر (تصنيف/ماركة/سعر/ترتيب) + بحث + Grid + Pagination
// مصدر الحقيقة لـ category/search/brand هو params (useNav)
// ============================================================

const SORT_OPTIONS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'price_asc', label: 'السعر: الأقل أولًا' },
  { value: 'price_desc', label: 'السعر: الأعلى أولًا' },
  { value: 'best_selling', label: 'الأكثر مبيعًا' },
  { value: 'featured', label: 'المميزة' },
]

const PAGE_LIMIT = 12

export function CatalogView() {
  const params = useNav((s) => s.params)
  const replace = useNav((s) => s.replace)

  const category = params.category ?? ''
  const search = params.search ?? ''
  const brand = params.brand ?? ''

  // فلاتر محلية
  const [searchInput, setSearchInput] = useState(search)
  const [sort, setSort] = useState('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [page, setPage] = useState(1)

  // مزامنة حقل البحث مع params
  useEffect(() => {
    setSearchInput(search)
  }, [search])

  // إعادة الصفحة للأول عند تغيير أي فلتر
  useEffect(() => {
    setPage(1)
  }, [category, search, brand, sort, minPrice, maxPrice])

  // بحث مؤجل
  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = searchInput.trim()
      if (q === search) return
      const next: Record<string, string> = {}
      if (q) next.search = q
      if (category) next.category = category
      if (brand) next.brand = brand
      replace('catalog', next)
    }, 500)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const setParam = (key: 'category' | 'brand', value: string) => {
    const next: Record<string, string> = {}
    if (search) next.search = search
    if (key !== 'category' && category) next.category = category
    if (key !== 'brand' && brand) next.brand = brand
    if (value) next[key] = value
    replace('catalog', next)
  }

  // الفلاتر (تصنيفات + ماركات)
  const { data: filtersData } = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: () => api.get<{ categories: Category[]; brands: Brand[] }>('/api/catalog/categories'),
    staleTime: 120_000,
  })

  const queryString = useMemo(() => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (category) q.set('category', category)
    if (brand) q.set('brand', brand)
    if (sort !== 'newest') q.set('sort', sort)
    if (minPrice) q.set('minPrice', minPrice)
    if (maxPrice) q.set('maxPrice', maxPrice)
    q.set('page', String(page))
    q.set('limit', String(PAGE_LIMIT))
    return q.toString()
  }, [search, category, brand, sort, minPrice, maxPrice, page])

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['catalog', queryString],
    queryFn: () => api.get<CatalogListResult>(`/api/catalog/products?${queryString}`),
    placeholderData: (prev) => prev,
  })

  const activeCategory = filtersData?.categories.find((c) => c.slug === category)
  const activeBrand = filtersData?.brands.find((b) => b.slug === brand)
  const hasActiveFilters = !!(search || category || brand || minPrice || maxPrice || sort !== 'newest')

  const clearAllFilters = () => {
    setSort('newest')
    setMinPrice('')
    setMaxPrice('')
    replace('catalog', {})
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      {/* البحث */}
      <div className="relative">
        <Input
          aria-label="بحث في المنتجات"
          className="min-h-11 pe-10"
          placeholder="ابحث عن منتج، ماركة، وصف..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button
            type="button"
            aria-label="مسح البحث"
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchInput('')}
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* شرائح التصنيفات */}
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="التصنيفات">
        <button
          type="button"
          role="tab"
          aria-selected={!category}
          onClick={() => setParam('category', '')}
          className={cn(
            'min-h-9 shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            !category
              ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-600'
              : 'bg-card hover:bg-accent'
          )}
        >
          الكل
        </button>
        {filtersData?.categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={category === cat.slug}
            onClick={() => setParam('category', cat.slug === category ? '' : cat.slug)}
            className={cn(
              'min-h-9 shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              category === cat.slug
                ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-600'
                : 'bg-card hover:bg-accent'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* صف الفلاتر */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <Select value={brand || undefined} onValueChange={(v) => setParam('brand', v)}>
          <SelectTrigger className="h-10 w-auto min-w-32" aria-label="الماركة">
            <SelectValue placeholder="كل الماركات" />
          </SelectTrigger>
          <SelectContent>
            {filtersData?.brands.map((b) => (
              <SelectItem key={b.id} value={b.slug}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            aria-label="أدنى سعر"
            inputMode="numeric"
            className="h-10 w-24"
            placeholder="من"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            aria-label="أقصى سعر"
            inputMode="numeric"
            className="h-10 w-24"
            placeholder="إلى"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 w-auto min-w-36" aria-label="الترتيب">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-10 text-rose-600 hover:text-rose-700" onClick={clearAllFilters}>
            <X className="size-4" aria-hidden />
            مسح الفلاتر
          </Button>
        )}
      </div>

      {/* عنوان النتائج */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-extrabold">
          {activeCategory ? activeCategory.name : activeBrand ? `ماركة ${activeBrand.name}` : search ? `نتائج البحث عن "${search}"` : 'كل المنتجات'}
        </h1>
        {data && <Badge variant="secondary">{data.total} منتج</Badge>}
      </div>

      {/* الشبكة */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل المنتجات'} retry={() => refetch()} />
      ) : data.products.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="لا توجد منتجات مطابقة"
          subtitle="جرّب تغيير الفلاتر أو البحث بكلمة أخرى"
          action={
            hasActiveFilters ? (
              <Button variant="outline" className="min-h-11" onClick={clearAllFilters}>
                مسح كل الفلاتر
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', isFetching && 'opacity-60 transition-opacity')}>
          {data.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* ترقيم الصفحات */}
      {data && data.pages > 1 && (
        <nav aria-label="ترقيم الصفحات" className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="icon" className="size-11" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="الصفحة السابقة">
            <ChevronRight className="size-5" aria-hidden />
          </Button>
          <span className="text-sm font-medium">
            صفحة {data.page} من {data.pages}
          </span>
          <Button variant="outline" size="icon" className="size-11" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} aria-label="الصفحة التالية">
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  )
}

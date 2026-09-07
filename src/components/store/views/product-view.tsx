'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Heart, Minus, MessageCircleQuestion, Plus, ShoppingCart, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState, EmptyState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useConfig, useSession } from '@/lib/client/session'
import { useCart, useNav, useUi, whatsappLink } from '@/lib/client/stores'
import { money, dateFmt } from '@/lib/client/format'
import { cn } from '@/lib/utils'
import { applyDiscount } from '../utils'
import { SafeImg } from '../components/safe-img'
import { ProductRow } from '../components/product-row'
import type { FavoriteProduct, ProductDetail, ProductVariant } from '../types'

// ============================================================
// صفحة المنتج — معرض + متغيرات (لون/مقاس) + سلة + مفضلة + تقييمات
// ============================================================

export function ProductView({ id }: { id: string }) {
  const { data: config } = useConfig()
  const { isAuthenticated } = useSession()
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const openLogin = useUi((s) => s.openLogin)
  const add = useCart((s) => s.add)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<ProductDetail>(`/api/catalog/products/${encodeURIComponent(id)}`),
    enabled: id.length > 0,
  })

  // المفضلة
  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.get<FavoriteProduct[]>('/api/favorites'),
    enabled: isAuthenticated,
  })
  const qc = useQueryClient()
  const toggleFavorite = useMutation({
    mutationFn: () => api.post<{ favorited: boolean }>('/api/favorites', { productId: data?.product.id }),
    onSuccess: (res) => {
      toast.success(res.favorited ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة')
      qc.invalidateQueries({ queryKey: ['favorites'] })
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'تعذر تنفيذ العملية'),
  })

  // حالة الواجهة
  const [qty, setQty] = useState(1)
  const [selectionOverride, setSelectionOverride] = useState<Record<string, string> | null>(null)
  const [mainImageIdx, setMainImageIdx] = useState(0)

  // الاختيار الفعّال: اختيار المستخدم أو أول متغير (اشتقاق مباشر — يُعاد الضبط تلقائيًا عند منتج جديد لإعادة التركيب)
  const firstVariantAttributes = data?.variants[0]?.attributes ?? {}
  const selection = selectionOverride ?? firstVariantAttributes

  // مفاتيح السمات (لون/مقاس...)
  const attributeKeys = useMemo(() => {
    const keys = new Set<string>()
    data?.variants.forEach((v) => Object.keys(v.attributes).forEach((k) => keys.add(k)))
    return [...keys]
  }, [data])

  // القيم المتاحة لكل مفتاح مع القيم الأخرى المحددة
  const valuesFor = (key: string): string[] => {
    const values = new Set<string>()
    data?.variants.forEach((v) => {
      const val = v.attributes[key]
      if (!val) return
      const compatible = attributeKeys.every((k) => k === key || v.attributes[k] === selection[k])
      if (compatible) values.add(val)
    })
    return [...values]
  }

  const selectedVariant: ProductVariant | undefined = useMemo(() => {
    if (!data || data.variants.length === 0) return undefined
    return data.variants.find((v) => attributeKeys.every((k) => v.attributes[k] === selection[k]))
  }, [data, attributeKeys, selection])

  const price = selectedVariant ? applyDiscount(selectedVariant.price, selectedVariant.discountPercent) : data?.product.basePrice ?? 0
  const compareAt = data?.product.compareAtPrice && data.product.compareAtPrice > price ? data.product.compareAtPrice : undefined
  const available = selectedVariant?.available ?? 0
  const maxQty = Math.min(Math.max(available, 1), 99)

  // المعرض: صور المنتج + صورة المتغير
  const gallery = useMemo(() => {
    if (!data) return []
    const urls: string[] = []
    if (data.product.imageUrl) urls.push(data.product.imageUrl)
    data.product.images.forEach((img) => {
      if (!urls.includes(img.url)) urls.push(img.url)
    })
    const variantImg = selectedVariant?.imageUrl
    if (variantImg && !urls.includes(variantImg)) urls.unshift(variantImg)
    else if (variantImg) {
      // اجعل صورة المتغير المختار هي الرئيسية
      const idx = urls.indexOf(variantImg)
      if (idx > 0) {
        urls.splice(idx, 1)
        urls.unshift(variantImg)
      }
    }
    return urls
  }, [data, selectedVariant])

  if (!id) {
    return <EmptyState icon="❓" title="لم يتم تحديد منتج" subtitle="عد إلى الكتالوج واختر منتجًا" />
  }

  if (isLoading) return <ProductSkeleton />

  if (error || !data) {
    return <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل المنتج'} retry={() => refetch()} />
  }

  const { product, reviews, reviewsSummary, related } = data

  const onAddToCart = () => {
    if (!selectedVariant) {
      toast.error('اختر المواصفات المتاحة أولًا')
      return
    }
    if (available <= 0) {
      toast.error('نفدت الكمية من هذا المنتج حاليًا')
      return
    }
    add({
      productId: product.id,
      variantId: selectedVariant.id,
      name: product.name,
      image: selectedVariant.imageUrl ?? product.imageUrl,
      price,
      attributes: selectedVariant.attributes,
      quantity: Math.min(qty, maxQty),
    })
    toast.success('تمت الإضافة إلى السلة', {
      action: { label: 'عرض السلة', onClick: () => go('cart') },
    })
  }

  const isFavorited = favorites?.some((f) => f.id === product.id) ?? false

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-4">
      {/* التنقل */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={() => back()} className="min-h-9 font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          رجوع
        </button>
        <span aria-hidden>·</span>
        {product.category && (
          <button type="button" onClick={() => go('catalog', { category: product.category!.slug })} className="min-h-9 hover:underline">
            {product.category.name}
          </button>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* المعرض */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <SafeImg
              src={gallery[mainImageIdx] ?? product.imageUrl}
              alt={product.name}
              className="aspect-square w-full"
            />
          </div>
          {gallery.length > 1 && (
            <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1" role="list" aria-label="صور المنتج">
              {gallery.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  role="listitem"
                  onClick={() => setMainImageIdx(i)}
                  aria-label={`صورة ${i + 1}`}
                  className={cn(
                    'size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-card transition-colors sm:size-20',
                    i === mainImageIdx ? 'border-emerald-600' : 'border-transparent hover:border-muted'
                  )}
                >
                  <SafeImg src={url} alt={`${product.name} — صورة ${i + 1}`} className="size-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {product.brand && <Badge variant="outline">{product.brand.name}</Badge>}
              {selectedVariant && selectedVariant.discountPercent ? (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">خصم {selectedVariant.discountPercent}%</Badge>
              ) : null}
              {data.variants.every((v) => v.available <= 0) && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300">نفدت الكمية</Badge>}
            </div>
            <h1 className="text-2xl font-extrabold leading-snug">{product.name}</h1>
            {reviewsSummary.count > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Stars rating={reviewsSummary.average} />
                <span className="font-bold">{reviewsSummary.average.toFixed(1)}</span>
                <span className="text-muted-foreground">({reviewsSummary.count} تقييم)</span>
              </div>
            )}
          </div>

          {/* السعر */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">{money(price)}</span>
            {compareAt && <span className="text-lg text-muted-foreground line-through">{money(compareAt)}</span>}
          </div>

          {/* اختيار المواصفات */}
          {attributeKeys.length > 0 && (
            <div className="space-y-4">
              {attributeKeys.map((key) => {
                const allValues = new Set<string>()
                data.variants.forEach((v) => {
                  const val = v.attributes[key]
                  if (val) allValues.add(val)
                })
                const selectable = valuesFor(key)
                return (
                  <div key={key} className="space-y-2">
                    <p className="text-sm font-bold">
                      {key}
                      {selection[key] && <span className="ms-2 font-normal text-muted-foreground">{selection[key]}</span>}
                    </p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={key}>
                      {[...allValues].map((val) => {
                        const enabled = selectable.includes(val)
                        const active = selection[key] === val
                        return (
                          <button
                            key={val}
                            type="button"
                            disabled={!enabled}
                            onClick={() => setSelectionOverride({ ...selection, [key]: val })}
                            aria-pressed={active}
                            className={cn(
                              'min-h-11 min-w-11 rounded-xl border px-4 text-sm font-medium transition-all',
                              active
                                ? 'border-emerald-700 bg-emerald-50 font-bold text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-card hover:bg-accent',
                              !enabled && 'cursor-not-allowed opacity-35 line-through'
                            )}
                          >
                            {val}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {!selectedVariant && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  هذا الخيار غير متوفر حاليًا — اختر مواصفات أخرى
                </p>
              )}
            </div>
          )}

          {/* الكمية + الإضافة */}
          <div className="space-y-3">
            {selectedVariant && available > 0 && available <= 5 && (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">⚡ بقي {available} فقط في المخزون</p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border" role="group" aria-label="الكمية">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="إنقاص الكمية"
                  disabled={qty <= 1}
                >
                  <Minus className="size-4" aria-hidden />
                </Button>
                <span className="w-10 text-center text-base font-bold" aria-live="polite">{qty}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  aria-label="زيادة الكمية"
                  disabled={qty >= maxQty || available <= 0}
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
              <Button
                size="lg"
                disabled={available <= 0 || !selectedVariant}
                onClick={onAddToCart}
                className="h-12 flex-1 bg-emerald-700 text-base text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                <ShoppingCart className="size-5" aria-hidden />
                {available <= 0 ? 'نفدت الكمية' : 'إضافة إلى السلة'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                className="h-12 flex-1"
                onClick={() => {
                  if (!isAuthenticated) {
                    openLogin('سجّل الدخول لحفظ المنتج في مفضلتك')
                    return
                  }
                  toggleFavorite.mutate()
                }}
                disabled={toggleFavorite.isPending}
                aria-pressed={isFavorited}
              >
                <Heart className={cn('size-5', isFavorited && 'fill-rose-500 text-rose-500')} aria-hidden />
                {isFavorited ? 'في المفضلة' : 'أضف للمفضلة'}
              </Button>
              {config?.flags.whatsapp_enabled !== false && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 flex-1"
                  onClick={() => window.open(whatsappLink(config?.settings.whatsappNumber ?? '', `مرحبًا، أرغب في الاستفسار عن المنتج: ${product.name}`), '_blank', 'noopener')}
                >
                  <MessageCircleQuestion className="size-5" aria-hidden />
                  اسأل عبر واتساب
                </Button>
              )}
            </div>
          </div>

          {/* الوصف */}
          {product.description && (
            <>
              <Separator />
              <section aria-label="وصف المنتج" className="space-y-2">
                <h2 className="font-bold">الوصف</h2>
                {product.description.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">{para}</p>
                ))}
              </section>
            </>
          )}
        </div>
      </div>

      {/* التقييمات */}
      {config?.flags.reviews_enabled !== false && (
        <section aria-label="التقييمات" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-extrabold">تقييمات المنتج</h2>
            {reviewsSummary.count > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <Stars rating={reviewsSummary.average} />
                <span className="font-bold">{reviewsSummary.average.toFixed(1)}</span>
                <span className="text-muted-foreground">من {reviewsSummary.count} تقييم</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">لا توجد تقييمات بعد</span>
            )}
          </div>
          {reviews.length > 0 && (
            <div className="max-h-96 space-y-3 overflow-y-auto pe-1 scrollbar-thin">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{review.customerName}</p>
                    <Stars rating={review.rating} />
                  </div>
                  {review.comment && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{dateFmt(review.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* منتجات ذات صلة */}
      {related.length > 0 && (
        <ProductRow
          title="منتجات ذات صلة"
          products={related.map((r) => ({ ...r, variants: [] }))}
        />
      )}
    </div>
  )
}

// ---------- نجوم التقييم ----------
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`تقييم ${rating.toFixed(1)} من 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('size-4', i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
          aria-hidden
        />
      ))}
    </span>
  )
}

// ---------- هيكل التحميل ----------
function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-4">
      <Skeleton className="h-5 w-24" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="size-16 rounded-xl sm:size-20" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-11 w-52" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}

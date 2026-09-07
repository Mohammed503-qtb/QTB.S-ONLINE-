'use client'

import { useQuery } from '@tanstack/react-query'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState, EmptyState } from '@/components/app/spinner'
import { api } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { SafeImg } from '../components/safe-img'
import { ProductRow } from '../components/product-row'
import type { HomeData } from '../types'

// ============================================================
// الرئيسية — أقسام ديناميكية من /api/catalog/home
// ============================================================

const SECTION_DEFAULT_TITLES: Record<string, string> = {
  FEATURED: 'مختارات مميزة',
  OFFERS: 'عروض وخصومات',
  NEW_ARRIVALS: 'وصل حديثًا',
  BEST_SELLERS: 'الأكثر مبيعًا',
}

const PRODUCT_SECTION_TYPES = ['FEATURED', 'OFFERS', 'NEW_ARRIVALS', 'BEST_SELLERS'] as const
type ProductSectionType = (typeof PRODUCT_SECTION_TYPES)[number]

export function HomeView() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: () => api.get<HomeData>('/api/catalog/home'),
    staleTime: 60_000,
  })

  if (isLoading) return <HomeSkeleton />

  if (error || !data) {
    return <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل الصفحة الرئيسية'} retry={() => refetch()} />
  }

  const sections = data.sections.filter((s) => s.active)
  const hasProductSections = sections.some((s) => PRODUCT_SECTION_TYPES.includes(s.type as ProductSectionType))
  const nothingToShow =
    data.banners.length === 0 &&
    data.categories.length === 0 &&
    !hasProductSections

  if (nothingToShow) {
    return (
      <EmptyState
        icon="🏬"
        title="لا يوجد محتوى لعرضه حاليًا"
        subtitle="يعمل المتجر على تجهيز المنتجات — عاود الزيارة قريبًا"
      />
    )
  }

  const bannerSection = sections.find((s) => s.type === 'BANNER')
  const categorySection = sections.find((s) => s.type === 'CATEGORIES')
  const productSections = sections.filter((s) => PRODUCT_SECTION_TYPES.includes(s.type as ProductSectionType))

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      {/* البانرات */}
      {data.banners.length > 0 && <BannersCarousel banners={data.banners} />}

      {/* التصنيفات */}
      {(categorySection || (!bannerSection && !categorySection)) && data.categories.length > 0 && (
        <section className="space-y-3" aria-label="التصنيفات">
          <h2 className="px-1 text-lg font-extrabold">{categorySection?.title || 'تسوق حسب القسم'}</h2>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {data.categories.map((cat) => (
              <CategoryChip key={cat.id} name={cat.name} slug={cat.slug} imageUrl={cat.imageUrl} />
            ))}
          </div>
        </section>
      )}

      {/* أقسام المنتجات */}
      {productSections.map((section) => (
        <ProductRow
          key={section.id}
          title={section.title || SECTION_DEFAULT_TITLES[section.type] || section.type}
          products={data.products[section.type as ProductSectionType] ?? []}
          viewAll={{ label: 'عرض الكل', view: 'catalog' }}
        />
      ))}

      {/* شريط ثقة */}
      <TrustBar />
    </div>
  )
}

// ---------- البانرات (embla) ----------
function BannersCarousel({ banners }: { banners: HomeData['banners'] }) {
  const go = useNav((s) => s.go)

  const onBannerClick = (banner: HomeData['banners'][number]) => {
    if (!banner.target || banner.actionType === 'NONE') return
    if (banner.actionType === 'CATEGORY') go('catalog', { category: banner.target })
    else if (banner.actionType === 'PRODUCT') go('product', { id: banner.target })
    else if (banner.actionType === 'PAGE') go('page', { slug: banner.target })
  }

  return (
    <section aria-label="العروض والإعلانات" className="px-1">
      <Carousel opts={{ loop: true, direction: 'rtl' }} className="w-full">
        <CarouselContent>
          {banners.map((banner) => (
            <CarouselItem key={banner.id}>
              <button
                type="button"
                onClick={() => onBannerClick(banner)}
                className="relative block aspect-[21/9] w-full overflow-hidden rounded-2xl shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-600 sm:aspect-[3/1]"
                aria-label={banner.title ?? 'إعلان'}
              >
                <SafeImg src={banner.imageUrl} alt={banner.title ?? 'إعلان'} className="absolute inset-0 h-full w-full" emoji="✨" />
                {(banner.title || banner.subtitle) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 text-center">
                    {banner.title && <h3 className="text-lg font-extrabold text-white drop-shadow sm:text-2xl">{banner.title}</h3>}
                    {banner.subtitle && <p className="text-xs text-white/90 drop-shadow sm:text-sm">{banner.subtitle}</p>}
                  </div>
                )}
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="end-2 start-auto" aria-label="السابق" />
        <CarouselNext className="start-2 end-auto" aria-label="التالي" />
      </Carousel>
    </section>
  )
}

// ---------- تصنيف ----------
function CategoryChip({ name, slug, imageUrl }: { name: string; slug: string; imageUrl?: string | null }) {
  const go = useNav((s) => s.go)
  return (
    <button
      type="button"
      onClick={() => go('catalog', { category: slug })}
      className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600"
      aria-label={`تصنيف ${name}`}
    >
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted/40">
        <SafeImg src={imageUrl} alt={name} className="h-full w-full transition-transform duration-300 group-hover:scale-110" emoji="🗂️" />
      </div>
      <span className="line-clamp-1 text-[11px] font-semibold sm:text-xs">{name}</span>
    </button>
  )
}

// ---------- شريط الثقة ----------
function TrustBar() {
  const items = [
    { icon: '🚚', title: 'توصيل لكل المحافظات', sub: 'شحن سريع وموثوق' },
    { icon: '🏦', title: 'دفع بالتحويل', sub: 'أو الدفع عند الاستلام' },
    { icon: '↩️', title: 'إرجاع سهل', sub: 'خلال نافذة الإرجاع' },
    { icon: '💬', title: 'دعم عبر واتساب', sub: 'نرد بسرعة' },
  ]
  return (
    <section aria-label="لماذا نتسوق معنا" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl dark:bg-emerald-950" aria-hidden>
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold sm:text-sm">{item.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{item.sub}</p>
          </div>
        </div>
      ))}
    </section>
  )
}

// ---------- هيكل التحميل ----------
function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      <Skeleton className="aspect-[21/9] w-full rounded-2xl sm:aspect-[3/1]" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-36 shrink-0 rounded-2xl sm:w-40" />
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { RequireAuth } from '../components/require-auth'
import { ProductCard } from '../components/product-card'
import type { FavoriteProduct } from '../types'

// ============================================================
// المفضلة — شبكة بطاقات + إزالة سريعة
// ============================================================

export function FavoritesView() {
  return (
    <RequireAuth title="سجّل الدخول لعرض مفضلتك">
      <FavoritesInner />
    </RequireAuth>
  )
}

function FavoritesInner() {
  const go = useNav((s) => s.go)
  const qc = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.get<FavoriteProduct[]>('/api/favorites'),
  })

  const toggleFavorite = useMutation({
    mutationFn: (productId: string) => api.post<{ favorited: boolean }>('/api/favorites', { productId }),
    onSuccess: (res) => {
      toast.success(res.favorited ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة')
      qc.invalidateQueries({ queryKey: ['favorites'] })
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'تعذر تنفيذ العملية'),
  })

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <Heart className="size-6 fill-rose-500 text-rose-500" aria-hidden />
        المفضلة
        {data && data.length > 0 && <span className="text-base font-normal text-muted-foreground">({data.length} منتج)</span>}
      </h1>

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
        <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل المفضلة'} retry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="💛"
          title="قائمة المفضلة فارغة"
          subtitle="اضغط على أيقونة القلب في أي منتج لحفظه هنا"
          action={
            <Button onClick={() => go('catalog')} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
              استكشف المنتجات
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 lg:grid-cols-4 lg:pb-0">
          {data.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              favorite
              onToggleFavorite={(id) => toggleFavorite.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

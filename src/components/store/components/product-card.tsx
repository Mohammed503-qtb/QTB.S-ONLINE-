'use client'

import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { money } from '@/lib/client/format'
import { useNav } from '@/lib/client/stores'
import { cn } from '@/lib/utils'
import { asCardProduct, cardPrice } from '../utils'
import { SafeImg } from './safe-img'

// ============================================================
// بطاقة منتج قابلة لإعادة الاستخدام
// صورة + اسم + سعر + شارة خصم + شارة نافد
// ============================================================

export type ProductCardData = {
  id: string
  name: string
  basePrice: number
  compareAtPrice: number | null
  imageUrl: string | null
  slug?: string
  variants?: { priceOverride?: number | null; discountPercent?: number | null }[]
  available?: number
}

export function ProductCard({
  product,
  className,
  favorite,
  onToggleFavorite,
}: {
  product: ProductCardData
  className?: string
  favorite?: boolean
  onToggleFavorite?: (productId: string) => void
}) {
  const go = useNav((s) => s.go)
  const p = asCardProduct(product)
  const { price, compareAt, discountPercent } = cardPrice(p)
  const outOfStock = product.available !== undefined && product.available <= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('relative', className)}
    >
      <button
        type="button"
        onClick={() => go('product', { id: product.id })}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600"
        aria-label={`عرض ${product.name}`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
          <SafeImg
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          />
          {discountPercent > 0 && !outOfStock && (
            <Badge className="absolute end-2 top-2 z-10 bg-amber-500 text-white shadow-sm hover:bg-amber-500">
              خصم {discountPercent}%
            </Badge>
          )}
          {outOfStock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
              <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-700">
                نفدت الكمية
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{product.name}</h3>
          <div className="mt-auto flex items-baseline gap-2">
            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">{money(price)}</span>
            {compareAt && compareAt > price && (
              <span className="text-xs text-muted-foreground line-through">{money(compareAt)}</span>
            )}
          </div>
        </div>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(product.id)}
          aria-label={favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          className="absolute start-2 top-2 z-20 flex size-9 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur transition-transform hover:scale-110"
        >
          <Heart
            className={cn('size-5', favorite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground')}
            aria-hidden
          />
        </button>
      )}
    </motion.div>
  )
}

/** بطاقة مصغرة أفقية (صفوف التمرير في الرئيسية) */
export function ProductCardMini({ product, className }: { product: ProductCardData; className?: string }) {
  const go = useNav((s) => s.go)
  const p = asCardProduct(product)
  const { price, compareAt, discountPercent } = cardPrice(p)
  const outOfStock = product.available !== undefined && product.available <= 0

  return (
    <button
      type="button"
      onClick={() => go('product', { id: product.id })}
      className={cn(
        'group flex w-36 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600 sm:w-40',
        className
      )}
      aria-label={`عرض ${product.name}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
        <SafeImg src={product.imageUrl} alt={product.name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        {discountPercent > 0 && !outOfStock && (
          <Badge className="absolute end-1.5 top-1.5 z-10 bg-amber-500 text-[10px] text-white hover:bg-amber-500">
            {discountPercent}%
          </Badge>
        )}
        {outOfStock && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-rose-700">نفدت الكمية</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 min-h-9 text-xs font-semibold leading-snug">{product.name}</h3>
        <div className="mt-auto flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{money(price)}</span>
          {compareAt && compareAt > price && <span className="text-[10px] text-muted-foreground line-through">{money(compareAt)}</span>}
        </div>
      </div>
    </button>
  )
}

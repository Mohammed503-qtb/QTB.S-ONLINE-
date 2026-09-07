'use client'

import { ChevronLeft } from 'lucide-react'
import { useNav } from '@/lib/client/stores'
import { ProductCardMini, type ProductCardData } from './product-card'

// ============================================================
// صف منتجات أفقي قابل للتمرير مع عنوان القسم
// ============================================================

export function ProductRow({
  title,
  products,
  viewAll,
}: {
  title: string
  products: ProductCardData[]
  viewAll?: { label: string; view: string; params?: Record<string, string> }
}) {
  const go = useNav((s) => s.go)
  if (products.length === 0) return null

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {viewAll && (
          <button
            type="button"
            onClick={() => go(viewAll.view, viewAll.params)}
            className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 hover:dark:bg-emerald-950 dark:text-emerald-400"
          >
            {viewAll.label}
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <div
        className="scrollbar-thin flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'thin' }}
        role="list"
        aria-label={title}
      >
        {products.map((p) => (
          <div key={p.id} role="listitem" className="snap-start">
            <ProductCardMini product={p} />
          </div>
        ))}
      </div>
    </section>
  )
}

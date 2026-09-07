'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ============================================================
// صورة آمنة — img عادي + بديل متدرج عند فشل التحميل
// ============================================================

export function SafeImg({
  src,
  alt,
  className,
  emoji = '🛍️',
}: {
  src?: string | null
  alt: string
  className?: string
  emoji?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-emerald-50 via-amber-50 to-emerald-100 dark:from-emerald-950 dark:via-emerald-900 dark:to-emerald-950',
          className
        )}
      >
        <span className="select-none text-2xl opacity-50" aria-hidden>
          {emoji}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}

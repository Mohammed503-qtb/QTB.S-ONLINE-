'use client'

import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/app/spinner'
import { api } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { dateFmt } from '@/lib/client/format'
import type { ContentPage } from '../types'

// ============================================================
// صفحة محتوى (سياسات/عن/أسئلة) — عنوان + فقرات نصية
// ============================================================

const SLUG_TITLES: Record<string, string> = {
  about: 'من نحن',
  'return-policy': 'سياسة الإرجاع',
  'shipping-policy': 'سياسة الشحن',
  'payment-policy': 'سياسة الدفع',
  terms: 'الشروط والأحكام',
  privacy: 'سياسة الخصوصية',
  faq: 'الأسئلة الشائعة',
}

export function PageView({ slug }: { slug: string }) {
  const go = useNav((s) => s.go)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['page', slug],
    queryFn: () => api.get<ContentPage>(`/api/content/pages/${encodeURIComponent(slug)}`),
    enabled: slug.length > 0,
  })

  if (!slug) return <ErrorState message="لم يتم تحديد الصفحة" />

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <button type="button" onClick={() => go('home')} className="min-h-9 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-400">
        ← الرئيسية
      </button>

      <header className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <BookOpen className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">{data?.title ?? SLUG_TITLES[slug] ?? 'صفحة'}</h1>
          {data && <p className="text-xs text-muted-foreground">آخر تحديث: {dateFmt(new Date())}</p>}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : error || !data ? (
        <ErrorState message={error instanceof Error ? error.message : 'الصفحة غير موجودة'} retry={() => refetch()} />
      ) : (
        <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6" aria-label="محتوى الصفحة">
          {data.content.split('\n').filter((p) => p.trim().length > 0).map((paragraph, i) => (
            <p key={i} className="mb-4 text-sm leading-loose text-muted-foreground sm:text-base">{paragraph}</p>
          ))}
        </article>
      )}
    </div>
  )
}

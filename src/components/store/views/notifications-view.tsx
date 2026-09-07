'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BellRing, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { useSession, useLogin } from '@/lib/client/session'
import { timeAgo } from '@/lib/client/format'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import type { AppNotification } from '../types'

// ============================================================
// الإشعارات — قائمة + تعليم مقروء + انتقال عبر linkView/linkParam
// روابط admin-* تُفتح فقط إذا كان المستخدم إداريًا (وإلا تُتجاهل)
// ============================================================

export function NotificationsView() {
  return (
    <RequireAuth title="سجّل الدخول لعرض إشعاراتك">
      <NotificationsInner />
    </RequireAuth>
  )
}

function NotificationsInner() {
  const go = useNav((s) => s.go)
  const qc = useQueryClient()
  const { isAdmin } = useSession()
  const { refresh } = useLogin()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ notifications: AppNotification[]; unread: number }>('/api/notifications'),
  })

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api.post('/api/notifications', ids && ids.length > 0 ? { ids } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      refresh()
    },
  })

  const onNotificationClick = (n: AppNotification) => {
    if (!n.read) markRead.mutate([n.id])
    if (!n.linkView) return
    // روابط الإدارة تُفتح للإداريين فقط
    if (n.linkView.startsWith('admin-')) {
      if (!isAdmin) return
      go(n.linkView, n.linkParam ? { id: n.linkParam } : undefined)
      return
    }
    go(n.linkView, n.linkParam ? { id: n.linkParam } : undefined)
  }

  const unread = data?.unread ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <BellRing className="size-6 text-emerald-600" aria-hidden />
          الإشعارات
          {unread > 0 && (
            <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-sm font-bold text-white">{unread}</span>
          )}
        </h1>
        {unread > 0 && (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={markRead.isPending}
            onClick={() => {
              markRead.mutate(undefined)
              toast.success('تم تعليم الكل كمقروء')
            }}
          >
            <CheckCheck className="size-4" aria-hidden />
            تعليم الكل كمقروء
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل الإشعارات'} retry={() => refetch()} />
      ) : data.notifications.length === 0 ? (
        <EmptyState icon="🔔" title="لا توجد إشعارات" subtitle="ستصلك هنا تحديثات طلباتك ودفعاتك" />
      ) : (
        <ul className="max-h-[70vh] space-y-2 overflow-y-auto pe-1 scrollbar-thin" aria-label="قائمة الإشعارات">
          {data.notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onNotificationClick(n)}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-2xl border p-4 text-start transition-colors',
                  n.read ? 'bg-card' : 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/40',
                  n.linkView && 'hover:border-emerald-500'
                )}
                aria-label={n.title}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold">{n.title}</span>
                  {!n.read && <span className="size-2.5 shrink-0 rounded-full bg-emerald-600" aria-label="غير مقروء" />}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{n.body}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

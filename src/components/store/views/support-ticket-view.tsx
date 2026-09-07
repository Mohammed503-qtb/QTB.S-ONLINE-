'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Headphones, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { statusColor, timeAgo, ticketStatusLabel } from '@/lib/client/format'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { ticketCategoryLabel } from '../utils'
import type { SupportTicket } from '../types'

// ============================================================
// محادثة تذكرة الدعم — فقاعات رسائل + رد العميل
// ============================================================

export function SupportTicketView({ id }: { id: string }) {
  return (
    <RequireAuth title="سجّل الدخول لعرض التذكرة">
      <SupportTicketInner id={id} />
    </RequireAuth>
  )
}

function SupportTicketInner({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['support-ticket', id],
    queryFn: () => api.get<SupportTicket>(`/api/support/${encodeURIComponent(id)}`),
    enabled: id.length > 0,
    refetchInterval: 15_000, // تحديث دوري خفيف للمحادثة
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [data?.messages.length])

  const reply = useMutation({
    mutationFn: () => api.post(`/api/support/${encodeURIComponent(id)}`, { message: message.trim() }),
    onSuccess: () => {
      setMessage('')
      qc.invalidateQueries({ queryKey: ['support-ticket', id] })
      qc.invalidateQueries({ queryKey: ['support-tickets'] })
      toast.success('تم إرسال ردك')
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'تعذر الإرسال'),
  })

  if (!id) return <ErrorState message="لم يتم تحديد تذكرة" />

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-24 w-3/4 rounded-2xl" />
        <Skeleton className="ms-auto h-16 w-1/2 rounded-2xl" />
      </div>
    )
  }
  if (error || !data) return <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل التذكرة'} retry={() => refetch()} />

  const isClosed = ['RESOLVED', 'CLOSED'].includes(data.status)

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-4" style={{ minHeight: 'calc(100vh - 10rem)' }}>
      {/* رأس التذكرة */}
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
        <button type="button" onClick={() => go('support')} className="min-h-9 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-400">
          ← كل التذاكر
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 font-extrabold">
            <Headphones className="size-5 text-emerald-600" aria-hidden />
            <span className="font-mono" dir="ltr">{data.ticketNumber}</span>
          </h1>
          <span className={cn('rounded-full px-3 py-0.5 text-xs font-bold', statusColor(data.status))}>{ticketStatusLabel(data.status)}</span>
        </div>
        <p className="font-semibold">{data.subject}</p>
        <p className="text-xs text-muted-foreground">
          {ticketCategoryLabel(data.category)} · فُتحت {timeAgo(data.createdAt)}
        </p>
      </div>

      {/* المحادثة */}
      <div className="my-4 flex-1 space-y-3 overflow-y-auto" role="log" aria-label="محادثة التذكرة">
        {data.messages.length === 0 && <p className="text-center text-sm text-muted-foreground">لا رسائل بعد</p>}
        {data.messages.map((msg) => {
          const isCustomer = msg.senderType === 'CUSTOMER'
          return (
            <div key={msg.id} className={cn('flex gap-2', isCustomer ? 'justify-start' : 'justify-end')}>
              {!isCustomer && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Headphones className="size-4" aria-hidden />
                </span>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm',
                  isCustomer
                    ? 'bg-muted text-foreground'
                    : 'bg-emerald-700 text-white dark:bg-emerald-600'
                )}
              >
                <p className="mb-0.5 text-[11px] font-bold opacity-70">{msg.senderName}{isCustomer ? ' (أنت)' : ' — الدعم'}</p>
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p className="mt-1 text-[10px] opacity-60">{timeAgo(msg.createdAt)}</p>
              </div>
              {isCustomer && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="size-4 text-muted-foreground" aria-hidden />
                </span>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* الرد */}
      {isClosed ? (
        <p className="rounded-2xl border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          هذه التذكرة مغلقة — افتح تذكرة جديدة إن احتجت مساعدة
        </p>
      ) : (
        <div className="sticky bottom-20 space-y-2 rounded-2xl border bg-card p-3 shadow-lg lg:bottom-2">
          <Textarea
            rows={2}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب ردك هنا..."
            aria-label="نص الرد"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
                e.preventDefault()
                reply.mutate()
              }
            }}
          />
          <Button
            className="min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            disabled={!message.trim() || reply.isPending}
            onClick={() => reply.mutate()}
          >
            <Send className="size-4" aria-hidden />
            {reply.isPending ? 'جارِ الإرسال...' : 'إرسال الرد'}
          </Button>
        </div>
      )}
    </div>
  )
}

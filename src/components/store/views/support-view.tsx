'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Headphones, MessageSquare, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { statusColor, timeAgo, ticketStatusLabel } from '@/lib/client/format'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { ticketCategoryLabel } from '../utils'
import type { SupportTicket } from '../types'

// ============================================================
// الدعم الفني — قائمة التذاكر + إنشاء تذكرة جديدة
// ============================================================

const TICKET_CATEGORIES = [
  { value: 'ORDER', label: 'استفسار عن طلب' },
  { value: 'PAYMENT', label: 'مشكلة دفع' },
  { value: 'RETURN', label: 'إرجاع واستبدال' },
  { value: 'SHIPPING', label: 'شحن وتوصيل' },
  { value: 'OTHER', label: 'أخرى' },
] as const

export function SupportView() {
  return (
    <RequireAuth title="سجّل الدخول لعرض تذاكر الدعم">
      <SupportInner />
    </RequireAuth>
  )
}

function SupportInner() {
  const go = useNav((s) => s.go)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => api.get<SupportTicket[]>('/api/support'),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Headphones className="size-6 text-emerald-600" aria-hidden />
          الدعم الفني
        </h1>
        <Button className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          تذكرة جديدة
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل التذاكر'} retry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="💬"
          title="لا توجد تذاكر دعم"
          subtitle="افتح تذكرة وسيرد فريقنا في أسرع وقت"
          action={
            <Button onClick={() => setCreateOpen(true)} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
              <Plus className="size-4" aria-hidden />
              فتح تذكرة
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((ticket) => {
            const lastMessage = ticket.messages[ticket.messages.length - 1]
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => go('support-ticket', { id: ticket.id })}
                className="block w-full rounded-2xl border bg-card p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600"
                aria-label={`تذكرة ${ticket.ticketNumber}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold">
                    <span className="font-mono" dir="ltr">{ticket.ticketNumber}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{ticketCategoryLabel(ticket.category)}</span>
                  </span>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', statusColor(ticket.status))}>
                    {ticketStatusLabel(ticket.status)}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold">{ticket.subject}</p>
                {lastMessage && (
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                    {lastMessage.body}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">آخر تحديث {timeAgo(ticket.updatedAt)}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* إنشاء تذكرة */}
      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />
    </div>
  )
}

function CreateTicketDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const qc = useQueryClient()
  const [category, setCategory] = useState<string>('ORDER')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => api.post<{ id: string; ticketNumber: string }>('/api/support', { category, subject: subject.trim(), message: message.trim() }),
    onSuccess: (res) => {
      toast.success(`تم فتح التذكرة ${res.ticketNumber}`)
      qc.invalidateQueries({ queryKey: ['support-tickets'] })
      onCreated()
      onOpenChange(false)
      setSubject('')
      setMessage('')
      setError(null)
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر فتح التذكرة'
      setError(msg)
      toast.error(msg)
    },
  })

  const submit = () => {
    setError(null)
    if (subject.trim().length < 3) return setError('الموضوع مطلوب (3 أحرف على الأقل)')
    if (message.trim().length < 3) return setError('نص الرسالة مطلوب')
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError(null) }}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تذكرة دعم جديدة</DialogTitle>
          <DialogDescription>صف مشكلتك وسيتواصل معك فريق الدعم</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>نوع المشكلة</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">الموضوع *</Label>
            <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="مثال: تأخر وصول الطلب" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">الرسالة *</Label>
            <Textarea id="ticket-message" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اشرح التفاصيل..." />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" disabled={create.isPending} onClick={submit}>
              <Send className="size-4" aria-hidden />
              {create.isPending ? 'جارِ الإرسال...' : 'إرسال'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

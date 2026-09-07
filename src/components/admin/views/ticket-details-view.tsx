'use client'

// ============================================================
// تفاصيل التذكرة — محادثة + رد + تغيير حالة
// ============================================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, LifeBuoy, User } from 'lucide-react'
import { api } from '@/lib/client/api'
import { ticketStatusLabel, dateTimeFmt, timeAgo } from '@/lib/client/format'
import { TICKET_STATUSES } from '@/lib/shared/constants'
import { useNav } from '@/lib/client/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState, FullSpinner } from '@/components/app/spinner'
import { PageHeader, StatusBadge, TICKET_CATEGORY_LABELS, useApiMutation, usePerm } from '@/components/admin/components/kit'
import type { TicketDetailResponse } from '@/components/admin/types'

export function TicketDetailsView({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const back = useNav((s) => s.back)
  const { can } = usePerm()

  const [reply, setReply] = useState('')
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState('')

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['admin-ticket', id],
    queryFn: () => api.get<TicketDetailResponse>(`/api/admin/tickets/${encodeURIComponent(id)}`),
    enabled: !!id,
  })

  const sendMutation = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post(`/api/admin/tickets/${encodeURIComponent(id)}`, body),
    {
      success: (res, vars) => (vars.message ? 'أُرسل الرد للعميل' : 'حُدّثت حالة التذكرة'),
      invalidate: [['admin-ticket', id], ['admin-tickets'], ['admin-operations']],
      onDone: () => { setReply(''); setStatus('') },
    }
  )

  if (!id) return <ErrorState message="معرّف التذكرة غير صالح" retry={() => go('admin-tickets')} />
  if (isLoading) return <FullSpinner label="جارِ تحميل التذكرة..." />
  if (queryError || !data) return <ErrorState message={queryError?.message} retry={refetch} />

  const canManage = can('support.manage')
  const closed = data.status === 'CLOSED' || data.status === 'RESOLVED'

  const submit = async (withMessage: boolean) => {
    setError('')
    if (withMessage && reply.trim().length < 1) return setError('اكتب نص الرد أولًا')
    if (!withMessage && !status) return setError('اختر حالة جديدة')
    await sendMutation.mutateAsync({
      ...(withMessage ? { message: reply.trim() } : {}),
      ...(status ? { status } : {}),
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`التذكرة ${data.ticketNumber}`}
        description={`${data.subject} · ${TICKET_CATEGORY_LABELS[data.category] ?? data.category} · ${timeAgo(data.createdAt)}`}
        onBack={() => (back ? back() : go('admin-tickets'))}
        actions={<StatusBadge status={data.status} label={ticketStatusLabel(data.status)} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* بيانات التذكرة */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 border-b pb-3">
              <LifeBuoy className="size-4 text-primary" />
              <h2 className="font-bold text-sm">بيانات التذكرة</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2.5">
                <User className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{data.customer?.user.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{data.customer?.user.phone ?? '—'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => go('admin-customer-details', { id: data.customer?.user.phone ?? '' })}>
                ملف العميل
              </Button>
              <p className="text-xs text-muted-foreground">فتحت: {dateTimeFmt(data.createdAt)}</p>
              <p className="text-xs text-muted-foreground">آخر تحديث: {dateTimeFmt(data.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* المحادثة */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <h2 className="font-bold text-sm">المحادثة ({data.messages.length})</h2>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pe-1">
              {data.messages.map((m) => {
                const isStaff = m.senderType === 'STAFF'
                return (
                  <div key={m.id} className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm space-y-1 ${
                        isStaff
                          ? 'bg-primary/10 border border-primary/20 rounded-ts-sm'
                          : 'bg-muted rounded-te-sm'
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {m.senderName} · {timeAgo(m.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap break-words leading-6">{m.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* الرد */}
            {canManage && !closed && (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-2">
                  <Label htmlFor="tk-reply">رد جديد</Label>
                  <Textarea
                    id="tk-reply"
                    value={reply}
                    onChange={(e) => { setReply(e.target.value); setError('') }}
                    rows={3}
                    placeholder="اكتب ردك على العميل..."
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="tk-status">الحالة بعد الإرسال (اختياري)</Label>
                    <Select value={status || undefined} onValueChange={(v) => setStatus(v)}>
                      <SelectTrigger id="tk-status" className="w-full">
                        <SelectValue placeholder="افتراضي: بانتظار العميل" />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUSES.filter((s) => s !== data.status).map((s) => (
                          <SelectItem key={s} value={s}>{ticketStatusLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button className="gap-1.5" onClick={() => submit(true)} disabled={sendMutation.isPending}>
                      <Send className="size-4" /> إرسال الرد
                    </Button>
                    {status && (
                      <Button variant="outline" onClick={() => submit(false)} disabled={sendMutation.isPending}>
                        تغيير الحالة فقط
                      </Button>
                    )}
                  </div>
                </div>
                {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              </div>
            )}

            {closed && (
              <p className="text-sm text-muted-foreground border-t pt-3">
                التذكرة {data.status === 'RESOLVED' ? 'تم حلها' : 'مغلقة'} — لا يمكن الرد عليها.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

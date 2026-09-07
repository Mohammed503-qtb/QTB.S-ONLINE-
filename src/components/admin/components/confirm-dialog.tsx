'use client'

// ============================================================
// حوار تأكيد موحد — مع سبب إلزامي اختياري (إلغاء طلب / رفض دفعة ...)
// ============================================================

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/app/spinner'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'تأكيد',
  danger = false,
  requireReason = false,
  reasonLabel = 'السبب',
  reasonPlaceholder = 'اكتب السبب...',
  reasonOptions,
  noteField = false,
  noteLabel = 'ملاحظة (اختياري)',
  extra,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  requireReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
  reasonOptions?: readonly string[]
  noteField?: boolean
  noteLabel?: string
  extra?: React.ReactNode
  onConfirm: (payload: { reason: string; note: string }) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setNote('')
      setErr('')
      setBusy(false)
    }
  }, [open])

  const submit = async () => {
    if (requireReason && reason.trim().length < 3) {
      setErr('هذا الحقل إلزامي (3 أحرف على الأقل)')
      return
    }
    setBusy(true)
    try {
      await onConfirm({ reason: reason.trim(), note: note.trim() })
      onOpenChange(false)
    } catch {
      // الخطأ يُعرض toast عبر useApiMutation
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {danger && <AlertTriangle className="size-5 text-rose-600" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {extra}
          {requireReason && (
            <div className="space-y-2">
              <Label htmlFor="confirm-reason">
                {reasonLabel} <span className="text-rose-600">*</span>
              </Label>
              {reasonOptions && reasonOptions.length > 0 ? (
                <Select value={reason || undefined} onValueChange={(v) => { setReason(v); setErr('') }}>
                  <SelectTrigger id="confirm-reason" className="w-full">
                    <SelectValue placeholder="اختر السبب" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Textarea
                  id="confirm-reason"
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setErr('') }}
                  placeholder={reasonPlaceholder}
                  rows={2}
                />
              )}
              {err && <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>}
            </div>
          )}
          {noteField && (
            <div className="space-y-2">
              <Label htmlFor="confirm-note">{noteLabel}</Label>
              <Input id="confirm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة تُسجل في السجل..." />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            إلغاء
          </Button>
          <Button variant={danger ? 'destructive' : 'default'} onClick={submit} disabled={busy}>
            {busy && <Spinner className="size-4" />}
            {busy ? 'جارِ التنفيذ...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

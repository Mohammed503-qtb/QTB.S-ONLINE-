'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ============================================================
// صندوق كود كبير قابل للنسخ (ORD-/PAY-/TRK-)
// ============================================================

export function CodeBox({ code, label, className }: { code: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(`تم نسخ ${label}`)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('تعذر النسخ — انسخ الرقم يدويًا')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`نسخ ${label}`}
      className={cn(
        'group flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 px-3 py-2.5 text-start transition-colors hover:border-emerald-500 hover:bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60',
        className
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span dir="ltr" className="block truncate font-mono text-base font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
          {code}
        </span>
      </span>
      {copied ? (
        <Check className="size-5 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="size-5 shrink-0 text-emerald-600/60 transition-colors group-hover:text-emerald-600" aria-hidden />
      )}
    </button>
  )
}

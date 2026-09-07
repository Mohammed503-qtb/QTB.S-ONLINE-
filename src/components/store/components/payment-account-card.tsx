'use client'

import { useState } from 'react'
import { Building2, Copy, Check, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PaymentAccount } from '../types'

// ============================================================
// بطاقة حساب دفع (بنك/محفظة) — تُعرض في الشراء والدفع والنجاح
// ============================================================

export function PaymentAccountCard({ account, selected, onSelect, compact }: { account: PaymentAccount; selected?: boolean; onSelect?: () => void; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  const number = account.accountNumber || account.walletNumber || account.iban || ''
  const isWallet = account.type === 'WALLET'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number)
      setCopied(true)
      toast.success('تم نسخ رقم الحساب')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('تعذر النسخ — انسخ يدويًا')
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm transition-colors',
        selected ? 'border-emerald-600 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/40' : 'bg-card',
        onSelect && 'cursor-pointer hover:border-emerald-400'
      )}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      aria-pressed={onSelect ? selected : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {isWallet ? <Wallet className="size-5" aria-hidden /> : <Building2 className="size-5" aria-hidden />}
          </span>
          <div>
            <p className="font-bold leading-tight">{account.institution}{account.branch ? ` — ${account.branch}` : ''}</p>
            <p className="text-xs text-muted-foreground">{account.name}</p>
          </div>
        </div>
        {selected !== undefined && (
          <span className={cn('size-5 shrink-0 rounded-full border-2', selected ? 'border-emerald-600 bg-emerald-600' : 'border-muted')} aria-hidden />
        )}
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">المستفيد</dt>
          <dd className="font-medium">{account.beneficiary}</dd>
        </div>
        {account.accountNumber && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{isWallet ? 'رقم الحساب' : 'رقم الحساب'}</dt>
            <dd className="flex items-center gap-1.5 font-mono font-bold" dir="ltr">
              {account.accountNumber}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  copy()
                }}
                aria-label="نسخ رقم الحساب"
                className="rounded-md p-1 text-emerald-700 transition-colors hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900"
              >
                {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              </button>
            </dd>
          </div>
        )}
        {account.walletNumber && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">رقم المحفظة</dt>
            <dd className="flex items-center gap-1.5 font-mono font-bold" dir="ltr">
              {account.walletNumber}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  copy()
                }}
                aria-label="نسخ رقم المحفظة"
                className="rounded-md p-1 text-emerald-700 transition-colors hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900"
              >
                {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              </button>
            </dd>
          </div>
        )}
        {account.iban && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">IBAN</dt>
            <dd className="font-mono text-xs" dir="ltr">{account.iban}</dd>
          </div>
        )}
        {!compact && account.instructions && (
          <p className="rounded-xl bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">{account.instructions}</p>
        )}
      </dl>
    </div>
  )
}

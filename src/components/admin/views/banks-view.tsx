'use client'

// ============================================================
// الحسابات البنكية + الحركات — tabs (الحسابات/الحركات) + إنشاء
// حساب + حركة يدوية (تحويل داخل/خارج، تسوية، رسوم) + إجماليات
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Landmark, Plus, Wallet } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, dateTimeFmt } from '@/lib/client/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { BANK_TYPE_LABELS, PageHeader, Pager, StatCard, StatusBadge, TXN_TYPE_LABELS, useApiMutation, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import type { BankAccountRow, BankTxnRow } from '@/components/admin/types'

type BanksResponse = {
  accounts: BankAccountRow[]
  transactions: BankTxnRow[]
  total: number
  page: number
  pages: number
  typeTotals: { type: string; direction: string; total: number }[]
}

const TXN_TYPES = ['TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'FEE', 'EXPENSE'] as const

export function BanksView() {
  const { can } = usePerm()
  const [tab, setTab] = useState<'accounts' | 'transactions'>('accounts')

  const [accountId, setAccountId] = useState('')
  const [txnType, setTxnType] = useState('')
  const [page, setPage] = useState(1)

  const [accountForm, setAccountForm] = useState<{ name: string; institution: string; type: string; accountNumber: string; beneficiary: string; openingBalance: string } | null>(null)
  const [accountError, setAccountError] = useState('')

  const [txnForm, setTxnForm] = useState<{ bankAccountId: string; direction: 'IN' | 'OUT'; amount: string; txnType: string; description: string; date: string } | null>(null)
  const [txnError, setTxnError] = useState('')

  const query = useQuery({
    queryKey: ['admin-banks', { accountId, txnType, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '30' })
      if (accountId) sp.set('accountId', accountId)
      if (txnType) sp.set('txnType', txnType)
      return api.get<BanksResponse>(`/api/admin/banks?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const createAccount = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/banks', { action: 'create_account', ...body }),
    {
      success: 'تم إنشاء الحساب البنكي (مع تسجيل الرصيد الافتتاحي)',
      invalidate: [['admin-banks'], ['admin-dashboard'], ['admin-banks-lite']],
      onDone: () => setAccountForm(null),
    }
  )

  const createTxn = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/banks', { action: 'create_transaction', ...body }),
    {
      success: 'تم تسجيل الحركة البنكية',
      invalidate: [['admin-banks'], ['admin-banks-lite'], ['admin-dashboard']],
      onDone: () => setTxnForm(null),
    }
  )

  const toggleAccount = useApiMutation<{ id: string; active: boolean }, unknown>(
    (v) => api.post('/api/admin/banks', { action: 'update_account', id: v.id, active: v.active }),
    {
      success: (res, v) => (v.active ? 'تم تنشيط الحساب' : 'تم تعطيل الحساب'),
      invalidate: [['admin-banks'], ['admin-banks-lite']],
    }
  )

  const accounts = query.data?.accounts ?? []
  const transactions = query.data?.transactions ?? []
  const canManage = can('bank.manage')
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0)

  const submitAccount = async () => {
    if (!accountForm) return
    setAccountError('')
    if (accountForm.name.trim().length < 2) return setAccountError('اسم الحساب مطلوب')
    if (accountForm.institution.trim().length < 2) return setAccountError('اسم الجهة مطلوب')
    if (accountForm.accountNumber.trim().length < 2) return setAccountError('رقم الحساب مطلوب')
    if (accountForm.beneficiary.trim().length < 2) return setAccountError('اسم المستفيد مطلوب')
    await createAccount.mutateAsync({
      name: accountForm.name.trim(),
      institution: accountForm.institution.trim(),
      type: accountForm.type,
      accountNumber: accountForm.accountNumber.trim(),
      beneficiary: accountForm.beneficiary.trim(),
      openingBalance: Number(accountForm.openingBalance) || 0,
      active: true,
    })
  }

  const submitTxn = async () => {
    if (!txnForm) return
    setTxnError('')
    const amount = Number(txnForm.amount)
    if (!txnForm.bankAccountId) return setTxnError('اختر الحساب البنكي')
    if (!Number.isFinite(amount) || amount < 1) return setTxnError('أدخل مبلغًا صحيحًا (1 على الأقل)')
    if (txnForm.description.trim().length < 2) return setTxnError('الوصف مطلوب')
    await createTxn.mutateAsync({
      bankAccountId: txnForm.bankAccountId,
      direction: txnForm.direction,
      amount,
      txnType: txnForm.txnType,
      description: txnForm.description.trim(),
      date: txnForm.date || undefined,
    })
  }

  const accountColumns: Column<BankAccountRow>[] = [
    {
      key: 'account',
      header: 'الحساب',
      cell: (a) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-44">{a.name}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-44">{a.institution} · {BANK_TYPE_LABELS[a.type] ?? a.type}</p>
        </div>
      ),
    },
    {
      key: 'number',
      header: 'رقم الحساب',
      cell: (a) => <span className="text-xs" dir="ltr">{a.accountNumber}</span>,
    },
    {
      key: 'beneficiary',
      header: 'المستفيد',
      cell: (a) => <span className="text-sm truncate max-w-32">{a.beneficiary}</span>,
    },
    {
      key: 'balance',
      header: 'الرصيد الحالي',
      cell: (a) => <span className="text-sm font-bold tabular-nums">{money(a.currentBalance)}</span>,
    },
    {
      key: 'txnCount',
      header: 'الحركات',
      cell: (a) => <span className="text-xs text-muted-foreground tabular-nums">{a._count?.transactions ?? 0}</span>,
    },
    {
      key: 'active',
      header: 'نشط',
      cell: (a) => (
        <span className={`text-xs font-semibold ${a.active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
          {a.active ? 'نشط' : 'معطّل'}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'toggle',
            header: 'تفعيل',
            cell: (a: BankAccountRow) => (
              <div data-no-row-click>
                <Switch checked={a.active} onCheckedChange={(v) => toggleAccount.mutate({ id: a.id, active: v })} aria-label={`تفعيل ${a.name}`} />
              </div>
            ),
          } satisfies Column<BankAccountRow>,
        ]
      : []),
  ]

  const txnColumns: Column<BankTxnRow>[] = [
    {
      key: 'txn',
      header: 'الحركة',
      cell: (t) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{t.txnNumber}</p>
          <p className="text-[11px] text-muted-foreground">{dateTimeFmt(t.date)}</p>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'الحساب',
      cell: (t) => (
        <div className="min-w-0">
          <p className="text-sm truncate max-w-36">{t.bankAccount?.name ?? '—'}</p>
          <p className="text-[11px] text-muted-foreground truncate max-w-36">{t.bankAccount?.institution ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      cell: (t) => <StatusBadge status={t.direction === 'IN' ? 'VERIFIED' : 'EXPENSE'} label={TXN_TYPE_LABELS[t.txnType] ?? t.txnType} />,
    },
    {
      key: 'direction',
      header: 'الاتجاه',
      cell: (t) =>
        t.direction === 'IN' ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <ArrowDownLeft className="size-3.5" /> داخل
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <ArrowUpRight className="size-3.5" /> خارج
          </span>
        ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      cell: (t) => (
        <span className={`text-sm font-bold tabular-nums ${t.direction === 'IN' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {t.direction === 'IN' ? '+' : '-'}{money(t.amount)}
        </span>
      ),
    },
    {
      key: 'desc',
      header: 'الوصف',
      cell: (t) => (
        <div className="min-w-0">
          <p className="text-xs truncate max-w-52">{t.description}</p>
          {t.refNumber && <p className="text-[10px] text-muted-foreground" dir="ltr">{t.refNumber}</p>}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="الحسابات البنكية"
        description={`إجمالي الأرصدة: ${money(totalBalance)}`}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => { setTxnError(''); setTxnForm({ bankAccountId: '', direction: 'IN', amount: '', txnType: 'TRANSFER_IN', description: '', date: '' }) }}>
                <Plus className="size-4" /> حركة يدوية
              </Button>
              <Button className="gap-1.5" onClick={() => { setAccountError(''); setAccountForm({ name: '', institution: '', type: 'BANK', accountNumber: '', beneficiary: '', openingBalance: '0' }) }}>
                <Landmark className="size-4" /> حساب جديد
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* إجماليات حسب النوع */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(query.data?.typeTotals ?? []).slice(0, 8).map((t) => (
          <StatCard
            key={t.type + t.direction}
            title={`${TXN_TYPE_LABELS[t.type] ?? t.type} (${t.direction === 'IN' ? 'داخل' : 'خارج'})`}
            value={money(t.total)}
            tone={t.direction === 'IN' ? 'primary' : 'info'}
            icon={t.direction === 'IN' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
          />
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'accounts' | 'transactions')}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="accounts" className="gap-1.5 flex-1 sm:flex-none">
            <Landmark className="size-4" /> الحسابات ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5 flex-1 sm:flex-none">
            <Wallet className="size-4" /> الحركات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-3">
          <Card>
            <CardContent>
              <DataTable
                columns={accountColumns}
                rows={accounts}
                loading={query.isLoading}
                error={query.error}
                onRetry={() => query.refetch()}
                emptyIcon="🏦"
                emptyTitle="لا توجد حسابات بنكية"
                compact
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-3 space-y-3">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={accountId || '__all__'} onValueChange={(v) => { setAccountId(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="sm:w-56 w-full"><SelectValue placeholder="كل الحسابات" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">كل الحسابات</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={txnType || '__all__'} onValueChange={(v) => { setTxnType(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="sm:w-56 w-full"><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">كل الأنواع</SelectItem>
                    {Object.keys(TXN_TYPE_LABELS).map((t) => (
                      <SelectItem key={t} value={t}>{TXN_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DataTable
                columns={txnColumns}
                rows={transactions}
                loading={query.isLoading}
                error={query.error}
                onRetry={() => query.refetch()}
                emptyIcon="💰"
                emptyTitle="لا توجد حركات بنكية"
                compact
                footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* حوار إنشاء حساب */}
      <Dialog open={accountForm !== null} onOpenChange={(v) => { if (!createAccount.isPending && !v) setAccountForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="size-5 text-primary" />
              حساب بنكي جديد
            </DialogTitle>
            <DialogDescription>الرصيد الافتتاحي يُسجل كحركة موثقة (الرصيد مشتق من الحركات).</DialogDescription>
          </DialogHeader>
          {accountForm && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="ba-name">اسم الحساب *</Label>
                <Input id="ba-name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="مثال: حساب البنك الرئيسي" />
              </div>
              <div className="space-y-2">
                <Label>النوع *</Label>
                <Select value={accountForm.type} onValueChange={(v) => setAccountForm({ ...accountForm, type: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BANK_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ba-inst">الجهة (بنك/محفظة) *</Label>
                <Input id="ba-inst" value={accountForm.institution} onChange={(e) => setAccountForm({ ...accountForm, institution: e.target.value })} placeholder="مثال: بنك التضامن" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ba-num">رقم الحساب *</Label>
                  <Input id="ba-num" value={accountForm.accountNumber} onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ba-open">رصيد افتتاحي</Label>
                  <Input id="ba-open" type="number" inputMode="numeric" value={accountForm.openingBalance} onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ba-ben">المستفيد *</Label>
                <Input id="ba-ben" value={accountForm.beneficiary} onChange={(e) => setAccountForm({ ...accountForm, beneficiary: e.target.value })} placeholder="مثال: متجر الأصيل" />
              </div>
              {accountError && <p className="text-sm text-rose-600 dark:text-rose-400">{accountError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountForm(null)} disabled={createAccount.isPending}>إلغاء</Button>
            <Button onClick={submitAccount} disabled={createAccount.isPending}>إنشاء الحساب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار حركة يدوية */}
      <Dialog open={txnForm !== null} onOpenChange={(v) => { if (!createTxn.isPending && !v) setTxnForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>حركة بنكية يدوية</DialogTitle>
            <DialogDescription>تحويلات داخلية/خارجية، تسويات ورسوم — بحركة موثقة في التدقيق.</DialogDescription>
          </DialogHeader>
          {txnForm && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>الحساب *</Label>
                <Select value={txnForm.bankAccountId || undefined} onValueChange={(v) => setTxnForm({ ...txnForm, bankAccountId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.active).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} — {a.institution}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الاتجاه *</Label>
                <RadioGroup value={txnForm.direction} onValueChange={(v) => setTxnForm({ ...txnForm, direction: v as 'IN' | 'OUT' })} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="IN" id="dir-in" />
                    <Label htmlFor="dir-in" className="cursor-pointer text-sm">داخل (إيداع)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="OUT" id="dir-out" />
                    <Label htmlFor="dir-out" className="cursor-pointer text-sm">خارج (سحب)</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bt-type">النوع *</Label>
                  <Select value={txnForm.txnType} onValueChange={(v) => setTxnForm({ ...txnForm, txnType: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TXN_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{TXN_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bt-amount">المبلغ *</Label>
                  <Input id="bt-amount" type="number" inputMode="numeric" min={1} value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bt-desc">الوصف *</Label>
                <Input id="bt-desc" value={txnForm.description} onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })} placeholder="مثال: إيداع نقدي من الصندوق" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bt-date">التاريخ (اختياري)</Label>
                <Input id="bt-date" type="date" value={txnForm.date} onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })} />
              </div>
              {txnError && <p className="text-sm text-rose-600 dark:text-rose-400">{txnError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnForm(null)} disabled={createTxn.isPending}>إلغاء</Button>
            <Button onClick={submitTxn} disabled={createTxn.isPending}>تسجيل الحركة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

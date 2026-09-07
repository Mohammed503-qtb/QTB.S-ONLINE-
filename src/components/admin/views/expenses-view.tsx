'use client'

// ============================================================
// المصروفات — جدول + فلاتر (تاريخ/تصنيف) + إجماليات byCategory
// + إنشاء (تصنيف/وصف/مبلغ/حساب بنكي أو نقدًا/إيصال upload)
// ============================================================

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Plus, ReceiptText } from 'lucide-react'
import { api } from '@/lib/client/api'
import { money, dateFmt, dateTimeFmt } from '@/lib/client/format'
import { EXPENSE_CATEGORIES } from '@/lib/shared/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Pager, SearchInput, StatCard, UploadField, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { SmartImage } from '@/components/admin/components/kit'
import type { ExpenseRow } from '@/components/admin/types'

type ExpensesResponse = {
  total: number; page: number; pages: number
  expenses: ExpenseRow[]
  totalAmount: number
  byCategory: { category: string; total: number }[]
  accounts: { id: string; name: string }[]
  categories: string[]
}

export function ExpensesView() {
  const { can } = usePerm()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const [form, setForm] = useState<{ category: string; description: string; amount: string; bankAccountId: string; date: string; receiptUrl: string } | null>(null)
  const [formError, setFormError] = useState('')

  const query = useQuery({
    queryKey: ['admin-expenses', { search: debouncedSearch, category, from, to, page }],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), limit: '20' })
      if (category) sp.set('category', category)
      if (from) sp.set('from', from)
      if (to) sp.set('to', to)
      // البحث نصي على صفحة العميل (الخادم لا يدعم search هنا)
      return api.get<ExpensesResponse>(`/api/admin/expenses?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const createMutation = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/expenses', body),
    {
      success: 'تم تسجيل المصروف (مع أثر بنكي إن كان من حساب)',
      invalidate: [['admin-expenses'], ['admin-banks'], ['admin-dashboard']],
      onDone: () => setForm(null),
    }
  )

  const rows = (query.data?.expenses ?? []).filter(
    (e) => !debouncedSearch.trim() || e.description.includes(debouncedSearch.trim()) || e.expenseNumber.includes(debouncedSearch.trim().toUpperCase())
  )

  const submit = async () => {
    if (!form) return
    setFormError('')
    if (!form.category) return setFormError('اختر التصنيف')
    if (form.description.trim().length < 3) return setFormError('الوصف مطلوب (3 أحرف على الأقل)')
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount < 1) return setFormError('أدخل مبلغًا صحيحًا (1 على الأقل)')
    await createMutation.mutateAsync({
      category: form.category,
      description: form.description.trim(),
      amount,
      bankAccountId: form.bankAccountId || null,
      date: form.date || undefined,
      receiptUrl: form.receiptUrl || null,
    })
  }

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'expense',
      header: 'المصروف',
      cell: (e) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold" dir="ltr">{e.expenseNumber}</p>
          <p className="text-xs text-muted-foreground truncate max-w-52">{e.description}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'التصنيف',
      cell: (e) => <span className="text-sm">{e.category}</span>,
    },
    {
      key: 'amount',
      header: 'المبلغ',
      cell: (e) => <span className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-400">{money(e.amount)}</span>,
    },
    {
      key: 'payment',
      header: 'الدفع',
      cell: (e) => {
        const acc = query.data?.accounts.find((a) => a.id === e.bankAccountId)
        return <span className="text-xs text-muted-foreground">{acc ? acc.name : 'نقدًا'}</span>
      },
    },
    {
      key: 'receipt',
      header: 'الإيصال',
      cell: (e) => (e.receiptUrl ? <SmartImage src={e.receiptUrl} alt={`إيصال ${e.expenseNumber}`} className="size-10" /> : <span className="text-xs text-muted-foreground">—</span>),
    },
    {
      key: 'date',
      header: 'التاريخ',
      cell: (e) => <span className="text-xs text-muted-foreground whitespace-nowrap">{dateFmt(e.date)}</span>,
    },
  ]

  const byCategory = query.data?.byCategory ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="المصروفات"
        description={query.data ? `الإجمالي: ${money(query.data.totalAmount)}` : 'تسجيل المصروفات التشغيلية'}
        actions={
          can('expenses.create') ? (
            <Button className="gap-1.5" onClick={() => { setFormError(''); setForm({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', bankAccountId: '', date: '', receiptUrl: '' }) }}>
              <Plus className="size-4" /> مصروف جديد
            </Button>
          ) : undefined
        }
      />

      {/* إجماليات حسب التصنيف */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {byCategory.slice(0, 8).map((c) => (
            <StatCard key={c.category} title={c.category} value={money(c.total)} tone="warning" icon={<ReceiptText className="size-4" />} />
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالوصف أو الرقم..." className="flex-1" />
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} aria-label="من تاريخ" className="sm:w-40" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} aria-label="إلى تاريخ" className="sm:w-40" />
            <Select value={category || '__all__'} onValueChange={(v) => { setCategory(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="sm:w-44 w-full"><SelectValue placeholder="كل التصنيفات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل التصنيفات</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyIcon="🧾"
            emptyTitle="لا توجد مصروفات"
            compact
            footer={<Pager page={query.data?.page ?? 1} pages={query.data?.pages ?? 1} onChange={setPage} />}
          />
        </CardContent>
      </Card>

      {/* إنشاء مصروف */}
      <Dialog open={form !== null} onOpenChange={(v) => { if (!createMutation.isPending && !v) setForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-primary" />
              مصروف جديد
            </DialogTitle>
            <DialogDescription>إن اخترت حسابًا بنكيًا يُسجل سحب تلقائي منه؛ و«نقدًا» بدون أثر بنكي.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>التصنيف *</Label>
                <Select value={form.category || undefined} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex-desc">الوصف *</Label>
                <Input id="ex-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: أجرة توصيل طلبات مارس" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ex-amount">المبلغ (ريال) *</Label>
                  <Input id="ex-amount" type="number" inputMode="numeric" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ex-date">التاريخ</Label>
                  <Input id="ex-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>مصروف من</Label>
                <Select value={form.bankAccountId || '__cash__'} onValueChange={(v) => setForm({ ...form, bankAccountId: v === '__cash__' ? '' : v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__cash__">نقدًا (بدون أثر بنكي)</SelectItem>
                    {(query.data?.accounts ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <UploadField label="إيصال المصروف" value={form.receiptUrl} onChange={(url) => setForm({ ...form, receiptUrl: url })} folder="expenses" />
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
              <p className="text-[11px] text-muted-foreground">سيُسجل المصروف الآن بتاريخ {form.date ? dateTimeFmt(form.date) : dateTimeFmt(new Date())}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={createMutation.isPending}>إلغاء</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>تسجيل المصروف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

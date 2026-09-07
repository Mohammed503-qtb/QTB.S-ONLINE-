'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { api, ApiClientError } from '@/lib/client/api'
import { useNav } from '@/lib/client/stores'
import { cn } from '@/lib/utils'
import { RequireAuth } from '../components/require-auth'
import { AddressForm } from '../components/address-form'
import type { Address } from '../types'

// ============================================================
// عناويني — CRUD كامل (إضافة/تعديل/حذف/تعيين افتراضي)
// ============================================================

export function AddressesView() {
  return (
    <RequireAuth title="سجّل الدخول لإدارة عناوينك">
      <AddressesInner />
    </RequireAuth>
  )
}

function AddressesInner() {
  const go = useNav((s) => s.go)
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editAddress, setEditAddress] = useState<Address | null>(null)
  const [deleteAddress, setDeleteAddress] = useState<Address | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<Address[]>('/api/addresses'),
  })

  const setDefault = useMutation({
    mutationFn: (addr: Address) => api.put<Address>(`/api/addresses/${addr.id}`, { isDefault: true }),
    onSuccess: () => {
      toast.success('تم تعيين العنوان الافتراضي')
      qc.invalidateQueries({ queryKey: ['addresses'] })
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'تعذر التعيين'),
  })

  const remove = useMutation({
    mutationFn: (addr: Address) => api.del(`/api/addresses/${addr.id}`),
    onSuccess: () => {
      toast.success('تم حذف العنوان')
      setDeleteAddress(null)
      qc.invalidateQueries({ queryKey: ['addresses'] })
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'تعذر الحذف'),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">عناويني</h1>
        <Button className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden />
          عنوان جديد
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : error || !data ? (
        <ErrorState message={error instanceof Error ? error.message : 'تعذر تحميل العناوين'} retry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="📍"
          title="لا توجد عناوين محفوظة"
          subtitle="أضف عنوانك ليصلك الطلب بسهولة"
          action={
            <Button onClick={() => setAddOpen(true)} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
              <Plus className="size-4" aria-hidden />
              إضافة عنوان
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              onEdit={() => setEditAddress(addr)}
              onDelete={() => setDeleteAddress(addr)}
              onSetDefault={() => setDefault.mutate(addr)}
              settingDefault={setDefault.isPending}
            />
          ))}
        </div>
      )}

      <div className="pb-24 text-center lg:pb-0">
        <Button variant="link" className="min-h-11" onClick={() => go('cart')}>
          العودة للسلة
        </Button>
      </div>

      {/* إضافة */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>عنوان جديد</DialogTitle>
            <DialogDescription>أدخل تفاصيل عنوان التوصيل</DialogDescription>
          </DialogHeader>
          <AddressForm
            onDone={() => {
              setAddOpen(false)
              refetch()
            }}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* تعديل */}
      <Dialog open={!!editAddress} onOpenChange={(o) => !o && setEditAddress(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل العنوان</DialogTitle>
            <DialogDescription>{editAddress?.label}</DialogDescription>
          </DialogHeader>
          {editAddress && (
            <AddressForm
              address={editAddress}
              onDone={() => {
                setEditAddress(null)
                refetch()
              }}
              onCancel={() => setEditAddress(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* حذف */}
      <AlertDialog open={!!deleteAddress} onOpenChange={(o) => !o && setDeleteAddress(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العنوان؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف «{deleteAddress?.label}» نهائيًا ولا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row">
            <AlertDialogCancel className="min-h-11">تراجع</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-rose-600 hover:bg-rose-700"
              onClick={(e) => {
                e.preventDefault()
                if (deleteAddress) remove.mutate(deleteAddress)
              }}
            >
              {remove.isPending ? 'جارِ الحذف...' : 'حذف نهائي'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  settingDefault,
}: {
  address: Address
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  settingDefault: boolean
}) {
  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm',
        address.isDefault && 'border-emerald-500'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          <MapPin className="size-4 text-emerald-600" aria-hidden />
          {address.label}
          {address.isDefault && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              افتراضي
            </span>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {address.governorate}، {address.city}
        {address.district ? `، ${address.district}` : ''}
        {address.neighborhood ? `، حي ${address.neighborhood}` : ''}
        {address.street ? `، شارع ${address.street}` : ''}
        {address.landmark ? ` (${address.landmark})` : ''}
        <span dir="ltr" className="mt-1 block">{address.phone}</span>
        {address.notes && <span className="mt-1 block text-xs">{address.notes}</span>}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {!address.isDefault && (
          <Button variant="outline" size="sm" className="min-h-9" onClick={onSetDefault} disabled={settingDefault}>
            <Star className="size-4" aria-hidden />
            تعيين افتراضي
          </Button>
        )}
        <Button variant="outline" size="sm" className="min-h-9" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
          تعديل
        </Button>
        {!address.isDefault && (
          <Button variant="outline" size="sm" className="min-h-9 text-rose-600 hover:text-rose-700" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
            حذف
          </Button>
        )}
      </div>
    </article>
  )
}

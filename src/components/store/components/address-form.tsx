'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/client/api'
import { GOVERNORATES } from '@/lib/shared/constants'
import type { Address } from '../types'

// ============================================================
// نموذج عنوان (إضافة/تعديل) — مشترك بين العناوين والشراء
// ============================================================

export type AddressFormValues = {
  label: string
  governorate: string
  city: string
  district: string
  neighborhood: string
  street: string
  landmark: string
  phone: string
  notes: string
  isDefault: boolean
}

function emptyValues(): AddressFormValues {
  return { label: 'عنوان', governorate: '', city: '', district: '', neighborhood: '', street: '', landmark: '', phone: '', notes: '', isDefault: false }
}

function fromAddress(a: Address): AddressFormValues {
  return {
    label: a.label,
    governorate: a.governorate,
    city: a.city,
    district: a.district ?? '',
    neighborhood: a.neighborhood ?? '',
    street: a.street ?? '',
    landmark: a.landmark ?? '',
    phone: a.phone,
    notes: a.notes ?? '',
    isDefault: a.isDefault,
  }
}

export function AddressForm({
  address,
  onDone,
  onCancel,
}: {
  address?: Address // عند التعديل
  onDone: (saved: Address) => void
  onCancel?: () => void
}) {
  const qc = useQueryClient()
  const [values, setValues] = useState<AddressFormValues>(address ? fromAddress(address) : emptyValues())
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setError(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        label: values.label.trim() || 'عنوان',
        governorate: values.governorate,
        city: values.city.trim(),
        district: values.district.trim() || undefined,
        neighborhood: values.neighborhood.trim() || undefined,
        street: values.street.trim() || undefined,
        landmark: values.landmark.trim() || undefined,
        phone: values.phone.trim(),
        notes: values.notes.trim() || undefined,
        isDefault: values.isDefault,
      }
      if (address) return api.put<Address>(`/api/addresses/${address.id}`, payload)
      return api.post<Address>('/api/addresses', payload)
    },
    onSuccess: (saved) => {
      toast.success(address ? 'تم تحديث العنوان' : 'تمت إضافة العنوان')
      qc.invalidateQueries({ queryKey: ['addresses'] })
      onDone(saved)
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر حفظ العنوان'
      setError(msg)
      toast.error(msg)
    },
  })

  const submit = () => {
    if (!values.governorate) return setError('اختر المحافظة')
    if (values.city.trim().length < 2) return setError('أدخل اسم المدينة')
    if (!/^7\d{8}$/.test(values.phone.trim())) return setError('رقم الهاتف يجب أن يبدأ بـ 7 ويكون 9 أرقام')
    save.mutate()
  }

  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="addr-label">اسم العنوان</Label>
        <Input id="addr-label" value={values.label} onChange={(e) => set('label', e.target.value)} placeholder="المنزل / العمل" maxLength={40} />
      </div>
      <div className="space-y-1.5">
        <Label>المحافظة</Label>
        <Select value={values.governorate} onValueChange={(v) => set('governorate', v)}>
          <SelectTrigger className="min-h-11 w-full">
            <SelectValue placeholder="اختر المحافظة" />
          </SelectTrigger>
          <SelectContent>
            {GOVERNORATES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-city">المدينة *</Label>
        <Input id="addr-city" value={values.city} onChange={(e) => set('city', e.target.value)} placeholder="مثال: كريتر" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-district">المديرية</Label>
        <Input id="addr-district" value={values.district} onChange={(e) => set('district', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-neighborhood">الحي</Label>
        <Input id="addr-neighborhood" value={values.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-street">الشارع</Label>
        <Input id="addr-street" value={values.street} onChange={(e) => set('street', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-landmark">علامة مميزة</Label>
        <Input id="addr-landmark" value={values.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="قرب جامع / مدرسة ..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-phone">رقم الهاتف *</Label>
        <Input
          id="addr-phone"
          inputMode="numeric"
          dir="ltr"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="7xxxxxxxx"
          maxLength={9}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="addr-notes">ملاحظات للمندوب</Label>
        <Textarea id="addr-notes" value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={2} maxLength={300} />
      </div>
      <label className="flex min-h-11 items-center gap-2 sm:col-span-2" htmlFor="addr-default">
        <Checkbox id="addr-default" checked={values.isDefault} onCheckedChange={(c) => set('isDefault', c === true)} />
        <span className="text-sm">تعيين كعنوان افتراضي</span>
      </label>

      {error && <p className="text-sm font-medium text-rose-600 sm:col-span-2">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
            إلغاء
          </Button>
        )}
        <Button
          type="submit"
          disabled={save.isPending}
          className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          {save.isPending ? 'جارِ الحفظ...' : address ? 'حفظ التعديل' : 'إضافة العنوان'}
        </Button>
      </div>
    </form>
  )
}

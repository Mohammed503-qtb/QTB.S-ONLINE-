'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, KeyRound, Phone, Smartphone } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiClientError } from '@/lib/client/api'
import { useLogin } from '@/lib/client/session'
import { useUi, useNav } from '@/lib/client/stores'

// ============================================================
// تسجيل الدخول بالهاتف + OTP (خطوتان)
// وضع تجريبي: devCode يظهر في تنبيه ظاهر داخل المودال
// ============================================================

export function LoginModal() {
  const { loginOpen, loginReason, closeLogin } = useUi()
  const { refresh } = useLogin()

  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [needsName, setNeedsName] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // إعادة الضبط (تُستدعى عند الإغلاق — لا تأثيرات متتالية)
  const reset = () => {
    setStep(1)
    setPhone('')
    setCode('')
    setName('')
    setNeedsName(false)
    setDevCode(null)
    setError(null)
  }

  useEffect(() => {
    if (needsName) nameRef.current?.focus()
  }, [needsName])

  const requestOtp = useMutation({
    mutationFn: () => api.post<{ sent: boolean; devCode: string }>('/api/auth/request-otp', { phone: phone.trim() }),
    onSuccess: (data) => {
      setDevCode(data.devCode)
      setStep(2)
      setError(null)
      toast.success('تم إرسال رمز التحقق')
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'تعذر إرسال الرمز — حاول مجددًا'
      setError(msg)
      toast.error(msg)
    },
  })

  const verifyOtp = useMutation({
    mutationFn: () =>
      api.post<{ isNew: boolean; user?: { role?: string } }>('/api/auth/verify-otp', {
        phone: phone.trim(),
        code: code.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    onSuccess: (data) => {
      toast.success(data.isNew ? 'تم إنشاء حسابك — أهلًا بك 🎉' : 'تم تسجيل الدخول — أهلًا بك')
      refresh()
      reset()
      closeLogin()
      // توجيه أدوار الإدارة إلى لوحتها (PLAN ق41)
      if (data.user?.role && data.user.role !== 'CUSTOMER') {
        setTimeout(() => useNav.getState().go('admin-dashboard'), 300)
      }
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'رمز غير صحيح'
      if (msg.includes('الاسم')) setNeedsName(true)
      setError(msg)
      toast.error(msg)
    },
  })

  const submitStep1 = () => {
    setError(null)
    if (!/^7\d{8}$/.test(phone.trim())) {
      setError('رقم الهاتف يجب أن يبدأ بـ 7 ويكون 9 أرقام (شبكات اليمن)')
      return
    }
    requestOtp.mutate()
  }

  const submitStep2 = () => {
    setError(null)
    if (code.trim().length !== 6) {
      setError('رمز التحقق 6 أرقام')
      return
    }
    if (needsName && name.trim().length < 2) {
      setError('أدخل اسمك لإكمال التسجيل')
      return
    }
    verifyOtp.mutate()
  }

  return (
    <Dialog open={loginOpen} onOpenChange={(open) => { if (!open) { reset(); closeLogin() } }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-xl dark:bg-emerald-950" aria-hidden>
              🛍️
            </span>
            دخول متجر الأصيل
          </DialogTitle>
          <DialogDescription>
            {loginReason ? loginReason : 'سجّل الدخول برقم هاتفك لمتابعة الطلبات والعناوين والمفضلة'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="login-phone"
                  dir="ltr"
                  inputMode="numeric"
                  autoFocus
                  className="min-h-11 ps-9 text-start"
                  placeholder="7xxxxxxxx"
                  value={phone}
                  maxLength={9}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              <p className="text-xs text-muted-foreground">يبدأ برقم 7 — 9 خانات (شبكات اليمن)</p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={submitStep1}
              disabled={requestOtp.isPending}
              className="min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              {requestOtp.isPending ? 'جارِ الإرسال...' : 'إرسال رمز التحقق'}
              <Smartphone className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* وضع تجريبي: عرض الكود بوضوح */}
            {devCode && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <KeyRound className="size-4" aria-hidden />
                <AlertTitle>وضع تجريبي — رمز الدخول</AlertTitle>
                <AlertDescription className="text-base font-bold tracking-widest" dir="ltr">
                  {devCode}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="login-code">رمز التحقق (6 أرقام)</Label>
              <Input
                id="login-code"
                dir="ltr"
                inputMode="numeric"
                autoFocus
                className="min-h-11 text-center text-lg font-bold tracking-widest"
                placeholder="______"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>

            {(needsName || name.trim().length > 0) && (
              <div className="space-y-1.5">
                <Label htmlFor="login-name">الاسم (للتسجيل الجديد)</Label>
                <Input
                  id="login-name"
                  ref={nameRef}
                  className="min-h-11"
                  placeholder="اسمك الكامل"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            {!needsName && name.trim().length === 0 && (
              <button
                type="button"
                className="text-xs font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                onClick={() => setNeedsName(true)}
              >
                عميل جديد؟ أضف اسمك مع الرمز
              </button>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={submitStep2}
              disabled={verifyOtp.isPending}
              className="min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              {verifyOtp.isPending ? 'جارِ التحقق...' : 'تأكيد الدخول'}
            </Button>
            <Button variant="ghost" className="min-h-11 w-full" onClick={() => setStep(1)} disabled={verifyOtp.isPending}>
              تغيير رقم الهاتف
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

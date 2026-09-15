'use client'

import { useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Share, Plus, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useInstallPrompt } from '@/lib/client/use-install-prompt'

// ============================================================
// شريط تثبيت التطبيق — يظهر على الهاتف (فوق الشريط السفلي)
// عند إتاحة التثبيت أو على iOS مع حوار تعليمات سريعة
// ============================================================

const DISMISS_KEY = 'qtb-install-dismissed'

function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getStoredDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallBanner() {
  const { canInstall, isStandalone, isIOS, install } = useInstallPrompt()
  const storedDismissed = useSyncExternalStore(
    subscribeStorage,
    getStoredDismissed,
    // SSR: مخفي حتى الترطيب
    () => true
  )
  const [locallyDismissed, setLocallyDismissed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const dismissed = locallyDismissed || storedDismissed

  if (isStandalone || dismissed) return null
  // لا نعرض الشريط إلا حين يكون التثبيت ممكنًا فعلاً (حدث المتصفح) أو على iOS
  if (!canInstall && !isIOS) return null

  const onDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* تجاهل */
    }
    setLocallyDismissed(true)
  }

  const onInstall = async () => {
    if (canInstall) {
      const outcome = await install()
      if (outcome === 'accepted') toast.success('جارِ تثبيت التطبيق…')
      else if (outcome === 'dismissed') onDismiss()
    } else {
      setHelpOpen(true)
    }
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 lg:hidden"
          role="complementary"
          aria-label="تثبيت التطبيق"
        >
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-xl shadow-emerald-900/10">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white" aria-hidden>
              <Smartphone className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">ثبّت التطبيق على هاتفك</p>
              <p className="truncate text-xs text-muted-foreground">وصول أسرع ويعمل حتى بلا إنترنت</p>
            </div>
            <Button
              size="sm"
              className="h-9 rounded-xl bg-emerald-700 px-4 font-bold hover:bg-emerald-800"
              onClick={onInstall}
            >
              تثبيت
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="إخفاء شريط التثبيت"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="pointer-events-none size-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تثبيت التطبيق على iPhone</DialogTitle>
            <DialogDescription>ثلاث خطوات فقط لتصبح واجهة المتجر تطبيقًا كاملاً على هاتفك:</DialogDescription>
          </DialogHeader>
          <ol className="space-y-4">
            <li className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">1</span>
              <div className="flex min-w-0 items-center gap-2 text-sm">
                اضغط زر المشاركة
                <span className="inline-flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs font-semibold">
                  <Share className="size-3.5" aria-hidden /> مشاركة
                </span>
                في شريط سفاري السفلي
              </div>
            </li>
            <li className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">2</span>
              <div className="flex min-w-0 items-center gap-2 text-sm">
                اختر
                <span className="inline-flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs font-semibold">
                  <Plus className="size-3.5" aria-hidden /> إضافة إلى الشاشة الرئيسية
                </span>
              </div>
            </li>
            <li className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">3</span>
              <div className="text-sm">افتح «متجر الأصيل» من الشاشة الرئيسية — بلا متصفح وبلا إنترنت</div>
            </li>
          </ol>
          <Button className="w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800" onClick={() => setHelpOpen(false)}>
            فهمت، شكرًا
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
